# Study plans

Pick one. Each block lists the repo exercise first. If you finish early, do the outside practice question on the same topic.

**Rules for every session**
- Timebox each exercise. When time is up, stop and read the solution. Learning *why* matters more than finishing.
- Talk out loud while you code, as you would in an interview. Say your plan, the edge cases, and the trade-offs.
- After each exercise, answer its **Follow-ups** section without notes.

---

## Plan A: 2 days × 5 hours (interview is close)

### Day 1: JavaScript core + React fundamentals

| Time | Do | Topic |
|---|---|---|
| 0:00–0:40 | `js/01-debounce` | timers, closures, `this`, edge-case thinking |
| 0:40–1:10 | `js/02-throttle` | same family, different semantics |
| 1:10–1:50 | `js/03-promise-pool` | concurrency limit (very common at senior level) |
| 1:50–2:00 | break | |
| 2:00–2:40 | `js/05-my-promise` | microtasks, thenables, chaining |
| 2:40–3:10 | `js/quiz/event-loop.md` | predict the output, then check |
| 3:10–3:40 | `js/07-deep-equal` or `js/06-deep-clone` | recursion, cycles, Map/Set |
| 3:40–5:00 | `react/01-autocomplete` | debounce + race conditions + ARIA combobox |

### Day 2: React depth + performance + system design

| Time | Do | Topic |
|---|---|---|
| 0:00–0:45 | `react/04-modal-dialog` | portals, focus trap, a11y |
| 0:45–1:30 | `react/07-use-query` | dedupe, stale-while-revalidate, `useSyncExternalStore` |
| 1:30–2:15 | `performance/01-chat-room` | the review from our conversation, now with tests |
| 2:15–2:30 | break | |
| 2:30–3:00 | `performance/review/code-review-snippets.md` | spot issues fast, out loud |
| 3:00–4:00 | `system-design/01-autocomplete` or `02-news-feed` | full RADIO answer on paper, 45 min, then compare |
| 4:00–5:00 | `react/concepts.md` | answer each question out loud before opening the answer |

**Morning of the interview (30 min):** re-solve `js/01-debounce` and `js/03-promise-pool` from memory. Skim `react/concepts.md` questions 1–10. Prepare a 2-minute story about the most impactful system you built: the problem, your decisions, the trade-offs, the measurable result.

---

## Plan B: 1 week × 2–3 hours

| Day | JavaScript | React | Performance / design |
|---|---|---|---|
| 1 | `js/01-debounce`, `js/02-throttle` | `react/01-autocomplete` | `js/quiz/event-loop.md` |
| 2 | `js/03-promise-pool`, `js/04-retry-with-backoff` | `react/02-nested-checkboxes` | `performance/01-chat-room` |
| 3 | `js/05-my-promise`, `js/09-event-emitter` | `react/04-modal-dialog` | `performance/02-product-grid` |
| 4 | `js/06-deep-clone`, `js/07-deep-equal` | `react/03-data-table` | `system-design/02-news-feed` |
| 5 | `js/08-lru-cache-ttl`, `js/10-dataloader` | `react/07-use-query`, `react/08-store-selector` | `performance/03-context-rerenders`, `04-orders-table` |
| 6 | `js/11-query-client`, `js/12-task-queue` | `react/09-virtual-list`, `react/10-optimistic-todos` | `performance/05`–`07`, `system-design/03-chat-app` |
| 7 | `js/13`–`15` (pick two) | `react/05`, `06`, `11` (pick two) | Mock interview (below) + `system-design/04-ecommerce-plp-pdp` |

### Mock interview (60 min, do it at least once)

1. 5 min: introduce yourself and your strongest project.
2. 25 min: a random `react/` exercise you haven't done. Explain while you code.
3. 15 min: a random `performance/review/` snippet. Find issues out loud and rank them.
4. 15 min: a system design question, requirements and architecture only.

Record yourself, or ask Claude to play the interviewer and grade you against the `SOLUTION.md` / `ANSWERS.md` files.

---

## Add-on: AI-era rounds (2–3 sessions)

Do this if any company on your list runs an AI-assisted round, or builds AI products. Read [ai/README.md](ai/README.md) first to see which format to expect.

| Session | Do |
|---|---|
| 1 | Read [ai/playbook.md](ai/playbook.md). Solve `ai/01-sse-parser` without AI, then `ai/02-streaming-chat` **with** your AI assistant, following the playbook out loud |
| 2 | `ai/03-review-ai-code` (code-comprehension round), then `ai/05-agent-loop` |
| 3 | `ai/system-design/01-chatgpt-ui` on paper (45 min), then [ai/concepts.md](ai/concepts.md) and [ai/behavioral.md](ai/behavioral.md). Prepare your own agent-pipeline story |

---

## Matching practice on other platforms

| Repo exercise | GreatFrontEnd | LeetCode (JS track) | Other |
|---|---|---|---|
| js/01 debounce | [Debounce](https://www.greatfrontend.com/questions/javascript/debounce), [Debounce II](https://www.greatfrontend.com/questions/javascript/debounce-ii) | [2627 Debounce](https://leetcode.com/problems/debounce/) | BFE.dev: debounce with leading & trailing |
| js/02 throttle | [Throttle](https://www.greatfrontend.com/questions/javascript/throttle) | [2676 Throttle](https://leetcode.com/problems/throttle/) | BFE.dev: throttle with leading & trailing |
| js/03 promise pool | [Map Async Limit](https://www.greatfrontend.com/questions/javascript/map-async-limit) | [2636 Promise Pool](https://leetcode.com/problems/promise-pool/) | |
| js/05 promise | [Promise.all](https://www.greatfrontend.com/questions/javascript/promise-all), [Promise.any](https://www.greatfrontend.com/questions/javascript/promise-any) | [2637 Promise Time Limit](https://leetcode.com/problems/promise-time-limit/) | BFE.dev: create your own Promise |
| js/06 deep clone | [Deep Clone](https://www.greatfrontend.com/questions/javascript/deep-clone), [Deep Clone II](https://www.greatfrontend.com/questions/javascript/deep-clone-ii) | | |
| js/07 deep equal | [Deep Equal](https://www.greatfrontend.com/questions/javascript/deep-equal) | [2628 JSON Deep Equal](https://leetcode.com/problems/json-deep-equal/) | |
| js/08 LRU + TTL | | [146 LRU Cache](https://leetcode.com/problems/lru-cache/), [2622 Cache With Time Limit](https://leetcode.com/problems/cache-with-time-limit/) | |
| js/09 event emitter | [Event Emitter](https://www.greatfrontend.com/questions/javascript/event-emitter) | [2694 Event Emitter](https://leetcode.com/problems/event-emitter/) | |
| js/10–15 | Memoize, Curry, Flatten, Promisify (warm-ups on the [JS functions list](https://www.greatfrontend.com/questions/formats/javascript-functions)) | [2623 Memoize](https://leetcode.com/problems/memoize/) | |
| react/02 nested checkboxes | [Nested Checkboxes](https://www.greatfrontend.com/questions/user-interface/nested-checkboxes/react) 💎 | | |
| react/03 data table | [Data Table](https://www.greatfrontend.com/questions/user-interface/data-table/react) | | |
| react/04 modal | [Modal Dialog](https://www.greatfrontend.com/questions/user-interface/modal-dialog/react) 💎 | | WAI-ARIA APG dialog pattern |
| react/06 progress bars | [Progress Bars](https://www.greatfrontend.com/questions/user-interface/progress-bars/react), [Progress Bars III](https://www.greatfrontend.com/questions/user-interface/progress-bars-iii/react) 💎 | | |
| react/11 OTP input | [Auth Code Input](https://www.greatfrontend.com/questions/user-interface/auth-code-input/react) 💎 | | |
| warm-ups | [Accordion](https://www.greatfrontend.com/questions/user-interface/accordion/react), [Tabs](https://www.greatfrontend.com/questions/user-interface/tabs/react), [Transfer List](https://www.greatfrontend.com/questions/user-interface/transfer-list/react) | | |
| system design | [Front End System Design Playbook](https://www.greatfrontend.com/front-end-system-design-playbook) | | [frontendinterviewhandbook.com](https://www.frontendinterviewhandbook.com) |
| React concepts | [React Interview Playbook](https://www.greatfrontend.com/react-interview-playbook) | | react.dev: "You Might Not Need an Effect" |

💎 = GreatFrontEnd premium question.
