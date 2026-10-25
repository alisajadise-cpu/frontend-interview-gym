# AI 03 · Answers

Don't read this until you've written your own review.

| # | Bug | What the user notices | How to prove it |
|---|---|---|---|
| 1 | `JSON.parse` on each piece of `chunk.split('\n')`. A line split across two chunks fails to parse and is **silently skipped** | Missing words in answers, more often on slow or mobile networks | Throttle the network in DevTools, or a unit test that cuts chunks mid-line. Compare the server log with the UI text. |
| 2 | `catch {}` around `JSON.parse`, and `console.log` in the outer catch. **Errors are swallowed**, and the `error` state is never set | A reply just stops. No message, no retry. A 502 HTML page from a proxy looks like an empty answer | Kill the network mid-answer. Error tracking (Sentry) shows nothing because nothing is reported. |
| 3 | **Stale closure:** `setMessages([...messages, userMessage, ...])` uses `messages` from the render when `sendMessage` started | A message sent during a stream **disappears**, overwritten by the old stream's next token. Removals during a stream come back | Send two messages quickly. A unit test with interleaved streams. |
| 4 | No `AbortController`: no abort on a new message or on unmount | Two answers stream into the UI at once. Tokens keep being paid for after the user left. `setState` after unmount | Network tab: the first request keeps downloading. Log the server-side cancellations. |
| 5 | `id: Date.now().toString()` for both messages | User and assistant messages get the **same id**. "Remove" deletes both, and React may warn about duplicate keys | Click Remove on a user message. Both disappear. |
| 6 | `key={index}` | Local state (the "Helpful" toggle) **jumps to another message** after a removal | Mark the 2nd reply helpful, remove the first message. |
| 7 | `useEffect` with no dependency array subscribes and unsubscribes on **every render**, about 50–100 times per second while streaming | Wasted work, and possibly missed status events between unsubscribe and subscribe | Count `subscribeStatus` calls, or set a breakpoint. |
| 8 | `setMessages` once per token, with a new array every time | 50–100 renders per second of the whole list. Typing lags on long chats | React Profiler: a commit per chunk. Performance panel: long tasks while streaming. |
| 9 | `MessageItem` isn't memoized, and `onRemove` is a new closure per render | Every message re-renders for every token | Profiler "Highlight updates". |
| 10 | `removeMessage` uses `messages` from the closure, not a functional update | Same lost-update family as #3 | Remove a message while a reply streams. |
| 11 | `data.delta` isn't validated, so `content += undefined` | The text `undefined` appears in answers when the server sends another event type (e.g. usage stats) | Send `{"usage":{...}}` in the stream. |

## Fixes (see `solution.tsx`)

1. **Carry over the partial line** between chunks: `pending += chunk; lines = pending.split('\n'); pending = lines.pop()`. Parse what's left at the end of the stream.
2. A complete invalid line is an **error**. Surface it (`role="alert"`), report it (`console.error` → error tracker), and never `catch {}` silently.
3. **Functional updates** (`setMessages(ms => …)`) everywhere state depends on previous state. Build `history` from a ref to the latest messages.
4. **One `AbortController` per stream.** Abort on a new message and on unmount. Ignore tokens from a stream that is no longer current.
5. **Unique ids** from a counter (or `crypto.randomUUID()` in browsers that have it).
6. **Stable keys:** `key={message.id}`.
7. **Effect deps:** `useEffect(() => transport.subscribeStatus(setOnline), [transport])`.
8. **Batch tokens:** keep a buffer in a ref and flush every ~16 ms with one functional update.
9. `memo(MessageItem)` with a stable `onRemove(id)` callback.

## How to talk about it in the interview

- "The AI's summary said 'handles errors gracefully'. I verified that claim first, because silent `catch {}` is the most common problem in generated code."
- "I wrote a failing test for each bug before fixing it. With AI-generated code, tests are how I keep ownership."
- "I'd accept the AI's JSX and types as they were. I rewrote the streaming logic by hand, because that's where the concurrency bugs are."
- Show the **rejected suggestions**. Interviewers at Meta, Google and Rippling look for judgment, not prompt volume.
