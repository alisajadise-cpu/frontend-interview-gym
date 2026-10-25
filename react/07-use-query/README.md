# 07 · useQuery: a mini React Query

**Difficulty:** Hard · **Time:** 60 min · **Similar to:** GreatFrontEnd *useQuery*, TanStack Query `useQuery`, SWR `useSWR`

## Why companies ask this

Every app fetches data, and most bugs live there: duplicate requests, a spinner shown over data you already have, the wrong user's data shown for a moment after navigation, and requests that keep running after the user leaves the page. Writing a small version of React Query shows you understand **caching, deduplication, stale-while-revalidate, cancellation and `useSyncExternalStore`**. These are the ideas behind the libraries you use every day.

## Task

Implement `useQuery` and `resetQueryCache` in `index.tsx`.

```tsx
function Profile({ id }: { id: string }) {
  const { data, error, status, isFetching, refetch } = useQuery(
    `user-${id}`,
    (signal) => fetch(`/api/users/${id}`, { signal }).then((r) => r.json()),
    { staleTime: 30_000 },
  );
  if (status === 'pending') return <Spinner />;
  if (status === 'error') return <ErrorView error={error} onRetry={refetch} />;
  return <h1>{data.name} {isFetching ? '(updating…)' : null}</h1>;
}
```

## Requirements

1. The cache lives at **module level** and is shared by all components. `resetQueryCache()` clears it and aborts every in-flight request.
2. Return `{ data, error, status, isFetching, refetch }`.
   - `status` is `'pending'` (no data yet), `'success'` or `'error'`.
   - `isFetching` is `true` while a request for this key is in flight, including background refetches.
3. **Dedupe:** components that use the same key at the same time share **one** request.
4. **Fresh data** (younger than `staleTime` ms, default `0`) shows immediately on mount, with **no request**.
5. **Stale data** shows immediately, and a background refetch starts (`status: 'success'`, `isFetching: true`). When it finishes, the new data replaces the old.
6. When the `key` changes, **never** return the previous key's data as the new key's data. The new key starts in `pending` unless it's already cached.
7. A late response for an old key must not appear under the new key.
8. **Cancellation:** abort the request (via the `AbortSignal` passed to `fetcher`) when the **last** component subscribed to that key unmounts or switches to another key. If other components still use the key, don't abort.
9. `enabled: false` doesn't fetch. `status` stays `'pending'` and `isFetching` stays `false`. Turning it back on fetches.
10. `refetch()` always starts a request, even when the data is fresh (unless one is already in flight).
11. On error, `status` is `'error'` and `error` is the thrown value. `refetch()` can recover.
12. Subscribe to the cache with **`useSyncExternalStore`**. Each change must produce a **new snapshot object**, and the same object while nothing changed.
13. The caller may pass a new inline `fetcher` every render. That must not cause new requests.

## Edge cases interviewers probe

- Why `useSyncExternalStore` and not `useState` + `useEffect`? (Tearing in concurrent rendering, and every component sees the same snapshot.)
- What happens if `getSnapshot` returns a new object every time? (An infinite loop, and React warns about it.)
- The fetcher closes over props. How do you always call the latest one without refetching on every render?
- StrictMode mounts, unmounts and mounts again. Does your abort logic cause a second request? Is that acceptable?

## Follow-ups

- `keepPreviousData` / `placeholderData` for pagination (show page 1 while page 2 loads).
- Garbage collection: remove entries with no subscribers after `gcTime` (TanStack's default is 5 minutes).
- Refetch on window focus and on reconnect (`visibilitychange`, `online` events).
- Retries with exponential backoff. Which errors should *not* be retried (4xx)?
- Mutations and invalidation: after `createTodo`, how do you mark `['todos']` as stale?
- SSR: how do you send the server's cache to the client (dehydrate/hydrate) without a second fetch?

## Run

```bash
npm test react/07-use-query
npm run test:solution react/07-use-query
npm run dev   # then open "react / 07-use-query"
```
