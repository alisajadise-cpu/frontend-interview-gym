# Perf 04 · The 10,000-row orders table

**Difficulty:** Hard · **Time:** 35–45 min · **Format:** code review + fix

## The bug report

> The back-office orders page has 10,000 rows. Clicking one checkbox takes almost a second on a normal laptop. "Select all" freezes the tab. After people leave the page open all day and resize the window, it gets slower and slower.

`index.tsx` is the production table. It's functionally correct, but it has **at least 5 performance problems and one leak**.

## Your task

1. **Review first.** For each problem, give the cost in Big-O terms where you can (e.g. "O(n²) per click"), what the user notices, and how you'd prove it.
2. **Fix it** in `index.tsx` until `npm test performance/04` passes.
3. Compare with `ANSWERS.md` and `solution.tsx`.

## Rules

- Keep the exports: `OrdersTable`, `defaultComputeTax`, `Order`.
- Keep `probe('Row')` in the row component.
- `computeTax` is injected so the tests can count calls. Treat it as expensive.

## What the tests check

- The total, single toggles, "Select all" and "Clear selection" are correct.
- The compact amount format kicks in below 600px width.
- Toggling one row re-renders **at most one** row.
- Changing the selection never calls `computeTax` again.
- At most **one** `resize` listener, and it is removed on unmount.

## Try it in the browser

`npm run dev` → **performance / 04-orders-table**. Pick 10,000 rows, click a checkbox, and compare *My code* with *Solution* in the Performance panel.
