# 09 · Virtualized list (windowing)

**Difficulty:** Hard · **Time:** 45–60 min · **Similar to:** react-window `FixedSizeList`, TanStack Virtual, GreatFrontEnd system design *News Feed* (the virtualization part)

## Why companies ask this

10,000 rows in the DOM means slow first render, slow scrolling, high memory and long layout times. Every large product (Slack, Gmail, Figma's layers panel, Divar's listings, admin tables) uses **virtualization**: render only the rows you can see. Interviewers want to see that you can do the scroll math, keep the scroll height correct, avoid layout work, and keep the list accessible.

## Task

Build `<VirtualList />` in `index.tsx`.

```tsx
const ref = useRef<VirtualListHandle>(null);

<VirtualList
  ref={ref}
  aria-label="Orders"
  items={orders}            // 10,000 items
  height={400}              // container height (px)
  itemHeight={32}           // every row is 32px
  overscan={3}              // default 3
  renderItem={(order, index) => <OrderRow order={order} />}
/>

ref.current?.scrollToIndex(500, 'center');
```

## Requirements

**Rendering**
1. Render **only** the visible rows plus `overscan` rows above and below (never below index 0 or past the last item).
   - Visible rows: from `floor(scrollTop / itemHeight)` to `ceil((scrollTop + height) / itemHeight) - 1`.
2. Call `renderItem` only for rendered rows.
3. The container is `height` px tall with `overflow-y: auto`. Inside it, a **spacer** element (the container's first child) has `height = items.length * itemHeight` px, so the scrollbar is correct.
4. Each row is absolutely positioned with `transform: translateY(index * itemHeight px)` (exactly in that format, e.g. `translateY(100px)`).

**Scrolling**
5. On the container's `scroll` event, read `scrollTop` and update the rendered range.
6. If `items` shrinks below the current scroll position, clamp. Never render an empty list or crash.

**Accessibility and keyboard**
7. The container has `role="list"`, accepts `aria-label`, and is focusable (`tabIndex={0}`).
8. Each row has `role="listitem"`, `aria-setsize={items.length}` and `aria-posinset={index + 1}`. This is how screen readers know it's "item 501 of 10,000" even though most rows aren't in the DOM.
9. Keys on the focused container: `ArrowDown`/`ArrowUp` scroll by one row, `PageDown`/`PageUp` by one page, `Home`/`End` jump to the top/bottom.

**Imperative API**
10. Expose `scrollToIndex(index, align = 'auto')` through `ref`. In React 19, `ref` is a normal prop, so use `useImperativeHandle` and skip `forwardRef`.
    - `'start'`: item at the top. `'end'`: item at the bottom. `'center'`: item in the middle.
    - `'auto'`: do nothing if the item is fully visible. Otherwise scroll the minimum amount (`start` if it's above, `end` if it's below).
    - Clamp the result to `[0, totalHeight - height]` and clamp `index` to the valid range.
    - Setting `scrollTop` programmatically fires `scroll` **asynchronously** in browsers (and never in jsdom), so update your state directly too.

## Edge cases interviewers probe

- Why `transform` instead of `top`? (It's composited, so it doesn't trigger layout for the other rows.)
- Why overscan? (No blank rows during fast scrolling, because rows are ready before they enter the viewport.)
- Why does each row need a stable `key`? What breaks if rows are keyed by position in the window instead of by item?
- `Ctrl+F` (browser find) can't find rows that aren't rendered. How do products solve that?

## Follow-ups

- **Variable / unknown row heights:** measure rows with `ResizeObserver`, keep a prefix-sum array, and binary-search the first visible row. What happens to the scroll position when a row above the viewport changes height? (Scroll anchoring.)
- **Reverse lists (chat):** start at the bottom and keep the position when older messages are prepended.
- Grids (2D virtualization), sticky headers, and infinite loading at the end.
- `content-visibility: auto` in CSS: when is it enough on its own?
- Measuring the win: DOM node count, "Recalculate style" and "Layout" time in the Performance panel, INP while scrolling.

## Run

```bash
npm test react/09-virtual-list
npm run test:solution react/09-virtual-list
npm run dev   # then open "react / 09-virtual-list"
```
