# 02 · Design an internal LLM playground

**Time:** 45 min · **Reported at:** OpenAI frontend system design ("design an internal ChatGPT Playground with model selection, editable parameters, and shareable presets"). Similar tools: the OpenAI Playground, Anthropic Console Workbench, Google AI Studio.

## The prompt

> "Our engineers and researchers need a web playground to try our models. They choose a model, write a system prompt and messages, change parameters like temperature and max tokens, and run it. They want to compare two models or two prompts side by side, save presets, and share a link with a teammate. Design the frontend."

## Clarifying questions (with assumed answers)

| Question | Assume |
|---|---|
| Who are the users? | Internal engineers, researchers, PMs. ~2,000 users. Desktop only. |
| How many models? | 10–30, each with its own allowed parameters and limits. The list comes from an API. |
| Are runs billed? | Yes, to the user's team. Show token usage and estimated cost. |
| Compare how many? | 2 side by side is required. Up to 4 is nice to have. |
| What does sharing mean? | A link opens the exact preset (model, params, messages). Teammates can fork it. Optional: share a *run result*. |
| Rate limits? | Per user and per team. Requests can get 429. |
| Tools / function calling? | Nice to have: define JSON-schema tools and see tool calls. |
| History? | Last 100 runs per user, searchable. |

## What the interviewer is looking for

- **State modelling:** a preset vs a run vs a comparison, plus URL state vs saved state.
- **Schema-driven parameter UI** that adapts to each model's capabilities and limits.
- **Parallel streaming** of two runs, with independent stop and errors.
- **Shareable, reproducible** links that are versioned and immutable when shared.
- **Token counting and cost** estimates *before* running.
- Rate-limit UX and concurrency control.
- Developer-tool polish: keyboard shortcuts, "view code" (curl / SDK snippet), diffing outputs.

## Time split

| Min | Part |
|---|---|
| 0–5 | Requirements |
| 5–15 | Architecture, components |
| 15–25 | Data model: preset, run, comparison, URL |
| 25–35 | API + streaming two runs + rate limits |
| 35–45 | Optimizations, sharing, security, trade-offs |
