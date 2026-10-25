import { useCallback, useRef, useSyncExternalStore } from 'react';

export type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
export type GetState<T> = () => T;
export type Listener<T> = (state: T, prevState: T) => void;

export type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: Listener<T>) => () => void;
};

export function createStore<T extends object>(initializer: (set: SetState<T>, get: GetState<T>) => T): StoreApi<T> {
  let state: T;
  const listeners = new Set<Listener<T>>();

  const getState: GetState<T> = () => state;

  const setState: SetState<T> = (partial, replace = false) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    // Updater returned the same state: nothing changed, notify nobody.
    if (Object.is(next, state)) return;
    const prev = state;
    // Always a NEW object, so subscribers can compare references.
    state = replace ? (next as T) : { ...state, ...next };
    // Copy first: a listener may unsubscribe (or subscribe) while we loop.
    [...listeners].forEach((l) => l(state, prev));
  };

  const subscribe = (listener: Listener<T>) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  state = initializer(setState, getState);
  return { getState, setState, subscribe };
}

/** Compares the top level only: same keys and Object.is-equal values. Works for objects, arrays, Maps and Sets. */
export function shallow<A>(a: A, b: A): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !Object.is(v, b.get(k))) return false;
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every(
    (k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is((a as any)[k], (b as any)[k]),
  );
}

export function useStore<T extends object, S>(
  store: StoreApi<T>,
  selector: (state: T) => S,
  equalityFn: (a: S, b: S) => boolean = Object.is,
): S {
  // Cache of the last result. useSyncExternalStore calls getSnapshot many times and
  // requires the SAME value while nothing changed. Without this cache a selector like
  // `s => ({ a: s.a })` would return a new object every call and loop forever.
  const cache = useRef<{ state: T; selector: (s: T) => S; selection: S } | null>(null);

  const getSelection = () => {
    const state = store.getState();
    const prev = cache.current;
    if (prev && prev.state === state && prev.selector === selector) return prev.selection;
    const next = selector(state);
    // Same "value" by the equality function: keep the old reference -> no re-render.
    const selection = prev && equalityFn(prev.selection, next) ? prev.selection : next;
    cache.current = { state, selector, selection };
    return selection;
  };

  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);

  return useSyncExternalStore(subscribe, getSelection, getSelection);
}
