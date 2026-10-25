# Perf 02 · Answers

## Issues, ranked by impact

| # | Issue | What the user notices | How to prove it |
|---|---|---|---|
| 1 | `key={i}` (array index as key) | Local state (quantity, focus, half-typed input) **jumps to another product** after sorting or filtering. This is a correctness bug, not just performance. | Set a quantity, change the sort. React DevTools: the component at position 0 keeps its state but gets new props. |
| 2 | `products.sort(...)` **mutates the prop** | Shared data (store, cache, parent state) changes order in other parts of the app. In React it can also stop updates: the parent's array is "the same" object, so memoized consumers skip it. | `Object.freeze(products)` in dev throws. Log the parent's array order before and after. |
| 3 | Filter + sort run **on every render** | Typing in *any* input (coupon) or adding to cart re-sorts 5,000 items: O(n log n) on each keystroke | Performance panel: a long task in `ProductGrid` for each keystroke. Count `compare` calls. |
| 4 | `memo(ProductCard)` defeated by inline `style={{…}}` and inline `onAdd={() => …}` | Every parent render re-renders all 5,000 cards. The `memo` gives a false sense of safety | Profiler "Why did this render?": *props changed: style, onAdd*. |
| 5 | `query.trim().toLowerCase()` computed **inside** the filter callback | 5,000 string allocations per render instead of 1. Small, but a classic review comment | Read the code. Allocation profile in the Memory panel. |
| 6 | Search runs synchronously at keystroke priority | With 5,000 cards, each keystroke blocks input → bad **INP** | Performance panel with 4× CPU throttling. `web-vitals` `onINP`. |
| 7 | No virtualization | 5,000 cards × ~6 DOM nodes = 30,000 nodes. Style, layout and memory cost | Elements panel node count. Performance panel: long "Recalculate style". |

## The fixes (see `solution.tsx`)

1. **Stable keys:** `key={p.id}`. Index keys are only OK for static lists that never reorder, filter or insert.
2. **Don't mutate:** `[...products].sort(...)`, or `products.toSorted(...)` (ES2023).
3. **Memoize derived data by its real inputs:** sort depends on `[products, sortKey]`, filter on `[sorted, query]`. Two separate `useMemo`s, so a search doesn't sort again.
4. **Make `memo` work:** hoist the style object to module scope (or use a CSS class). Make the callback stable with `useCallback` + a functional `setState`, so it doesn't depend on `cartCount`.
5. **Normalize the query once** outside the loop.
6. **Keep typing responsive:**
   - `useDeferredValue(query)`: the input updates at high priority, and the list re-renders with the deferred value in an interruptible background render.
   - Or `startTransition(() => setFilterQuery(value))`, with two pieces of state.
   - Debouncing works too, but it adds fixed latency. Concurrent rendering doesn't wait when the device is fast.
7. **Virtualize** the grid (TanStack Virtual with `lanes` for a grid, or react-window `FixedSizeGrid`). Render only about 30 visible cards.

## Senior talking points

- **`useDeferredValue` vs debounce:** debounce always waits N ms. Deferred rendering starts immediately and gets interrupted by new keystrokes. Combine it with `memo` on the list, or the deferred render is still the full 5,000 cards.
- **Where should filtering live?** For 5,000 items, client-side is fine. For 500,000 items, search on the server with pagination, and keep the query in the URL (`?q=&sort=`) so results are shareable and survive refresh.
- **Measure before and after:** React Profiler (commit duration), Performance panel with CPU throttling, and INP in the field. Say a number: "the keystroke task went from 180 ms to 8 ms."
- **Index-as-key interview trap:** the classic follow-up is "When is index as key fine?" Answer: a static list that is never reordered, filtered or prepended, and whose items have no state.
