# Notes

- Learner asked to be taught from zero on streaming ("I don't have any idea how streaming works"), in the context of `ai/01-sse-parser`.
- Knows fetch/async-await, Promises deeply, generators. Did NOT select bytes/encodings → teach UTF-8 basics from scratch.
- Workspace lives in `learn/streaming/` so it stays out of the exercise folder and the dev-server sidebar.
- Lessons are opened as `file://` pages → use classic `<script src>` (not ES modules) in assets.

## Planned path: 6 lessons (adjust from learning records)
1. Bytes arrive in chunks → reader loop + one TextDecoder with `stream: true`.
2. Text → lines across chunk boundaries (buffer, `\r\n` split across chunks).
3. The SSE format → events (fields, comments, dispatch on blank line).
4. Assemble `parseSSE` as an async generator; cancel on early `break`.
5. `streamChatCompletion`: `[DONE]`, JSON deltas, errors. Then timed attempt at `ai/01`.
6. Interview follow-ups: SSE vs WebSocket vs fetch streaming, `Last-Event-ID`, backpressure.

- Lesson 2 started without feedback on lesson 1 (learner said "go next lesson"). Ask for quiz/practice results to calibrate.

## Teaching preferences
- **Simple language.** Learner asked for lesson 2 to be simpler ("simpler language to understand what happening in buffer"). Use short sentences, everyday words, and show state changing step by step (before/after tables, narrated simulators) instead of abstract descriptions. Avoid spec-quote blocks in the main flow; paraphrase plainly and cite.
- English is likely not the learner's first language (Persian examples resonate). Prefer plain English; avoid idioms.
