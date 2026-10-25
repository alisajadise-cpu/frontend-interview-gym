# Perf 06 · Answers

A leak in a JS app means something **reachable from a GC root** (window, a module variable, a running timer, a live subscription) still holds a reference to things you no longer need. The garbage collector can only free unreachable objects.

## Issues, ranked by impact

| # | Leak | What keeps it alive | What the user notices | How to find it |
|---|---|---|---|---|
| 1 | `feed.subscribe(...)` is never unsubscribed | The feed's listener set → the closure → `setPrice` → the unmounted component's fiber, state and DOM | Memory grows with each tab switch. CPU work for invisible tickers. React ignores the updates, but the listener still runs | Heap snapshot comparison: growing `FiberNode` / closure counts. A counter in the feed (`listenerCount`). |
| 2 | `setInterval(load, pollMs)` is never cleared | The timer list → `load` → `api`, `symbol`, `setStats` | Requests for tickers that are not on screen, forever. Network + battery | Network tab keeps polling after you leave. `vi.getTimerCount()` in tests. |
| 3 | The `AbortController` is created but never aborted | The pending request + its `.then(setStats)` closure | Wasted bandwidth. Old responses can land after newer ones | Network tab: requests not marked *(canceled)* on navigation. |
| 4 | Inline `visibilitychange` listener, never removed | `document` → the listener → `setHidden` → the unmounted component | Grows by one per mount. All of them run on every visibility change | DevTools console: `getEventListeners(document).visibilitychange.length`. |
| 5 | Module-level `history` grows forever | A module variable is a GC root for the life of the page | Thousands of points per symbol per hour: an unbounded array | Allocation timeline: steady growth of `Array` storage. Retainers view → `history`. |
| 6 | Polling continues in background tabs | — | Battery and data drain. Chrome throttles timers in background tabs, but they still fire | Performance → record with the tab hidden. Network requests continue. |
| 7 | `useEffect` deps miss `feed`/`api` | A stale feed or api after a parent swaps it (logout, account switch) | Data from the wrong account | `react-hooks/exhaustive-deps`. |

## The fixes (see `solution.tsx`)

- **Every effect that starts something returns a cleanup that stops it.** `return feed.subscribe(...)` is the shortest correct version, because `subscribe` returns the unsubscribe function.
- **Intervals:** `const id = setInterval(...)` → `return () => clearInterval(id)`.
- **Requests:** keep the current `AbortController`. Abort it before starting the next request *and* in the cleanup. Ignore results whose signal is aborted.
- **DOM listeners:** use a named handler, so the *same reference* can be passed to `removeEventListener`. (Or pass `{ signal }` from an AbortController to `addEventListener` and abort it.)
- **Module-level caches must be bounded:** a ring buffer or limit (`HISTORY_LIMIT`), an LRU, or a TTL.
- **Pause in background tabs:** read `document.hidden` and include it in the polling effect's deps.

## Chrome DevTools workflow (say this in the interview)

1. **Memory panel → Heap snapshot.** Take one, do the action N times (switch tabs 20×), force GC (trash-can icon), take another. Use the **Comparison** view and sort by *# Delta*. Objects that grow by about N are leaking.
2. Filter by **"Detached"** to find DOM nodes removed from the document but still referenced (*Detached HTMLDivElement*). Click one → the **Retainers** panel shows the reference chain back to a GC root, often `system / Context` (a closure) → listener → `Window`.
3. **Allocation instrumentation on timeline**: blue bars that stay blue are allocations that were never freed.
4. **Performance monitor** (Cmd+Shift+P → "Show Performance monitor"): live JS heap size, DOM node count and **JS event listener count**. A steadily growing listener count is the clearest leak signal.
5. In the field: `performance.measureUserAgentSpecificMemory()` (needs cross-origin isolation) to report memory from real users.

## Tools in the language

- **`WeakMap` / `WeakSet`:** keys are held weakly. Good for caching data *about* objects (DOM nodes, component instances) without keeping them alive.
- **`WeakRef`:** a reference that doesn't prevent GC (`ref.deref()` may return `undefined`). Rarely needed in app code.
- **`FinalizationRegistry`:** a callback after an object is collected. Use it for diagnostics only, never for correctness: the timing is not guaranteed.
- **`AbortController` + `addEventListener(type, fn, { signal })`:** one `abort()` removes many listeners at once. Great for cleanup in effects.

## Senior talking points

- React 18 removed the *"Can't perform a React state update on an unmounted component"* warning, because it was often a false alarm. The real leak is the **subscription**, not the setState.
- StrictMode in development mounts → unmounts → mounts every component. It exists to surface missing cleanups like these. If your app breaks under StrictMode, you have a leak.
- SPAs never reload, so leaks accumulate in ways that never happen with page navigations. Test long sessions: a Playwright script that switches tabs 500× and checks `performance.memory` or the listener count.
