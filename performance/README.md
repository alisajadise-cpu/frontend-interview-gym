# Performance

Each exercise is a **bug report plus real-looking production code** that works but is slow, leaky, or subtly wrong. Your job is the same as in a senior interview:

1. **Review first.** List every issue, what the user would notice, and how you'd *prove* it (React Profiler, the Performance panel, the Memory panel, the Network tab).
2. **Fix** `index.tsx` until the tests pass. The tests measure render counts, request counts, leaked timers and listeners, and DOM read/write order.
3. Compare with `ANSWERS.md` (ranked issues + talking points) and `solution.tsx`.

```bash
npm test performance/04
npm run test:solution performance/04
npm run dev    # profile the buggy vs fixed version in the browser
```

Keep the `probe()` / `useMountProbe()` calls in place. The tests use them to count renders and mounts.

| # | Bug report | Main topics |
|---|---|---|
| 01 | [Chat room that gets slower the longer you use it](01-chat-room/README.md) | inline components, state colocation, request dedupe, stale closures, forced reflow |
| 02 | [Product grid that forgets your quantities](02-product-grid/README.md) | index keys, prop mutation, broken `memo`, `useMemo`, `useDeferredValue` |
| 03 | [One context to rule them all](03-context-rerenders/README.md) | context re-renders, splitting contexts, `useSyncExternalStore` |
| 04 | [The 10,000-row orders table](04-orders-table/README.md) | O(n²) selection, stable callbacks, expensive derived values, listener leaks |
| 05 | [Layout thrashing in an "equal height" grid](05-layout-thrashing/README.md) | forced reflow, read/write batching, rAF throttling |
| 06 | [The dashboard that eats memory](06-memory-leaks/README.md) | subscriptions, timers, listeners, unbounded caches, abort on unmount |
| 07 | [The profile page waterfall](07-request-waterfall/README.md) | request waterfalls, N+1, batching, parallel fetching |

## Read-only code reviews (no code to run)

Practice spotting issues fast, out loud, in 10–15 minutes each:

- [code-review-snippets.md](review/code-review-snippets.md): 6 short snippets (product list, search, context, big table, vanilla DOM, Next.js page)
- [nextjs-dashboard.md](review/nextjs-dashboard.md): an App Router page with bundle, hydration and CLS problems
- [hard-chat-review.md](review/hard-chat-review.md): the chat-room review as a reading exercise
