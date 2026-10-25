# AI-era behavioral and discussion questions

Interviewers now ask how you **work with** AI, not only whether you can code without it. Companies like Canva, Rippling, Meta, and Google say they grade candidates on "AI fluency": planning before prompting, judging AI output, and owning the result. These questions check the same things in conversation.

**General rules for every answer**
- Be concrete: a real project, real numbers, a real failure.
- Show **judgment**: when you used AI, when you didn't, and why.
- Show **ownership**: "the AI wrote it" is never an excuse. You merged it, so it's yours.
- Avoid both extremes: "AI does everything for me" (a red flag: low skill) and "I never use AI" (a red flag: out of date).

STAR = **S**ituation, **T**ask, **A**ction, **R**esult. Add **L**earning at the end for AI questions. That shows growth.

---

## 1. "How do you use AI in your daily work?"

**What they're checking:** Do you have a deliberate workflow, or do you paste everything into a chatbot? Do you know where AI is strong and where it's weak?

**Structure:** sort your work into categories, give one example of each, and end with your verification habits.

**Strong example answer:**
> "I use it differently depending on the task. For **boilerplate and migrations**, like converting 40 class components to hooks, I let an agent do the bulk work. Then I review the diff file by file and run the tests and visual checks. For **exploring unfamiliar code**, I ask it to explain a module and point me to the call sites, and then I verify by reading those files. For **design decisions**, like state management for a new feature, I use it as a sparring partner: I ask for trade-offs and counter-arguments, but I make the decision. I *don't* use it to write security-sensitive code without a careful review, or for things I can't verify, like performance claims, which I measure myself. My rule: anything it produces must pass the same review and tests as a teammate's code."

**Red flags:** no verification step. Can't name a case where AI was wrong. Only uses it for autocomplete.

---

## 2. "Tell me about a time AI-generated code caused a bug."

**What they're checking:** honesty, debugging skill, and whether you changed your process afterwards.

**Structure (STAR + L):** the bug → how it got past review → how you found it → the fix → the **process change**.

**Strong example answer:**
> "**S:** We used an assistant to write a date-range filter for a reports page. **T:** It looked right and the tests passed. **A:** In production, users in UTC+3:30 saw items from the previous day. The generated code built dates with local midnight but compared them with UTC timestamps from the API, and the tests it wrote ran in UTC so they didn't catch it. I reproduced it by running the tests with `TZ=Asia/Tehran`, fixed the code to normalize everything to UTC at the API boundary, and added timezone-parametrized tests. **R:** The fix shipped the same day. **L:** We now run CI tests in two timezones. And when AI writes both the code *and* its tests, I write at least the edge-case tests myself, because the same wrong assumption ends up in both."

**Red flags:** blaming the tool, no process change, a vague story.

---

## 3. "How do you review AI-written code? Is it different from human code?"

**What they're checking:** the depth of your code review, and knowledge of typical AI failure patterns.

**Strong answer points:**
- Same quality bar. **More** suspicion in specific areas:
  - APIs that don't exist, or wrong library versions.
  - Tests that pass whatever happens (heavy mocking, asserting the implementation instead of the behavior).
  - Silent scope creep: unrelated refactors, deleted code.
  - Error handling that swallows errors.
  - New dependencies: check that they exist, are maintained, and aren't typosquatted.
- Order: read the ticket or spec → read the tests → then the code. Run it locally for UI changes.
- Ask for **small PRs**. Large agent PRs get split.
- Automation catches the cheap things (types, lint, tests, security scanning), so humans focus on design and correctness.

---

## 4. "How did you bring AI tools to your team, and how did you measure the impact?"

**What they're checking:** leadership, change management, and measuring instead of guessing.

**Structure:** the problem → a small pilot → guardrails → metrics → result → what you'd do differently.

**What to include:**
- **Baseline first:** measure cycle time, PR size, review time, and bug rate *before* the rollout.
- **Guardrails:** CI requirements, review rules (a human approves every PR), data-privacy rules (which repos and data can go to which tools).
- **Enablement:** share prompts, examples, and "where it fails" notes.
- **Metrics after:** the same ones, plus the review burden and the change failure rate.
- **Honesty:** what didn't improve, and where it got worse at first.

---

## 5. "Where should we NOT use AI?"

**What they're checking:** judgment and risk awareness.

**Strong answer points:**
- Where you **can't verify** the output quickly (complex concurrency, cryptography, legal or financial logic) without strong tests and expert review.
- **Security-critical code paths** (auth, permissions) without very careful review.
- When it would leak **sensitive data** (customer data, secrets) to tools that aren't approved for it.
- Final decisions affecting people (hiring, performance reviews) without human judgment.
- When learning is the goal: juniors learning fundamentals, or onboarding into a critical system you must understand deeply.
- When a deterministic solution exists: don't call a model for something a regex or a SQL query does reliably.

---

## 6. "How do you keep your skills sharp if AI writes a lot of your code?"

**What they're checking:** whether your fundamentals are still strong, which matters because many interviews (Google, Amazon, Meta's standard rounds) still ban AI.

**Strong answer:**
> "I deliberately practice without AI: interview-style problems, and reading code from libraries I use, like how React Query dedupes requests. When AI gives me a solution I don't fully understand, I don't merge it until I can explain it. I also do the hard parts myself, like data modelling and performance investigation, and use AI for the mechanical parts. And I measure: if I can't debug something without the assistant, that's a gap to fix."

---

## 7. "Walk me through an agentic workflow you built."

This is the big one if you've built agent pipelines. See the next section for a full guide.

---

# Presenting your own agentic pipeline (ticket → PR)

If you built a pipeline where agents take tickets from a task manager, implement them, review each other's work, and run manual UI tests before opening PRs, this is a **strong** story for AI-era interviews. Most candidates have only used autocomplete. Tell it well.

## The 2-minute version (structure)

1. **Problem (15 s):** What was slow or painful? For example: "Small, well-defined tickets waited days for a developer, and context switching was expensive."
2. **What you built (45 s):**
   - Input: tickets from any task manager, through an adapter layer.
   - Steps: plan → implement in an isolated branch or sandbox → automated review by a second agent → run the app and test the UI like a person (browser automation, screenshots) → open a PR with a summary, screenshots, and test results.
   - Works across repos.
   - Human gates: which steps need a human and why.
3. **Guardrails (20 s):** sandboxing, scoped tokens, protected branches, budgets per run, loop detection, required CI.
4. **Results (25 s):** numbers (see below).
5. **Learning (15 s):** what failed and what you changed.

## What to quantify

Collect these before the interview. Even approximate numbers are much better than none, but say how you measured them.

| Metric | Why it matters | Example of how to say it |
|---|---|---|
| **Cycle time** (ticket ready → PR open → merged) | Speed | "Median ticket-to-PR went from about 2 days to about 40 minutes for small tickets." |
| **PR acceptance / merge rate** | Quality of output | "About X% of agent PRs merged with only minor changes, Y% needed major rework, Z% were closed." |
| **Review burden** | Hidden cost | "Review time per agent PR was about N minutes. We reduced it by adding screenshots and a summary of what was tested." |
| **Bug / revert rate** of agent changes | Safety | "Change failure rate was similar to human PRs for the ticket types we allowed." |
| **Coverage of ticket types** | Scope | "We started with copy changes and small UI fixes, then added bug fixes with a clear repro." |
| **Cost per ticket** | Business sense | "Model and compute cost per ticket was about $X, compared with engineer time." |
| **Human intervention rate** | Autonomy | "N% of runs needed a human answer mid-run." |

If you don't have exact numbers, say "roughly" and explain how you'd measure them properly. **Never invent precise numbers.** Interviewers will dig in.

## Failure modes to talk about (this shows seniority)

- **Wrong understanding of vague tickets** → added a planning step where the agent restates the task and acceptance criteria, and asks a question when something is ambiguous.
- **Passing tests but wrong behavior** → the UI-testing agent checks the acceptance criteria in a real browser, with screenshots in the PR.
- **Reviewer agent agreeing too easily** (the same model family has the same blind spots) → a different model or prompt for review, a checklist-based review, and humans still approve merges.
- **Loops and runaway cost** → max iterations, budgets per run, detecting repeated identical tool calls.
- **Big, noisy diffs** → instructions and checks that limit the scope, plus lint/format to keep diffs minimal.
- **Flaky environments** (the dev server won't start, seed data missing) → standard sandbox images and health checks before the agent starts.
- **Security** → scoped repo tokens, no production secrets in the sandbox, network allowlist, treating ticket text as untrusted (prompt injection).

## Likely follow-up questions (with good answers)

**"How do you decide which tickets go to the agent?"**
> "Rules plus labels: small scope, clear acceptance criteria, no schema migrations, no auth changes. The planning step can also reject a ticket as 'not suitable', and that rejection is a useful signal for writing better tickets."

**"How do you know the reviewer agent adds value?"**
> "We measured how often its comments led to changes, and compared PRs with and without the review step on bug rate and human review time. We kept it because it caught [concrete category, like missing loading states or a11y issues]. Humans still approve every merge."

**"What happens when the agent is wrong but confident?"**
> "That's why the final gate is evidence, not the agent's claim: CI results, screenshots of the UI states, and a human reviewer. The PR template forces the agent to list what it tested and what it didn't."

**"How did engineers react?"**
> "At first, some were skeptical about review load. We made agent PRs smaller and easier to review (summary, screenshots, test evidence) and let teams choose which ticket types to enable. Adoption grew when people saw it handled the boring tickets."

**"What would you build next?"**
> "Better evals: a set of past tickets with known good solutions, to compare agent versions before rolling out a new model or prompt. Plus routing by ticket type to cheaper or stronger models."

**"How do you handle different repos and conventions?"**
> "A per-repo config: how to install, run, and test the app, plus coding conventions and examples of good PRs. The agent reads it as context. Repos without good test setups got lower autonomy."

## Red flags to avoid when telling this story

- Claiming it's fully autonomous with no human gates (sounds unsafe).
- Only talking about the tech, with no metrics or impact.
- No failures mentioned (sounds untrue).
- Not knowing the cost.
- Being unable to explain how a step works under the hood (tool calling, sandboxing, how the UI test agent controls the browser).

---

## Quick practice

Say each answer out loud in under 2 minutes, recorded:
1. How do you use AI in your daily work?
2. A time AI-generated code caused a bug.
3. Walk me through your ticket → PR agent pipeline.
4. Where should we not use AI?
5. How do you review AI-written code?

Then listen back. Did you give numbers? Did you show judgment? Did you own the result?
