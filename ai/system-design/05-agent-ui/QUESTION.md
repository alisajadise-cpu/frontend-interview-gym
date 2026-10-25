# 05 · Design the UI for an AI agent that takes actions

**Time:** 45–60 min · **Similar products:** coding agents that go from a ticket to a PR (Devin, GitHub Copilot coding agent, Cursor background agents, Claude Code on the web), browser agents, and workflow automation agents

## The prompt

> "We're building an agent. A user gives it a task, for example a Jira ticket, and the agent plans, edits code in a repo, runs tests, opens a PR, and can even click through the app to test the UI. A run can take 2 to 40 minutes. Design the web UI. Users need to trust it, steer it, and stop it."

## Clarifying questions (with assumed answers)

| Question | Assume |
|---|---|
| Where does the agent run? | On our servers, in sandboxed containers. The browser only displays and controls it. |
| How many runs at once per user? | Up to 10. A team dashboard shows all runs. |
| Which actions are risky? | Pushing to protected branches, deploying, running migrations, spending money, sending messages to people, deleting files outside the repo. |
| Must the user watch? | No. Runs continue in the background, and the user gets notified when it needs input or is done. |
| Can users chat with the agent mid-run? | Yes: add instructions, correct it, answer its questions. |
| Audit requirements? | Yes. Enterprise customers need a full log of what the agent did and who approved it. |

## What the interviewer is looking for

- A **data model for a run**: plan, steps, tool calls, artifacts, approvals, messages.
- **Real-time updates** for long-running jobs: the transport, reconnect, catching up after being offline.
- **Human-in-the-loop**: approval requests, timeouts, what happens while waiting.
- **Control**: pause, stop, resume, steer, undo / rollback.
- **Trust and transparency**: showing what the agent did and why, diffs, screenshots, logs, without flooding the user.
- **Permissions and safety**: least privilege, scopes, prompt injection from tool results (web pages, ticket text).
- Notifications, multi-run dashboard, performance of huge logs.

## Time split

| Min | Part |
|---|---|
| 0–5 | Requirements |
| 5–15 | Architecture + run lifecycle state machine |
| 15–25 | Data model + event stream |
| 25–40 | UI: run view, approvals, steering, notifications |
| 40–50 | Safety, permissions, audit, performance |
| 50–60 | Trade-offs, follow-ups |
