# 15 · Immer's `produce` (copy-on-write with Proxy)

**Difficulty:** Very hard · **Time:** 60 min · **Similar to:** GreatFrontEnd *Immer*, *Immutability Utilities*, *Object Update*. The real library: `immer` (used inside Redux Toolkit).

## Why companies ask this

React and Redux need **immutable** updates: you return a new object instead of changing the old one. Writing `{ ...state, todos: state.todos.map(...) }` by hand gets painful for deep data. Immer lets you write normal mutations on a **draft** and builds the new immutable state for you. It does this with **structural sharing**: unchanged parts keep their identity, so `React.memo` and selectors still work.

This tests `Proxy`, recursion, lazy work, and a real understanding of why reference identity matters in React.

## Task

Implement `produce(base, recipe)` in `index.ts`.

```ts
const next = produce(state, (draft) => {
  draft.todos[1].done = true;          // looks like a mutation…
  draft.todos.push({ id: 4, title: 'new', done: false, tags: [] });
});
// …but `state` is untouched, and:
next.todos[0] === state.todos[0];       // true: unchanged items are shared
next.user === state.user;               // true
```

## Requirements

1. The recipe gets a **draft** (a `Proxy`). Reads look exactly like the base. Writes never touch the base.
2. **Copy-on-write:** an object is copied (shallowly) only when it, or something inside it, changes. Then its parents up to the root are copied too.
3. **Structural sharing:** everything that didn't change keeps its identity (`===`) in the result.
4. If nothing changed, `produce` returns the **original** `base` (same reference). Reading nested data doesn't count as a change. Assigning the same value (`draft.a = draft.a`, or `draft.name = 'Ali'` when it's already `'Ali'`) doesn't count either.
5. Support nested plain objects and arrays: property set, `delete`, and array methods (`push`, `pop`, `splice`, index assignment, `length = 0`, `filter` + reassign, …). Inside the recipe, `Array.isArray(draft.list)` is `true`, and `Object.keys` / `JSON.stringify` work.
6. Moving a draft to another place (`const [x] = d.todos.splice(0, 1); d.todos.push(x)`) puts the **final value** there. An unmodified item stays `===` to the original.
7. The recipe may **return a new value** instead of mutating. Then that value is the result (drafts inside it are finalized too). Returning `undefined` (or the draft itself) means "use the draft".
8. Returning a new value **and** modifying the draft throws an `Error` whose message contains `new value`.
9. After `produce` returns, any use of a draft (for example one saved in an outer variable) throws a `TypeError`. Hint: `Proxy.revocable`.
10. The result is **not** frozen (immer freezes by default: see the follow-ups). Only plain objects and arrays are drafted. `Map`, `Set`, `Date` and class instances are left as-is.

## Edge cases interviewers probe

- Reading `draft.a.b` twice must return the **same** child draft. Otherwise writes through the first one are lost.
- `Array.prototype.splice` on a proxy goes through your `get`/`set`/`deleteProperty`/`has` traps, with `this` set to the proxy. Your traps must handle `length`.
- Proxy invariants: for an array draft, `getOwnPropertyDescriptor(target, 'length')` must stay non-configurable. Learn why the target object matters.
- Why only draft **original** children? Newly assigned objects belong to you already.

## Follow-ups

- **Auto-freeze:** immer deep-freezes the result in development. Why? (It catches accidental mutation of state.) What does it cost?
- **Patches:** `produceWithPatches` returns `[next, patches, inversePatches]`. How would you record them? (It's great for undo/redo, see `js/14`, and for sending small diffs over a WebSocket.)
- Map/Set support: how would you draft a `Map`?
- Performance: when is spreading by hand faster than immer? (Hot paths with thousands of updates per second.)

## Run

```bash
npm test js/15-immer-produce
npm run test:solution js/15-immer-produce
```
