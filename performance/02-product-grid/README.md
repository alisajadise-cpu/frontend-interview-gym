# Perf 02 · Product grid that forgets your quantities

**Difficulty:** Medium–Hard · **Time:** 30–40 min · **Format:** code review + fix

## The bug report

> The catalog has 5,000 products. Typing a coupon code lags. Search feels heavy. A customer set quantity **5** on one product, changed the sort order, and the 5 moved to a different product. QA also says the product list in the Redux store is in a different order after visiting this page.

The **coupon code** field is not a product, and it doesn't apply a discount. It's a plain text box that saves what you type into state. It's there to show the problem: typing in a box that has nothing to do with the products should not re-render or re-sort them.

The tests use a small catalog (Apple, Apricot, Banana, Cherry, Kiwi, Mango). The demo in `npm run dev` uses 5,000 generated products like "Red Lamp #0".

`index.tsx` is the production component. It renders the right products, but it has **at least 7 problems**.

## Your task

1. **Review first (10–15 min).** List every issue: what's wrong, what the user notices, and how you'd prove it. Rank them.
2. **Fix it** in `index.tsx` until `npm test performance/02` passes.
3. Compare with `ANSWERS.md` and `solution.tsx`.

## Rules

- Keep the exports: `ProductGrid`, `defaultHelpers`, and the types.
- Keep `probe('ProductCard')` and `probe('CartBadge')` in place.
- All filtering and sorting must go through `helpers.matches` and `helpers.compare`. The tests count calls to them.

## What the tests check

- Sorting and case-insensitive search still work.
- The `products` prop is never mutated.
- A card's local state (quantity) stays with its product after re-sorting.
- Typing in the coupon field: **0** card renders and **0** filter/sort calls.
- Adding to cart re-renders the badge, with at most one card.
- Searching filters the list without sorting it again.

## Try it in the browser

`npm run dev` → **performance / 02-product-grid**. The render counters are at the top. Type in "Coupon code" with *My code*, then with *Solution*.
