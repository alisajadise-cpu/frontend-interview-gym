# JavaScript

Each folder has a `README.md` (the spec), `index.ts` (your code), `index.test.ts`, and `solution.ts`.

```bash
npm test js/03                 # your code, watch mode
npm run test:solution js/03    # the reference solution
```

| # | Exercise | What it really tests | Time |
|---|---|---|---|
| 01 | [Debounce (lodash-grade)](01-debounce/README.md) | leading/trailing, `maxWait`, `cancel`/`flush`, `this` | 30–40 min |
| 02 | [Throttle](02-throttle/README.md) | edge semantics, latest args, cancel/flush | 30 min |
| 03 | [Promise pool / `mapLimit`](03-promise-pool/README.md) | concurrency limit, order, fail-fast, `AbortSignal` | 30 min |
| 04 | [Retry with backoff](04-retry-with-backoff/README.md) | exponential backoff, jitter, `Retry-After`, abort | 35 min |
| 05 | [Your own Promise](05-my-promise/README.md) | Promises/A+, microtasks, thenables, `all`/`any`/`race` | 60 min |
| 06 | [Deep clone](06-deep-clone/README.md) | cycles, Map/Set/Date/RegExp, prototypes, symbols | 30 min |
| 07 | [Deep equal](07-deep-equal/README.md) | SameValueZero, Map/Set, cycles | 35 min |
| 08 | [LRU cache with TTL](08-lru-cache-ttl/README.md) | O(1) doubly linked list + Map, lazy expiry | 40 min |
| 09 | [Typed event emitter](09-event-emitter/README.md) | mutation during emit, error isolation, generics | 30 min |
| 10 | [DataLoader](10-dataloader/README.md) | batching per tick, N+1, per-key errors | 45 min |
| 11 | [Query client (React Query core)](11-query-client/README.md) | dedupe, staleTime, invalidation, races, GC | 60 min |
| 12 | [Priority task queue (p-queue)](12-task-queue/README.md) | concurrency, priority, pause, `onIdle`, abort | 45 min |
| 13 | [Virtual list math (TanStack Virtual)](13-virtual-range/README.md) | prefix sums, binary search, measured sizes | 45 min |
| 14 | [Undo / redo with coalescing](14-undo-redo/README.md) | history stacks, batching, typing coalescing | 40 min |
| 15 | [Immer `produce`](15-immer-produce/README.md) | Proxy, copy-on-write, structural sharing | 60 min |

## Quizzes (predict the output, then open the answer)

- [Event loop: microtasks, macrotasks, async/await](quiz/event-loop.md)
- [`this`, closures, hoisting, coercion](quiz/this-closures-coercion.md)

Every quiz answer was checked by running the code in Node.
