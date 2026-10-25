import { describe, expect, it } from 'vitest';
import { deepClone } from './index';

describe('deepClone', () => {
  it('returns primitives as they are', () => {
    const sym = Symbol('s');
    for (const v of [1, 'a', true, null, undefined, sym, 10n]) expect(deepClone(v)).toBe(v);
  });

  it('deep-copies nested objects and arrays', () => {
    const original = { a: 1, nested: { list: [1, { deep: true }] } };
    const copy = deepClone(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.nested).not.toBe(original.nested);
    expect(copy.nested.list[1]).not.toBe(original.nested.list[1]);
    (copy.nested.list[1] as { deep: boolean }).deep = false;
    expect((original.nested.list[1] as { deep: boolean }).deep).toBe(true);
  });

  it('keeps functions by reference', () => {
    const fn = () => 1;
    expect(deepClone({ fn }).fn).toBe(fn);
  });

  it('handles circular references', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    a.list = [a];
    const copy = deepClone(a);
    expect(copy).not.toBe(a);
    expect(copy.self).toBe(copy);
    expect((copy.list as unknown[])[0]).toBe(copy);
  });

  it('keeps shared references shared', () => {
    const shared = { n: 1 };
    const copy = deepClone({ x: shared, y: shared });
    expect(copy.x).toBe(copy.y);
    expect(copy.x).not.toBe(shared);
  });

  it('copies Date and RegExp (flags and lastIndex)', () => {
    const date = new Date('2024-01-02T03:04:05Z');
    const re = /ab+c/gi;
    re.lastIndex = 3;
    const copy = deepClone({ date, re });
    expect(copy.date).not.toBe(date);
    expect(copy.date).toBeInstanceOf(Date);
    expect(copy.date.getTime()).toBe(date.getTime());
    expect(copy.re).not.toBe(re);
    expect(copy.re.source).toBe('ab+c');
    expect(copy.re.flags).toBe('gi');
    expect(copy.re.lastIndex).toBe(3);
  });

  it('copies Map: same keys, cloned values, self-references', () => {
    const key = { id: 1 };
    const value = { name: 'v' };
    const map = new Map<unknown, unknown>([[key, value]]);
    map.set('me', map);
    const copy = deepClone(map);
    expect(copy).not.toBe(map);
    expect([...copy.keys()][0]).toBe(key);
    expect(copy.get(key)).toEqual(value);
    expect(copy.get(key)).not.toBe(value);
    expect(copy.get('me')).toBe(copy);
  });

  it('copies Set with cloned values', () => {
    const item = { a: 1 };
    const copy = deepClone(new Set([1, item]));
    expect(copy.size).toBe(2);
    expect(copy.has(1)).toBe(true);
    const cloned = [...copy][1] as { a: number };
    expect(cloned).toEqual(item);
    expect(cloned).not.toBe(item);
  });

  it('keeps array length and holes', () => {
    // eslint-disable-next-line no-sparse-arrays
    const sparse = [1, , 3];
    sparse.length = 5;
    const copy = deepClone(sparse);
    expect(copy).toHaveLength(5);
    expect(1 in copy).toBe(false);
    expect(4 in copy).toBe(false);
    expect(copy[2]).toBe(3);
    expect(Array.isArray(copy)).toBe(true);
  });

  it('keeps prototypes: class instances keep their methods', () => {
    class Point {
      constructor(
        public x: number,
        public y: number,
      ) {}
      length() {
        return Math.hypot(this.x, this.y);
      }
    }
    const copy = deepClone({ p: new Point(3, 4) });
    expect(copy.p).toBeInstanceOf(Point);
    expect(copy.p.length()).toBe(5);
    const bare = Object.create(null) as Record<string, number>;
    bare.a = 1;
    const bareCopy = deepClone(bare);
    expect(Object.getPrototypeOf(bareCopy)).toBeNull();
    expect(bareCopy.a).toBe(1);
  });

  it('copies own enumerable symbol keys but not non-enumerable properties', () => {
    const sym = Symbol('id');
    const obj: Record<PropertyKey, unknown> = { [sym]: { v: 1 }, visible: 1 };
    Object.defineProperty(obj, 'hidden', { value: 2, enumerable: false });
    const copy = deepClone(obj);
    expect(copy[sym]).toEqual({ v: 1 });
    expect(copy[sym]).not.toBe(obj[sym]);
    expect(copy.visible).toBe(1);
    expect('hidden' in copy).toBe(false);
  });
});
