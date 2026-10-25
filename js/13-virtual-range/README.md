# 13 · Virtualizer Math (variable row heights)

**Difficulty:** Hard · **Time:** 45–60 min · **Similar to:** TanStack Virtual / `react-window` `VariableSizeList` internals, "render a 100,000-row list" interview questions

## Why companies ask this

Feeds, chat, logs, spreadsheets and tables all need virtualization: render only what is on screen. Fixed-height rows are easy (`index = Math.floor(scrollTop / rowHeight)`). Real rows have **different heights**, and you only learn the real height **after** a row renders. This question tests data structures (prefix sums + binary search), lazy computation and cache invalidation. That's the part interviewers care about, not the DOM. `react/09-virtual-list` uses this math in a component.

## Task

Implement `createVirtualizer(options)` in `index.ts`.

```ts
const v = createVirtualizer({ count: 100_000, estimateSize: () => 40, overscan: 2 });

v.getVirtualItems(scrollTop, viewportHeight); // [{ index, start, size }, …] → render these with position: absolute; top: start
v.getTotalSize();                              // height of the inner spacer element
v.measure(17, 83);                             // row 17 rendered and is really 83px tall
```

## Requirements

**Sizes and offsets**
1. The size of item `i` is the measured size if `measure(i, size)` was called, otherwise `estimateSize(i)`.
2. `getItemOffset(i)` = `paddingStart` + the sum of the sizes of the items before `i`.
3. `getTotalSize()` = `paddingStart` + the sum of all sizes. With `count: 0` it is `paddingStart`.

**Visible range.** `getRange(scrollTop, viewportHeight)` returns `{ start, end }` (both inclusive) or `null` when `count` is 0.
4. Visible items are the items that overlap `[scrollTop, scrollTop + viewportHeight)`: item `i` covers `[offset, offset + size)`.
   - The first visible item is the first one whose end is `> scrollTop`.
   - The last visible item is the first one whose end is `>= scrollTop + viewportHeight` (or the last item).
5. Add `overscan` (default `2`) items on each side, clamped to `[0, count - 1]`.
6. A negative `scrollTop` (iOS bounce) behaves like `0`. A `scrollTop` past the end gives the last items.
7. `getVirtualItems(scrollTop, viewportHeight)` returns `{ index, start, size }` for every index in the range (`[]` for count 0).

**Performance (this is the real question)**
8. Keep a **prefix-sum array** of item end positions. Compute it **lazily**: only as far as a call needs. The top of a 100,000-item list must not call `estimateSize` 100,000 times.
9. Don't cache estimates separately: the prefix sums are the cache. `measure(i, size)` invalidates the prefix sums **from `i` onward only**. Items before `i` are not recomputed.
10. Find the first visible item with **binary search** over the prefix sums: `O(log n)` per scroll event, not `O(n)`.

The tests check 8–10 by counting `estimateSize` calls.

## Why binary search?

The prefix sums `ends[i]` are sorted (sizes are positive), so "the first `i` with `ends[i] > scrollTop`" is a classic lower-bound search. With 100,000 rows that's about 17 comparisons per scroll event instead of up to 100,000. Scroll events can fire 60+ times a second, so this matters.

## Edge cases interviewers probe

- Measuring an item **above** the viewport changes every offset below it, and the content "jumps". How do TanStack Virtual and chat apps fix that? (Adjust `scrollTop` by the size difference: scroll anchoring.)
- A row's height changes after images load (use `ResizeObserver` to call `measure`).
- `estimateSize` that's very wrong makes the scrollbar jump while you scroll. Why?

## Follow-ups

- Horizontal and grid virtualization (two of these, one per axis).
- Reverse lists (chat) where new items are added at the bottom and the view stays pinned.
- Sticky headers inside a virtualized list.
- What happens with 10 million rows? (Browsers cap element height at around 16–33 million px, so you need to scale the scroll position.)

## Run

```bash
npm test js/13-virtual-range
npm run test:solution js/13-virtual-range
```
