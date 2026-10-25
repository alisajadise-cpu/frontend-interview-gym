# 03 · Promise Pool: `mapLimit` with order, fail-fast and abort

**Difficulty:** Hard · **Time:** 30–40 min · **Similar to:** GreatFrontEnd *Map Async Limit*, LeetCode 2636 *Promise Pool*, `p-map`, `async.mapLimit`

## Why companies ask this

Uploading 500 files, prefetching 200 images, or calling an API that allows 5 parallel requests. `Promise.all` starts everything at once, and a `for … await` loop runs one at a time. Real apps need **N at a time**. The interviewer watches for three classic bugs:

- running in **batches** (waiting for the slowest of each batch) instead of a real pool,
- returning results in **completion order** instead of input order,
- continuing to start new work after a failure or after the user cancelled.

## Task

Implement `mapLimit(items, limit, mapper, options)` in `index.ts`.

```ts
const controller = new AbortController();
const thumbs = await mapLimit(files, 3, (file, i) => upload(file), { signal: controller.signal });
// cancel button: controller.abort();
```

## Requirements

1. At most `limit` mappers run at the same time.
2. Start the first `min(limit, items.length)` mappers **synchronously**, inside the `mapLimit` call.
3. As soon as **any** mapper finishes, start the next item. Don't wait for a whole batch.
4. Resolve with the results in **input order**.
5. `mapper` receives `(item, index)`. It may return a value or a promise. If it throws synchronously, treat that as a rejection.
6. **Fail fast:** if a mapper rejects, reject with that error right away and don't start any more mappers. Results that arrive later are ignored.
7. Empty input resolves to `[]` without calling `mapper`.
8. `limit` must be an integer ≥ 1. Otherwise **throw** a `RangeError` synchronously.
9. **Abort:** when `options.signal` aborts, reject right away with `signal.reason` (an `AbortError` `DOMException` if no reason was given) and don't start new mappers. If the signal is already aborted, reject without calling `mapper`.
10. Remove the abort listener when the pool finishes, so long-lived signals don't leak listeners.

## Edge cases interviewers probe

- `limit` larger than the number of items.
- A mapper that resolves synchronously, like `(x) => x * 2`.
- Two mappers that reject: only the first error counts.

## Follow-ups

- How would you pass the `signal` down to each mapper so in-flight `fetch` calls are cancelled too?
- Add a "settle all" mode (like `Promise.allSettled`) that keeps going after errors.
- Make the pool **streaming**: an async iterator that yields results as they finish (`for await (const r of pool)`).
- Browser fact: Chrome allows only about 6 HTTP/1.1 connections per host. How does that change the best `limit`? What changes with HTTP/2?

## Run

```bash
npm test js/03-promise-pool
npm run test:solution js/03-promise-pool
```
