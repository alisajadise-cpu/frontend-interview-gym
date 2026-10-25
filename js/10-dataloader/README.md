# 10 · DataLoader (batching + caching)

**Difficulty:** Hard · **Time:** 40–50 min · **Similar to:** `graphql/dataloader` (Facebook), the "N+1 requests" problem in GraphQL and REST BFFs

## Why companies ask this

A list of 50 posts renders 50 `<Author id=… />` components. Each one calls `getUser(id)`. That's 50 requests (the **N+1 problem**). DataLoader collects every `load(id)` made in the same tick and sends **one** request: `GET /users?ids=1,2,3…`. Facebook built it for GraphQL. The same idea shows up in frontends, BFFs and analytics batchers. It tests your understanding of the event loop (microtasks), promises and caching.

## Task

Implement `createLoader(batchFn, options)` in `index.ts`.

```ts
const users = createLoader(async (ids: readonly string[]) => {
  const rows = await api.getUsers(ids);            // ONE request
  return ids.map((id) => rows.find((r) => r.id === id) ?? new Error(`No user ${id}`));
});

const [a, b] = await Promise.all([users.load('1'), users.load('2')]); // batchFn(['1', '2'])
```

## Requirements

1. All `load(key)` calls made in the same tick are sent to `batchFn` in **one** call. The default scheduler is `queueMicrotask`. `options.scheduler(cb)` replaces it (for example `cb => setTimeout(cb, 10)` to batch over a time window).
2. Keys are passed in the order they were first requested. A key requested twice in the same batch is passed **once**. Both callers get the same value.
3. `batchFn` must return an array with the **same length** as `keys`. Values are matched by index. If the length is wrong, every `load` of that batch rejects with an `Error`.
4. If a value in the result array is an `Error` instance, only **that** key's `load` rejects with it. The other keys resolve.
5. If `batchFn` itself rejects (or throws), every `load` of that batch rejects with that error.
6. `maxBatchSize`: a batch never has more keys than this. Extra keys go to more `batchFn` calls.
7. **Cache** (default `cache: true`): `load(key)` for a key already requested returns the **same promise**, and doesn't call `batchFn` again. With `cache: false`, every tick asks again (but requirement 2 still holds).
8. Failed keys (requirements 3, 4 and 5) are **removed from the cache**, so a later `load` retries them.
9. `clear(key)` and `clearAll()` remove cached entries. `prime(key, value)` puts a value in the cache if the key isn't there yet. All three return the loader, for chaining.
10. `loadMany(keys)` returns a promise of an array in which each item is the value or the `Error` (it never rejects).

## Edge cases interviewers probe

- `load` called inside a `.then()` of another load: that is a **new tick**, so a new batch.
- Why a microtask and not `setTimeout(0)`? (Batches within the current task without delaying paint or I/O.)
- Ordering: the result for `keys[i]` must go to the callers of `keys[i]`, even when the backend returns rows in another order. This is the user's job inside `batchFn`, and the README example shows how.

## Follow-ups

- Should the cache live forever? (No. One loader **per request** on the server, so users don't see each other's data. On the client, use a TTL or a normalized cache.)
- How is this different from React Query's dedupe? (Dedupe = same key at the same time. Batching = *different* keys combined into one request.)
- Server side: how would you design the `GET /users?ids=` endpoint? Think about the URL length limit, partial failures and per-item status.

## Run

```bash
npm test js/10-dataloader
npm run test:solution js/10-dataloader
```
