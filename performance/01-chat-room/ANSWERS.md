# Perf 01 · Answers

Don't read this until you've written your own review.

## Issues, ranked by impact

| # | Issue | What the user notices | How to prove it |
|---|---|---|---|
| 1 | `MessageRow` is defined **inside** `ChatRoom` | Each keystroke unmounts and remounts every row. Typing lags, and every row's `useUser` effect runs again | React DevTools Profiler: rows show as *mounted* on every commit. A `useEffect(() => console.count('mount'), [])` in the row. |
| 2 | `handleSend` uses `useCallback(..., [])` and reads `draft` | **Send posts an empty message** (data loss) | Type text and press Send. `onSend` gets `''`. ESLint `react-hooks/exhaustive-deps` flags it. |
| 3 | `draft` state lives in `ChatRoom` | Every keystroke re-renders the whole list (2,000 rows) | Profiler: the commit on each keystroke includes every row. Turn on "Highlight updates". |
| 4 | `useUser` caches **results**, not **promises** | 300 rows with 5 authors make about 300 requests on first load, because the cache stays empty until the first response comes back | Network tab: duplicate `/api/users/u1` requests. Count `fetchUser` calls. |
| 5 | `options` object is recreated on every render, and the effect depends on it | The socket closes and reopens on **every keystroke**. That means server load, and messages lost during the reconnect | Network → WS tab: new connections while typing. Log inside `connect`. |
| 6 | `useLayoutEffect` with no deps reads `scrollHeight` | A **forced synchronous layout** of the whole list on every render, before paint | Performance panel: purple "Layout" blocks inside each keystroke task, flagged as *Forced reflow*. |
| 7 | `visible` is derived data copied into state with `useEffect` | Two renders per update, and one frame with stale data | Profiler: two commits for each new message. |
| 8 | `useState(cache.get(id))` only uses the initial value | The **wrong author name** after `authorId` changes, if the new author is already cached (the effect returns early). Issue #1 hides this, because remounting re-initializes state. | Change a message's author in a test once #1 is fixed. |
| 9 | No cleanup or race protection in `useUser` | `setUser` after unmount. With id A → B, A's late response can overwrite B | Throttle the network, switch rooms fast. |
| 10 | Module-level cache with no limit | Memory grows forever in long sessions, and it leaks between logged-in users | Memory panel: heap snapshots before and after an hour of chat. Compare retained `Map` size. |
| 11 | No virtualization | 2,000+ `<li>` in the DOM make layout, style recalc and memory expensive | Performance panel: long "Recalculate style" and "Layout" times. Elements panel: node count. |
| 12 | `useEffect([id])` ignores `api` | Lint warning. With a new `api` (logout or tenant switch), the old one is still used | `react-hooks/exhaustive-deps`. |

## The fixes (see `solution.tsx`)

1. **Move the row component to module scope** and wrap it in `memo`. A component type must be stable between renders. A new function identity is a new type, so React throws the old subtree away.
2. **Colocate state:** move `draft` into a `Composer` component. Now typing re-renders the composer only. This fixes #3 without any `memo` tricks, and it's the first thing to reach for.
3. **Send reads current state:** with `draft` local to `Composer`, `send` is a plain function. No `useCallback`, so no stale closure. If you do keep `useCallback`, its deps must include `draft` and `onSend`.
4. **Cache promises:** the first caller stores the in-flight promise, and everyone else awaits the same promise. Make it an LRU so it's bounded, and drop failed entries so they can be retried.
5. **Primitive effect deps:** `useEffect(() => connect({ roomId, reconnect: true }), [api, roomId])`. Build the object *inside* the effect.
6. **Scroll only when a new message arrives** (`[lastId]`), and only if the user is near the bottom. Alternative: `flex-direction: column-reverse` needs no JS at all.
7. **Derive during render:** `useMemo(() => messages.filter(...), [messages])`.
8. **`useUser` derives from the current `id`:** check the cache during render, and tag async results with the id they belong to, so a result for another id is never returned.
9. **Ignore stale responses** with an `ignore` flag in the effect cleanup. Don't abort the shared request, because 299 other rows are waiting on it. If you need real cancellation, reference-count subscribers and abort when the count reaches 0.
10. **Virtualize** the list with TanStack Virtual or react-window. Chat needs *reverse* virtualization and dynamic row heights. Mention it even if you don't build it.

## Senior talking points

- **"How would you prove #1 in production before fixing it?"** React DevTools Profiler, "Why did this render?" shows *"The parent component rendered"* and mounts on every commit. In the field, the `PerformanceObserver` long-tasks API (or INP in RUM data) shows typing interactions getting slower as the message count grows.
- **"Would you use React Query here?"** Yes, in a real app. `useQuery({ queryKey: ['user', id] })` gives dedupe, race safety, garbage collection (`gcTime`), retries and cancellation. Writing it by hand in the interview shows you know what the library does underneath.
- **INP:** this component's main problem is Interaction to Next Paint. The keystroke handler triggers a 2,000-row render plus a forced layout. Measure it with the `web-vitals` library, `onINP`.
