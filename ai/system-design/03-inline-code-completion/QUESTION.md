# 03 · Design inline code completion (ghost text)

**Time:** 45–60 min · **Similar products:** GitHub Copilot, Cursor Tab, Codeium/Windsurf, and AI completion inside web IDEs like StackBlitz, CodeSandbox, and Replit

## The prompt

> "We have a browser-based code editor. Design AI inline completions: while the user types, a gray 'ghost text' suggestion appears, and Tab accepts it. It must feel instant and never get in the way of typing. Walk me through the client design."

## Clarifying questions (with assumed answers)

| Question | Assume |
|---|---|
| Which editor? | Monaco or CodeMirror 6 running in the browser. |
| Model location? | A server-side completion model behind our API. A smaller model than chat, optimized for latency. |
| Single-line or multi-line? | Both. Multi-line when the cursor is at the end of a line in a block. |
| Latency target? | p50 under ~300 ms from pause to ghost text, p95 under ~600 ms. Slower suggestions are worse than none. |
| Context? | The current file (prefix + suffix), plus snippets from other open files and imports. |
| Privacy? | Business plans: no code retained, and admins can exclude paths (for example `.env`). |
| Metrics? | Acceptance rate and characters accepted are the main product metrics. |

## What the interviewer is looking for

- A **trigger policy** (when to ask) and **debouncing**, plus **cancellation** of stale requests.
- A **latency budget** split across client, network, and model.
- **Context gathering** within a token budget (fill-in-the-middle: prefix and suffix).
- **Caching and reuse**: when the user types characters that match the suggestion, keep showing it without a new request.
- Accept, partial accept (word / line), and dismiss UX. Never block typing.
- **Telemetry** to measure quality (acceptance rate, retention after accept).
- Privacy and security (secrets, excluded files).

## Time split

| Min | Part |
|---|---|
| 0–5 | Requirements, latency target |
| 5–15 | Client architecture + flow per keystroke |
| 15–25 | Context building + API |
| 25–40 | Optimizations: debounce, cancel, cache, streaming, post-processing |
| 40–45 | Telemetry, privacy, trade-offs |
