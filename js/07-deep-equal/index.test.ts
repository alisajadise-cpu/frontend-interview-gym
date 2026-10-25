import { describe, expect, it } from 'vitest';
import { deepEqual } from './index';

describe('deepEqual: primitives', () => {
  it('uses SameValueZero', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(0, -0)).toBe(true);
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });

  it('compares functions and symbols by reference', () => {
    const f = () => 1;
    expect(deepEqual(f, f)).toBe(true);
    expect(deepEqual(f, () => 1)).toBe(false);
    expect(deepEqual(Symbol('x'), Symbol('x'))).toBe(false);
  });
});

describe('deepEqual: objects and arrays', () => {
  it('compares nested structures, ignoring key order', () => {
    expect(deepEqual({ a: 1, b: [1, { c: NaN }] }, { b: [1, { c: NaN }], a: 1 })).toBe(true);
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { a: 1, b: [1, { c: 3 }] })).toBe(false);
  });

  it('treats a missing key and an undefined value as different', () => {
    expect(deepEqual({ a: undefined }, {})).toBe(false);
    expect(deepEqual({}, { a: undefined })).toBe(false);
    expect(deepEqual({ a: undefined, b: 1 }, { b: 1, c: undefined })).toBe(false);
  });

  it('compares arrays by length and index', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('requires the same prototype', () => {
    class User {
      constructor(public name: string) {}
    }
    expect(deepEqual(new User('a'), { name: 'a' })).toBe(false);
    expect(deepEqual(new User('a'), new User('a'))).toBe(true);
    expect(deepEqual(['a'], { 0: 'a', length: 1 })).toBe(false);
  });

  it('compares own enumerable symbol keys', () => {
    const s = Symbol('s');
    expect(deepEqual({ [s]: 1 }, { [s]: 1 })).toBe(true);
    expect(deepEqual({ [s]: 1 }, { [s]: 2 })).toBe(false);
    expect(deepEqual({ [s]: 1 }, {})).toBe(false);
  });
});

describe('deepEqual: built-ins', () => {
  it('compares Date and RegExp', () => {
    expect(deepEqual(new Date(5), new Date(5))).toBe(true);
    expect(deepEqual(new Date(5), new Date(6))).toBe(false);
    expect(deepEqual(new Date('bad'), new Date('worse'))).toBe(true);
    expect(deepEqual(/a+/g, /a+/g)).toBe(true);
    expect(deepEqual(/a+/g, /a+/i)).toBe(false);
    expect(deepEqual(new Date(5), { getTime: () => 5 })).toBe(false);
  });

  it('compares Map keys by SameValueZero and values deeply', () => {
    expect(deepEqual(new Map([[NaN, { a: 1 }]]), new Map([[NaN, { a: 1 }]]))).toBe(true);
    expect(deepEqual(new Map([['k', { a: 1 }]]), new Map([['k', { a: 2 }]]))).toBe(false);
    expect(deepEqual(new Map([[{ id: 1 }, 'x']]), new Map([[{ id: 1 }, 'x']]))).toBe(false); // different key objects
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 1], ['b', 2]]))).toBe(false);
  });

  it('compares Set members, matching each object member only once', () => {
    expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(deepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
    expect(deepEqual(new Set([{ id: 1 }, { id: 2 }]), new Set([{ id: 2 }, { id: 1 }]))).toBe(true);
    expect(deepEqual(new Set([{ a: 1 }, { a: 1 }]), new Set([{ a: 1 }, { a: 2 }]))).toBe(false);
  });
});

describe('deepEqual: cycles', () => {
  it('handles circular structures of the same shape', () => {
    const a: Record<string, unknown> = { name: 'x' };
    a.self = a;
    const b: Record<string, unknown> = { name: 'x' };
    b.self = b;
    expect(deepEqual(a, b)).toBe(true);
  });

  it('detects differences inside cycles', () => {
    const a: Record<string, unknown> = { name: 'x', list: [] as unknown[] };
    (a.list as unknown[]).push(a);
    const b: Record<string, unknown> = { name: 'y', list: [] as unknown[] };
    (b.list as unknown[]).push(b);
    expect(deepEqual(a, b)).toBe(false);
  });

  it('handles mutual references (a ↔ b)', () => {
    const p1: Record<string, unknown> = { id: 1 };
    const c1: Record<string, unknown> = { id: 2, parent: p1 };
    p1.child = c1;
    const p2: Record<string, unknown> = { id: 1 };
    const c2: Record<string, unknown> = { id: 2, parent: p2 };
    p2.child = c2;
    expect(deepEqual(p1, p2)).toBe(true);
    c2.id = 3;
    expect(deepEqual(p1, p2)).toBe(false);
  });
});

describe('deepEqual: failed attempts are not remembered', () => {
  it('a Set candidate that did not match is not treated as equal later', () => {
    const x = { v: 1 };
    const w = { v: 2 };
    const y = { v: 2 };
    const w2 = { v: 1 };
    // Matching the sets tries x against y first (fails), then x against w2 (ok).
    // Comparing x with y again afterwards must still be false.
    expect(deepEqual([new Set([x, w]), x], [new Set([y, w2]), y])).toBe(false);
  });
});
