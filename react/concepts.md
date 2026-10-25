# Senior React concepts: 25 interview questions

Answer each question **out loud** first (aim for 1–2 minutes), then open the answer. A strong senior answer covers three things: **what** happens, **why** React works that way, and **a real bug or trade-off** you've seen. The answers describe React 19.

---

## Rendering model

### 1. What is reconciliation, and how do keys affect it?

<details><summary>Answer</summary>

When state changes, React calls your components to get a new element tree, then compares it with the previous one to decide which DOM changes to make. Rules of the diff:

- **Same type at the same position** → React keeps the instance (state, DOM, refs) and updates its props.
- **Different type** (`<div>` → `<span>`, or `ComponentA` → `ComponentB`) → React unmounts the whole old subtree and mounts a new one. All state is lost.
- **Lists** are matched by `key`, not by position.

Consequences you should mention:
- **Index as key** breaks when the list is reordered, filtered or has items inserted at the start. State (an input's text, a checkbox, focus) stays at the *position* and ends up attached to the wrong item. It's also slower, because every item looks "changed".
- **Changing a key on purpose** resets a component: `<Profile key={userId} />` gives a fresh state per user, with no effect needed to "reset".
- **A component defined inside another component** is a new type on every render, so its subtree remounts every time. (Perf exercise 01 shows exactly this.)
</details>

### 2. What's the difference between the render phase and the commit phase?

<details><summary>Answer</summary>

- **Render phase:** React calls your components and computes the next tree. It must be **pure**: no DOM writes, no subscriptions, no mutations of outside variables. In concurrent rendering this phase can be **interrupted, thrown away, or repeated**, so side effects there run an unpredictable number of times.
- **Commit phase:** React applies the changes to the DOM. Then it runs, in order: ref attachment and `useLayoutEffect` (synchronously, before the browser paints), then `useEffect` (usually after paint).

"Rendering" ≠ "updating the DOM". A component can render and produce exactly the same output, in which case there's no DOM work, but the render itself still costs CPU. That's the difference between "too many renders" and "too many DOM updates".
</details>

### 3. When do `useEffect`, `useLayoutEffect` and `useInsertionEffect` run? When would you use each?

<details><summary>Answer</summary>

- **`useInsertionEffect`** runs during the commit, **before** layout effects. It exists for CSS-in-JS libraries to inject `<style>` tags before anything reads layout. You can't read refs or schedule updates in it. App code almost never uses it.
- **`useLayoutEffect`** runs synchronously after the DOM is updated and **before the browser paints**. Use it when you must **measure** the DOM and change something before the user sees it (tooltip position, auto-height, scroll restore). It blocks paint, so keep it short. Reading layout there forces a synchronous reflow.
- **`useEffect`** usually runs **after paint**. Use it for subscriptions, network requests, logging, and syncing with non-React systems. One detail: if the update came from a **discrete user event** (click, keydown), React flushes those effects synchronously at the end of the commit, so they can run before paint.

Also worth saying: many effects shouldn't exist at all. Derived data belongs in render (or `useMemo`), and responses to user actions belong in event handlers ("You Might Not Need an Effect").
</details>

### 4. What is a stale closure in React, and how do you fix it?

<details><summary>Answer</summary>

Every render creates new functions that "see" the props and state **of that render**. A function stored somewhere and called later (a `useCallback` with missing deps, a `setInterval` callback, an event listener added in an effect with `[]`) keeps seeing **old values**.

Classic bugs:
- `useCallback(() => send(draft), [])` always sends the first `draft` (`''`).
- `setInterval(() => setCount(count + 1), 1000)` in an effect with `[]` stays at 1.

Fixes, best first:
1. **Functional updates:** `setCount(c => c + 1)`. You don't need the value at all.
2. **Correct dependencies** (trust `react-hooks/exhaustive-deps`).
3. **A ref holding the latest value/callback**, updated in a layout effect, when you need a *stable* function that reads *fresh* data (the "latest ref" pattern, `useEffectEvent`-style). React's `useEffectEvent` hook (stable since React 19.2) is made for exactly this case.
</details>

### 5. What does batching mean in React 18/19?

<details><summary>Answer</summary>

Several `setState` calls in the same tick produce **one** re-render. Since React 18 this is **automatic everywhere**: in event handlers, promises, `setTimeout` and native event listeners (React 17 only batched inside React event handlers).

- State updates are queued. Reading state right after `setState` gives the **old** value in that render's closure.
- `flushSync(() => setX(...))` forces a synchronous commit. It's rarely needed, for example to measure the DOM right after an update or before printing.
- In React exercise 10 (optimistic todos), confirming the server data and removing the pending op happen in the same tick, so the user never sees a flicker in between.
</details>

---

## Performance

### 6. When do `memo`, `useMemo` and `useCallback` actually help, and when do they hurt?

<details><summary>Answer</summary>

They help when:
- A computation is **actually expensive** (filtering or sorting thousands of items, heavy formatting) → `useMemo`.
- You pass a value to a **`memo` child** or use it as an **effect dependency**, and a new identity on every render would defeat the memo or re-run the effect → `useMemo`/`useCallback` for referential stability.
- A subtree is expensive and its props rarely change → `memo`.

They hurt or do nothing when:
- The child isn't memoized. Then a stable `useCallback` prop changes nothing.
- One prop is still unstable (`style={{...}}`, `children`, an inline object), so `memo` compares and re-renders anyway, and you pay for both.
- The deps are wrong, which gives stale values: a correctness bug.
- They're everywhere. That adds memory, comparison cost and a lot of noise.

What to try first: **colocate state** (move it down so fewer components re-render), **lift content up** (pass expensive parts as `children`), and then memoize what the Profiler shows is slow. Measure before and after.
</details>

### 7. What does the React Compiler change?

<details><summary>Answer</summary>

The React Compiler (stable since late 2025) is a build-time tool that **auto-memoizes** components and hooks. It analyzes your code and inserts fine-grained caching, so values, callbacks and JSX are reused when their inputs haven't changed. In practice most manual `useMemo`/`useCallback`/`memo` becomes unnecessary.

What it needs from you: code that follows the **Rules of React** (pure render, no mutating props or state, hooks called unconditionally). Code that breaks the rules is skipped (it bails out) instead of being "fixed". The ESLint plugin reports those places.

What it doesn't do: fix slow algorithms, virtualize lists, split bundles, or fix network waterfalls. Expensive work in render is still expensive the first time.
</details>

### 8. Why does Context cause performance problems, and how do you fix them?

<details><summary>Answer</summary>

Every component that reads a context re-renders when the **Provider's `value` changes identity**. There's no selector. Two typical bugs:

1. `value={{ user, setUser }}` creates a new object on every Provider render, so every consumer re-renders even when nothing changed. **Fix:** `useMemo` the value.
2. One big context that mixes fast-changing data (a clock, the mouse position, form input) with slow data (theme, user). **Fix:** split it into several contexts, or put fast data in its own provider, close to where it's used.

For high-frequency or large shared state, use an **external store with selectors** (Zustand, Redux, or your own built on `useSyncExternalStore`, like exercise 08). Each component then subscribes to its own slice. Context is good for **low-frequency, app-wide values** (theme, locale, current user, dependency injection).
</details>

### 9. What is state colocation, and why is it the first performance fix to try?

<details><summary>Answer</summary>

Keep state **as close as possible to the components that use it**. If a text input's value lives in the page component, every keystroke re-renders the whole page. Move it into the small form component, and only that component re-renders. No `memo` needed.

Related techniques:
- **Pass expensive parts as `children`:** `<Layout sidebar={<HeavySidebar/>}>`. When `Layout`'s state changes, the `children` elements are the same objects, so React skips them.
- **Lift state up only when it's needed** (siblings need to share it), and no further.

It also makes the code easier to understand: the state lives next to the code that changes it.
</details>

### 10. Explain `useTransition` and `useDeferredValue`. When do you use each?

<details><summary>Answer</summary>

Both mark some work as **non-urgent** so React can keep urgent updates (typing, clicking) responsive. In concurrent rendering a non-urgent render can be **interrupted** and restarted with newer data.

- **`useTransition`:** you control the **state update**. `startTransition(() => setTab('posts'))`. You get `isPending` to show feedback. Use it when *you* trigger the slow update (tab switch, navigation, applying a filter). In React 19 the function can be **async** (an "Action"): `isPending` stays true until it finishes, and errors go to the nearest error boundary.
- **`useDeferredValue`:** you **receive a value** (often from props or a fast input) and want a lagging copy for the expensive part: `const deferred = useDeferredValue(query)`, and render the big list with `deferred`. The input updates at full speed, and the list catches up when the CPU is free. React 19 added an `initialValue` argument.

Neither one makes the work faster. They change **priority**. The heavy component must also be wrapped in `memo` (or receive stable props), or it re-renders on the urgent update anyway. For real CPU-heavy work, consider a Web Worker or virtualization.
</details>

### 11. What is tearing, and how does `useSyncExternalStore` solve it?

<details><summary>Answer</summary>

**Tearing** is when different parts of the UI show **different versions** of the same data in one frame. In concurrent rendering React can pause halfway through a render. If an external store (Redux, a global variable, `window.location`) changes during the pause, components rendered before and after the change read different values.

`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)`:
- Reads the snapshot during render, and **checks it again before committing**. If it changed, React re-renders **synchronously** so the whole tree is consistent.
- Requires `getSnapshot` to return the **same value** (by `Object.is`) while nothing changed. Returning a new object every time causes an infinite loop. That's why selector-based stores cache the last result (exercise 08).
- `getServerSnapshot` provides the value for SSR and hydration, which avoids hydration mismatches.
</details>

---

## Data, Suspense and the server

### 12. How do Suspense and streaming SSR work together?

<details><summary>Answer</summary>

- **Suspense** lets a component "wait" (for code via `lazy`, for data via a Suspense-enabled framework, or `use(promise)`) while React shows the nearest `<Suspense fallback>`.
- **Streaming SSR** (`renderToPipeableStream` / `renderToReadableStream`, used by Next.js App Router): the server sends the HTML shell immediately with fallbacks in place. When each Suspense boundary's data is ready, it **streams** the HTML for that part along with a small inline script that swaps it in. The user sees content earlier (better TTFB/FCP), and slow parts don't block fast parts.
- **Selective hydration:** React hydrates boundaries independently and **prioritizes the part the user interacts with**. A click on a not-yet-hydrated section bumps its priority.

Design trade-off: **where you place boundaries**. Too few means one slow query blocks the page. Too many means "popcorn" UI, with spinners popping in and out. Group content that should appear together.
</details>

### 13. Server Components vs Client Components: what's the difference, and what does `'use client'` really mean?

<details><summary>Answer</summary>

- **Server Components** (the default in the Next.js App Router) run **only on the server** (at build or request time). They can be `async`, read databases or files directly, and keep secrets. Their code is **never sent to the browser**, so heavy libraries used there add zero bundle size. They **can't** use state, effects, event handlers or browser APIs.
- **Client Components** are regular React components. They're rendered on the server for the initial HTML, then **hydrated** and interactive in the browser.
- **`'use client'`** marks a **module boundary**. That file and everything it imports become part of the client bundle. It doesn't mean "client-only rendering". Put it as **low** in the tree as possible (a `LikeButton`, not the whole page).
- Props passed from Server to Client Components must be **serializable** (no functions except Server Functions, no class instances).
- A Client Component can render Server Components passed as **`children`/props**. That's how you keep most of the tree on the server while wrapping it in an interactive shell.
</details>

### 14. What are Server Functions / Server Actions? What should you watch out for?

<details><summary>Answer</summary>

A function marked with `'use server'` runs on the server, but Client Components can call it like a normal async function. React and the framework turn the call into a POST request. When it's used as a form `action` or inside a transition it's called a **Server Action**: `<form action={createTodo}>` works **even before JavaScript loads** (progressive enhancement).

Watch out:
- It's a **public HTTP endpoint**. Always **authenticate, authorize and validate** inputs on the server. Never trust that "only my UI calls it".
- Arguments and return values must be serializable.
- Frameworks like Next.js run them one after another, so they're not a tool for parallel data fetching. **Read data in Server Components**, and use actions for **mutations**.
- After a mutation, revalidate the cached data (`revalidatePath` / `revalidateTag` in Next.js).
</details>

### 15. What causes hydration errors, and how do you fix them?

<details><summary>Answer</summary>

Hydration means React attaches to server HTML and expects the **first client render to produce exactly the same output**. Common causes of a mismatch:

- Values that differ between server and client: `Date.now()`, `new Date().toLocaleString()` (time zones!), `Math.random()`, generated ids.
- Branches on `typeof window !== 'undefined'`, `localStorage`, `window.innerWidth` during render.
- **Invalid HTML nesting**: `<div>` inside `<p>`, `<a>` inside `<a>`, `<tr>` directly in `<table>` without `<tbody>`. The browser's parser "fixes" the server HTML, so the DOM no longer matches.
- Browser extensions that modify the DOM (React 19 is more tolerant of unexpected third-party `<head>`/`<body>` content).

Fixes:
- Client-only values: render a placeholder first, then set the real value in `useEffect` (or use a `useIsClient`/`useSyncExternalStore` pattern with `getServerSnapshot`).
- `useId()` for ids that must match on both sides.
- Format dates with a fixed time zone and locale, or format them on the client.
- `suppressHydrationWarning` only for unavoidable **text** differences, such as a timestamp. It works one level deep.

React 19 shows a single error with a **diff** of the mismatch, which makes these much easier to find.
</details>

---

## Hooks and APIs

### 16. What changed about refs in React 19?

<details><summary>Answer</summary>

- **`ref` is a normal prop** for function components: `function Input({ ref, ...props })`. `forwardRef` is no longer needed (it will be deprecated). Exercise 09 uses this.
- **Ref callbacks can return a cleanup function**, called on detach instead of calling the callback with `null`. Because of this, an implicit return from an arrow function such as `ref={el => (x = el)}` is now a TypeScript error. Use a block body.
- `useRef` requires an argument in the TypeScript types (`useRef<T>(null)`), and `ref.current` is mutable.
- `useImperativeHandle` is still how you expose a small API (`focus()`, `scrollToIndex()`) instead of the raw DOM node.
- In StrictMode (dev), React 19 also double-invokes ref callbacks (attach → detach → attach) to find missing cleanups.
</details>

### 17. What are the limits of error boundaries?

<details><summary>Answer</summary>

An error boundary (a class component with `getDerivedStateFromError` / `componentDidCatch`) catches errors thrown **during rendering, in lifecycle methods/effects, and in constructors** of its subtree.

It does **not** catch:
- Errors in **event handlers** (use try/catch and set error state, or rethrow inside a `setState` updater to send it to the boundary).
- **Async code** that runs later: `setTimeout`, promise callbacks, `fetch().then`.
- Errors during **server-side rendering** (the framework handles those).
- Errors thrown by the **boundary itself**. They go to the next boundary up.

React 19 notes: errors thrown inside **transitions/Actions** (`startTransition(async () => ...)`) are shown in the nearest error boundary. `createRoot` accepts `onCaughtError` / `onUncaughtError` / `onRecoverableError` for reporting (e.g. to Sentry). There is still no hook equivalent of an error boundary, so use a class or `react-error-boundary`.
</details>

### 18. Why does StrictMode render twice and run effects twice? What is it catching?

<details><summary>Answer</summary>

In **development only**, StrictMode:
- **Calls component bodies, initializers and reducers twice** to find impure render logic (mutations, side effects in render). In React 19 the second call **reuses** the `useMemo`/`useCallback` results from the first.
- **Mounts, unmounts and mounts again** every component on first mount, running effect setup → cleanup → setup. This finds **missing cleanups**: a subscription without unsubscribe, a timer that isn't cleared, a request that isn't aborted. That matters for features like Fast Refresh, Activity/offscreen and back/forward navigation, where React really does unmount and remount components.
- Double-invokes ref callbacks (React 19) and warns about deprecated APIs.

The right response is to **make effects idempotent with a proper cleanup**, not to block the second run with a "didRun" ref. Example: "my analytics event fires twice in dev" is fine. "My POST request runs twice" means the request belongs in an event handler, not an effect.
</details>

### 19. Controlled vs uncontrolled components: trade-offs?

<details><summary>Answer</summary>

- **Controlled:** React state is the source of truth (`value` + `onChange`). Easy to validate on each keystroke, format input, enable or disable submit, or sync with other UI. The cost: every keystroke re-renders the owner. Keep that state colocated.
- **Uncontrolled:** the DOM keeps the value (`defaultValue`, read it with a ref or `FormData` on submit). Fewer re-renders, works with native form features and progressive enhancement.

React 19 makes uncontrolled forms more attractive: `<form action={fn}>` passes `FormData` to the action, and React **resets the form** after a successful action. Libraries like React Hook Form are mostly uncontrolled for performance. A component should never switch from uncontrolled to controlled (`value` going from `undefined` to a string); React warns about it.
</details>

### 20. How do forms work with Actions and `useActionState` in React 19?

<details><summary>Answer</summary>

```tsx
const [state, formAction, isPending] = useActionState(async (prev, formData) => {
  const result = await saveProfile(formData);
  return result.ok ? { error: null } : { error: result.message };
}, { error: null });

<form action={formAction}>
  <input name="name" />
  <button disabled={isPending}>Save</button>
  {state.error && <p role="alert">{state.error}</p>}
</form>
```

- `action` accepts a function (client function or Server Function). React runs it in a **transition**, so `isPending` is handled for you.
- `useActionState` keeps the **last result** as state. Calls are queued in order, and each gets the previous state.
- `useFormStatus()` (from `react-dom`) lets a nested component, such as a design-system `SubmitButton`, read `pending` for its parent form without prop drilling.
- With a Server Function, the form works **before hydration**.
- After a successful action, uncontrolled fields are reset automatically.
</details>

### 21. What does `useOptimistic` do?

<details><summary>Answer</summary>

`const [optimisticTodos, addOptimistic] = useOptimistic(todos, (state, newTodo) => [...state, newTodo])`

While an Action or transition is running, you can show a temporary, optimistic version of some state. When the transition **ends**, React drops the optimistic value and shows the real `todos` again. If the request succeeded, `todos` now includes the item. If it failed, the item simply disappears: **rollback for free**.

It must be called inside a transition or action. Because optimistic updates are **replayed on top of the real state**, a failure can't undo other changes. That's the same "base state + pending ops" model as exercise 10. For error messages, catch the failure in the action and set error state.
</details>

### 22. How do portals affect event bubbling and context?

<details><summary>Answer</summary>

`createPortal(children, domNode)` renders into a different DOM node (a modal into `document.body`), but **the React tree doesn't change**:

- **Context** still flows from the React parents.
- **React synthetic events bubble through the React tree**, not the DOM tree. A click inside a modal portal reaches an `onClick` on the React parent that rendered it, even though in the DOM the modal is outside that parent. This surprises people: "clicking in my modal triggers the row's onClick". Fix it with `e.stopPropagation()` in the portal root, or by checking `e.target`.
- **Native DOM listeners** (`document.addEventListener`) follow the DOM tree. Code like "close on outside click" must use `contains()` on both the trigger and the portal content.
- Focus management (trap focus, restore focus) and `aria-modal` are still your job.
</details>

### 23. How does `use()` differ from other hooks?

<details><summary>Answer</summary>

`use(resource)` reads a **Promise** (suspends until it resolves, and throws its error to the error boundary) or a **Context**.

- It **can be called conditionally** and inside loops, unlike other hooks. `if (show) { const theme = use(ThemeContext) }` is fine.
- **Don't create the promise during render** (`use(fetch(...))` would make a new promise on every render and suspend forever). The promise must be cached or created **outside** render, for example passed from a Server Component to a Client Component, or created by a data library.
- In Server Components, `await` is usually simpler than `use`.
</details>

---

## Architecture and testing

### 24. How would you structure data fetching in a large React app today?

<details><summary>Answer</summary>

- **Server-first when you can** (Next.js App Router / RSC): fetch in Server Components, close to the data. That avoids client waterfalls, ships no fetching code, and streams with Suspense.
- **Client data** goes through a cache library (**TanStack Query, SWR, Relay, Apollo**), not `useEffect` + `useState`. You get dedupe, caching, stale-while-revalidate, retries, cancellation, pagination, optimistic updates, and refetch on focus or reconnect (exercise 07 builds the core of this).
- **Avoid waterfalls:** start requests in parallel at the route level (loaders, `Promise.all`, prefetch on hover). Don't chain "parent loads, then child starts loading".
- **Separate server state from client state.** Server state lives in the cache library. Client UI state lives in `useState`, URL search params (filters, pagination: shareable and survive a refresh), or a small store.
- **Mutations:** a server action or mutation hook, then invalidate or revalidate the affected queries, with optimistic UI where it matters.
</details>

### 25. What is your testing philosophy for React components?

<details><summary>Answer</summary>

"The more your tests resemble the way your software is used, the more confidence they can give you." (Testing Library)

- Test **behavior**, not implementation: render, interact the way a user would (by role and accessible name), and assert on what the user sees. Don't test state variables, hook internals or class names. Querying by role also tests accessibility.
- **Mock at the network boundary** (MSW, or inject an API like the exercises in this repo do), not your own modules.
- Async UI: `findBy*`/`waitFor` with real timers. With fake timers, wrap timer advancement in `act` (`await act(() => vi.advanceTimersByTimeAsync(ms))`).
- `act` warnings mean "something updated state when you weren't looking". Fix the test (await the thing that causes the update) instead of silencing the warning.
- Pyramid: many unit/component tests for logic and widgets, fewer integration tests for flows, a few E2E tests (Playwright) for critical paths, plus visual regression and accessibility checks (axe) in CI.
- Performance can be tested too: render counts (the probes in this repo), request counts, and bundle-size budgets in CI.
</details>
