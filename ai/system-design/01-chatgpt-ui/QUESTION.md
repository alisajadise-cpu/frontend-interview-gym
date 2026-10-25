# 01 · Design a ChatGPT-style chat UI

**Time:** 45–60 min · **Reported at:** OpenAI frontend loop (a ChatGPT-like interface with streaming, history, Markdown, and file upload), Anthropic (Claude-style streaming chat), and many companies adding an "AI assistant"

## The prompt (as the interviewer says it)

> "Design the frontend of a ChatGPT-like chat app. Users type a message and see the answer stream in. They can stop a response, regenerate it, edit an old message, and come back to old conversations. Responses contain Markdown and code. Users can attach files and images. Walk me through how you would build it."

## Clarifying questions to ask (with assumed answers)

| Question | Assume |
|---|---|
| Web only, or mobile web too? | Web desktop + mobile web. Native apps exist but are out of scope. |
| How many users and conversations? | Millions of users. A heavy user has thousands of conversations, some with 500+ messages. |
| Is the model API ours? | Yes. We have a backend "chat service" in front of the model. The client never calls the model directly. |
| Must edits keep the old branch? | Yes. Editing a message creates a new branch, and the user can switch between versions (`< 2/3 >`). |
| Should a stream continue if the tab closes? | Nice to have: the server finishes generating and the client can resume or reload the final answer. |
| File types and size? | Images, PDFs, and text files up to 20 MB each. |
| Offline? | Read old conversations offline. Sending requires a connection. |
| Accessibility and languages? | WCAG 2.2 AA. RTL languages (Persian, Arabic) must work. |

## What the interviewer is looking for

- Your **streaming design**: the protocol, incremental rendering, and the cost of re-rendering per token.
- **Stop** that really cancels the upstream generation.
- A **data model for branching** (a message tree, not a flat array).
- **Safe Markdown rendering** (XSS) and **prompt injection** awareness.
- **Failure handling**: a broken stream, 429 rate limits, and reconnect/resume.
- Performance of long conversations (virtualization) and code highlighting while streaming.
- Accessibility of live-updating text.

## Suggested time split (45 min)

| Min | Part |
|---|---|
| 0–5 | Requirements and scope |
| 5–15 | Architecture + component tree |
| 15–22 | Data model (message tree) |
| 22–32 | API + streaming protocol + stop/resume |
| 32–43 | Optimizations: rendering, Markdown, virtualization, security, a11y |
| 43–45 | Trade-offs and what you'd do next |
