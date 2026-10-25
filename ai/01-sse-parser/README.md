# AI 01 · Server-Sent Events parser (how LLM streaming really works)

**Difficulty:** Hard · **Time:** 40 min · **Similar to:** the streaming layer inside the OpenAI / Anthropic JS SDKs, `@microsoft/fetch-event-source`, `eventsource-parser`

## Why companies ask this

Every "ChatGPT-style" product streams tokens over **Server-Sent Events** (SSE). You can't use the browser's `EventSource` when you need `POST`, auth headers, or a request body. So frontend teams call `fetch()` and parse `response.body` themselves, and that's where the bugs live:

- A network chunk can end **in the middle of a line**.
- A chunk can end **in the middle of a UTF-8 character**. Persian, Arabic, Chinese and emoji use 2–4 bytes, and decoding each chunk separately prints `�`.
- `\r\n` can be split across two chunks and look like two line breaks.

Interviewers at AI companies use this to check that you understand bytes vs text, streams, and specs, not only React.

## Task

Implement two async generators in `index.ts`.

```ts
const res = await fetch('/api/chat', { method: 'POST', body, signal });

for await (const event of parseSSE(res.body!)) {
  console.log(event); // { event: 'message', data: '{"choices":[...]}', id: '' }
}

for await (const text of streamChatCompletion(res.body!)) {
  appendToMessage(text); // "Hel", "lo", " world"
}
```

## Requirements

`parseSSE(source)`, where `source` is a `ReadableStream<Uint8Array>` **or** an `AsyncIterable<Uint8Array>`:

1. Decode bytes with **one** `TextDecoder` and `{ stream: true }`, so multi-byte characters split across chunks decode correctly.
2. Lines end with `\n`, `\r\n`, or `\r`. A `\r\n` split across two chunks is **one** line break.
3. Ignore a UTF-8 BOM (`﻿`) at the very start of the stream.
4. A line starting with `:` is a comment. Ignore it (servers send `: ping` keep-alives).
5. `field: value` lines. Remove **one** space after the colon, if present. A line without a colon is a field with an empty value.
   - `data`: append the value plus `\n` to the data buffer.
   - `event`: set the event type.
   - `id`: set the last event id. It **persists** for later events until changed.
   - Ignore any other field (including `retry`).
6. A blank line **dispatches** the event: `{ event: type || 'message', data: dataBuffer without its last '\n', id: lastEventId }`. Then reset the data buffer and the event type.
   - If the data buffer is empty, don't dispatch anything (but still reset).
7. At end of stream, an event that wasn't followed by a blank line is **discarded** (that's what the spec says).
8. If the consumer stops early (`break`), cancel the `ReadableStream` reader.

`streamChatCompletion(source)` (OpenAI-style chat completions stream):

9. For each event, `data: [DONE]` ends the generator. Don't read any further.
10. Otherwise, `JSON.parse` the data and yield `choices[0].delta.content` when it's a non-empty string. Deltas with only `role`, or with empty content, yield nothing.
11. Invalid JSON throws an `Error` whose message contains `Malformed`.
12. A JSON body with an `error` object throws an `Error` with `error.message`.

## Edge cases interviewers probe

- Why not `chunk.toString()` / `new TextDecoder().decode(chunk)` per chunk?
- Why is splitting on `\n\n` wrong? (CRLF, `\r`, and blank lines split across chunks.)
- What happens to your parser on a 10 MB single event? (Buffering, and using `indexOf` from the last scan position.)

## Follow-ups

- SSE vs WebSocket vs fetch streaming for LLM output: auto-reconnect, `Last-Event-ID`, proxies/HTTP2, direction of data.
- How do you **resume** a stream after a network drop? (`id` + `Last-Event-ID`, server-side buffering.)
- Where do you put backpressure? (`ReadableStream` pull vs push, and why rendering every token is the real bottleneck. See `ai/02-streaming-chat`.)
- Anthropic's API sends typed events (`message_start`, `content_block_delta`, …). How would you change `streamChatCompletion` to support both providers? (An adapter per provider that emits one internal event type.)

## Run

```bash
npm test ai/01
npm run test:solution ai/01
```
