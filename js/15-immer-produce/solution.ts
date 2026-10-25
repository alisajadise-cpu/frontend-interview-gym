export type Recipe<T> = (draft: T) => T | void | undefined;

type Obj = Record<PropertyKey, any>;

type State = {
  base: Obj;
  copy: Obj | null; // shallow copy, created on first write OR first nested read
  modified: boolean; // true only if this object (or something inside it) really changed
  parent: State | null;
  proxy: Obj;
  revoke: () => void;
};

const STATE = Symbol('draft-state');

function isPlainObject(v: unknown): v is Obj {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Only plain objects and arrays get drafts. Map, Set, Date, class instances are returned as-is. */
function isDraftable(v: unknown): v is Obj {
  return Array.isArray(v) || isPlainObject(v);
}

function stateOf(v: unknown): State | undefined {
  return v !== null && typeof v === 'object' ? (v as Obj)[STATE] : undefined;
}

const latest = (s: State) => s.copy ?? s.base;

function shallowCopy(v: Obj): Obj {
  return Array.isArray(v) ? v.slice() : Object.assign(Object.create(Object.getPrototypeOf(v)), v);
}

function prepareCopy(s: State) {
  if (!s.copy) s.copy = shallowCopy(s.base);
}

function markChanged(s: State) {
  for (let x: State | null = s; x && !x.modified; x = x.parent) {
    x.modified = true;
    prepareCopy(x);
  }
}

export function produce<T>(base: T, recipe: Recipe<T>): T {
  if (!isDraftable(base)) {
    // Primitives and non-draftables: nothing to proxy.
    const r = recipe(base);
    return r === undefined ? base : (r as T);
  }

  const drafts: State[] = [];

  function createDraft(value: Obj, parent: State | null): Obj {
    const state = { base: value, copy: null, modified: false, parent } as unknown as State;
    // An array target keeps Array.isArray(draft) === true.
    const target: Obj = Array.isArray(value) ? [] : {};
    const { proxy, revoke } = Proxy.revocable(target, handler(state));
    state.proxy = proxy;
    state.revoke = revoke;
    drafts.push(state);
    return proxy;
  }

  function handler(state: State): ProxyHandler<Obj> {
    return {
      get(_, prop) {
        if (prop === STATE) return state;
        const source = latest(state);
        const value = Reflect.get(source, prop, state.proxy);
        if (!Object.prototype.hasOwnProperty.call(source, prop)) return value; // methods, length via proto
        if (!isDraftable(value) || stateOf(value)) return value;
        // Only draft ORIGINAL children. Newly assigned objects are already "ours".
        if (value !== state.base[prop as any]) return value;
        prepareCopy(state);
        const child = createDraft(value, state);
        state.copy![prop as any] = child; // next read returns the same draft
        return child;
      },
      set(_, prop, value) {
        const source = latest(state);
        if (!state.modified) {
          const current = source[prop as any];
          const sameDraft = stateOf(value) && stateOf(value)!.base === state.base[prop as any] && !stateOf(value)!.modified;
          if ((Object.is(current, value) && (value !== undefined || prop in source)) || (stateOf(current) === stateOf(value) && sameDraft)) {
            return true; // assigning the same value is not a change
          }
        }
        markChanged(state);
        state.copy![prop as any] = value;
        return true;
      },
      deleteProperty(_, prop) {
        if (!(prop in latest(state))) return true;
        markChanged(state);
        delete state.copy![prop as any];
        return true;
      },
      has(_, prop) {
        return prop in latest(state);
      },
      ownKeys() {
        return Reflect.ownKeys(latest(state));
      },
      getOwnPropertyDescriptor(target, prop) {
        const source = latest(state);
        const desc = Reflect.getOwnPropertyDescriptor(source, prop);
        if (!desc) return undefined;
        // Proxy invariant: only the array target's own `length` may be non-configurable.
        const nonConfigurable = Array.isArray(target) && prop === 'length';
        return { ...desc, writable: true, configurable: !nonConfigurable, value: (state.proxy as Obj)[prop as any] };
      },
      getPrototypeOf() {
        return Object.getPrototypeOf(state.base);
      },
      defineProperty() {
        throw new TypeError('produce: defineProperty on a draft is not supported');
      },
      setPrototypeOf() {
        throw new TypeError('produce: setPrototypeOf on a draft is not supported');
      },
    };
  }

  /** Turn a draft into its final value. Unmodified drafts return their base: structural sharing. */
  function finalize(value: unknown): unknown {
    const state = stateOf(value);
    if (state) {
      if (!state.modified) return state.base;
      const copy = state.copy!;
      for (const key of Reflect.ownKeys(copy)) {
        if (key === 'length' && Array.isArray(copy)) continue;
        copy[key as any] = finalize(copy[key as any]);
      }
      return copy;
    }
    // A brand-new object (e.g. `draft.list = [draft.a]`) may contain drafts inside.
    if (isDraftable(value)) {
      for (const key of Reflect.ownKeys(value)) {
        if (key === 'length' && Array.isArray(value)) continue;
        const v = value[key as any];
        if (v !== null && typeof v === 'object') value[key as any] = finalize(v);
      }
    }
    return value;
  }

  const rootDraft = createDraft(base, null);
  try {
    const returned = recipe(rootDraft as T);
    const rootState = stateOf(rootDraft)!;
    if (returned !== undefined && returned !== rootDraft) {
      if (rootState.modified) {
        throw new Error('produce: the recipe returned a new value AND modified the draft. Do one or the other.');
      }
      return finalize(returned) as T;
    }
    return finalize(rootDraft) as T;
  } finally {
    // Any later use of a draft throws a TypeError ("revoked proxy").
    for (const d of drafts) d.revoke();
  }
}
