# AI 02 · Streaming chat UI (ChatGPT-style)

**Difficulty:** Hard · **Time:** 60 min · **Similar to:** an OpenAI frontend coding round reported in 2026 ("build a ChatGPT-style interface around a supplied streaming function, then handle a new request mid-stream"), and the streaming parts of Claude.ai / ChatGPT / Vercel AI SDK `useChat`

## Why companies ask this

Every AI product team builds this screen, and it's full of traps that a normal CRUD form doesn't have:

- Tokens arrive **50–100 times per second**. A `setState` per token re-renders the conversation 100×/s and makes typing lag.
- The user can press **Stop**, or send a **new message while the old answer is still streaming**. The old stream must be aborted, and its late tokens must never land in the new answer.
- Errors happen in the middle of an answer. The user needs **Retry**.
- Model output is untrusted text. Rendering it as HTML is an **XSS hole**.

## Task

Build `<Chat />` in `index.tsx`.

```tsx
<Chat
  streamReply={async function* (messages, signal) {
    const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages }), signal });
    yield* streamChatCompletion(res.body!); // see ai/01-sse-parser
  }}
/>
```

`streamReply(history, signal)` receives the conversation as `{ role: 'user' | 'assistant'; content: string }[]`, ending with the newest user message, and returns an `AsyncIterable<string>` of text deltas.

## Requirements

**Sending**
1. A `<textarea>` labelled `Message` and a `Send` button. `Enter` sends; `Shift+Enter` doesn't (it adds a newline). Ignore `Enter` while an IME is composing (`isComposing`); Persian/Chinese keyboards need this.
2. Empty or whitespace-only input isn't sent. After sending, the input is cleared. The input **stays enabled** while a reply streams.
3. Each message is an `<article>` with the accessible name `Your message` or `Assistant message`, inside a container with `role="log"`, `aria-live="polite"`, the accessible name `Conversation`, and `aria-busy="true"` while a reply is streaming.
4. `history` contains every user message plus every **finished or stopped** assistant message, in order. Failed assistant messages are left out.

**Streaming**
5. The assistant message shows text as it arrives.
6. **Batch updates:** buffer incoming tokens and flush them to React state at most once per ~16 ms (one frame), plus a final flush when the stream ends. The assistant message component must call `probe('AssistantMessage')` when it renders; a test streams 200 tokens and expects fewer than 10 renders of that message.
7. Render model output as **plain text**. Never use `dangerouslySetInnerHTML`.

**Stop, interrupt, errors**
8. While streaming, show a `Stop` button. Stop aborts the `signal`, keeps the partial text, and shows `Stopped` on that message.
9. Sending a new message during a stream stops the current reply first (same as Stop), then starts the new one. Its `history` includes the stopped partial answer.
10. Tokens that arrive after their stream was stopped are ignored, even if `streamReply` doesn't respect the signal.
11. If the stream throws (not because we aborted), show `Something went wrong` and a `Retry` button on that message. Retry removes the failed message and calls `streamReply` again with the same history.
12. Unmounting aborts the active stream.

## Edge cases interviewers probe

- Why must the token handler check *which* stream it belongs to? (A late token from stream #1 arriving after stream #2 started.)
- Where does the batching buffer live, and why not in state?
- What does the screen reader announce for 100 updates per second? (Why `aria-busy`, and why announcing only on completion is common.)

## Follow-ups

- **Markdown + code highlighting:** parse incrementally. A half-received code fence must not flash the whole message as code. Sanitize the generated HTML (DOMPurify or a safe renderer) and block `javascript:` links. Never trust model output. It can contain **prompt-injected** HTML from a web page the model read.
- **Auto-scroll:** stick to the bottom only if the user was already near the bottom (see `performance/01-chat-room`).
- **Long conversations:** virtualize, and memoize finished messages so only the streaming one re-renders.
- **Edit and regenerate / branches:** model the conversation as a tree (each message has a `parentId`) instead of an array.
- **Resume after reload:** persist the partial message and either resume with `Last-Event-ID` or regenerate.
- **Tokens/sec and time-to-first-token (TTFT):** how would you measure them in RUM and show them to users?
- **`useTransition` / `useDeferredValue`:** could they replace the manual buffer? (They help keep input responsive, but they don't reduce how many updates you schedule.)

## Run

```bash
npm test ai/02
npm run test:solution ai/02
npm run dev   # "ai / 02-streaming-chat"
```
