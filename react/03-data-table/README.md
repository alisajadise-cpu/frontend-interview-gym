# 03 · Generic Data Table (sort, filter, paginate)

**Difficulty:** Hard · **Time:** 50–60 min · **Similar to:** GreatFrontEnd *Data Table I–IV*, TanStack Table, admin dashboards everywhere

## Why companies ask this

Almost every company has an internal admin page with a table. This question checks **generic TypeScript components**, the **order of derived data** (filter → sort → paginate), correct **sorting** (stable, typed comparison, no mutation of props), pagination edge cases, and `aria-sort` for accessibility. Interviewers love the page-size bug: change rows-per-page on page 3 and the user suddenly sees completely different rows.

## Task

Build `<DataTable />` in `index.tsx`.

```tsx
type User = { id: string; name: string; age: number; city: string };

<DataTable<User>
  rows={users}
  getRowId={(u) => u.id}
  columns={[
    { key: 'name', header: 'Name', sortable: true },
    { key: 'age', header: 'Age', sortable: true },
    { key: 'city', header: 'City', sortable: true, compare: (a, b) => a.city.length - b.city.length },
    { key: 'id', header: 'Profile', render: (u) => <a href={`/u/${u.id}`}>Open</a> },
  ]}
  pageSizeOptions={[5, 10, 20]}   // optional, default [10, 20, 50]. The first option is the initial page size.
/>
```

## Requirements

**Rendering**
1. Render a `<table>` with one `<th>` per column. Cells show `render(row)` if given, otherwise `String(row[key])`.
2. Use `getRowId(row)` as the React key.
3. When no rows match, show one row with the text `No rows`.

**Sorting**
4. A sortable column's header contains a `<button>` whose accessible name is the header text.
5. Clicking cycles that column through **ascending → descending → none**. Clicking a different column starts it at ascending.
6. Sortable `<th>` elements have `aria-sort` set to `ascending`, `descending`, or `none`. Non-sortable headers have no `aria-sort`.
7. Default comparison: numbers numerically, everything else with `String(a).localeCompare(String(b))`. A column's `compare(a, b)` (which gets whole rows) overrides it.
8. The sort is **stable**: rows that compare equal keep their original order. "None" restores the original order.
9. **Never mutate** the `rows` prop. The tests pass a frozen array.

**Filtering**
10. A text input with the accessible name `Filter rows`. A row matches if any column value that is a **string** contains the text, case-insensitive. Trim the filter text.
11. Changing the filter goes back to page 1.

**Pagination**
12. Buttons `Previous page` and `Next page`, disabled at the first and last page.
13. Show the text `Page X of Y`. Y is at least 1, even with no rows.
14. A `<select>` with the accessible name `Rows per page`. When the page size changes, keep the first row that was visible still on screen: `newPage = Math.floor(firstVisibleIndex / newSize) + 1`.
15. If the data shrinks so the current page no longer exists, show the last page instead.
16. Order of operations: **filter → sort → paginate**.

## Edge cases interviewers probe

- Sorting `[10, 9, 100]` as strings gives `[10, 100, 9]`. That's why types matter.
- `Array.prototype.sort` mutates. Calling `rows.sort(...)` on a prop is a real production bug.
- What to sort by when two values are equal? Stability.
- Where should sort/filter/page state live if the user wants to share a link? (The URL.)

## Follow-ups

- **Server-side** sorting/filtering/pagination for 1M rows: what changes in the API (`?sort=age:desc&q=teh&cursor=…`)? Offset vs cursor pagination.
- 50,000 rows client-side: `useMemo`, `useDeferredValue` for the filter input, row virtualization.
- Multi-column sort (Shift+click), column resizing, sticky headers, selection with "select all on this page vs all pages".
- Locale-aware sorting: `Intl.Collator` (Persian, German umlauts, numbers inside strings with `{ numeric: true }`).

## Run

```bash
npm test react/03-data-table
npm run test:solution react/03-data-table
npm run dev   # then open "react / 03-data-table"
```
