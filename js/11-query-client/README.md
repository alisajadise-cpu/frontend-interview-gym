# 11 · Query Client (the core of React Query)

**Difficulty:** Hard · **Time:** 50–60 min · **Similar to:** TanStack Query's `QueryCache` / `QueryObserver` internals, SWR, Apollo cache, "design a data-fetching layer" questions

## Why companies ask this

Every serious frontend has a server-state layer. Interviewers at product companies love asking "how does React Query work?" because it covers request deduplication, stale-while-revalidate, subscriptions, race conditions and memory management (garbage collection) in one small piece of code. If you can build this, you can explain every `useQuery` option.

## Task

Implement `createQueryClient(options)` in `index.ts`. There's no React here: this is the framework-agnostic core. `react/07-use-query` builds a hook on top of the same ideas.

```ts
const client = createQueryClient({ staleTime: 30_000, gcTime: 5 * 60_000 });

const unsubscribe = client.subscribe('user:1', (state) => render(state));
await client.fetchQuery('user:1', () => api.getUser(1));
client.invalidate('user:1');                     // subscribers exist → refetch
client.setQueryData('user:1', (u) => ({ ...u, name: 'Ali' })); // optimistic update
unsubscribe();                                   // after gcTime the entry is deleted
```

## Requirements

**State.** `getQueryState(key)` returns `{ status, data, error, updatedAt, isFetching }`.
- An unknown key: `{ status: 'idle', data: undefined, error: null, updatedAt: 0, isFetching: false }`.
- `status` is `'pending'` only while there is **no data yet**. A refetch with existing data keeps `status: 'success'` and `data`, and sets `isFetching: true` (stale-while-revalidate).
- On error: `status: 'error'`, `error` is set, `isFetching: false`, and old `data` is **kept**.
- On success: `status: 'success'`, `error: null`, `updatedAt: Date.now()`.
- Every change produces a **new** state object. If nothing changed, `getQueryState` returns the **same** object (so it works with `useSyncExternalStore`).

**`fetchQuery(key, fn)`**
1. If a fetch for `key` is in flight, return that promise. Don't call `fn` again (dedupe).
2. If the data is **fresh** (`Date.now() - updatedAt < staleTime`, and not invalidated), resolve with the cached data without calling `fn`.
3. Otherwise call `fn` and return a promise of its result. The promise rejects if `fn` rejects.
4. Default `staleTime` is `0`, which means the data is stale right away.

**`subscribe(key, listener)`** calls `listener(state)` on every state change of that key and returns an unsubscribe function.

**`invalidate(key)`** marks the data as stale. If the key has subscribers, it **immediately refetches** with the last `fn` used for that key, even if a fetch is in flight.

**Race safety.** If an older fetch finishes after a newer fetch for the same key **started**, the older result (or error) is ignored. It must never overwrite newer data.

**`setQueryData(key, updaterOrValue)`** sets data directly: `status: 'success'`, `updatedAt: now`. The updater gets the old data.

**Garbage collection.** When the **last** subscriber of a key unsubscribes, start a `gcTime` timer (default 5 minutes). When it fires, delete the entry (`getQueryState` returns the idle state again). If someone subscribes before then, cancel the timer.

## Edge cases interviewers probe

- Two components mount at the same time and both call `fetchQuery`: exactly one request.
- `invalidate` during a slow fetch: the user must see the **new** data, even if the old response arrives last.
- A failed refetch should not wipe data the user is looking at.
- Why does GC wait for `gcTime` instead of deleting right away? (Back/forward navigation and tab switches should show cached data instantly.)

## Follow-ups

- Add `AbortSignal` support: abort the old fetch when a newer one starts.
- Retries with exponential backoff (see `js/04-retry`), `refetchOnWindowFocus`, `refetchInterval`.
- Entries that were fetched but never subscribed: when should they be collected? (React Query schedules GC for them too.)
- Query keys as arrays (`['user', id]`): how do you hash them, and how do you invalidate by prefix?
- Normalized caches (Apollo, Relay) vs document caches (React Query): trade-offs.

## Run

```bash
npm test js/11-query-client
npm run test:solution js/11-query-client
```
