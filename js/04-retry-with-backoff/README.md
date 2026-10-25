# 04 · Retry with exponential backoff, jitter and abort

**Difficulty:** Hard · **Time:** 35–45 min · **Similar to:** AWS SDK retry strategy, `p-retry`, `ky` / `axios-retry`, React Query `retry` + `retryDelay`

## Why companies ask this

Every production API client retries failed requests. A naive retry (a loop with a fixed delay) makes outages **worse**: thousands of clients retry at the same moment ("thundering herd"). Interviewers want to hear about **exponential backoff**, **jitter**, **which errors are safe to retry**, respecting the server's `Retry-After`, and **cancelling** when the user leaves the page.

## Task

Implement `retry(fn, options)` in `index.ts`.

```ts
const user = await retry((attempt, signal) => fetchJson(`/api/user`, { signal }), {
  retries: 4,
  baseDelay: 200,
  maxDelay: 5_000,
  jitter: 'full',
  shouldRetry: (err) => err.status === undefined || err.status >= 500 || err.status === 429,
  signal: controller.signal,
});
```

## Requirements

Options and defaults: `retries = 3`, `baseDelay = 100`, `factor = 2`, `maxDelay = Infinity`, `jitter = 'none'`, `shouldRetry = () => true`, `random = Math.random`.

1. Call `fn(attempt, signal)`. `attempt` starts at **1**. `signal` is `options.signal` (may be `undefined`). If it resolves, resolve with its value.
2. If it fails, retry up to `retries` more times (so at most `retries + 1` calls). After the last failure, reject with the **last** error.
3. Treat a synchronous throw from `fn` the same as a rejection.
4. **Delay** before the next attempt, after attempt `n` failed:
   - `jitter: 'none'` → `min(maxDelay, baseDelay * factor ** (n - 1))`, so 100, 200, 400, …
   - `jitter: 'full'` → `Math.floor(random() * thatCappedDelay)` ("full jitter", from the AWS architecture blog)
   - If the error has a numeric `retryAfterMs` property (e.g. parsed from a `Retry-After` header), use `min(maxDelay, err.retryAfterMs)` instead, with no jitter.
5. `shouldRetry(error, attempt)` returning `false` → reject right away with that error.
6. `onRetry(error, attempt, delay)` is called once before each wait.
7. **Abort:**
   - If `signal` is already aborted, reject with `signal.reason` without calling `fn`.
   - If it aborts **during a wait**, reject right away and **clear the timer** (no leaked timers).
   - If it aborts **while `fn` is running**, reject right away. Don't wait for `fn` and don't retry.
   - If `signal.reason` is empty, use a `DOMException` named `AbortError`.
8. Use `setTimeout` for the waits. The tests use fake timers.

## Edge cases interviewers probe

- `retries: 0` → exactly one call.
- `maxDelay` smaller than `baseDelay`.
- `fn` ignores the signal: you still must not hang.
- Don't leave unhandled rejections behind (e.g. the original `fn` promise after an abort).

## Follow-ups

- Which HTTP errors are safe to retry? Explain idempotency: `GET`/`PUT`/`DELETE` vs `POST`, and idempotency keys.
- Full jitter vs equal jitter vs decorrelated jitter. Why does jitter reduce load on a recovering server?
- Retry budgets and circuit breakers: when should the client **stop** retrying for everyone?
- How would you show this in the UI ("Reconnecting in 4s… Retry now")?

## Run

```bash
npm test js/04-retry-with-backoff
npm run test:solution js/04-retry-with-backoff
```
