# 05 · Infinite Feed (cursor pagination + IntersectionObserver)

**Difficulty:** Hard · **Time:** 45 min · **Similar to:** Twitter/X, Instagram and LinkedIn feeds; GreatFrontEnd system design *News Feed*; the "infinite scroll" UI round at many product companies

## Why companies ask this

Infinite scroll is in almost every consumer app. The naive version (a scroll listener that fetches page N+1) has real production bugs: **duplicate requests** while one is in flight, **duplicate items** when new posts shift the pages, no way to recover from errors, requests that resolve after unmount, and a scroll handler that runs hundreds of times per second. Interviewers want to see `IntersectionObserver`, cursor pagination, and careful async state.

## Task

Build `<InfiniteFeed />` in `index.tsx`.

```tsx
type Page = { items: { id: string; title: string }[]; nextCursor: string | null };

<InfiniteFeed fetchPage={(cursor, signal) => api.feed({ cursor, signal })} />
// cursor is null for the first page; nextCursor === null means there are no more pages.
```

## Requirements

1. On mount, load the first page with `fetchPage(null, signal)`.
2. Render the list as an element with `role="feed"` and each item as an `<article>` (role `article`) that shows the item's `title`.
3. After the list, render a **sentinel** element and watch it with `IntersectionObserver`. When it intersects, load the next page using the last `nextCursor`.
4. **Never** have more than one request in flight. Intersections while loading are ignored.
5. Pages can overlap (new posts were added on the server). **Dedupe items by `id`** and keep the first occurrence.
6. While loading, the feed has `aria-busy="true"` (otherwise `"false"`) and the text `Loading…` is shown.
7. If a request fails, show `Something went wrong` and a `Retry` button. Retry loads **the same cursor** again. Don't auto-load on intersection while in the error state.
8. When `nextCursor` is `null`, show `You're all caught up` and stop observing (disconnect the observer). No more requests.
9. On unmount, **abort** the in-flight request (`signal.aborted === true`) and disconnect the observer. Ignore results of aborted requests.

## Edge cases interviewers probe

- Why `IntersectionObserver` instead of a `scroll` listener + `getBoundingClientRect()`? (No main-thread work per scroll event, no forced layout.)
- `rootMargin: '400px'` to start loading before the user hits the bottom.
- A short first page that doesn't fill the screen: the sentinel is visible right away. Does the next page still load? (It should, after the first request finishes.)
- React StrictMode mounts, unmounts and mounts again. Do you end up with two first-page requests or a stuck "loading" flag?

## Follow-ups

- **Cursor vs offset** pagination: why offsets give duplicates/missing items when new posts are inserted at the top.
- 10,000 loaded items: virtualize the list, keep the scroll position when going back (bfcache, `history.scrollRestoration`, storing the cursor).
- "New posts" pill at the top (polling or WebSocket) without jumping the user's scroll position.
- Accessibility of feeds: the WAI-ARIA `feed` pattern, `aria-setsize` / `aria-posinset`, Page Down between articles.

## Run

```bash
npm test react/05-infinite-feed
npm run test:solution react/05-infinite-feed
npm run dev   # then open "react / 05-infinite-feed"
```
