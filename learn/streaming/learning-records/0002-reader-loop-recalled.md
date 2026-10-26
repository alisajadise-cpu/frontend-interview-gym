# Reader loop + streaming decoder recalled from memory; inner-loop exit is the gap

In the lesson 2 practice, the learner wrote the lesson 1 part correctly without help: `getReader()`, the `{ value, done }` loop with `break`, ONE `TextDecoder` with `{ stream: true }`, and the final `decoder.decode()` flush. Lesson 1's skill is in place.

**Gaps seen (same attempt):**
- The inner "take out lines" loop was `while (true)` with no exit when no line ending is left. That's an endless yield loop that froze the page. The missing idea: "no line ending found → stop, the rest waits in the buffer."
- `end` was declared outside the loop and kept a stale value from the previous line.
- `\r\n` handling: checked `\r\n` then `\n`, so `\n` always won. The line kept a trailing `\r`, and `slice(end + 1)` assumed a 1-character ending. Bare `\r` and the trailing-`\r` wait rule weren't attempted yet.
- After the stream ends, the flush was done but leftover lines weren't taken out.

**Implications:** Next steps should build the loop up in stages: `\n` only with a correct stop, then `\r\n` and `\r`, then the end-of-stream pass. Lesson 3+ should state every loop's stop condition explicitly. Also asked about `while ((end = indexOf()) !== -1)` and put the brackets in the wrong place, so prefer the explicit `while (true) { ...; if (end === -1) break; }` form in teaching code.

**Follow-up (same session):** After 3 more attempts the learner reached the `\n` and `\r\n` handling on their own: resetting `end` each round, skipping 2 for `\r\n`. They couldn't work out the bare `\r` / trailing-`\r` wait logic or the final `takeLines(true)` pass, and asked for the full code, which was given with `buffer.search(/[\r\n]/)` and `function* takeLines(isEnd)`. Treat these as **seen, not mastered**. Lesson 3 should open with a short retrieval task on the trailing-`\r` rule and the final pass before building on it.
