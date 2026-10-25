# 08 · Store with selectors (mini Zustand)

**Difficulty:** Hard · **Time:** 45 min · **Similar to:** Zustand `create`, Redux `useSelector`, the React docs for `useSyncExternalStore`

## Why companies ask this

"Why does my whole app re-render when one value in Context changes?" is one of the most common performance problems in React apps. The answer libraries like Zustand and Redux give is an **external store plus selectors**: each component subscribes to the slice it needs and re-renders only when that slice changes. Building one shows you understand `useSyncExternalStore`, referential equality, and why `getSnapshot` must be cached.

## Task

Implement `createStore`, `useStore` and `shallow` in `index.tsx`.

```tsx
const store = createStore<State>((set, get) => ({
  count: 0,
  name: 'Ali',
  increment: () => set({ count: get().count + 1 }),
  rename: (name) => set((s) => ({ name })),
}));

function Counter() {
  const count = useStore(store, (s) => s.count);          // re-renders only when count changes
  const increment = useStore(store, (s) => s.increment);
  return <button onClick={increment}>{count}</button>;
}

function Summary() {
  // A new object every time → needs `shallow`, or it would loop forever
  const { count, name } = useStore(store, (s) => ({ count: s.count, name: s.name }), shallow);
}
```

## Requirements

**`createStore(initializer)`** returns `{ getState, setState, subscribe }`.
1. `initializer(set, get)` returns the initial state. It can include actions that call `set`/`get`.
2. `setState(partial)` **merges** into a **new** state object. The old state object is never mutated.
3. `setState(updater)` accepts `(state) => partial`.
4. `setState(next, true)` **replaces** the whole state.
5. If the updater returns the same state object (`Object.is`), nothing changes and nobody is notified.
6. `subscribe(listener)` calls `listener(state, prevState)` after every change and returns an unsubscribe function.
7. A listener may unsubscribe itself or others during notification without breaking the loop.

**`shallow(a, b)`**
8. `true` if `Object.is(a, b)`, or both are objects/arrays with the same keys whose values are `Object.is`-equal. **One level only**, not deep.

**`useStore(store, selector, equalityFn = Object.is)`**
9. Built on `useSyncExternalStore`.
10. A component re-renders **only** when its selected value changes according to `equalityFn`.
11. Selectors that return a new object each time must work with `shallow` **without an infinite loop**. Cache the last snapshot.
12. Selectors that depend on props (`s => s.users[id]`) use the **latest** selector.
13. Unsubscribe on unmount.

## Edge cases interviewers probe

- Why does `useSyncExternalStore(subscribe, () => ({ a: s.a }))` crash with "getSnapshot should be cached"?
- Why is `subscribe` wrapped in `useCallback`? What happens if it changes every render? (React unsubscribes and subscribes again on every render.)
- Tearing: with `useState` + `useEffect` subscriptions, two components can show different versions of the store in the same concurrent render. How does `useSyncExternalStore` prevent that?
- Selecting an action (`s => s.increment`) never causes a re-render. Why?

## Follow-ups

- Middleware: how would you add `persist` (localStorage) or `devtools` without changing `createStore`?
- Compare with Context + `useReducer`. When is Context fine, and when do you need a store?
- How does React-Redux `useSelector` avoid "zombie children" (a child reading a deleted item before its parent re-renders)?
- SSR: one store per request, not a module singleton. Why? (Data leaking between users.)
- Derived/computed values: memoized selectors (`reselect`) vs computing in the selector.

## Run

```bash
npm test react/08-store-selector
npm run test:solution react/08-store-selector
npm run dev   # then open "react / 08-store-selector"
```
