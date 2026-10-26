# Starting point: strong on async JS, new to streams and bytes

The learner says they are comfortable with `fetch` + async/await, know Promises deeply, and know generators / `for await`. They have no mental model of streaming yet ("I don't have any idea how streaming works") and did not claim knowledge of bytes/encodings.

**Implications:** Don't re-teach promises or generators. Use them as the bridge, e.g. `parseSSE` as an async generator. Start at `ReadableStream` chunks and UTF-8 (lesson 1). Expect the line-buffering and spec-reading steps to be the real difficulty.
