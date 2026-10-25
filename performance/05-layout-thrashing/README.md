# Perf 05 · Layout thrashing in an "equal height" grid

**Difficulty:** Hard · **Time:** 30–40 min · **Format:** code review + fix

## The bug report

> The blog index page equalizes card heights per row. With 60 cards, the page freezes for ~300 ms on every content update on mid-range phones. Scrolling is janky because of the progress bar in the sticky header. After navigating between pages for a while, scrolling gets even worse.

`index.tsx` has two components:

- `EqualHeightGrid`: each card in a row gets the height of the tallest card in that row.
- `ScrollProgressHeader`: shows how far the page is scrolled.

## Your task

1. **Review first.** Explain *forced synchronous layout* and *layout thrashing* using this code. How many layouts does the grid trigger for 60 cards? What would the Performance panel show?
2. **Fix it** in `index.tsx` until `npm test performance/05` passes.
3. Compare with `ANSWERS.md` and `solution.tsx`.

## Rules

- Use `measure(el)` for **every** layout read and `mutate(el, height)` for **every** height write. They're in `dom.ts`, and the tests check the order of reads and writes through them. Don't edit `dom.ts`.
- Keep `probe('ScrollProgressHeader')`.
- Keep the exports: `EqualHeightGrid`, `ScrollProgressHeader`, `defaultScrollProgress`, `Card`.

## What the tests check

- The grid does **all reads first, then all writes**: one batch, no interleaving.
- Every card in a row ends up with the same height.
- The grid does not measure again on unrelated re-renders, and does when `cards` or `columns` change.
- The header reads layout and renders **at most once per animation frame**, no matter how many scroll events fire.
- The scroll listener is removed on unmount, and a pending frame is cancelled.

## Try it in the browser

`npm run dev` → **performance / 05-layout-thrashing**. Click "New content" while recording in the Performance panel. Look for purple **Layout** blocks with the red *Forced reflow* warning.
