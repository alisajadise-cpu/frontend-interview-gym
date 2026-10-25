# AI 03 · Review the AI's code (code-comprehension round)

**Difficulty:** Hard · **Time:** 45 min · **Format:** code review + fix · **Similar to:** Google's 2026 "code comprehension" round (read, debug, and optimize existing code with Gemini), Meta's AI-assisted round (reviewing AI output is part of the score), Canva's AI-assisted coding interview ("can you find and fix problems in AI-generated code?")

## The situation

You asked an AI assistant for a production-ready streaming chat hook. It answered with `index.tsx` and said:

> ✅ This implementation is production-ready, handles errors gracefully, and is optimized for performance.

The demo works when you try it once. It's wrong in at least **9 ways**. This is the most important AI-era skill interviewers test now: **don't trust, verify.** Rippling, for example, is reported to reject candidates for over-relying on AI even when their first approach was right.

## Your task

1. **Review first (15 min, no AI).** Read every line. List each bug with what the user would see and how you'd prove it. Rank by impact.
2. **Fix it (30 min).** You may use an AI assistant now, but you must be able to explain every line you keep. Run `npm test ai/03` until it passes.
3. Compare with `ANSWERS.md` and `solution.tsx`.

## Protocol (what `transport` does)

- `transport.stream(history, { signal })` yields **raw network chunks** of NDJSON. Each complete line is `{"delta":"text"}`, but **a chunk can end anywhere**, including in the middle of a line.
- A complete line that isn't valid JSON (for example, a proxy's HTML error page) is a protocol error. Show `Something went wrong` in a `role="alert"`.
- `transport.subscribeStatus(listener)` reports online/offline and returns an unsubscribe function.

## Rules

- Keep the exported names: `ChatPanel`, `useChatStream`, and the types.
- Keep `probe('MessageItem')` in `MessageItem`.
- One reply streams at a time. Sending a new message cancels the current reply.

## Hints (open one at a time)

<details><summary>Hint 1</summary>What is <code>messages</code> inside <code>sendMessage</code> after 50 tokens have arrived? After the user sent another message?</details>
<details><summary>Hint 2</summary>What does <code>Date.now()</code> return for two calls in the same millisecond?</details>
<details><summary>Hint 3</summary>What happens to <code>'{"delta":"Hel'</code> when you <code>split('\n')</code> and <code>JSON.parse</code> it?</details>
<details><summary>Hint 4</summary>How many times does the status effect run during one streamed answer?</details>

## Run

```bash
npm test ai/03
npm run test:solution ai/03
npm run dev   # "ai / 03-review-ai-code": the demo splits chunks badly on purpose
```
