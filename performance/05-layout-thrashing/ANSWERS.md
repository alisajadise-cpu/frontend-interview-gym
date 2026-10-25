# Perf 05 · Answers

## Background: how the browser renders a frame

```
JS → Style → Layout → Paint → Composite
```

Normally the browser **batches**. You can write 100 styles, and it does one layout before the next paint.

- **Forced synchronous layout (forced reflow):** you *read* a geometry value (`offsetHeight`, `getBoundingClientRect()`, `scrollHeight`, `scrollTop`, `getComputedStyle()`, `innerText`, …) **after** a write. The browser must run layout *right now*, in the middle of your JS, to answer correctly.
- **Layout thrashing:** doing that in a loop (read → write → read → write). Every read pays for a full layout. N cards = N layouts instead of 1.

## Issues, ranked by impact

| # | Issue | What the user notices | How to prove it |
|---|---|---|---|
| 1 | The grid **interleaves** reads and writes per card: measure the row, write one card, measure the row again… | 60 cards → ~60 forced layouts (and 3× more reads than needed). A frozen frame of hundreds of ms on phones | Performance panel: many purple *Layout* blocks inside one `useLayoutEffect`, each with **"Forced reflow is a likely performance bottleneck"**, pointing at `measure`. |
| 2 | `useLayoutEffect` has **no dependency array** | Any re-render (a highlight, a parent update) measures and writes everything again, synchronously **before paint** | Highlight a card and record: layout work for a style-only change. |
| 3 | The scroll handler reads layout (`scrollHeight`) and calls `setState` on **every scroll event** | Scroll fires many times per frame on fast trackpads. Each one does a forced layout + a React render → scroll jank | Performance panel: many short tasks per frame during scroll. The FPS meter drops. |
| 4 | The scroll listener is an inline function that is **never removed** | Each mount adds another listener. After navigating back and forth, every scroll runs N stale handlers, and the closures keep unmounted components alive (leak) | `getEventListeners(window).scroll.length` in the DevTools console grows after each navigation. |
| 5 | `getScrollProgress` is captured once (stale closure) | If the parent passes a new function, the header keeps using the old one | Code review. |

## The fixes (see `solution.tsx`)

1. **Batch: read everything, then write everything.** One layout for the reads (if any is needed), then writes that the browser lays out once before paint.
   This is what the `fastdom` library does across components: `fastdom.measure(...)` and `fastdom.mutate(...)` queue work into one read phase and one write phase per frame.
2. **Correct dependencies:** `[cards, columns]`. Re-measure on real content changes only.
   - When *widths* change (window resize, fonts loading, images loading), re-run from a **`ResizeObserver`**. It reports sizes *after* layout without forcing one, and it batches.
3. **rAF-throttle scroll work:** schedule at most one `requestAnimationFrame` per frame and do the read + `setState` there.
4. **Clean up:** keep a named handler, remove it on unmount, and `cancelAnimationFrame` the pending frame.
5. Keep the latest callback in a ref (the "latest ref" pattern) instead of re-subscribing.

### Even better: no JS at all

- **Equal heights:** CSS grid rows already stretch items to the tallest item in the row (`align-items: stretch` is the default). The exercise used `alignItems: 'start'` only to make JS necessary. Flexbox rows do the same.
- **True masonry:** `grid-template-rows: masonry` (Firefox behind a flag) or the newer CSS masonry proposal. Until then, do column-based layout with known image aspect ratios from the API, so you never need to measure.
- **Scroll progress:** **scroll-driven animations**: `animation-timeline: scroll()` animates a progress bar on the compositor, with zero JS and zero layout reads. Fall back to the rAF version where unsupported.
- **Long pages:** `content-visibility: auto` + `contain-intrinsic-size` lets the browser skip layout and paint for off-screen sections.

## About `{ passive: true }`: a common interview myth

Many people say "make the scroll listener passive". `passive` tells the browser you won't call `preventDefault()`. That matters for **`touchstart`, `touchmove` and `wheel`**, because the browser must otherwise wait for your handler before scrolling. A **`scroll` event is not cancelable**: it fires *after* scrolling already happened. So `passive` changes nothing for `scroll` (it's harmless to add). The real scroll fixes are rAF throttling, avoiding layout reads, and `IntersectionObserver` instead of scroll math. Saying this clearly is a strong senior signal.

## Senior talking points

- List the properties that force layout from memory (Paul Irish's gist *"What forces layout/reflow"*).
- `useLayoutEffect` runs before paint, so heavy work there **blocks the frame**. Use it only when you must measure and write before the user sees anything (to avoid a flicker). Otherwise use `useEffect`.
- Prefer `IntersectionObserver` (visibility) and `ResizeObserver` (size) over scroll/resize handlers + measuring. They are async, batched, and don't force layout.
- Animate `transform`/`opacity` only (compositor-only). `top`/`height` animations trigger layout every frame.
