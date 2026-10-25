# AI-era interviews

Since 2025, several big companies have changed their loops. Some now **let or expect** you to use an AI assistant and grade *how* you use it. Others still forbid AI in live rounds. Companies building AI products also ask frontend questions about streaming chat UIs, agents, and LLM cost and latency.

This folder trains all three: AI-assisted coding, AI product engineering, and AI system design.

## What companies are doing (as of October 2026)

Formats change fast, and some of these sources are secondhand. **Always ask your recruiter which tools are allowed in each round.**

| Company | What's reported | What they grade |
|---|---|---|
| **Meta** | "AI-enabled coding" round, piloted from October 2025. 60 min in CoderPad with a built-in assistant (models like GPT-5, Claude Sonnet, and Gemini 2.5 Pro). It replaces one of the two onsite coding rounds. You extend a **multi-file project** in phases instead of solving two LeetCode problems. | Planning before prompting, judgment, reviewing AI output, testing, clear communication, owning the final code |
| **Google** | Pilot from H2 2026 for early- and mid-career SWE roles on select US teams. Gemini is allowed. It includes a **code comprehension** round: read an existing codebase, find bugs, improve performance. | "AI fluency": prompting, checking output, debugging |
| **Canva** | "AI-Assisted Coding" replaced the CS-fundamentals screen for frontend and backend roles (June 2025). Candidates use Copilot, Cursor, or Claude on realistic, ambiguous product problems ("build a control system for airport takeoffs and landings"). | Breaking down ambiguity, when and how to use AI, catching and fixing bad AI code, production quality |
| **Rippling** | AI is optional in every round, but the **rubric changes** depending on how much you rely on it. Onsite includes a 90-minute build-and-defend round. | Sketching the approach yourself, understanding every line, verifying with tests. **Over-reliance is the top rejection reason.** |
| **OpenAI (frontend)** | Reported coding: build a ChatGPT-style UI around a supplied streaming function, then handle a new message arriving mid-stream (cancellation). Reported design: an internal LLM playground, and a ChatGPT-like app. | Streaming UI, async correctness, product sense |
| **Anthropic (frontend)** | Reported practical product rounds built around Claude-style flows: streaming chat, file uploads, async utilities. AI tools are **not** allowed unless explicitly stated. | Practical engineering, async JS |
| **Amazon and others** | Many standardized live rounds still run with AI **off**. Using AI there is an integrity violation. Take-homes at Stripe, Shopify, Vercel and many startups reportedly allow AI, but expect you to explain every choice. | Classic fundamentals |

**The common thread:** nobody hires "a prompt typist." They hire engineers who can break down a problem, keep control of the design, use AI for well-defined pieces, **read and verify every line**, and explain the trade-offs. The repo's other folders still matter just as much. You can't review AI code you couldn't write yourself.

## What's in this folder

| | What | Format |
|---|---|---|
| [playbook.md](playbook.md) | How to perform in an AI-assisted round: method, good and bad prompts, rubric, 60-min plan, drills | guide |
| [01-sse-parser](01-sse-parser/README.md) | Parse a streaming LLM response (SSE) byte by byte: split chunks, UTF-8, `[DONE]` | JS + tests |
| [02-streaming-chat](02-streaming-chat/README.md) | ChatGPT-style UI: streaming tokens, Stop, new message mid-stream, retry, batched renders | React + tests + demo |
| [03-review-ai-code](03-review-ai-code/README.md) | Code-comprehension round: an AI wrote this chat hook. Find the bugs and fix them. | buggy code + tests + answers |
| [04-context-window](04-context-window/README.md) | Fit a conversation into a token budget, plus cost with prompt caching | JS + tests |
| [05-agent-loop](05-agent-loop/README.md) | Agent tool-calling loop with guardrails: parallel tools, timeouts, approvals, loop detection | JS + tests |
| [system-design/](system-design/README.md) | ChatGPT UI, LLM playground, inline code completion, RAG support assistant, agent UI | QUESTION + SOLUTION |
| [concepts.md](concepts.md) | 30 AI engineering questions every frontend/product engineer should answer | Q&A |
| [behavioral.md](behavioral.md) | "How do you use AI?", reviewing AI PRs, presenting your own agent pipeline | Q&A + STAR |

## How to practice

- **AI-off (default):** solve the exercises yourself first. This is what "AI-off" rounds test, and what lets you judge AI output later.
- **AI-assisted mode:** pick an exercise you haven't done (any folder in the repo). Turn on your assistant (Cursor, Claude Code, Copilot), set the timer, and follow [playbook.md](playbook.md). Talk out loud. Afterwards, write down each AI suggestion you **rejected** and why. That list is your interview material.

## Sources

- interviewing.io: [How to use AI in Meta's AI-assisted coding interview](https://interviewing.io/blog/how-to-use-ai-in-meta-s-ai-assisted-coding-interview-with-real-prompts-and-examples)
- Canva Engineering Blog: [Yes, you can use AI in our interviews](https://canva.dev/blog/engineering/yes-you-can-use-ai-in-our-interviews) (June 2025)
- Entrepreneur: [Google is testing a new rule that could transform job interviews](https://www.entrepreneur.com/business-news/google-is-testing-a-new-rule-transform-job-interviews)
- University of Miami Career Center (republished Exponent guide, secondhand): [Google's AI-assisted coding interview, 2026 guide](https://customcareer.miami.edu/blog/2026/05/14/googles-ai-assisted-coding-interview-2026-guide/)
- Nyrion (summary of interviewing.io reports): [Rippling's AI-enabled coding interview](https://nyrion.ai/companies/rippling)
- Educative: [OpenAI Frontend Engineer interview guide](https://www.educative.io/blog/openai-frontend-engineer-interview) (secondhand reports)
- GreatFrontEnd: [Anthropic front end interview guide](https://www.greatfrontend.com/interviews/company/anthropic/questions-guides)
- techinterview.org: [Are you allowed to use AI in coding interviews? The 2026 rules](https://www.techinterview.org/post/3233475415/ai-coding-interviews-rules-2026/) and [What applied-AI engineer interviews test in 2026](https://www.techinterview.org/post/3233476824/ai-engineer-interview-rag-agents-evals/)
