# 02 · News Feed — Solution

## 1. Requirements

### Functional
1. Show a feed of posts, ranked by the server, loading more as the user scrolls (infinite scroll).
2. Create a post with text and up to 4 images.
3. React to a post (one reaction type per user per post), and remove a reaction.
4. See that new posts are available while reading ("12 new posts" pill), and load them on click.
5. Open a post's detail page (shareable, public, SEO-friendly).

**Out of scope:** comment threads, video, stories, ads (mention that ads would be feed items of another type).

### Non-functional
- **Fast first load:** feed visible in under 2 s on a mid-range phone on 4G (LCP under 2.5 s).
- **Smooth scrolling:** 60 fps, no jank even after 500+ posts (memory must not grow without limit).
- **Responsive interactions:** reacting feels instant (INP under 200 ms, optimistic UI).
- **Data saving:** responsive images, no loading of offscreen media.
- **Resilient:** works on flaky networks, shows the cached feed offline.
- **Accessible** and **RTL-ready**.

---

## 2. Architecture

```
                     ┌─────────────────────────────────────────────┐
                     │                   Browser                    │
                     │                                              │
                     │  ┌────────────── View layer ──────────────┐  │
                     │  │ <FeedPage>                              │  │
                     │  │   <Composer/>  <NewPostsPill/>          │  │
                     │  │   <VirtualFeed> <PostCard/> × N         │  │
                     │  └──────────────▲──────────────┬───────────┘  │
                     │       subscribe │              │ actions      │
                     │  ┌──────────────┴──────────────▼───────────┐  │
                     │  │ Client store (normalized)                │  │
                     │  │  posts{id→Post} users{id→User}           │  │
                     │  │  feed{ids[], cursor, pendingNewIds[]}    │  │
                     │  │  optimistic mutations queue              │  │
                     │  └──────────────▲──────────────┬───────────┘  │
                     │                 │              │              │
                     │  ┌──────────────┴──────────────▼───────────┐  │
                     │  │ Network layer                            │  │
                     │  │  REST/GraphQL client · retry · dedupe    │  │
                     │  │  real-time channel (SSE / WebSocket)     │  │
                     │  └──────────────▲──────────────┬───────────┘  │
                     │  ┌──────────────┴──────────────┴───────────┐  │
                     │  │ Service worker: app shell, offline feed  │  │
                     │  │ IndexedDB: last feed page, draft outbox  │  │
                     │  └─────────────────────────────────────────┘  │
                     └──────────────────┬──────────────▲──────────────┘
                                        │ HTTPS        │ SSE / WS
                     ┌──────────────────▼──────────────┴──────────────┐
                     │ CDN: JS/CSS (immutable), images (resized, AVIF) │
                     └──────────────────┬──────────────────────────────┘
                     ┌──────────────────▼──────────────────────────────┐
                     │ API gateway → Feed service · Post service ·     │
                     │ Reaction service · Media upload · Notifications │
                     └─────────────────────────────────────────────────┘
```

### Rendering strategy

- **Feed page (behind login):** SSR the **first page** of posts (or stream it with Suspense). This gives a fast LCP and no loading spinner on the first paint. Then hydrate, and load more on the client. If SSR is too expensive at this scale, use CSR with a fast app shell from the service worker plus the cached feed from IndexedDB. Both are fine. Say the trade-off.
- **Post detail page (public):** SSR/ISR with Open Graph meta tags for link previews and SEO.
- With React Server Components, the post card body (text, images) can be a server component, and only interactive parts (reactions, menu) ship JS.

### Main data flows

**Initial load:** HTML with first page → hydrate → store normalized → observe the sentinel near the bottom.

**Scroll:** sentinel enters a "prefetch zone" (e.g. 2 screens before the end) → `GET /feed?cursor=...` → append ids → render.

**React:** click → optimistic update in store (count+1, myReaction) → `PUT /posts/:id/reaction` → on success keep; on failure roll back and show a toast.

**New posts:** real-time channel says "new posts available" → store keeps their ids in `pendingNewIds` → show the pill → on click, prepend them and scroll to top.

---

## 3. Data model

```ts
type ID = string;

interface User {
  id: ID;
  name: string;
  handle: string;
  avatarUrl: string;
}

type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

interface Media {
  id: ID;
  type: 'image';
  url: string;                // base URL; client asks for sizes via srcset
  width: number;              // needed to reserve space → no layout shift (CLS)
  height: number;
  alt: string;
  blurhash?: string;          // tiny placeholder while loading
}

interface Post {
  id: ID;
  authorId: ID;               // normalized: user lives in users map
  createdAt: string;          // ISO; formatted on the client with Intl
  text: string;
  media: Media[];
  linkPreview?: { url: string; title: string; imageUrl?: string };
  reactionCounts: Partial<Record<ReactionType, number>>;
  myReaction: ReactionType | null;
  commentCount: number;
  // client-only fields
  _optimistic?: boolean;      // created locally, not yet confirmed
  _clientId?: string;         // idempotency key for the create request
}

interface FeedState {
  ids: ID[];                  // ordered post ids shown in the feed
  nextCursor: string | null;  // null = end of feed
  status: 'idle' | 'loading' | 'error';
  pendingNewIds: ID[];        // arrived in real time, not shown yet
}

interface Store {
  users: Record<ID, User>;
  posts: Record<ID, Post>;
  feed: FeedState;
}
```

**Why normalize?** The same user appears in many posts. When they change their avatar, we update one record. When a reaction changes in the detail page, the feed card updates too, because both read `posts[id]`. React Query + a normalized layer (or Relay/Apollo's normalized cache) gives this.

**Where state lives:**

| State | Where |
|---|---|
| Posts, users, feed ids | Normalized client cache (server state) |
| Composer draft | Local state, persisted to `localStorage`/IndexedDB on change (debounced) |
| Which post menu is open | Local component state |
| Scroll position | `sessionStorage` / history state, for back navigation |
| Feed type filter ("Following" / "For you") | URL query param |

---

## 4. Interface (API)

### Feed — cursor pagination

```
GET /api/feed?cursor=eyJ0cyI6...&limit=10
→ 200
{
  "posts": [Post, ...],          // with authorId
  "users": { "u1": User, ... },  // side-loaded, deduped
  "nextCursor": "eyJ0cyI6..." | null
}
```

**Why cursor, not offset?** New posts are inserted at the top all the time. With `?page=2` (offset 10), when 3 new posts arrive, page 2 now starts 3 posts earlier, so the user sees **duplicates**. When posts are deleted, they **miss** posts. A cursor is an opaque pointer to "after this item" (e.g. encoded rank + id), so pages stay stable. The client must still **dedupe by id** when appending, as a safety net.

### Create post

```
POST /api/posts
Idempotency-Key: 6f1c...        // same key on retry → no duplicate posts
{ "text": "...", "mediaIds": ["m1", "m2"] }
→ 201 { "post": Post, "user": User }
```

Media upload is separate and starts **while the user is typing**:

```
POST /api/media/upload-url  { "contentType": "image/jpeg", "size": 2400000 }
→ { "uploadUrl": "https://storage.../signed", "mediaId": "m1" }
PUT <uploadUrl>  (binary, directly to storage, with progress events)
```

Resize/compress images on the client before upload (canvas or `createImageBitmap`, max ~2048 px, WebP/JPEG). This saves upload time on mobile.

### Reactions

```
PUT    /api/posts/:id/reaction   { "type": "love" }   → 200 { "reactionCounts": {...}, "myReaction": "love" }
DELETE /api/posts/:id/reaction                        → 200 { ... }
```

`PUT` is idempotent: double clicks or retries don't double count. The response returns the server's truth, which replaces the optimistic value.

### Real-time

```
GET /api/feed/stream   (Server-Sent Events)
event: new_posts
data: { "count": 3, "newestId": "p987" }

event: post_updated
data: { "id": "p123", "reactionCounts": {...} }
```

**SSE vs WebSocket vs polling:**
- The feed only needs **server → client** messages, so **SSE** is enough. It's plain HTTP, works through proxies, and reconnects automatically (`Last-Event-ID`).
- WebSocket if the app already has one for chat/notifications. Then **multiplex** feed events on the same socket. Don't open a second connection.
- Polling every 30–60 s is the simple fallback, and fine for "new posts" counts.
- Don't push full post objects for every new post to every client. Send a **signal**, and let the client fetch `GET /feed?after=<newestId>` when the user clicks the pill.

Reaction counts on posts you're looking at: subscribe only to visible post ids, or simply refresh counts when a card comes into view after being away for a while. Updating every count live for every post is costly and mostly invisible.

---

## 5. Optimizations

### 5.1 Infinite scroll

- Use **`IntersectionObserver`** on a sentinel element near the end of the list, with `rootMargin: '0px 0px 1500px 0px'` to start loading about 2 screens early. Never use scroll event listeners with `getBoundingClientRect` on every scroll.
- **Guard against double loads:** don't request if `status === 'loading'` or `nextCursor === null`.
- Show **skeleton cards** at the end while loading. On error, show "Couldn't load more · Retry" instead of a silent failure.
- Provide a real "Load more" button as a fallback for keyboard and screen reader users, and for when JS observers fail.

### 5.2 Virtualization (long sessions)

- After hundreds of posts, the DOM has thousands of nodes (images, buttons), which slows style, layout and memory. **Virtualize**: render only the posts near the viewport plus an overscan buffer.
- Feed items have **variable heights** (text length, images). Use a virtualizer that **measures** items after render (ResizeObserver) and keeps an estimate for unmeasured items (TanStack Virtual, react-virtuoso). Image `width`/`height` from the API let us estimate well before the image loads.
- Cheaper alternative: **`content-visibility: auto`** + `contain-intrinsic-size` on each card. The browser skips rendering offscreen cards but they stay in the DOM (good for Ctrl+F and a11y). A good middle step before full virtualization.
- Also limit memory: drop data for posts far above (e.g. > 300 posts back) and re-fetch them if the user scrolls back.

### 5.3 Scroll restoration

When the user opens a post and comes back, they must land in the same place. Save `{ feedIds, cursor, scrollAnchorId, offset }` in history state / `sessionStorage`. On return, render from cache (no refetch) and scroll to the anchor post. Anchor-based restore (a post id) works even when heights change, while a raw `scrollY` doesn't.

### 5.4 New posts without layout jumps

- Never insert new posts above what the user is reading. Show the pill instead.
- When the user clicks it: prepend, then scroll to top with focus on the first new post.
- CSS `overflow-anchor` (scroll anchoring) prevents jumps when content above the viewport changes size, for example an image loading above.

### 5.5 Images and media

- `srcset` + `sizes` with CDN resizing (`?w=480`, `?w=960`), AVIF/WebP with JPEG fallback.
- Always set `width`/`height` (or `aspect-ratio`) to avoid CLS.
- `loading="lazy"` and `decoding="async"` for offscreen images. **The first post's image** gets `fetchpriority="high"` and is not lazy, because it's often the LCP element.
- Blurhash/dominant-color placeholder.
- Respect `Save-Data` / `navigator.connection.saveData`: serve smaller images, don't autoplay anything.

### 5.6 JS and rendering

- Code-split: composer, image editor, reactions picker, and post detail route load on demand (prefetch the composer on idle, the reactions picker on hover/long-press).
- `PostCard` is memoized and receives an **id**. It subscribes to `posts[id]` with a selector. A reaction on one post re-renders one card, not the feed.
- Format timestamps with `Intl.RelativeTimeFormat` and update them with **one** shared timer every minute, not one timer per card.
- Long text: clamp with CSS (`line-clamp`) and a "See more" button.

### 5.7 Optimistic updates

```
react(postId, type):
  snapshot = posts[postId]
  apply optimistic: adjust counts, myReaction = type
  send PUT
  on success: replace with server counts
  on error: if posts[postId] still has OUR optimistic value → restore snapshot; toast "Couldn't react"
```

Watch out for **out-of-order responses**: the user clicks like, unlike, like fast. Either serialize mutations per post (queue), or tag each with a sequence number and ignore responses older than the latest. React Query's `onMutate`/`onError` + `cancelQueries` covers the common case.

**Optimistic post creation:** insert a post with a temporary id and `_optimistic: true` at the top (greyed out with "Posting…"). Replace it with the server post on success (match by `_clientId`). On failure keep it with "Failed · Retry · Delete". Don't lose the user's text.

### 5.8 Offline and network resilience

- Service worker caches the app shell (stale-while-revalidate for JS/CSS).
- Store the last feed page(s) in IndexedDB. Offline → show them with a banner "You're offline. Showing saved posts."
- Composer drafts saved locally. Posts created offline go to an **outbox** in IndexedDB and are sent with their idempotency key when back online (Background Sync where supported, otherwise on the `online` event).

### 5.9 Accessibility

- Use the ARIA **`feed`** pattern: container `role="feed"` with `aria-busy="true"` while loading. Each post is an `<article>` with `aria-posinset`, `aria-setsize` (`-1` if unknown), and `aria-labelledby` pointing at the author/heading.
- Keyboard: `Page Down`/`Page Up` move between articles (feed pattern). Each card's interactive elements are reachable with Tab.
- Infinite scroll traps keyboard users from reaching the footer. Offer a "Skip to end of feed" link, or keep important links in a sidebar/header.
- Announce "12 new posts loaded" via `aria-live="polite"` when the user clicks the pill.
- Reaction buttons: `aria-pressed` for the selected reaction, and a label like "Love, 128 reactions".
- Images need alt text: prompt for it in the composer.

### 5.10 i18n / RTL

- Logical CSS properties everywhere, `dir` on `<html>`.
- User text in a post may be in a different direction than the UI: `dir="auto"` on the post body. `<bdi>` around user names in sentences ("<bdi>علی</bdi> liked your post").
- Relative time and counts via `Intl` ("2 hr", "۲ ساعت"; compact numbers "1.2K" via `Intl.NumberFormat({ notation: 'compact' })`).

### 5.11 Security

- Post text is rendered as text. Mentions, hashtags and links are parsed into tokens and rendered as React elements, never as HTML strings.
- Link previews are generated on the **server** (the client never fetches arbitrary URLs). Preview images are served via our image proxy/CDN.
- `rel="noopener noreferrer"` and `target="_blank"` on external links. Show the real domain.
- Auth via `HttpOnly` cookies, CSRF protection on mutations, CSP to limit script sources.

### 5.12 Observability

- RUM: LCP, INP, CLS per page and device class. Long tasks while scrolling (Long Animation Frames API).
- Feed-specific metrics: time to first post, posts viewed per session, load-more error rate, reaction failure rate.
- Error tracking with source maps. Log failed optimistic mutations.

---

## 6. Trade-offs

| Topic | Options | Choice and reason |
|---|---|---|
| Pagination | Offset vs cursor | **Cursor.** Stable on a live feed. Can't jump to page N (not needed). |
| Real-time | WebSocket / SSE / polling | **SSE** for one-way signals, or reuse an existing WebSocket. Polling as fallback. |
| New posts | Auto-insert vs pill | **Pill.** Never move content under the reader. |
| Long lists | Full virtualization vs `content-visibility` | Start with **`content-visibility`** (simple, keeps a11y). Virtualize if memory/DOM size measurements say so. |
| First load | SSR vs CSR + cached shell | **SSR (streaming)** for LCP. Costs server CPU. CSR + SW cache is acceptable for an app-like experience. |
| Store | Nested responses vs normalized | **Normalized.** One source of truth for posts/users. More code. |
| Reactions | Wait for server vs optimistic | **Optimistic**, with rollback and ordering. |

---

## 7. Follow-up questions

**"The feed gets slow after 20 minutes of scrolling. How do you find out why?"**
Record a Performance profile while scrolling: look for long tasks, layout/style recalculation cost, and GC pauses. Check DOM node count and the JS heap in the Memory panel (heap snapshots, detached nodes). Likely causes: no virtualization, listeners or timers per card that are never removed, or images kept in memory.

**"How do you insert ads into the feed?"**
The server returns a heterogeneous list: `items: [{ type: 'post', id }, { type: 'ad', id }]`. The renderer maps type → component. Ads are lazy-loaded, sized in advance (no CLS), and tracked with viewability (IntersectionObserver with a 50% threshold for 1 second).

**"How would you track impressions?"**
IntersectionObserver per card, an "impression" when at least 50% is visible for 1 s. Batch events in memory and send with `navigator.sendBeacon` every few seconds and on `visibilitychange` → hidden.

**"Two tabs are open. A user reacts in one. Should the other update?"**
`BroadcastChannel` between tabs to share store updates, or rely on the real-time stream. Cheap and nice for consistency.

**"How would you A/B test a new card design?"**
Feature flag evaluated on the server (no flicker), passed to the client. Both variants code-split. Measure engagement and vitals per variant.

---

## 8. What separates a senior answer from a mid-level one

- **Mid-level:** infinite scroll with a scroll listener, `?page=N`, a list of posts in component state, likes that wait for the server.
- **Senior:**
  - Explains **why offset pagination breaks** on a live feed, and still **dedupes by id**.
  - **Normalized store** and per-card subscriptions, so one reaction re-renders one card.
  - **Virtualization with variable heights**, scroll restoration with an **anchor id**, and memory limits for long sessions.
  - **Optimistic updates with rollback and ordering** of fast repeated clicks.
  - Real-time as a **signal + pill**, not auto-inserting content. Picks SSE vs WS with reasons.
  - Images: dimensions from the API for CLS, `fetchpriority` for the LCP image.
  - **Accessibility of infinite scroll** (`role="feed"`, footer reachability).
  - Idempotency keys for creates and an offline outbox.
