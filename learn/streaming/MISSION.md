# Mission: Streaming in the browser (fetch streams + SSE)

## Why
Pass senior frontend interview rounds at AI-era companies, where "stream an LLM response into the UI" is a standard question. I need to solve `ai/01-sse-parser` and `ai/02-streaming-chat` under time pressure and explain the why out loud.

## Success looks like
- Write the `fetch` → `response.body` reader loop from memory, including cancel on early exit.
- Explain why bytes ≠ text, and decode a split multi-byte character correctly with one `TextDecoder`.
- Implement the SSE parser in `ai/01-sse-parser` so all tests pass, in ~40 minutes, without peeking.
- Answer the follow-ups out loud: SSE vs WebSocket vs fetch streaming, resuming with `Last-Event-ID`, where backpressure lives.

## Constraints
- Already comfortable with: `fetch` + async/await, Promises (deeply), generators / `for await`.
- New to: streams, bytes/encodings, the SSE wire format.
- Prefers short lessons that end in hands-on practice.

## Out of scope
- Server-side implementation of SSE (Node/edge handlers), except where it explains client behaviour.
- WebSocket protocol internals.
- Node.js streams API (we use the web `ReadableStream`).
