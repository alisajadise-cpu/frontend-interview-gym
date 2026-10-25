# 03 · Inline code completion: solution

## R: Requirements

### Functional

1. Show a gray inline suggestion (ghost text) at the cursor after the user pauses typing.
2. **Tab** accepts all of it. **Cmd/Ctrl+→** accepts the next word. **Esc** dismisses. Any other typing continues normally.
3. If the user types characters that match the start of the suggestion, the suggestion stays and shrinks ("type-through").
4. Multi-line suggestions are shown as ghost lines below the cursor.
5. Optional: cycle through alternatives (Alt+] / Alt+[).
6. Users and admins can turn it off per language or file pattern.

### Non-functional

| Area | Target |
|---|---|
| Latency | p50 ≤ 300 ms, p95 ≤ 600 ms from pause to ghost text. Drop anything older. |
| Typing | **Zero** impact on keystroke latency. Completion code never runs on the keystroke path synchronously. |
| Cost | Requests per user per hour must stay bounded, because every keystroke *could* be a request. |
| Privacy | Excluded files never leave the browser. Secrets are filtered. |
| Quality | Acceptance rate is tracked per language and per model version. |

## Latency budget (example, p50)

```
user pauses ─ debounce 75 ms ─┬─ build context 5–15 ms ─ network RTT 40–80 ms ─ model TTFT 80–150 ms ─ render 1 frame
                              └─ total ≈ 250–300 ms
```

To save time: keep a warm HTTP/2 connection, use edge regions, and use a small fast model. **Stream** the completion and stop early: for a single-line suggestion, stop at the first newline.

## A: Architecture

```
┌────────────────────────────── Browser tab ───────────────────────────────┐
│  Editor (Monaco / CodeMirror)                                             │
│    │ onDidChangeContent / cursor events                                   │
│    ▼                                                                      │
│  CompletionController (main thread, tiny)                                 │
│    - trigger policy + debounce                                            │
│    - current request id, AbortController                                  │
│    - ghost text rendering via the editor's inline-suggestion API          │
│    - type-through matching, accept / partial accept / dismiss             │
│    │                                     ▲                                │
│    ▼ postMessage(doc snapshot, cursor)   │ suggestion events              │
│  Completion Worker (Web Worker)                                           │
│    - context builder (prefix/suffix, neighbor snippets, imports)          │
│    - token budgeting, secret filter, excluded-path check                  │
│    - LRU cache: hash(context) → suggestions                               │
│    - fetch + stream parse, post-processing (dedupe vs suffix, brackets)   │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTPS/2 (keep-alive)
┌──────────────────────────────▼───────────────────────────────────────────┐
│ Completion gateway: auth, rate limit, routing (lang → model), no-retain   │
│   → low-latency completion model (FIM)                                     │
│ Telemetry ingest (shown / accepted / rejected events)                      │
└───────────────────────────────────────────────────────────────────────────┘
```

**Why a worker:** context building (reading other files, ranking snippets, hashing) and stream parsing must never compete with typing. The main thread only debounces and renders.

## D: Data model

```ts
type CompletionRequest = {
  requestId: string;
  language: string;
  filePath: string;          // relative, for the model's context. Excluded files never get here.
  prefix: string;            // text before the cursor (trimmed to a budget)
  suffix: string;            // text after the cursor (trimmed)
  snippets: { path: string; text: string; score: number }[]; // from other files
  mode: 'single-line' | 'multi-line';
  maxTokens: number;
};

type Suggestion = {
  requestId: string;
  text: string;              // text to insert at the cursor
  range: { start: Position; end: Position }; // may replace an auto-closed bracket
  createdAt: number;
  modelVersion: string;
};

type GhostState =
  | { kind: 'idle' }
  | { kind: 'pending'; requestId: string; anchor: Position; docVersion: number }
  | { kind: 'showing'; suggestion: Suggestion; typedSoFar: string; anchor: Position };

type CompletionEvent = {
  type: 'shown' | 'accepted' | 'partially_accepted' | 'rejected' | 'dismissed';
  requestId: string;
  language: string;
  latencyMs: number;
  charsShown: number;
  charsAccepted: number;
  // later: whether the accepted text is still there after 30s / 5min ("retention")
};
```

## I: Interface / API

```
POST /v1/completions/inline
Body: CompletionRequest
Response: text/event-stream
  data: {"text":"const user = await"}
  data: {"text":" fetchUser(id);"}
  data: {"done":true,"finishReason":"newline" | "length" | "stop"}

POST /v1/completions/telemetry   (batched, sendBeacon on page hide)
  { events: CompletionEvent[] }
```

Why streaming even for short text: the client can show the first line as soon as it arrives and **stop reading early**. For single-line mode, the client aborts at the first `\n`, which saves model time on the server.

## The keystroke flow

```
keystroke
  │
  ├─ if ghost is showing and the typed char equals the next char of the suggestion:
  │      advance typedSoFar, keep showing the remaining text (no request)  ← type-through
  │
  ├─ else: clear the ghost, abort the in-flight request (AbortController)
  │
  ├─ trigger policy: should we ask at all?
  │      no if: in the middle of a word with text after it, inside a comment (configurable),
  │             IME composition active, multi-cursor, selection not empty,
  │             file excluded, user typing very fast (wait for a pause)
  │
  └─ debounce (≈ 50–100 ms, adaptive: shorter after an accepted suggestion)
        │
        ├─ cache lookup (hash of trimmed prefix-end + suffix-start + file) → show instantly
        └─ else worker builds context → fetch (stream) → post-process → show if still valid
```

**"Still valid" check before showing:** the doc version and cursor position must be the same as when the request was made. Or the user typed text that is a prefix of the suggestion, in which case trim it and show the rest. Otherwise drop the result. This is the race-condition guard.

## Context building (fill-in-the-middle)

1. **Prefix:** text before the cursor, up to about 1,500 tokens, cut at line boundaries.
2. **Suffix:** text after the cursor, up to about 500 tokens. The suffix tells the model what *not* to repeat (for example a closing `}` that already exists).
3. **Neighbor snippets:** from other open tabs and imported files. Rank them by similarity to the code around the cursor (for example Jaccard similarity over token sets, which is cheap), plus the import graph. Fill the remaining budget.
4. **Header:** file path and language, which helps the model a lot.
5. **Budget:** a total token budget per request (for example 2–4k). Smaller prompts mean lower TTFT and cost.
6. **Filters:** drop excluded paths (admin patterns, `.env`, `*.pem`), and redact strings that look like secrets (high-entropy tokens, `AKIA…`).

## Post-processing (on the client/worker)

- **Remove overlap with the suffix.** If the suggestion ends with text that already exists after the cursor (like `)`), trim it.
- **Balance brackets** for multi-line suggestions. Cut at the end of the current block.
- **Drop useless suggestions:** empty, whitespace only, or repeating the line above.
- Respect the file's indentation (tabs vs spaces).
- **Syntax check (optional):** a tree-sitter parse of prefix + suggestion + suffix in the worker. Drop suggestions that create a parse error, where the parser supports the language.

## O: Optimizations

| Technique | Effect |
|---|---|
| Debounce + trigger rules | Fewer requests (cost) and less flicker |
| Abort stale requests | Server stops generating for outdated context, frees capacity |
| Type-through | No new request while the user types what was suggested |
| LRU cache by context hash | Instant re-show after undo, or when moving back to the same place |
| Streaming + early stop at newline | Lower latency and fewer tokens |
| Warm connection, HTTP/2, edge | Lower RTT |
| Small FIM model, short context | Lower TTFT |
| **Speculative prefetch** (optional) | After an accept, immediately request the *next* suggestion |
| Adaptive debounce | Fast typists get a longer debounce, and after an accept it's shorter |
| Worker for context and parsing | Typing stays smooth |

**Rate limiting on the client:** a token bucket of N requests per minute per tab, so a runaway loop or a stuck key can't flood the API. The server enforces limits too.

## Rendering ghost text

- Use the editor's inline-suggestion API (Monaco `InlineCompletionsProvider`, CodeMirror decorations/widgets). Don't overlay DOM on top of the editor yourself, because of scrolling, wrapping, and bidi issues.
- Ghost text must be clearly different: a gray/italic theme token, with enough contrast to read while still clearly "not real" text.
- Multi-line ghost text uses widget lines that don't shift the real lines until accepted. Or accept that they shift, but then *never* show them while the user is typing fast.

## Accessibility

- Screen readers: don't read every suggestion. Announce "Suggestion available, press Tab to accept" politely, and only after a pause. Offer a command to read the suggestion.
- Tab is normally used to move focus or indent. Accept with Tab **only when a suggestion is visible**, and keep a documented way to insert a real tab.
- Every shortcut must be configurable.

## Security and privacy

- **Exclusions are enforced on the client** (the content never leaves the browser) **and the server** (defense in depth).
- **Secrets:** redact before sending, and filter suggestions that contain key-like strings, because a model can "remember" secrets from training data.
- **Retention:** a no-retain mode for business tenants. Telemetry has no code content, only lengths and ids, unless the user opts in.
- **Licensing:** optionally filter suggestions that match public code verbatim (a "public code filter").
- **Prompt injection through code comments** matters less for plain completion (no tools). It matters a lot if the same context goes to an agent with tools.

## Telemetry and evals

- **Acceptance rate** = accepted / shown. Track it per language, per model version, and per trigger type.
- **Characters retained**: how much accepted text still exists after 30 s / 2 min / 10 min. This catches "accepted then deleted", which makes the acceptance rate look better than it is.
- **Latency**: p50/p95 of pause → ghost, and the share of suggestions dropped for being stale.
- **A/B tests** for model versions and debounce values, with guardrail metrics (requests per user, cost).
- **Offline evals**: a dataset of real cursor positions where we know what the developer typed next (from consenting users or open repos). Measure exact match and edit distance, and whether the result compiles or passes tests.

## Trade-offs

| Decision | Alternative | Why |
|---|---|---|
| Small fast model | Big smart model | Latency beats intelligence for inline completion. Chat uses the big model. |
| Debounce ~75 ms | Request on every key | Cost and flicker. Type-through covers fast typing. |
| Worker-based context | Main thread | Keystroke latency is sacred |
| Drop late results | Show anything that arrives | A suggestion for old context is wrong and confusing |
| Early stop at newline | Generate full multi-line | Faster. Multi-line only in the right positions. |

## Follow-ups

- **"How do you decide single-line vs multi-line?"** Multi-line when the cursor is at the end of a line that opens a block (`{`, `:`, `=>`), or on an empty line inside a function body. Otherwise single-line.
- **"How do you avoid suggestions flickering?"** Debounce, keep the current suggestion while the typed text matches it, and don't replace a visible suggestion unless the new one is clearly for the new position.
- **"How would you handle a 10k-line file?"** Never send the whole file. Take a window around the cursor, plus symbols (signatures) from the rest. The editor model already gives cheap access to lines.
- **"How do you measure if it actually helps developers?"** Acceptance and retention rates first, then cohort studies of task completion time and PR throughput, with skepticism about self-reported speedups.

## Senior vs mid-level answer

| Mid-level | Senior |
|---|---|
| "Call the API on change, show the result" | Trigger policy, debounce, abort, validity check before showing |
| Sends the whole file | Prefix/suffix FIM, ranked snippets, token budget |
| Ignores typing performance | Worker, zero work on the keystroke path |
| No metrics | Acceptance rate, retention, latency percentiles, A/B tests |
| Ignores privacy | Exclusions enforced in client and server, secret redaction, no-retain |
