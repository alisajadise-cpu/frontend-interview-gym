# 05 · Collaborative Editor — Solution

## 1. Requirements

### Functional
1. Rich-text editing: paragraphs, headings, inline marks (bold, italic, link), lists, images.
2. Multiple users edit at the same time. Everyone converges to the **same document**.
3. Live presence: who's here, their cursor and selection, in their color.
4. Offline editing, merged automatically on reconnect.
5. Comments anchored to a text range (the anchor survives other people's edits).
6. Per-user undo/redo.
7. Version history: see and restore past versions.
8. Permissions: viewer / commenter / editor.

### Non-functional
- **Local edits feel instant** (no network round trip for typing). INP under 100 ms even in large docs.
- **Convergence:** all clients end up with identical content. No lost edits.
- **Intention preservation:** if I bold a word while you insert text before it, my bold still applies to that word.
- Remote changes appear in under ~300 ms on good networks.
- Large documents (100 pages) stay smooth.
- Accessible (screen readers, keyboard), RTL and mixed-direction text, IME input.

---

## 2. Architecture

```
┌──────────────────────────────── Browser ────────────────────────────────┐
│                                                                          │
│  ┌────────────────────────────── Editor UI ───────────────────────────┐ │
│  │ Toolbar · Document view (contenteditable, controlled by the model) │ │
│  │ Remote cursors overlay · Comments sidebar · Presence avatars        │ │
│  └───────────────▲──────────────────────────────────┬─────────────────┘ │
│                  │ render (view update)              │ DOM input → transactions
│  ┌───────────────┴──────────────────────────────────▼─────────────────┐ │
│  │ Editor engine (ProseMirror / Lexical / Slate-like)                   │ │
│  │  schema · document tree · selection · transactions · input rules     │ │
│  └───────────────▲──────────────────────────────────┬─────────────────┘ │
│                  │ remote changes                    │ local changes      │
│  ┌───────────────┴──────────────────────────────────▼─────────────────┐ │
│  │ Collaboration binding                                                │ │
│  │  CRDT doc (e.g. Yjs) or OT client  ·  undo manager (local origin)   │ │
│  │  awareness/presence  ·  relative positions for cursors & comments   │ │
│  └─────────▲───────────────────────┬──────────────────────▲───────────┘ │
│            │                       │                      │             │
│   ┌────────┴────────┐    ┌─────────▼────────┐   ┌─────────┴─────────┐   │
│   │ IndexedDB        │    │ Sync provider    │   │ REST: doc meta,   │   │
│   │ local doc state, │    │ WebSocket,       │   │ comments, history,│   │
│   │ pending updates  │    │ reconnect, ack   │   │ permissions       │   │
│   └─────────────────┘    └─────────▲────────┘   └─────────▲─────────┘   │
└────────────────────────────────────┼──────────────────────┼─────────────┘
                                     │ WSS                  │ HTTPS
                          ┌──────────▼─────────┐   ┌────────▼───────────┐
                          │ Collab server       │   │ Doc service        │
                          │ (room per doc:      │──►│ snapshots, history,│
                          │ relay/transform,    │   │ comments, ACL      │
                          │ persist updates)    │   └────────────────────┘
                          └─────────────────────┘
```

### Why not just `contenteditable`?

Raw `contenteditable` produces browser-specific, messy HTML, and you can't merge two people's HTML. We need a **structured document model** (a tree with a schema) and treat the DOM as a **view** of it. Every user action becomes a **transaction** on the model. This is what ProseMirror, Lexical, Slate, and Google Docs (which renders its own layout on canvas since 2021) do.

---

## 3. Data model

```ts
// Document tree (schema-validated)
type Node =
  | { type: 'doc'; content: Node[] }
  | { type: 'paragraph'; attrs: { dir?: 'ltr' | 'rtl' | 'auto' }; content: Inline[] }
  | { type: 'heading'; attrs: { level: 1 | 2 | 3 }; content: Inline[] }
  | { type: 'bullet_list' | 'ordered_list'; content: Node[] }
  | { type: 'list_item'; content: Node[] }
  | { type: 'image'; attrs: { src: string; alt: string; width: number; height: number } };

type Inline = { type: 'text'; text: string; marks?: Mark[] };
type Mark = { type: 'bold' } | { type: 'italic' } | { type: 'link'; attrs: { href: string } };

// Presence: ephemeral, never stored in the document
interface Awareness {
  clientId: number;
  user: { id: string; name: string; color: string };
  cursor?: { anchor: RelativePosition; head: RelativePosition };
  lastActiveAt: number;
}

// A position that survives concurrent edits (CRDT item id + offset, or OT-mapped index)
type RelativePosition = { itemId: string; assoc: -1 | 1 } | { index: number; version: number };

interface Comment {
  id: string;
  anchor: { from: RelativePosition; to: RelativePosition };
  threadId: string;
  authorId: string;
  body: string;
  resolved: boolean;
}

interface Version {
  id: string;
  createdAt: string;
  authors: string[];
  snapshotRef: string;    // server-side snapshot of the doc state
}
```

Three kinds of data, three different treatments:
1. **Document content**: must converge, must be persisted, ordered/merged by the algorithm.
2. **Presence (cursors, selections, who's online)**: ephemeral, lossy is fine, latest value wins, never in the document history.
3. **Metadata (comments, permissions, title)**: normal REST/CRUD with optimistic UI. Only the comment **anchors** need to be collaborative positions.

---

## 4. Conflict resolution: OT vs CRDT

### Operational Transformation (OT)
- Each edit is an operation like `insert(pos=5, "hi")` or `delete(pos=3, len=2)`.
- When two operations happen concurrently, one is **transformed** against the other. Example: A inserts at 5, B deletes 0–2. A's insert is transformed to position 3.
- Needs a **central server** that orders operations (Google Docs, the Jupiter/Wave model). Each client sends ops based on a known server version. The server transforms and broadcasts.
- **Pros:** compact operations, a well-known model for server-centric apps, history is a simple ordered log.
- **Cons:** transformation functions for rich text (marks, splits, tree structure) are hard to get right. Offline for a long time = big transform work. Peer-to-peer is impractical.

### CRDT (Conflict-free Replicated Data Type)
- Every character/element gets a **unique id** (client id + counter). Inserts reference the neighbor's id, not an index. Deletes mark items as deleted (tombstones).
- Updates can be applied **in any order, any number of times**, and every replica converges. No central ordering needed.
- Libraries: **Yjs** (YATA algorithm), **Automerge**. Bindings exist for ProseMirror, Lexical, Tiptap, Monaco, CodeMirror.
- **Pros:** offline and peer-to-peer are natural. The server can be a simple relay + storage. Positions (cursors, comment anchors) can be stable ids.
- **Cons:** metadata overhead (ids, tombstones), so docs need garbage collection and compact encodings. Some "intention" cases still need care (e.g. concurrent formatting of overlapping ranges, moving list items).

### Decision

I'd pick a **CRDT (Yjs-style)** with a **server that relays and persists updates**:
- Offline editing is a hard requirement, and CRDTs handle it with no special code.
- Mature libraries exist with editor bindings, undo managers, and presence ("awareness") built in.
- We still use a server for auth, persistence, snapshots, and fan-out. It just doesn't need to transform.

OT is still a valid choice for a server-authoritative product (that's what Google Docs uses). In the interview, say both are valid, and choose based on offline and team expertise.

---

## 5. Interface (sync protocol)

### Connecting

```
WSS /collab/:docId   (auth: cookie or token in the first message; server checks ACL)

client → server: { t: 'sync1', stateVector }            // "here's what I have"
server → client: { t: 'sync2', update }                 // "here's what you're missing"
server → client: { t: 'sync1', stateVector }            // server asks what it's missing
client → server: { t: 'sync2', update }                 // offline edits get uploaded here
```

A **state vector** is a small map `{ clientId: lastClock }`. Comparing state vectors tells each side exactly which updates the other is missing. This is how reconnecting after hours offline works: only the missing parts are exchanged.

### Live editing

```
client → server: { t: 'update', update: <binary CRDT update> }   // batched ~every 50–100 ms
server → others: { t: 'update', update }                         // relay
server → client: { t: 'ack', upTo: ... }                         // optional: mark as persisted
client ↔ server: { t: 'awareness', states }                      // presence, throttled
```

- Updates are **binary** (Yjs encodes compactly), much smaller than JSON.
- **Batch** local keystrokes into one update every ~50 ms. Typing 10 characters = 1–2 messages.
- The server writes updates to an append-only log, and periodically **compacts** them into a snapshot (merge all updates, garbage-collect tombstones where safe).

### REST

```
GET  /api/docs/:id                 → { title, permissions, latestSnapshot (binary/base64), updatedAt }
GET  /api/docs/:id/versions        → Version[]
GET  /api/docs/:id/versions/:vid   → snapshot (read-only render)
POST /api/docs/:id/versions/:vid/restore   → creates a NEW update that changes the doc back (history is never rewritten)
GET/POST/PATCH /api/docs/:id/comments
```

**Initial load:** fetch the latest snapshot via HTTP (cacheable, can be streamed), render it immediately (read-only feel is OK for a moment), then connect the WebSocket and sync the small difference. Faster than replaying thousands of updates.

---

## 6. Deep dives

### 6.1 Local-first editing flow

1. The user types → the editor creates a transaction → applied to the local model immediately → view updates. **No waiting for the network.**
2. The binding converts the transaction into CRDT changes → an update is queued.
3. The update is saved to **IndexedDB** (so a crash or offline doesn't lose it) and sent over the socket.
4. Remote updates are applied to the CRDT → converted to an editor transaction → the view updates while **mapping the local selection** so my cursor doesn't jump.

### 6.2 Presence (cursors and selections)

- Stored as **relative positions** (CRDT item ids), so a remote cursor stays on the right character when text is inserted before it.
- Sent through a separate "awareness" channel, **throttled** (~every 100 ms while moving), with a timeout (remove users not seen for 30 s).
- Rendered as an **overlay layer** (absolutely positioned carets/highlights computed from DOM ranges), not inside the document DOM. Inserting extra spans into the content would mess up the editor and the undo history.
- Recompute positions only for visible cursors, once per animation frame.
- With 50 users: show up to ~10 cursors, collapse others into avatars, and throttle more.

### 6.3 Offline

- The doc state + pending updates live in IndexedDB. The app shell is cached by a service worker.
- Editing offline works exactly like online, just without sending.
- On reconnect: state-vector sync uploads all offline updates and downloads others' changes. The CRDT merges automatically.
- UX: show "Offline: changes saved on this device" and later "All changes saved". Warn if offline for a very long time (big merge surprises). For **permission changes while offline** (you lost edit access), the server rejects your updates. Keep them locally and offer "copy your changes".

### 6.4 Undo in a shared document

- **Undo must only undo my own changes.** If I undo after Sara typed, Sara's text must stay.
- Track changes by **origin**: the undo manager records only transactions with the local origin, and stores them as CRDT items (ids). Undo creates a **new inverse change** of those items. It doesn't roll back the document to an older state.
- Group keystrokes into undo steps (e.g. a pause of 500 ms or a word boundary), so one undo doesn't remove a single letter.
- Selections are restored with relative positions.

### 6.5 Comments anchored to text

- Anchor = two relative positions (start, end). When text inside is edited, the range grows/shrinks. If the whole range is deleted, the comment becomes "orphaned" (show it with the quoted original text).
- Comment threads themselves are normal REST data with optimistic updates. Only anchors live in the CRDT world.

### 6.6 Version history

- The server keeps periodic snapshots (e.g. every N minutes of activity) plus the update log.
- Viewing a version renders a snapshot read-only. A **diff view** compares two snapshots.
- **Restore = a new forward change** that makes the content equal to the old version. Others see it as a normal edit and nobody's history is lost.

### 6.7 Performance for large documents

- Typing must only update the changed paragraph: the editor model and view do **incremental updates** (ProseMirror/Lexical do this). Avoid React re-rendering the whole document per keystroke.
- For very long documents, **virtualize rendering** by blocks (render pages near the viewport). This is hard with `contenteditable` (selection across unrendered blocks, find-in-page). This is one reason Google Docs moved to canvas rendering. For most products, block-level `content-visibility: auto` is a good cheaper step.
- Apply remote updates in batches per animation frame.
- Load large docs progressively: snapshot first, comments and history later.
- Compact the CRDT on the server and garbage-collect tombstones to keep the binary small.
- Heavy work (diffing versions, export to PDF/DOCX, spellcheck) in Web Workers or on the server.

### 6.8 Accessibility

- A `contenteditable` with a proper structure (real headings, lists) is readable by screen readers. A canvas-rendered editor needs a hidden accessible DOM mirror (Google Docs has one).
- All toolbar actions available by keyboard shortcuts, announced in tooltips. `aria-pressed` on toggle buttons (Bold).
- Announce remote changes politely and sparingly ("Sara edited the paragraph"), or offer a setting. Too many announcements are unusable.
- Remote cursors must not be in the accessibility tree as content (use `aria-hidden` for decorative overlays), but presence ("3 people are editing") should be available.
- Focus management for dialogs (insert link, comments).

### 6.9 i18n / RTL / IME

- Paragraph direction per block (`dir="auto"` or explicit attribute), since a Persian document can contain English paragraphs.
- **IME composition** (Persian on some keyboards, CJK): don't create transactions in the middle of a composition. Wait for `compositionend`. Remote updates arriving during composition must be applied carefully or deferred, or the composition breaks. This is a classic source of bugs.
- Bidi cursor movement: arrow keys in mixed text follow visual order. Let the browser handle it where possible.
- Spellcheck per language. Locale-aware word boundaries (`Intl.Segmenter`) for double-click selection and word count.

### 6.10 Security

- Paste is the big XSS risk: parse pasted HTML **through the schema** (only allowed nodes/marks survive). Strip scripts, event handlers, `javascript:` URLs.
- Links: validate protocols (`http`, `https`, `mailto`). Images through a proxy/CDN.
- The server **enforces permissions**: viewers' updates are rejected, even if the client sends them. Commenters can only create comments.
- Access tokens checked on WebSocket connect and on every reconnect. Revoking access closes the socket.
- E2E encryption is possible with CRDTs (the server relays encrypted updates) but removes server features like search and snapshots compaction on the server.

### 6.11 Observability

- Metrics: sync latency (local edit → others receive), reconnect count, time offline, size of offline merges, update size, snapshot size growth.
- **Divergence detection:** clients occasionally send a hash of their document state. If hashes differ for the same state vector, log it. This catches convergence bugs early.
- Editor errors (schema violations, failed transactions) with breadcrumbs, without document content (privacy).

---

## 7. Trade-offs

| Topic | Options | Choice |
|---|---|---|
| Algorithm | OT (server-ordered) / CRDT | **CRDT (Yjs)**: offline and stable positions. More metadata. |
| Editor engine | Build own / ProseMirror / Lexical | **Use a proven engine.** Building one is years of work. |
| Rendering | contenteditable / canvas | **contenteditable** with a model. Canvas only at Google scale with layout needs (pagination). |
| Presence | In document / separate channel | **Separate, ephemeral, throttled.** |
| Initial load | Replay updates / snapshot + delta | **Snapshot + state-vector delta.** |
| Restore version | Reset history / forward change | **Forward change**: nobody loses work. |
| Undo | Global / per user | **Per user**, origin-tracked. |

---

## 8. Follow-up questions

**"Two users bold and un-bold overlapping text at the same time. What happens?"**
With a CRDT, marks are stored as attributes on ranges/items. Concurrent conflicting attribute changes on the same item resolve deterministically (e.g. by client id/clock: last writer wins per character). The result is consistent everywhere, but maybe not what both wanted. That's acceptable. The user sees it live and fixes it.

**"How do you handle copy-paste of 50 pages?"**
Parse in chunks, show progress, apply as one transaction (one undo step), and send as one large update (maybe chunked on the wire). Images are uploaded async and inserted as placeholders first.

**"How does the server scale to many documents?"**
One "room" per document, pinned to one server instance (consistent hashing by doc id), so all editors of a doc share memory. Rooms load the snapshot on first join and unload after everyone leaves. Use a pub/sub layer if a doc's editors must span instances.

**"How would you add suggestion mode?"**
Store suggestions as marked insertions/deletions (marks with author id) instead of applying them directly. Accept = remove the mark (or apply the deletion). Reject = delete the inserted text (or remove the deletion mark).

**"Why not just lock paragraphs while someone edits them?"**
Simple, and some products use block-level locking. But locks feel bad (people wait), fail with offline, and need lock timeouts. Real-time merging gives a better experience.

---

## 9. What separates a senior answer from a mid-level one

- **Mid-level:** "Send the whole document on every change and last write wins", or "use WebSocket and contenteditable".
- **Senior:**
  - Separates **model and view** and explains why raw `contenteditable` HTML can't be merged.
  - Explains **OT vs CRDT** clearly, picks one with reasons (offline, server role, libraries).
  - **State vectors** for efficient reconnect and **snapshot + delta** for loading.
  - Treats **presence as ephemeral** and uses **relative positions** for cursors and comments.
  - **Per-user undo** as new inverse changes, not time travel.
  - **Restore = forward change**.
  - Knows the hard parts: **IME composition**, paste sanitization, divergence detection, tombstone growth.
