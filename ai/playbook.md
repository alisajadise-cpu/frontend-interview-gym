# The AI-assisted interview playbook

Many companies now let you, or ask you to, use an AI assistant in coding interviews. Others still ban it completely. This page covers what is known about each format, how you're graded, and a method you can practice with the exercises in this folder.

> ⚠️ **Formats change fast.** Most details below come from public reports and secondary sources (marked). Before every loop, **ask your recruiter**: "Is AI allowed in this round? Which tool? Is it graded?" Using AI in a round where it isn't allowed is treated as cheating.

---

## 1. What companies are doing (as reported, late 2025 – 2026)

| Company | Format | What's graded | Source |
|---|---|---|---|
| **Meta** | "AI-enabled" coding round, **60 min**, in **CoderPad with a built-in AI chat**. It replaces one of the two onsite coding rounds. You work on a **small multi-file project** in phases instead of two LeetCode problems. Models reported as available: GPT-4o mini, GPT-5, Claude Sonnet 4/4.5, Claude Haiku 3.5/4.5, Gemini 2.5 Pro, Llama 4 Maverick. Pilot started around Oct 2025, expected to expand in 2026. | Judgment, critical review of AI output, communication, ownership of the final code. Officially AI use is optional. | [interviewing.io guide](https://interviewing.io/blog/how-to-use-ai-in-meta-s-ai-assisted-coding-interview-with-real-prompts-and-examples) *(secondary)*, [CO/AI news](https://getcoai.com/news/meta-now-allows-ai-assistants-in-coding-interviews-to-match-real-work-environments/) *(secondary)* |
| **Google** | Pilot of a **"human-led, AI-assisted"** format with **Gemini**, for early- and mid-career SWE roles on select US teams, reported to start in **H2 2026**. Includes a **code comprehension** round: read an existing codebase, find bugs, improve performance, refine it with Gemini. | **"AI fluency"**: writing prompts, *checking* AI output, debugging. Over-relying on AI without showing your own understanding is reported to hurt. | [Entrepreneur](https://www.entrepreneur.com/business-news/google-is-testing-a-new-rule-transform-job-interviews) *(secondary, cites Business Insider)*, [Exponent guide via U. Miami](https://customcareer.miami.edu/blog/2026/05/14/googles-ai-assisted-coding-interview-2026-guide/) *(secondary)* |
| **Canva** | **"AI-Assisted Coding"** replaced the CS-fundamentals screen for backend **and frontend** roles (announced June 2025). Use your own tools (Copilot, Cursor, Claude). Problems are realistic and ambiguous, e.g. *"Build a control system for managing aircraft takeoffs and landings at a busy airport."* | Breaking down ambiguous requirements, knowing **when** to use AI, sound technical decisions, **finding and fixing problems in AI-generated code**, production quality. Candidates with little AI experience struggled, because of judgment, not coding. | [Canva engineering blog](https://canva.dev/blog/engineering/yes-you-can-use-ai-in-our-interviews) *(primary)*, [The Register](https://www.theregister.com/2025/06/11/canva_coding_assistant_job_interviews/) |
| **Rippling** | AI **allowed in every coding round**, but you're graded on a **different rubric** depending on how much you use it. The onsite includes a 90-min "build and discuss" round (about 1 h building, then defending decisions), with prompts like a task manager with filtering/sorting or an expense rules engine. | Can you sketch the approach before prompting? Do you read and understand the generated code? Do you verify with tests? Can you explain every line? **Top rejection reason: over-reliance on AI**, even with a correct first idea. | [Nyrion company page](https://nyrion.ai/companies/rippling) *(secondary, cites interviewing.io)* |
| **OpenAI** (frontend) | Practical rounds. One reported coding task: *build a ChatGPT-style interface around a supplied streaming function, then handle a new request mid-stream.* System design: an internal "Playground" or a ChatGPT-like UI. | Streaming, cancellation, state, product sense for AI UX (partial responses, retries, uncertainty, token usage). | [Educative guide](https://www.educative.io/blog/openai-frontend-engineer-interview) *(secondary)*. Practice: `ai/02-streaming-chat`. |
| **Anthropic** (frontend) | Product-engineering rounds built around Claude-style flows (streaming chat, file uploads). Reported advice: **don't** use AI tools in take-homes or live interviews unless explicitly allowed. | Practical UI engineering, system design, project deep dive, values/safety conversation. | [GreatFrontEnd company guide](https://www.greatfrontend.com/interviews/company/anthropic/questions-guides) *(secondary)* |
| **Many big companies' standard live rounds** | Reported in mid-2026: Google, Meta and Amazon **standard** live algorithm rounds still run with AI turned off (CoderPad/HackerRank/CodeSignal have AI-off modes). Take-homes at some companies (reported: Stripe, Shopify, Vercel, many startups) allow AI, but you must explain your choices. | Classic fundamentals. Using AI where it's not allowed = integrity violation. | [techinterview.org overview](https://www.techinterview.org/post/3233475415/ai-coding-interviews-rules-2026/) *(secondary, cites no primary sources)* |

**The pattern is the same everywhere.** No company grades "how good is your prompt". They grade **judgment**: you stay the engineer, the AI is a fast junior who is confident and sometimes wrong.

---

## 2. The method: C-P-D-R-V-E

Practice this order until it's automatic.

1. **Clarify (no AI).** Ask about requirements, scale, edge cases, and what "done" means. Write them as a short checklist in a comment at the top of the file.
2. **Plan (no AI).** Sketch the design in 3–6 bullets: data model, main functions or components, where the tricky part is. *Say it out loud.* Rippling and Meta reportedly look for this before your first prompt.
3. **Delegate small, well-defined pieces.** Good jobs for AI: boilerplate, types, test scaffolding, a regex, a CSS layout, a shell or Docker snippet, an API you forgot the syntax of. Keep the **core logic** (the part with concurrency, state, or the algorithm) in your own hands, or at least specify it very precisely.
4. **Read every line.** Before you run it, read it. Say what you'd change. Typical AI bugs: swallowed errors, stale closures, missing cleanup/abort, index keys, wrong edge cases, made-up APIs, and over-engineering. The review exercise `ai/03-review-ai-code` has all of them.
5. **Verify.** Run it. Write or generate tests for the edge cases *you* listed in step 1, not the ones the AI thought of. A failing test first, then the fix.
6. **Explain.** At the end, walk through the code as its owner: decisions, trade-offs, what you rejected from the AI and why, and what you'd do with more time.

### Time plan for a 60-minute AI-assisted round

| Minutes | What |
|---|---|
| 0–8 | Clarify and plan. **No prompts yet.** Read the existing code if it's a multi-file project. |
| 8–40 | Build in small loops: prompt for one piece → read → run → fix. Narrate. |
| 40–50 | Verify: edge-case tests, error paths, cleanup. Run everything. |
| 50–60 | Explain and discuss: trade-offs, performance, what's next. Leave this time. Candidates who code until the last minute lose the "ownership" points. |

---

## 3. Prompts: good vs bad

| ❌ Bad | ✅ Good | Why |
|---|---|---|
| "Build the whole chat app." | "Write a TypeScript type for a chat message with `id`, `role` (`user`/`assistant`), `content`, and `status` (`streaming`/`done`/`stopped`/`error`)." | Small, checkable, and you keep the design. |
| "Fix this." *(pastes 200 lines)* | "This test fails: `expected 'Hello world', got 'Hello'`. Chunks can end mid-line. In `parseLines` below, where is the partial line lost?" | Gives the failing evidence and a narrow question. |
| "Make it production ready." | "List the failure modes of this hook: abort, unmount, errors, concurrent sends. Don't change code yet." | Uses AI as a reviewer and checklist, not an author. |
| "Write tests." | "Write Vitest tests for these 4 cases: (1) chunk splits a JSON line, (2) stream throws, (3) new message mid-stream aborts the old one, (4) unmount aborts." | *Your* edge cases. AI-picked cases test what the AI already got right. |
| Accepting a 150-line answer without reading | "Explain lines 30–45. Why `useLayoutEffect` here?" — then decide | Shows you're reading critically. It's often where you find the bug. |

**Say your rejections out loud:** "It suggested `catch {}` around the parse. I'm rejecting that, because a bad line from a proxy must show an error." Interviewers write that down.

---

## 4. Scoring rubric (use it to grade yourself)

| Area | Weak | Strong |
|---|---|---|
| **Problem framing** | Starts prompting at minute 1 | Clarifies, writes a checklist, plans before any prompt |
| **Delegation** | Asks AI for the whole solution | Delegates boilerplate and lookups. Owns the core logic and the decisions |
| **Critical review** | Accepts output that "looks right" | Reads every line, finds at least one real bug or weak spot, explains the rejection |
| **Verification** | "It runs in the demo" | Tests edge cases they chose: errors, races, cleanup, empty input |
| **Code quality** | Mixed styles, dead code, unused AI extras | Coherent, minimal, typed, idiomatic. Removes what isn't needed |
| **Communication** | Silent typing, or reading AI output aloud | Narrates intent, trade-offs, and *why* |
| **Fundamentals** | Can't explain generated code | Can rewrite the key part without AI if asked |
| **Speed** | Stuck fighting the tool | Uses AI to go faster on the boring parts and finishes with time to discuss |

---

## 5. Practice drills with this repo

Run each drill in **AI-assisted mode**: turn inline suggestions back on (`.vscode/settings.json`), use Cursor, Claude Code or Copilot Chat, set a timer, and **talk out loud** (record yourself if you can). Keep a small log next to you:

```
Prompt # | What I asked | Accepted? | What I changed / rejected and why
```

| Drill | Exercise | Time | Rules |
|---|---|---|---|
| 1. Comprehension round (Google-style) | `ai/03-review-ai-code` | 45 min | First 15 min **without AI**: list bugs. Then fix with AI. Score: bugs found before AI / total. |
| 2. Build round (OpenAI-style) | `ai/02-streaming-chat` | 60 min | Plan for 8 minutes first. Let AI write the JSX and styles only. You write the abort and batching logic. |
| 3. Protocol + bytes | `ai/01-sse-parser` | 40 min | Ask AI for test cases only *after* you list your own. Compare lists: what did each of you miss? |
| 4. Multi-file project (Meta-style) | `ai/04-context-window` + `ai/05-agent-loop` | 60 min | Treat both as one project: build `fitToContext`, then use it inside `runAgent` before each model call. Explain the design at the end. |
| 5. Rippling-style "defend it" | any `react/` exercise | 60 + 30 min | Build with AI for 60 min. Then explain every line for 30 min to a friend, or to an AI playing a skeptical interviewer. If you can't explain a line, delete it. |
| 6. No-AI baseline | any `js/` exercise | as listed | Solve it once **without** AI. Many rounds still ban it, and every AI round assumes you could. |

**Ask Claude to be your interviewer:** paste an exercise README and say *"Play a Meta AI-enabled coding interviewer. Give me the task in phases, answer clarifying questions, and at the end grade me with this rubric."* Then paste your log and final code.

---

## 6. Questions you will be asked about AI in your work

Prepare a 2-minute story for each. Use real numbers.

1. "How do you use AI tools day to day? Where do you **not** use them?"
2. "Tell me about a time AI-generated code caused a bug. How did you catch it? What did you change in your process?"
3. "How do you review AI-written pull requests at scale? What do you check first?"
4. "How did you introduce AI tooling or agents to your team? How did you measure whether it helped?" If you've built agent pipelines (ticket → PR → review → UI test), this is your strongest story. Cover the guardrails, the human approval points, the failure rate, and what you measured.
5. "How do you keep your fundamentals sharp when AI writes a lot of your code?"
6. "Which tasks would you never delegate to an agent, and why?" (Security-sensitive code, migrations without review, anything without tests.)
