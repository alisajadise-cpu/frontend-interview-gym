# 02 · LLM playground: solution

## R: Requirements

### Functional

1. Pick a model from a list. Each model shows its context window, price, and capabilities (vision, tools, JSON mode).
2. Edit the **system prompt**, a list of **messages** (user/assistant turns), and **parameters**: temperature, top_p, max output tokens, stop sequences, seed (if supported), response format (text / JSON schema), and tools.
3. **Run** and stream the output. **Stop** a run.
4. **Compare mode:** 2–4 panes. Each pane has its own model and params, and either shares the prompt or has its own. "Run all" streams them in parallel.
5. **Presets:** save, name, version, and share by link. Opening a link loads the exact configuration. Editing a shared preset creates a fork.
6. **History:** recent runs with input, output, params, usage, and latency. Re-open any run.
7. Show **token count** and **estimated cost** before running, and real usage after.
8. **View code:** generate a curl / Python / JS snippet for the current configuration.

### Non-functional

- Exact reproducibility of a shared configuration, with no silent defaults changing under the user.
- Parallel streams must not block each other or the editor.
- Large prompts (100k tokens of text) must not freeze the editor.
- Internal tool, so access is controlled by SSO. Secrets must never end up in shared links.

## A: Architecture

```
┌──────────────────────────────── Browser ───────────────────────────────┐
│ <PlaygroundPage>                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ Toolbar: preset name · Save · Share · Compare · View code       │  │
│   ├──────────────────────────────┬──────────────────────────────────┤  │
│   │ PromptEditor                 │ Pane A          │ Pane B         │  │
│   │  SystemPrompt (code editor)  │  ModelPicker    │  ModelPicker   │  │
│   │  MessageList (editable)      │  ParamsForm     │  ParamsForm    │  │
│   │  ToolsEditor (JSON schema)   │  OutputStream   │  OutputStream  │  │
│   │  TokenCounter (worker)       │  Usage/latency  │  Usage/latency │  │
│   └──────────────────────────────┴─────────────────┴────────────────┘  │
│                                                                        │
│  Playground store (draft config) ──► URL sync (preset id + version)    │
│  Run manager (one AbortController per pane, concurrency limit)         │
│  Tokenizer Web Worker (counts tokens without blocking typing)          │
└───────────────┬────────────────────────────────────┬───────────────────┘
                │ REST                               │ fetch streaming (SSE format)
┌───────────────▼────────────────────┐   ┌───────────▼───────────────────┐
│ Playground API                     │   │ Inference proxy               │
│  models (+ param schemas, prices)  │   │  auth, per-team quotas        │
│  presets (versioned)               │   │  rate limiting, usage metering│
│  runs history                      │   │  → model backends             │
└────────────────────────────────────┘   └───────────────────────────────┘
```

## D: Data model

```ts
type ModelInfo = {
  id: string;                    // "model-large-2026-05"
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  pricing: { inputPer1M: number; outputPer1M: number; cachedInputPer1M?: number; currency: 'USD' };
  capabilities: { vision: boolean; tools: boolean; jsonSchema: boolean; seed: boolean };
  params: ParamSpec[];           // drives the form
  deprecated?: { sunsetDate: string; replacement: string };
};

type ParamSpec =
  | { key: string; type: 'number'; min: number; max: number; step: number; default: number; label: string; help?: string }
  | { key: string; type: 'integer'; min: number; max: number; default: number; label: string }
  | { key: string; type: 'enum'; options: string[]; default: string; label: string }
  | { key: string; type: 'string[]'; maxItems: number; label: string };

type PromptConfig = {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  tools?: { name: string; description: string; parameters: object /* JSON schema */ }[];
  responseFormat?: { type: 'text' } | { type: 'json_schema'; schema: object };
};

type PaneConfig = {
  id: string;
  modelId: string;
  params: Record<string, number | string | string[]>; // only explicitly set values
  promptOverride?: PromptConfig; // when panes compare different prompts
};

type Preset = {
  id: string;
  version: number;               // immutable versions
  name: string;
  ownerId: string;
  prompt: PromptConfig;
  panes: PaneConfig[];
  createdAt: string;
  forkedFrom?: { id: string; version: number };
};

type Run = {
  id: string;
  paneId: string;
  presetRef?: { id: string; version: number };
  request: { modelId: string; params: Record<string, unknown>; prompt: PromptConfig }; // fully resolved
  output: string;
  toolCalls?: { name: string; arguments: string }[];
  status: 'streaming' | 'complete' | 'stopped' | 'error';
  usage?: { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
  timings: { startedAt: number; firstTokenAt?: number; endedAt?: number };
  error?: { code: string; message: string; retryAfterMs?: number };
};
```

Key decisions:
- **Store only explicitly set params**, and keep the defaults in `ModelInfo`. But when you **save a preset or a run, resolve and store all values**. Model defaults may change later, and a shared link must reproduce exactly the same request.
- **Presets are immutable versions.** Sharing `?preset=p_123&v=4` always loads the same thing. Saving creates v5. Someone else's edit creates a fork.
- **Draft vs saved:** the editor holds a *draft*. Show an "unsaved changes" dot. Autosave drafts to `localStorage` per preset id.

### URL design

```
/playground                         empty draft
/playground?preset=p_123&v=4        load a saved version
/playground?run=r_999               open a past run (read-only, "Edit as new")
```

Don't put the whole prompt in the URL. Prompts can be 100 KB, URLs have length limits, and URLs leak through logs and referrers. Small tweaks like the selected pane can go in the URL hash.

## I: Interface / API

```
GET  /api/models                          → ModelInfo[]          (cache 5 min, ETag)
GET  /api/presets/:id?version=4           → Preset
POST /api/presets                         { name, prompt, panes }      → { id, version: 1 }
POST /api/presets/:id/versions            { prompt, panes, baseVersion } → { version }  (409 if baseVersion is stale)
POST /api/presets/:id/fork                → { id, version: 1 }
GET  /api/runs?cursor=…&q=…               → { items: RunSummary[], nextCursor }
POST /api/tokens/count                    { modelId, prompt } → { inputTokens }   (fallback if no client tokenizer)

POST /api/runs  (streaming)
  Headers: Idempotency-Key
  Body: { paneId, modelId, params, prompt, presetRef? }
  → text/event-stream
    event: run.created   data: {"runId":"r_1"}
    event: delta         data: {"text":"…"}
    event: tool_call     data: {"name":"get_weather","argumentsDelta":"{\"city\":"}
    event: done          data: {"usage":{…},"finishReason":"stop" | "length" | "tool_calls"}
    event: error         data: {"code":"rate_limited","retryAfterMs":3000}
POST /api/runs/:id/cancel
```

**Streaming two panes:** two independent `fetch` streams, each with its own `AbortController`. With HTTP/2 they share one connection. (HTTP/1.1 limits a browser to about 6 connections per host, which matters once you allow 4 panes plus other requests.) One pane failing must not stop the other.

## Client state

- **Playground store** (Zustand or `useReducer` + context): `draft`, `panes`, `runsByPane`, `activePresetRef`, `dirty`.
- **Server state** (React Query): models, presets, run history.
- **Run manager:** start/stop/retry per pane, a concurrency limit (for example 4 runs per user in the client, which also matches server quotas), and a token buffer per pane flushed once per animation frame.
- **Tokenizer worker:** counts tokens on every change, debounced 150 ms, off the main thread. If the model's tokenizer isn't available on the client, call the count endpoint, debounced, and show "≈" for approximate values.

## O: Optimizations

### Editor performance
- Use a real code editor (CodeMirror 6 / Monaco) for the system prompt and long messages. They virtualize lines and handle 100k-token text.
- Don't store editor text in React state on every keystroke. Keep it in the editor, and read it on Run or on a debounced change.
- Token counting runs in a worker, so typing never waits for tokenization.

### Output performance
- Batch deltas per animation frame.
- Long outputs: plain text by default, with a "Render Markdown" toggle that renders incrementally.
- **Diff view** for compare mode: word-level diff of two finished outputs, computed in a worker for large outputs.

### Network
- Cache `/models` with ETag. Prefetch preset data when hovering in the preset list.
- Debounce autosave (1 s) and only send changed fields.

### Cost display
```
estimatedCost = inputTokens / 1e6 * inputPer1M + maxOutputTokens / 1e6 * outputPer1M   (upper bound)
actualCost    = (usage.input - cached) / 1e6 * inputPer1M + cached / 1e6 * cachedInputPer1M + usage.output / 1e6 * outputPer1M
```
Show the *upper bound* before running ("up to $0.42"), and the actual cost after. In compare mode, show cost and latency side by side. That's often the reason people compare.

### Parameter UX
- Generate forms from `ParamSpec`, so a new model needs no frontend deploy.
- When switching models, **keep** compatible values, **clamp** out-of-range values with a visible notice ("max tokens lowered to 8,192 for this model"), and **drop** unsupported ones with a notice. Never change values silently.
- Show defaults as placeholders, so it's clear what is set and what is default.

## Rate limits and failures

| Case | UX |
|---|---|
| 429 for one pane | That pane shows "Rate limited, retry in 3 s" with a countdown and a Retry button. The other panes continue. |
| Team quota exhausted | A banner with usage and a link to request more. Run buttons disabled. |
| Context too long | Block Run before sending, because the token counter already knows. Show by how much the limit is exceeded. |
| `finishReason: length` | "Output cut at max tokens" + a "Continue" action. |
| Stream drops | Keep the partial output, mark it "incomplete", allow retry. |
| Deprecated model | Warning badge with the sunset date and a "switch to replacement" action. |

## Security

- SSO. Runs are billed to the team, so check that the user belongs to it **on the server**.
- **No API keys in the browser.** The inference proxy adds credentials.
- Shared links respect permissions: viewing a preset requires access to its workspace. Don't put secrets in system prompts. Optionally scan presets for key-looking strings before sharing.
- Render Markdown output safely (raw HTML off + sanitizer). Show tool-call JSON as text, never execute it.
- "View code" snippets use a placeholder like `$API_KEY`, never a real token.

## Accessibility

- Every parameter control has a label, a visible value, and help text through `aria-describedby`. Sliders are paired with number inputs for exact values.
- Keyboard shortcuts: Cmd/Ctrl+Enter runs, Esc stops. List them in a "?" dialog. Don't steal the browser's shortcuts.
- Status per pane goes through a polite live region: "Model A finished, 412 tokens, 2.3 seconds".

## Observability

- Per run: TTFT, total latency, tokens/s, error code, and model. Store these with the run so users can compare latency between models.
- Product metrics: runs per user, compare-mode use, preset shares, and the most-used params (to pick better defaults).

## Trade-offs

| Decision | Alternative | Why |
|---|---|---|
| Immutable preset versions | Mutable presets | Shared links stay reproducible |
| Store resolved params in runs | Store only overrides | Defaults can change later |
| Schema-driven forms | Hard-coded forms per model | New models ship without a frontend deploy |
| Client tokenizer in a worker | Server count on each keystroke | Fast and private, with server fallback |
| Prompt not in the URL | Encode everything in the URL | Length limits, leaks through logs and referrers |

## Follow-ups

- **"How do you make a run reproducible when the model is non-deterministic?"** Store the full resolved request including `seed` and the exact model version id. Explain that even with a seed, determinism is best effort on most providers.
- **"Batch evals in the playground?"** Upload a CSV of inputs, run with a concurrency limit through a job queue on the server (not 500 browser streams), and show a results table with scoring columns. This turns into an eval tool.
- **"Collaborative editing of presets?"** Start with optimistic locking (`baseVersion` + 409 + merge UI). Real-time co-editing with a CRDT (Yjs) only if users ask for it.
- **"How do you show structured output?"** Validate the JSON against the schema on the client, show a tree view, and highlight schema errors.

## Senior vs mid-level answer

| Mid-level | Senior |
|---|---|
| A form with fixed sliders | Schema-driven params with clamping and visible notices on model switch |
| Shares state in the URL | Immutable versioned presets, permissions, no secrets |
| Runs both panes, one spinner | Independent streams, stops, errors, and rate-limit handling per pane |
| No cost info | Pre-run upper-bound estimate, actual cost, cached-token pricing |
| Counts tokens on the main thread | Tokenizer in a worker, debounced, with a server fallback |
