export function deepClone<T>(value: T): T {
  // Maps every original object to its copy: handles cycles AND shared references.
  return clone(value, new WeakMap()) as T;
}

function clone(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') return value; // primitives and functions
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) {
    const copy = new Date(value.getTime());
    seen.set(value, copy);
    return copy;
  }

  if (value instanceof RegExp) {
    const copy = new RegExp(value.source, value.flags);
    copy.lastIndex = value.lastIndex;
    seen.set(value, copy);
    return copy;
  }

  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy); // register BEFORE recursing, so self-references resolve
    value.forEach((v, k) => copy.set(k, clone(v, seen)));
    return copy;
  }

  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    value.forEach((v) => copy.add(clone(v, seen)));
    return copy;
  }

  // Arrays: `new Array(length)` keeps holes; copying own keys skips them.
  const copy: Record<PropertyKey, unknown> = Array.isArray(value)
    ? (new Array(value.length) as unknown as Record<PropertyKey, unknown>)
    : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);

  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue;
    copy[key] = clone((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return copy;
}
