export function deepEqual(a: unknown, b: unknown): boolean {
  return equal(a, b, new Map());
}

/** SameValueZero: like ===, but NaN equals NaN. */
function sameValueZero(a: unknown, b: unknown): boolean {
  return a === b || (a !== a && b !== b);
}

type Seen = Map<object, Set<object>>;

function equal(a: unknown, b: unknown, seen: Seen): boolean {
  if (sameValueZero(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  // Cycle guard: if we are already comparing this exact pair higher up the stack,
  // assume equal. If anything else differs, that branch will return false.
  // The pair is removed when its comparison finishes, so a FAILED attempt
  // (e.g. trying Set candidates) can never be mistaken for "equal" later.
  let partners = seen.get(a);
  if (partners?.has(b)) return true;
  if (!partners) seen.set(a, (partners = new Set()));
  partners.add(b);
  try {
    return compareObjects(a, b, seen);
  } finally {
    partners.delete(b);
  }
}

function compareObjects(a: object, b: object, seen: Seen): boolean {
  if (a instanceof Date) return sameValueZero(a.getTime(), (b as Date).getTime());
  if (a instanceof RegExp) return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags;

  if (a instanceof Map) {
    const mb = b as Map<unknown, unknown>;
    if (a.size !== mb.size) return false;
    for (const [key, value] of a) {
      if (!mb.has(key) || !equal(value, mb.get(key), seen)) return false;
    }
    return true;
  }

  if (a instanceof Set) {
    const sb = b as Set<unknown>;
    if (a.size !== sb.size) return false;
    const unmatched = [...sb].filter((x) => typeof x === 'object' && x !== null);
    for (const value of a) {
      if (sb.has(value)) continue;
      if (typeof value !== 'object' || value === null) return false;
      const index = unmatched.findIndex((candidate) => equal(value, candidate, seen));
      if (index === -1) return false;
      unmatched.splice(index, 1); // each member of b may match only once
    }
    return true;
  }

  if (Array.isArray(a)) {
    const ab = b as unknown[];
    if (a.length !== ab.length) return false;
    for (let i = 0; i < a.length; i++) if (!equal(a[i], ab[i], seen)) return false;
    return true;
  }

  const keysA = ownEnumerableKeys(a);
  const keysB = ownEnumerableKeys(b);
  if (keysA.length !== keysB.length) return false;
  const setB = new Set(keysB);
  for (const key of keysA) {
    if (!setB.has(key)) return false;
    if (!equal((a as Record<PropertyKey, unknown>)[key], (b as Record<PropertyKey, unknown>)[key], seen)) return false;
  }
  return true;
}

function ownEnumerableKeys(o: object): PropertyKey[] {
  return Reflect.ownKeys(o).filter((k) => Object.prototype.propertyIsEnumerable.call(o, k));
}
