# 07 · Deep equal (Map, Set, Date, prototypes, cycles)

**Difficulty:** Hard · **Time:** 30–40 min · **Similar to:** GreatFrontEnd *Deep Equal*, LeetCode 2628 *JSON Deep Equal*, `lodash.isEqual`, React Query's `structuralSharing`

## Why companies ask this

`React.memo` with a custom compare, "did the form change?" checks, test assertions (`toEqual`), and cache keys all depend on deep equality. The JSON version is easy. A senior version must handle `NaN`, `Map`/`Set`, dates, different prototypes, and **circular** structures without a stack overflow.

## Task

Implement `deepEqual(a, b)` in `index.ts`.

```ts
deepEqual({ a: [1, { b: NaN }] }, { a: [1, { b: NaN }] }); // true
deepEqual(new Set([{ id: 1 }]), new Set([{ id: 1 }]));     // true
deepEqual({ a: undefined }, {});                            // false
```

## Requirements

1. **Primitives:** SameValueZero. `NaN` equals `NaN`, `+0` equals `-0`, `1` doesn't equal `'1'`, and `null` doesn't equal `undefined`.
2. Functions and symbols are equal only if they're the same reference.
3. Two objects must have the **same prototype**. A class instance is not equal to a plain object with the same fields, and `['a']` is not equal to `{ 0: 'a', length: 1 }`.
4. **Arrays:** same length, and every index deep-equal.
5. **Plain objects:** the same set of **own enumerable** keys (string *and* symbol keys), with deep-equal values. Key order doesn't matter. `{ a: undefined }` is **not** equal to `{}`.
6. **Date:** the same time value (two invalid dates are equal). **RegExp:** the same `source` and `flags`.
7. **Map:** same size, keys matched with SameValueZero (`b.has(key)`), and deep-equal values.
8. **Set:** same size. Each primitive member must be in the other set. Each object member must deep-equal a **different, not yet matched** member of the other set.
9. **Circular structures** must not overflow the stack. If two structures have cycles of the same shape, they're equal.

## Edge cases interviewers probe

- `new Set([{a:1},{a:1}])` vs `new Set([{a:1},{a:2}])` → false. Each member can match only once.
- `deepEqual(a, b)` where `a.self = a` and `b.self = b`.
- Performance: comparing the same pair twice in a big graph.

## Follow-ups

- How would you return the **path** of the first difference (`"user.tags[2].name"`) for a test failure message?
- React's `memo` uses **shallow** equality by default. When is deep equality in render a bad idea?
- How does React Query's "structural sharing" reuse unchanged parts of a new response?

## Run

```bash
npm test js/07-deep-equal
npm run test:solution js/07-deep-equal
```
