# 03 · Chat App — Solution

## 1. Requirements

### Functional
1. Conversation list: sorted by last activity, with last message preview, unread count, and avatar.
2. Open a conversation: see recent messages, scroll up for older history.
3. Send text and images. Reply to a specific message.
4. Receive messages in real time, in every open tab and device.
5. Message status: sending → sent ✓ → delivered ✓✓ → read.
6. Typing indicator and online/last-seen presence.
7. Works offline: read cached conversations, write messages that send later.

**Out of scope:** calls, message search (server feature), reactions, editing/deleting (mention how to add them).

### Non-functional
- **Latency:** a sent message appears instantly locally, and reaches the other user in under 500 ms on good networks.
- **Correctness:** no lost messages, no duplicates, stable ordering.
- **Smooth** with very long histories (100k messages) and busy groups.
- **Efficient** on battery and data: one connection, small payloads, no polling loops.
- **Accessible**, **RTL-ready** (mixed-direction text in one chat is common).
- **Secure:** no XSS from message content, secure tokens.

---

## 2. Architecture

```
┌─────────────────────────────────── Browser tab ───────────────────────────────────┐
│                                                                                    │
│  UI (React)                                                                        │
│  ┌───────────────────┐  ┌─────────────────────────────────────────────────────┐   │
│  │ ConversationList   │  │ ConversationView                                    │   │
│  │  (virtualized)     │  │  Header (presence) · MessageList (reverse virtual)  │   │
│  │                    │  │  TypingIndicator · Composer (draft, attachments)    │   │
│  └─────────▲──────────┘  └──────────────────────────▲──────────────────────────┘   │
│            │ selectors                               │                              │
│  ┌─────────┴─────────────────────────────────────────┴──────────────────────────┐   │
│  │ Client store: conversations · messages by conversation · users · presence    │   │
│  └─────────▲─────────────────────────────────────────┬──────────────────────────┘   │
│            │ events                                  │ commands (send, markRead)    │
│  ┌─────────┴─────────────────────────────────────────▼──────────────────────────┐   │
│  │ Sync engine                                                                    │   │
│  │  outbox (pending messages) · dedupe by clientId · ordering by seq             │   │
│  │  gap detection + resync · receipt batching · local DB writes                  │   │
│  └───────▲─────────────────────┬───────────────────────────────▲────────────────┘   │
│          │                     │                               │                    │
│  ┌───────┴────────┐   ┌────────▼─────────┐            ┌────────┴─────────┐          │
│  │ IndexedDB       │   │ Connection mgr   │            │ REST client       │          │
│  │ messages,       │   │ WebSocket,       │            │ history pages,    │          │
│  │ outbox, cursors │   │ heartbeat,       │            │ media upload      │          │
│  └────────────────┘   │ backoff reconnect │            └────────┬─────────┘          │
│                        └────────▲─────────┘                     │                    │
│   (Leader tab owns the socket — other tabs via BroadcastChannel / SharedWorker)        │
└──────────────────────────────────┼──────────────────────────────┼────────────────────┘
                                   │ WSS                          │ HTTPS
                         ┌─────────▼────────┐           ┌─────────▼────────┐
                         │ Realtime gateway │           │ REST API + CDN   │
                         │ (fan-out)        │           │ (media)          │
                         └──────────────────┘           └──────────────────┘
```

**Key idea:** the UI never talks to the network directly. It reads from a **local store** (backed by IndexedDB) and sends **commands** to a **sync engine**. The sync engine handles the socket, the outbox, retries, and ordering. This makes offline, multi-tab, and optimistic UI fall out naturally. It's the same "local-first" idea used by Linear, WhatsApp Web, and Messenger's own web client.

**Rendering:** CSR app shell served by a service worker (instant start, works offline). SEO doesn't matter (everything is behind login). The conversation list and the last opened chat come from IndexedDB first, then sync with the server.

---

## 3. Data model

```ts
type ID = string;

interface Conversation {
  id: ID;
  type: 'direct' | 'group';
  title?: string;                 // group name; direct chats use the other user's name
  memberIds: ID[];
  lastMessageId: ID | null;
  lastActivityAt: number;         // for sorting the list
  unreadCount: number;
  lastReadSeq: number;            // my read position in this conversation
  muted: boolean;
}

type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

interface Message {
  id: ID | null;                  // server id, null until acknowledged
  clientId: string;               // generated by the sender (UUID). Dedupe + idempotency key.
  conversationId: ID;
  senderId: ID;
  seq: number | null;             // server-assigned, strictly increasing per conversation
  createdAt: number;              // sender's clock: display only, NOT for ordering
  body:
    | { type: 'text'; text: string }
    | { type: 'image'; mediaId: ID; width: number; height: number; caption?: string };
  replyTo?: { messageId: ID; preview: string };
  status: MessageStatus;          // only meaningful for my own messages
}

interface Presence {
  userId: ID;
  online: boolean;
  lastSeenAt?: number;
  typingIn?: ID;                  // conversation id
}

// Per conversation, in the store
interface MessageWindow {
  orderedKeys: string[];          // clientId or id, sorted by seq; pending ones at the end
  oldestSeqLoaded: number;
  hasMoreBefore: boolean;
  newestSeqSynced: number;        // used to detect gaps after reconnect
}
```

**Ordering rule:** messages are sorted by **server `seq`**. Client clocks are wrong all the time (wrong timezone, wrong time). Pending messages (no `seq` yet) are shown at the end in the order they were sent. When the server acknowledges, they get a `seq` and move to their correct place (usually they stay where they were).

**Dedupe rule:** a message is identified by `clientId`. When the sender's own message comes back through the socket (echo), or a retry succeeds twice, we merge by `clientId`, not append.

---

## 4. Interface (API and protocol)

### Transport choice

- **WebSocket**: chat needs low-latency messages in **both directions** (send, typing, receipts). One long-lived connection is cheaper than many HTTP requests.
- SSE + POST is possible (SSE for downstream, POST for sends) and simpler with HTTP infrastructure. But typing indicators and receipts are chatty, so WebSocket is the usual choice.
- Fallback: long polling for networks that block WebSockets (rare today).

### WebSocket messages (JSON; Protobuf/MessagePack later to save bytes)

```jsonc
// client → server
{ "t": "send", "clientId": "c-123", "conversationId": "cv1", "body": { "type": "text", "text": "hi" } }
{ "t": "typing", "conversationId": "cv1" }                      // throttled, max every 3s
{ "t": "read", "conversationId": "cv1", "upToSeq": 5021 }        // one event covers many messages
{ "t": "sync", "cursors": { "cv1": 5021, "cv2": 88 } }           // after reconnect
{ "t": "ping" }

// server → client
{ "t": "ack", "clientId": "c-123", "id": "m-9", "seq": 5022, "createdAt": 1700000000 }
{ "t": "message", "message": { ...Message } }
{ "t": "receipt", "conversationId": "cv1", "userId": "u2", "type": "delivered" | "read", "upToSeq": 5022 }
{ "t": "presence", "userId": "u2", "online": true }
{ "t": "typing", "conversationId": "cv1", "userId": "u2" }
{ "t": "resync_required", "conversationId": "cv1" }              // gap too large: fetch via REST
{ "t": "pong" }
```

**Receipts use "up to seq"** (like a watermark). Reading 50 messages sends **one** event, not 50.

### REST

```
GET /api/conversations?cursor=...&limit=30
→ { conversations: Conversation[], users: Record<ID, User>, nextCursor }

GET /api/conversations/:id/messages?beforeSeq=5000&limit=50      // history, going backwards
→ { messages: Message[], hasMore: boolean }

GET /api/conversations/:id/messages?afterSeq=5021&limit=200      // fill a gap after reconnect
→ { messages: Message[], hasMore: boolean }

POST /api/media/upload-url → { uploadUrl, mediaId }               // then PUT the file directly
```

History uses **seq-based cursors**: stable, fast for the server (index on `(conversationId, seq)`), and easy to detect gaps.

---

## 5. Deep dives

### 5.1 Sending: optimistic UI + outbox

```
user presses Enter
  1. create Message { clientId: uuid(), status: 'pending', seq: null }
  2. write to IndexedDB outbox + store → UI shows it immediately (grey clock icon)
  3. if socket open: send { t: 'send', clientId, ... }
  4. on 'ack' (matching clientId): set id, seq, status 'sent'; remove from outbox
  5. no ack within ~10 s, or socket closed: keep in outbox; retry on reconnect
  6. after N failures or a permanent error: status 'failed' → "Not sent · Retry"
```

- **Idempotency:** the server stores `clientId` per sender. A retried `send` with the same `clientId` returns the same `ack` instead of creating a duplicate. This is what makes retries safe.
- **Order of sends:** the outbox is sent **in order, one conversation at a time**. Otherwise message 2 could get a lower `seq` than message 1.
- **Images:** upload first (show a progress ring on the message), then send the message with `mediaId`. Compress on the client before upload.

### 5.2 Receiving, ordering, and gaps

- Each conversation's messages have a **contiguous `seq`**. If we have seq 100 and receive 103, we **missed 101–102** (e.g. a reconnect lost them). Fetch `afterSeq=100` via REST, then merge.
- After a reconnect, send `{ t: 'sync', cursors }` for recent conversations. The server replies with missed messages, or `resync_required` if the gap is huge. Then we fetch the latest page and drop the old window.
- Merge rule: insert by `seq` (binary search into `orderedKeys`), dedupe by `clientId`/`id`.

### 5.3 Connection management

- **Heartbeat:** ping every ~25 s. No pong in ~10 s → assume dead (mobile networks often drop silently, and `onclose` may not fire).
- **Reconnect with exponential backoff + jitter** (1 s, 2 s, 4 s… max 30 s, ± random), so a server restart doesn't cause a thundering herd.
- Reconnect immediately on the `online` event and when the tab becomes visible.
- **Auth:** short-lived token sent in the first message after connecting (or a cookie on the upgrade request). Refresh before expiry. Server closes with a specific code if expired → client refreshes and reconnects.
- Show connection state in the UI: "Connecting…", "Waiting for network".

### 5.4 Multiple tabs

- Without care, 5 tabs = 5 sockets = 5× server load and receipts sent 5 times.
- **Leader election:** one tab owns the socket (Web Locks API: `navigator.locks.request('chat-socket', ...)`). Other tabs get events via **BroadcastChannel** and send commands through the leader. If the leader closes, the lock is released and another tab takes over.
- Alternative: a **SharedWorker** holds the socket for all tabs (not supported in some mobile browsers, so keep the lock-based fallback).
- All tabs share IndexedDB, so they can read history directly.

### 5.5 Message list: reverse infinite scroll + virtualization

- Opens **at the bottom**. Scrolling **up** loads older pages (`beforeSeq`).
- **Scroll anchoring:** when older messages are prepended, the content above grows. Keep the user's view still by remembering the first visible message and its offset, then restoring after render (`useLayoutEffect`). CSS `overflow-anchor: auto` helps but isn't enough in every browser (Safari support came late). Some libraries use `flex-direction: column-reverse`, so the browser keeps the bottom fixed.
- **Virtualize** with variable heights (text length, images, replies). Measure after render with ResizeObserver. Image messages have known `width`/`height`, so heights are predictable.
- **Stick to bottom** only if the user is already at the bottom. If they are reading history and a new message arrives, show a "↓ 3 new messages" button instead of jumping.
- "Jump to replied message" may need a page far back in history: load a window around that `seq` (`aroundSeq=` endpoint), and replace the current window. This is why the window is a range, not "all messages so far".
- Keep a bounded number of messages in memory per conversation (e.g. 500). Older ones live in IndexedDB.

### 5.6 Receipts and read state

- **Delivered:** the recipient's device sends `delivered upToSeq` when messages reach it (even if the tab is in the background).
- **Read:** only when the message is **actually visible** (IntersectionObserver) **and** the tab is visible (`document.visibilityState === 'visible'`) **and** the window has focus. Batch: debounce ~500 ms, send the highest seq.
- Unread count = `latestSeq - lastReadSeq` (minus my own messages). Shared across tabs and devices because it comes from the server.
- Group "read by": store per-member `lastReadSeq`. A message is read by everyone when `min(lastReadSeq of others) >= seq`. Show details on demand.

### 5.7 Typing and presence

- Send `typing` at most every 3 s while the user types. The receiver shows the indicator for 5 s after the last event (so no "stopped typing" message is needed, but sending one on blur/send is nice).
- Presence: the server tracks socket connections. Subscribe to presence **only for users visible on screen** (open chat, visible list rows). Don't receive presence for 2,000 contacts.

### 5.8 Offline and storage

- IndexedDB stores: conversations, recent messages per conversation (bounded), outbox, sync cursors, drafts.
- Service worker caches the app shell.
- Offline: everything is readable from IndexedDB. Sending puts messages in the outbox with a clock icon.
- Quota: request persistent storage (`navigator.storage.persist()`). Evict old media blobs first.
- On logout: **clear IndexedDB and caches** (privacy on shared computers).

### 5.9 Performance

- The conversation list is virtualized too (thousands of chats). A new message moves one conversation to the top: update one item and re-sort the id list. Don't re-render all rows.
- Socket events can come in bursts (busy group). **Batch store updates** per animation frame (or let React 18+ automatic batching do it), so 20 messages = 1 render.
- Parse large payloads (sync of 500 messages) and write to IndexedDB in a **Web Worker** to keep the main thread free.
- Lazy-load emoji picker, image viewer, and group settings.
- Images: thumbnails in the list, full size only in the viewer. Use `URL.createObjectURL` for local previews before upload (and revoke it later to avoid leaks).

### 5.10 Accessibility

- The message list is a `role="log"` region with `aria-live="polite"`. Only **new incoming** messages should be announced, not history being loaded.
- Each message is an element with a readable label: "Sara, 10:42: See you tomorrow. Read." Status icons have text alternatives.
- Keyboard: `Tab` into the list, arrow keys between messages, `Enter` for message actions (reply), `Esc` back to the composer.
- Composer: `Enter` sends, `Shift+Enter` new line. Clear labels.
- Don't steal focus when new messages arrive.

### 5.11 i18n / RTL

- One chat often mixes Persian and English. Each message bubble has `dir="auto"`. Bubbles align by sender (start/end) using logical properties, which flip in RTL.
- Timestamps via `Intl.DateTimeFormat` with the user's locale and calendar (`fa-IR-u-ca-persian`).
- Date separators ("Today", "Yesterday") with `Intl.RelativeTimeFormat`.
- Emoji and complex scripts: count characters with `Intl.Segmenter` (grapheme clusters) for limits and truncation, not `string.length`.

### 5.12 Security and privacy

- Message text is rendered as text. Links are detected and rendered as `<a rel="noopener noreferrer">`. No HTML in messages.
- Media served from a separate domain (cookieless) with signed, expiring URLs.
- Tokens in memory or `HttpOnly` cookies, not in `localStorage`. The WebSocket must check the `Origin` header on the server (CSRF-like attacks on sockets).
- With **end-to-end encryption** (Signal protocol), the server can't read messages, so search, link previews and server-side features move to the client. Keys stored in IndexedDB, non-extractable via WebCrypto when possible.

### 5.13 Observability

- Metrics: send → ack latency (p50/p95), failed sends, reconnect count and time offline, gap resync count, duplicate messages detected (should be ~0).
- RUM: INP on the composer, long tasks while scrolling history.
- Error tracking with breadcrumbs of socket events (without message content, for privacy).

---

## 6. Trade-offs

| Topic | Options | Choice |
|---|---|---|
| Transport | WebSocket / SSE+POST / long polling | **WebSocket**, chatty and bi-directional. Long polling fallback. |
| Ordering | Client timestamp / server seq | **Server seq** per conversation. Client time is only for display. |
| Optimistic send | Wait for ack / show immediately | **Immediately** with pending state and outbox. |
| Storage | Memory only / IndexedDB | **IndexedDB**: offline, instant start, multi-tab. More complexity (migrations, quotas). |
| Multi-tab | Socket per tab / leader / SharedWorker | **Leader tab with Web Locks + BroadcastChannel**. |
| List rendering | Render all / virtualize | **Virtualize** (variable heights, reverse). Harder for find-in-page and a11y, so keep the window reasonable. |
| Receipts | Per message / watermark | **Watermark (upToSeq)**: far fewer events. |

---

## 7. Follow-up questions

**"How do you add message editing and deletion?"**
They are new events (`edit`, `delete`) that reference the message id and get their own `seq` in the conversation's event stream. The client applies them to the stored message. Deleted messages become tombstones ("This message was deleted"), so ordering and replies still work.

**"A user sends 3 messages offline, then comes online. One of them fails validation. What happens?"**
The outbox sends them in order. The failed one is marked `failed` with a reason. Should the next ones wait? For chat, no: keep sending (they are independent). For operations that depend on each other, you'd stop the queue.

**"How would you implement search?"**
Server-side full-text search (unless E2EE). For E2EE, build a local index in a worker (e.g. over IndexedDB data). Results jump into history using the "around seq" window.

**"How do you know the socket is really alive?"**
Application-level ping/pong with a timeout. TCP can stay "open" for minutes after the network is gone. Browsers don't expose WebSocket ping frames to JS.

**"How do you handle 10,000 messages arriving after a long offline period?"**
Don't replay them one by one. The server sends `resync_required`. The client fetches the latest page, marks the conversation unread count from the server, and loads older history lazily when the user scrolls.

---

## 8. What separates a senior answer from a mid-level one

- **Mid-level:** "WebSocket, append incoming messages to an array, scroll to bottom".
- **Senior:**
  - **clientId for dedupe and idempotent retries**, server **seq for ordering**, gap detection and resync.
  - An **outbox** in IndexedDB, sent in order, with failure states.
  - **Heartbeats, backoff with jitter**, and reconnect on `online`/visibility.
  - **One socket for many tabs** (Web Locks / SharedWorker / BroadcastChannel).
  - **Reverse virtualization with scroll anchoring**, and not jumping when the user reads history.
  - **Read receipts only when actually seen**, batched as a watermark.
  - Presence subscriptions limited to what's on screen.
  - Privacy: clearing local data on logout, E2EE implications.
