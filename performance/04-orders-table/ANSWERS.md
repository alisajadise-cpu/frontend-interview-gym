# Perf 04 · Answers

## Issues, ranked by impact

| # | Issue | Cost / what the user notices | How to prove it |
|---|---|---|---|
| 1 | `selected.includes(o.id)` inside `orders.map` | **O(n × k)**. With "Select all" (k = n = 10,000) that's 100M comparisons per render. The tab freezes | Performance panel: a long task in `OrdersTable` render. Bottom-up view → `Array.prototype.includes`. |
| 2 | A new `onToggle={() => …}` closure per row, every render | `memo(Row)` never bails out, so **every click re-renders 10,000 rows** | Profiler "Why did this render?" → *props changed: onToggle*. Probe/render counter. |
| 3 | The tax total is recomputed on **every** render, including selection changes | 10,000 × expensive `computeTax` per click | Performance panel: `computeTax` in the flame chart for a click. Count calls. |
| 4 | `useEffect` in every row adds a `resize` listener and **never removes it** | 10,000 listeners per mount. They pile up after each navigation (a **memory leak**: closures keep unmounted fibers alive). Each resize event runs 10,000+ handlers | DevTools console: `getEventListeners(window).resize.length`. Memory panel → heap snapshot → *Detached* elements and `FiberNode` counts grow after navigating away and back. |
| 5 | 10,000 rows each own resize state | Even with cleanup, one resize = 10,000 `setState` calls | Profiler: a commit per resize with every row. |
| 6 | Selection state is an array copied on each toggle (`[...s, id]`, `filter`) | O(n) per toggle. Small next to #1, but adds up | Code review. |
| 7 | No virtualization | 10,000 `<tr>` ≈ 40,000 DOM nodes. Initial render, memory, style recalc | Elements panel node count. "Recalculate style" time. |

## The fixes (see `solution.tsx`)

1. **`Set` for selection:** `selected.has(id)` is O(1). Update it immutably: `new Set(prev)` then add/delete, so React sees a new reference.
2. **One stable callback:** `const toggle = useCallback((id) => setSelected(prev => …), [])`. Rows call `onToggle(order.id)`. Now props change only for the clicked row, so `memo` works and **one row re-renders**.
3. **`useMemo` the total by `[orders, computeTax]`.** Selection isn't an input, so it never triggers a recompute. (If the total depended on the selection, keep a running sum and add/subtract on toggle: O(1).)
4. **Lift the resize listener** to one hook in the table, **with cleanup**, and pass `compact` down. Better: `matchMedia('(max-width: 599px)')` fires only when the breakpoint is crossed. Best: plain CSS media queries, with no JS at all.
5. **Virtualize** the `tbody` (TanStack Virtual). Keep a `<table>` for semantics, and use `aria-rowcount`/`aria-rowindex` so screen readers know the real size.

## Senior talking points

- **Name the complexity:** "This click is O(n²) because of `includes` inside `map`." Interviewers like hearing the Big-O *and* the measured number.
- **"Why not just `memo` everything?"** Because `memo` only helps when props are referentially stable. Inline closures, inline objects and new arrays defeat it. Fix the data flow first, then memo.
- **Leak detection workflow:** take a heap snapshot → navigate away → force GC → take another snapshot → compare. Look for *Detached HTMLTableRowElement* and growing listener counts.
- **Select all at scale:** with 1M rows on the server, don't store 1M ids. Store `{ mode: 'all', except: Set<id> }` (inverted selection). That's how Gmail-style "select all 50,000 conversations" works.
