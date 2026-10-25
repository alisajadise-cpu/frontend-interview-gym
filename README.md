# Frontend Interview Gym

Hard, realistic practice for **senior frontend interviews**: JavaScript internals, React components and hooks, performance debugging, frontend system design, and the new **AI-era rounds** (AI-assisted coding, streaming chat UIs, agents, LLM system design). Every coding exercise has a spec, tests, and a reference solution.

These are not puzzles. They're the things real companies build: lodash `debounce`, React Query's cache, Facebook's DataLoader, TanStack Virtual's math, an accessible combobox, a focus-trapped modal, and a chat room that gets slower the longer you use it.

## Setup

Requires **Node 18.18+** (Node 20 or 22 recommended).

```bash
npm install
npm run dev        # exercise browser for the React + performance exercises
npm test js/01     # start practicing
```

Open the folder in VS Code and install the recommended extensions (Vitest Explorer) when VS Code asks.

## How to practice one exercise

1. Open the exercise's `README.md`. Set a timer for the time it lists.
2. Write your code in `index.ts` / `index.tsx`. **Don't open `solution.*` yet.**
3. Run the tests in watch mode while you work:
   ```bash
   npm test react/04-modal-dialog
   ```
4. When the tests pass, or the time is up, compare with the solution:
   ```bash
   npm run test:solution react/04-modal-dialog   # same tests, against solution.tsx
   ```
5. Answer the **Follow-ups** section out loud, as if an interviewer were asking. That part is what separates senior answers.

To start an exercise over: `git checkout -- react/04-modal-dialog/index.tsx`. Run `git init && git add -A && git commit -m start` once if you downloaded this as a zip.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Vitest in watch mode on **your** code. Add a path filter: `npm test js/03` |
| `npm run test:run` | Run all your tests once |
| `npm run test:solution` | Run the same tests against the reference solutions. Add a filter: `npm run test:solution js/03` |
| `npm run dev` | Exercise browser: each React/performance/AI exercise with fake data and a **My code / Solution** toggle |
| `npm run typecheck` | TypeScript check of the whole repo |

Your stubs fail their tests at first. That's expected: `npm run test:run` will be mostly red until you solve things.

## What's inside

| Folder | What | Format |
|---|---|---|
| [`js/`](js/README.md) | 15 hard JavaScript implementations, plus quizzes on the event loop, `this`, and coercion | `index.ts` + tests + `solution.ts` |
| [`react/`](react/README.md) | 11 production-grade components and hooks, plus 25 senior React concept questions | `index.tsx` + tests + `solution.tsx` + `demo.tsx` |
| [`performance/`](performance/README.md) | 7 "this app is slow" bug reports with buggy production code to fix, plus read-only code reviews | buggy `index.tsx` + tests + `solution.tsx` + `ANSWERS.md` |
| [`system-design/`](system-design/README.md) | 9 frontend system design questions with full RADIO-format answers | `QUESTION.md` + `SOLUTION.md` |
| [`ai/`](ai/README.md) | How Meta, Google, Canva, Rippling, OpenAI and Anthropic interview in the AI era; a playbook for AI-assisted rounds; 5 hands-on AI exercises; 5 AI system design questions; AI concepts and behavioral Q&A | mixed |
| [`PLAN.md`](PLAN.md) | Study plans (2 days / 1 week) and matching GreatFrontEnd / LeetCode / BFE.dev practice links | |

## Interview mode

Real interviews don't have autocomplete. This workspace turns off inline AI suggestions in `.vscode/settings.json` (`editor.inlineSuggest.enabled: false`). Delete that line if you want them back.

## Tests and the solution toggle

The tests import from `./index`. When you run `npm run test:solution`, a small Vite plugin (`vite.config.ts`) redirects those imports to `./solution`. Nothing else changes. Tests use Vitest, jsdom, and React Testing Library. Some performance tests count renders and mounts with the tiny helpers in `shared/probe.ts`.
