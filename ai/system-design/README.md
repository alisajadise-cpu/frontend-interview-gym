# AI system design (frontend-heavy)

AI product companies now ask design questions about chat UIs, playgrounds, code completion, and agents. Examples include OpenAI ("design a ChatGPT-like interface", "design an internal Playground") and Anthropic (Claude-style streaming chat and file upload flows). Classic companies ask them too, because almost every product is adding an AI feature.

Use the same **RADIO** framework as the main [`system-design/`](../../system-design/README.md) folder: Requirements, Architecture, Data model, Interface/API, Optimizations.

| # | Question | Main topics | Difficulty |
|---|---|---|---|
| 01 | [ChatGPT-style chat UI](01-chatgpt-ui/QUESTION.md) | streaming, stop/regenerate, branching, incremental markdown, resume | Hard |
| 02 | [Internal LLM playground](02-llm-playground/QUESTION.md) | params, side-by-side compare, presets in URL, cost display, rate limits | Medium–Hard |
| 03 | [Inline code completion (ghost text)](03-inline-code-completion/QUESTION.md) | debounce, cancellation, latency budget, context, telemetry | Hard |
| 04 | [RAG support assistant](04-rag-support-assistant/QUESTION.md) | ingestion, hybrid search, reranking, citations, evals | Hard (full-stack) |
| 05 | [Agent UI with human approval](05-agent-ui/QUESTION.md) | plans, tool calls, approvals, interrupt/resume, audit log | Hard |

Each folder has `QUESTION.md` (read this first and answer on paper for 45 minutes) and `SOLUTION.md` (a full senior answer).

## How AI design rounds differ from classic frontend rounds

| Classic round | AI round: what changes |
|---|---|
| Responses are fast and complete | Responses are **slow and streamed**: 1–30 s, token by token. You must design for *partial* state. |
| The same request gives the same response | **Non-deterministic** output. Regenerate, variants, and feedback are product features. |
| Cost per request is near zero | **Every request costs money**, roughly proportional to tokens. Cost becomes a design constraint. |
| The server is the source of truth for data | The model is an **untrusted source of content**. Its output can contain malicious markdown, links, or injected instructions. |
| Correctness is binary | Quality is a **distribution**. You need evals, feedback signals, and regression tests for prompts. |
| Latency = network + server | Latency = queueing + **time to first token (TTFT)** + generation speed (tokens/s). Perceived latency is a UX problem. |
| Rate limits are rare | **Rate limits (429) and capacity errors are normal**. Backoff, queueing, and graceful degradation are required. |

## Things to always mention in an AI design round

1. **Streaming protocol choice** and why (SSE / `fetch` + `ReadableStream` / WebSocket).
2. **Cancellation:** a Stop button that really aborts the upstream request, so you stop paying for tokens.
3. **Partial and failed states:** what the UI shows when the stream breaks halfway.
4. **Safe rendering** of model output: markdown → sanitized HTML, no raw HTML, safe links, CSP.
5. **Prompt injection:** content from documents, web pages, or tools can contain instructions.
6. **Cost and latency budgets:** model routing, prompt caching, `max_tokens`, short contexts.
7. **Evals and feedback:** thumbs up/down, regenerate rate, and offline eval sets before each prompt or model change.
8. **Accessibility of streaming text:** don't announce every token to screen readers.
