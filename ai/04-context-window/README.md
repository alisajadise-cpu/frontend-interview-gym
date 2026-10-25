# AI 04 · Fit a conversation into the context window

**Difficulty:** Hard · **Time:** 45 min · **Similar to:** conversation memory in the Vercel AI SDK / LangChain, "trim messages" helpers, and context management in every chat product

## Why companies ask this

Models have a fixed **context window** (input + output tokens). Long chats and agent runs with big tool results overflow it, and then the API returns an error or cuts things off. Engineers on AI products write this function, and interviewers like it because it mixes:

- careful bookkeeping (token budgets, reserved output tokens),
- protocol rules (a tool result without its tool call is **rejected** by the provider APIs),
- product trade-offs (drop vs summarize) and **cost** (prompt caching).

## Task

Implement `fitToContext` and `estimateCost` in `index.ts`.

```ts
const result = fitToContext({
  system: 'You are a helpful assistant.',
  messages,                 // full conversation, oldest first
  maxTokens: 128_000,       // model context window
  reserveForReply: 4_000,   // room left for the answer
  countTokens: (text) => tokenizer.encode(text).length,
  summary: 'User is planning a trip to Isfahan…', // optional, from an earlier summarization call
});
// result.system, result.messages → send these to the model
```

## Requirements

**Counting**
1. Budget = `maxTokens - reserveForReply`.
2. Message cost = `perMessageOverhead` (default **4**) + `countTokens(content)`. For an assistant message with `toolCalls`, add `countTokens(name)` + `countTokens(arguments)` for each call.
3. System cost = `perMessageOverhead` + `countTokens(system)`.

**What to keep**
4. The **current turn** is the last `user` message plus everything after it (assistant tool calls and tool results of the running turn). It's always kept, along with the system prompt. If system + current turn don't fit, throw an `Error` whose message contains `does not fit`.
5. Older history is split into **units**:
   - an assistant message with `toolCalls` plus the following `tool` messages that answer those calls form **one** unit;
   - every other message is its own unit;
   - a `tool` message whose call isn't in its unit (an orphan) is **always dropped**.
6. Keep the **newest** units that fit, as a contiguous block. Drop the oldest first. Once one unit doesn't fit, stop: don't keep an older, smaller unit, because a gap in the middle confuses the model.
7. Never split or truncate a message.

**Summary**
8. If some history was dropped and `summary` is given, append it to the system prompt as `\n\nSummary of earlier conversation:\n<summary>`, then re-run the selection with the larger system prompt. If even system+summary+current turn don't fit, don't use the summary.
9. Don't add the summary when nothing was dropped.

**Result:** `{ system, messages, droppedCount, usedTokens, summarized }`. `droppedCount` counts dropped **messages**, including orphans. `usedTokens` is the cost of the returned system + messages.

**`estimateCost(usage, pricing)`**

10. `usage = { inputTokens, cachedInputTokens = 0, outputTokens }`. `inputTokens` **includes** cached tokens.
11. `pricing = { input, cachedInput, output }` in USD per **million** tokens.
12. Cost = uncached input × input price + cached input × cachedInput price + output × output price. Throw a `RangeError` if `cachedInputTokens > inputTokens`.

## Edge cases interviewers probe

- The last message is a tool result, not a user message (an agent mid-turn).
- An assistant made 3 parallel tool calls. Only 2 results fit.
- A single huge tool result (e.g. a 200 KB web page) inside the current turn.

## Follow-ups

- **Prompt caching vs trimming:** providers cache the **prefix** of the prompt. Dropping one old message every turn changes the prefix, so you pay full price every time. How would you trim in big steps instead? Where do tools and system prompt go? (First, because they are stable.)
- **Summarize vs drop vs retrieve:** when do you summarize (cheap model, background), and when do you store old turns in a vector index and retrieve them (RAG memory)?
- **Token counting on the client:** shipping a tokenizer (hundreds of KB) vs a server endpoint vs a `chars / 4` estimate with a safety margin.
- **Truncating tool results:** keep the head and tail, or ask the model to re-call the tool with pagination.
- **Cost guardrails:** per-user daily budgets, routing simple requests to a smaller model.

## Run

```bash
npm test ai/04
npm run test:solution ai/04
```
