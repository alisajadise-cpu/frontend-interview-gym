# React

Each folder has a `README.md` (the spec), `index.tsx` (your code), `index.test.tsx`, `solution.tsx`, and `demo.tsx`. The demo shows the component with fake data in `npm run dev`.

```bash
npm test react/04              # your code, watch mode
npm run test:solution react/04 # the reference solution
npm run dev                    # try it in the browser, toggle My code / Solution
```

| # | Exercise | What it really tests | Time |
|---|---|---|---|
| 01 | [Autocomplete / typeahead](01-autocomplete/README.md) | debounce, race conditions, abort, cache, ARIA combobox | 45–60 min |
| 02 | [Nested checkboxes](02-nested-checkboxes/README.md) | derived tri-state, recursion, `indeterminate` | 40 min |
| 03 | [Generic data table](03-data-table/README.md) | sort/filter/paginate, generics, `aria-sort`, no prop mutation | 45 min |
| 04 | [Modal dialog](04-modal-dialog/README.md) | portal, focus trap, restore focus, scroll lock, stacking | 45 min |
| 05 | [Infinite feed](05-infinite-feed/README.md) | IntersectionObserver, cursor paging, dedupe, retry | 45 min |
| 06 | [Concurrent progress bars](06-progress-bars/README.md) | timers, concurrency limit, pause/resume, no leaks | 40 min |
| 07 | [`useQuery` hook](07-use-query/README.md) | shared cache, dedupe, SWR, `useSyncExternalStore`, abort | 60 min |
| 08 | [Store + selectors (Zustand-like)](08-store-selector/README.md) | subscriptions, selective re-renders, `shallow` | 45 min |
| 09 | [Virtual list](09-virtual-list/README.md) | windowing, overscan, `scrollToIndex`, a11y | 45 min |
| 10 | [Optimistic todos](10-optimistic-todos/README.md) | optimistic UI, rollback of one change, concurrent mutations | 60 min |
| 11 | [OTP / auth code input](11-otp-input/README.md) | focus management, paste, keyboard, `onComplete` | 35 min |

## Concepts

[concepts.md](concepts.md): 25 senior-level React 19 questions (reconciliation, effects, memoization, concurrent rendering, Server Components, hydration, `useSyncExternalStore`, `useOptimistic`, …). Answer each one out loud before you open the answer.
