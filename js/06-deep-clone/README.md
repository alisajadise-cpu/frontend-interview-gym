# 06 · Deep clone (circular refs, Map/Set, classes, symbols)

**Difficulty:** Hard · **Time:** 30–40 min · **Similar to:** GreatFrontEnd *Deep Clone* and *Deep Clone II*, `lodash.cloneDeep`, `structuredClone`

## Why companies ask this

Undo/redo snapshots, "duplicate this item", form drafts, and Redux-style state copies all need a real deep copy. `JSON.parse(JSON.stringify(x))` breaks on dates, `Map`, `Set`, `undefined`, class instances, and **crashes on circular references**. Interviewers want to see the `WeakMap` "seen" trick, correct handling of built-in types, and a conscious decision about prototypes.

## Task

Implement `deepClone(value)` in `index.ts`.

```ts
const a: any = { when: new Date(), tags: new Set(['x']), byId: new Map([[1, { n: 1 }]]) };
a.self = a;
const b = deepClone(a);
b.self === b;                         // true: the cycle is kept, pointing to the copy
b.byId.get(1) !== a.byId.get(1);      // true: values are deep copies
```

## Requirements

1. Primitives (including `null`, `undefined`, symbols, bigint) are returned as they are.
2. **Functions** are copied by reference (not cloned).
3. Plain objects and arrays are deep-copied. Changing the copy never changes the original.
4. **Circular references** work, and **shared references** stay shared: if the same object appears twice in the input, the same *copy* appears twice in the output.
5. `Date` → a new `Date` with the same time.
6. `RegExp` → a new `RegExp` with the same `source` and `flags`, and the same `lastIndex`.
7. `Map` → a new `Map` with the **same keys** (by reference, like lodash) and deep-cloned **values**. `Set` → a new `Set` with deep-cloned values.
8. Arrays keep their `length` and their **holes** (a sparse array stays sparse).
9. Objects keep their **prototype**: a cloned class instance is still `instanceof` the class and keeps its methods. `Object.create(null)` objects work.
10. Copy **own enumerable** properties, both string keys and **symbol keys**. Non-enumerable properties are not copied.

## Edge cases interviewers probe

- `const x = {}; deepClone({ a: x, b: x })`: is `copy.a === copy.b`?
- A `Map` whose value is the map itself.
- Getters: lodash copies the *value* the getter returns, not the getter itself. What does your version do?

## Follow-ups

- Compare with `structuredClone`: what does it support (Map, Set, Date, cycles, typed arrays, Blob), and what does it **throw** on (functions, DOM nodes)? Does it keep prototypes? (No: class instances become plain objects.)
- How would you support typed arrays, `ArrayBuffer`, and `Error`?
- Very deep objects (100k levels) overflow the stack with recursion. How would you make it iterative?
- For immutable state updates, why is structural sharing (see the Immer exercise) usually better than deep cloning?

## Run

```bash
npm test js/06-deep-clone
npm run test:solution js/06-deep-clone
```
