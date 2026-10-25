# Perf 07 · Answers

## The timeline

Buggy (each request = 1 round trip, RTT):

```
getUser ─────┐
             └─ getPosts ─────┐
                              ├─ getCommentCount(p1)
                              ├─ getCommentCount(p2)   ← N requests
                              └─ getCommentCount(pN)
total: 3 RTT + N requests (plus refetches)
```

Fixed:

```
getUser  ──────
getPosts ──────┐
               └─ getCommentCounts([p1…pN])
total: 2 RTT, 3 requests
```

## Issues, ranked by impact

| # | Issue | What the user notices | How to prove it |
|---|---|---|---|
| 1 | **Waterfall:** `Posts` only mounts after the user loads, but the posts request only needs `userId`, which we already have from the route | +1 full round trip. On a 300 ms mobile RTT that's +300 ms before content | Network panel *Waterfall* column: a staircase. The Initiator column shows each request was started by the previous one's component. |
| 2 | **N+1:** each `PostItem` fetches its own comment count | 20 posts = 20 extra requests. Browsers limit ~6 HTTP/1.1 connections per host, so they queue. Server load ×N | Network panel request count. Backend logs. |
| 3 | The `filters={{ sort: 'new' }}` object literal is a new object every render, and it's an effect dependency | Every parent re-render refetches the posts (and then every comment count) | Network panel while interacting with unrelated UI. |
| 4 | **Race condition:** no cleanup or ignore flag | Fast navigation Ada → Bob: Ada's slow response arrives last and overwrites Bob's page. **Wrong data on screen** | Throttle the network to "Slow 3G", click between profiles quickly. |
| 5 | Effect deps miss `api` | A stale API client after logout or a tenant switch | `react-hooks/exhaustive-deps`. |
| 6 | Loading UI is nested: nothing about posts shows until the user arrives | Content pops in late, one piece at a time | Filmstrip in the Performance panel. |

## The fixes (see `solution.tsx`)

1. **Start independent requests together.** Hoist data fetching to the top of the tree (or the route), and start every request that depends only on the URL **at the same time**.
2. **Batch dependent requests:** `getCommentCounts(ids)`, or include `commentCount` in the posts response (best: zero extra requests). If the backend can't batch, a **DataLoader**-style batcher collects all `load(id)` calls in one tick into one request.
3. **Stable effect deps:** constants at module scope, or depend on primitives (`filters.sort`).
4. **Ignore stale responses** with `let ignore = false` + cleanup, or `AbortController`.
5. **Show each part as soon as its data is ready.**

## How real apps avoid waterfalls

- **Render-as-you-fetch:** start fetching *before* rendering (on route change, or on hover/intent), then render with Suspense. Fetch-on-render (`useEffect` in each component) is what creates waterfalls.
- **Route loaders:** React Router `loader`, TanStack Router `loader`, and Remix all fetch in parallel for the matched routes before rendering.
- **React Query:** `queryClient.prefetchQuery` in the loader + `useQuery`/`useSuspenseQuery` in components. Use `useQueries` for parallel queries.
- **Next.js App Router (Server Components):**
  ```tsx
  export default async function Page({ params }) {
    const [user, posts] = await Promise.all([getUser(params.id), getPosts(params.id)]);
    // or: start both, await separately inside <Suspense> boundaries to stream
  }
  ```
  Server-to-database latency is ~1 ms instead of a 100+ ms client RTT, so even a sequential fetch is cheaper on the server. Two `await`s in a row are still a waterfall, so use `Promise.all`, or start the promises first and await later.
- **GraphQL / BFF:** one query returns user + posts + counts (Relay uses fragments to collect each component's data needs into one query).
- **HTTP/2 / HTTP/3 multiplexing** removes the 6-connection limit, so N+1 hurts less on the network. It still costs server work and RTT when requests are sequential. Multiplexing doesn't fix waterfalls.
- **`<link rel="preload">` / `fetchpriority`** for critical resources the browser would discover late.

## Senior talking points

- "Fetch where you render" is great for colocation but causes waterfalls. The fix is to **hoist the starting of the fetch**, not the data ownership: components can still read from a shared cache.
- Count the round trips and multiply by mobile RTT: that is the number your PM cares about.
- Combine with INP/LCP thinking: the posts list is likely the LCP element, so its data request should start as early as possible.
