# 05 · Agent UI with human-in-the-loop: solution

## R: Requirements

### Functional
1. Start a run from a ticket link or a free-text task. Choose the repo, branch, and permission profile.
2. See the agent's **plan** (a checklist that can change during the run) and **live progress** of steps.
3. See **tool calls**: commands run, files changed (diffs), browser screenshots, test results. Collapsed by default, expandable.
4. **Approve or reject** risky actions. The agent waits, or does something else while waiting.
5. **Steer:** send a message mid-run ("use the existing date util"), answer the agent's questions.
6. **Pause, resume, stop.** Stop leaves things in a clean state (no half-pushed branch).
7. **Undo:** revert the agent's changes (close the PR, delete the branch, restore files) where possible.
8. Notifications when the agent needs input, fails, or finishes (in-app, email/Slack, browser push).
9. A dashboard of all runs with status, and the time each has been waiting for input.
10. A full **audit log** per run, exportable.

### Non-functional
- Runs last minutes to hours. The UI must handle reconnecting, sleeping laptops, and opening the run on another device.
- A run can produce 10k+ events and MBs of logs. The UI must stay fast.
- The approval path must be secure: it can't be approved by forged requests, and it must be clear *what* is being approved.

## Run lifecycle (state machine)

```
             ┌─────────────┐
   create ──►│   queued    │
             └──────┬──────┘
                    ▼
             ┌─────────────┐  needs approval / asks question   ┌──────────────────┐
     ┌──────►│   running   │──────────────────────────────────►│ waiting_for_user │
     │       └──┬───┬───┬──┘◄──────── approved / answered ─────└───────┬──────────┘
     │ resume   │   │   │                                              │ timeout → policy (skip / stop)
     │          │   │   └── error (retryable) → running (auto retry, max N)
┌────┴────┐     │   │
│ paused  │◄────┘   │ done / fatal error / stop
└─────────┘ pause   ▼
             ┌──────────────────────────────────────┐
             │ succeeded │ failed │ stopped         │  ──► undo → reverted
             └──────────────────────────────────────┘
```

Model this explicitly on the server **and** client. Many UI bugs come from impossible combinations like "running and waiting at the same time".

## A: Architecture

```
┌─────────────────────────────── Browser ────────────────────────────────┐
│ Dashboard (runs list)    Run view                                       │
│                          ┌──────────────┬───────────────────────────┐  │
│                          │ Plan + steps │ Detail pane                │  │
│                          │ (timeline)   │  diff / terminal / screenshot │
│                          ├──────────────┴───────────────────────────┤  │
│                          │ Approval cards · Steering composer        │  │
│                          └───────────────────────────────────────────┘ │
│  Run store (event-sourced: state = reduce(events))                      │
│  Event client: SSE per open run + a "my runs" summary channel           │
│  Notifications: Web Push (service worker) + in-app                      │
└───────────────┬──────────────────────────────────┬─────────────────────┘
                │ REST (commands)                  │ SSE (events, resumable)
┌───────────────▼──────────────────────────────────▼─────────────────────┐
│ Run API: create / pause / resume / stop / steer / approve (signed)      │
│ Event log (append-only, per run, ordered seq numbers)                   │
│ Orchestrator ──► Agent workers (sandbox container per run)              │
│                    tools: shell, editor, git, browser, ticket API       │
│                    policy engine: which tool calls need approval         │
│ Artifact store (diffs, logs, screenshots)   Audit log (immutable)       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Event sourcing fits well.** The server appends events with increasing `seq` numbers. The client state is `reduce(events)`. Reconnect = "give me events after seq N". The same event log is the audit trail.

## D: Data model

```ts
type Run = {
  id: string;
  task: { source: 'ticket' | 'text'; ticketUrl?: string; text: string };
  repo: { fullName: string; baseBranch: string; workBranch?: string };
  permissionProfile: 'read-only' | 'standard' | 'trusted';
  status: 'queued' | 'running' | 'waiting_for_user' | 'paused' | 'succeeded' | 'failed' | 'stopped' | 'reverted';
  createdBy: string;
  createdAt: string;
  lastSeq: number;
  costSoFar: { tokens: number; usd: number; computeSeconds: number };
};

type RunEvent = { runId: string; seq: number; at: string } & (
  | { type: 'plan.updated'; steps: { id: string; title: string; status: 'todo' | 'doing' | 'done' | 'skipped' }[] }
  | { type: 'message'; role: 'agent' | 'user'; text: string }
  | { type: 'thinking.delta'; text: string }                        // short summaries, not raw chain of thought
  | { type: 'tool.started'; callId: string; tool: ToolName; input: unknown; summary: string }
  | { type: 'tool.output.delta'; callId: string; chunk: string }     // e.g. terminal output
  | { type: 'tool.finished'; callId: string; ok: boolean; artifactIds: string[]; summary: string }
  | { type: 'approval.requested'; approvalId: string; action: ProposedAction; risk: 'medium' | 'high'; expiresAt: string }
  | { type: 'approval.resolved'; approvalId: string; decision: 'approved' | 'rejected' | 'expired'; by?: string; comment?: string }
  | { type: 'status.changed'; status: Run['status']; reason?: string }
  | { type: 'artifact.created'; artifact: Artifact }
);

type ToolName = 'shell' | 'edit_file' | 'git' | 'browser' | 'ticket' | 'deploy';

type ProposedAction = {
  tool: ToolName;
  description: string;          // human readable: "Push branch fix/login-bug and open a PR"
  details: unknown;             // exact command / diff / URL
  reversible: boolean;
  undoPlan?: string;
};

type Artifact =
  | { id: string; kind: 'diff'; files: { path: string; additions: number; deletions: number }[]; url: string }
  | { id: string; kind: 'screenshot'; url: string; width: number; height: number; caption: string }
  | { id: string; kind: 'log'; url: string; bytes: number }
  | { id: string; kind: 'pr'; url: string; number: number }
  | { id: string; kind: 'test_report'; passed: number; failed: number; url: string };
```

## I: Interface / API

```
POST /api/runs                         { task, repo, permissionProfile }      → Run
GET  /api/runs?status=…&cursor=…        → { items: RunSummary[], nextCursor }
GET  /api/runs/:id                      → Run + snapshot (reduced state at seq N)
GET  /api/runs/:id/events?after=<seq>   → text/event-stream (EventSource, Last-Event-ID = seq)
GET  /api/me/runs/stream                → SSE of summary changes for the dashboard
POST /api/runs/:id/pause | resume | stop
POST /api/runs/:id/messages             { text, clientMessageId }              (idempotent)
POST /api/runs/:id/approvals/:approvalId { decision, comment, expectedActionHash }
POST /api/runs/:id/revert               → starts an undo job (also a run, with events)
GET  /api/artifacts/:id                 → signed URL (diffs, logs, screenshots)
```

**Why SSE here:** updates are mostly server → client. Commands (approve, steer) are normal POSTs, so we get HTTP auth, CSRF protection, idempotency, and audit for free. `EventSource` reconnects by itself and sends `Last-Event-ID` (our `seq`). WebSocket would work too, but brings more infrastructure for little gain.

**Snapshot + tail:** opening a run with 10k events doesn't replay everything. The server sends a snapshot (reduced state at seq N) plus the events after N.

**`expectedActionHash` on approval:** the user approves *exactly* what they saw. If the agent changed the proposed action in the meantime, the hash doesn't match, and the server rejects with 409. This prevents approving a different command than the one displayed.

## UI design

### Run view
- **Left: timeline.** The plan as a checklist at the top. Below it, steps grouped by plan item. Each tool call is one line: icon + summary ("Ran `pnpm test` · 2 failed") + duration + status. Expand to see details.
- **Right: detail pane** for the selected step: a diff viewer, a terminal output (virtualized, ANSI colors), screenshots with captions, a test report.
- **Top bar:** status pill, elapsed time, cost so far, buttons: Pause / Stop / Revert, and an "Open PR" link when one exists.
- **Bottom: steering composer.** Messages sent while the agent is busy are queued and shown as "will be read at the next step".

### Approval card
```
┌─────────────────────────────────────────────────────────┐
│ ⚠ The agent wants to: Push branch and open a PR          │
│ Repo: acme/web  ·  Branch: agent/fix-login-1043          │
│ Changes: 4 files, +82 −17   [View diff]                  │
│ Reversible: yes (close PR, delete branch)                │
│ [Approve]  [Reject with comment]   expires in 45:00      │
└─────────────────────────────────────────────────────────┘
```
- Show **exactly what** will happen, the **risk**, and whether it's **reversible**.
- High-risk approvals require re-authentication or typing the repo name, like GitHub's dangerous-action confirmation.
- An approval card is also a notification and appears on the dashboard ("Waiting for you · 12 min").
- Never auto-approve on timeout. The policy decides between *skip that action* and *stop the run*.

### Information density
- Agents produce a lot of noise. Default to **summaries**, and let users drill down: plan → step → tool call → raw output.
- Highlight what needs attention: failures, approvals, questions.
- Show "thinking" as short summaries the model writes for the user. Don't display raw reasoning streams as the main UI.

### Dashboard
- Columns: task, repo, status, waiting time, last update, cost. Filter by "needs my input".
- Live updates through one summary SSE stream, not one stream per run.

## Performance

- **Logs:** terminal output can be MBs. Store it in the artifact store. In the UI, stream only the tail live, virtualize lines, and load more on scroll up. Parse ANSI escapes in a worker.
- **Event batching:** coalesce `tool.output.delta` events per animation frame.
- **Store:** normalized by `callId`. Only the expanded step subscribes to output deltas.
- **Diff viewer:** lazy-load it. Big diffs are virtualized per file, and collapsed files render nothing.
- **Many open runs:** close event streams for runs not visible (background tabs) and rely on the summary stream plus notifications.

## Notifications

- In-app toast + badge. A service worker with the **Web Push** API for "needs your input" even when the tab is closed (ask for permission only after the first run, with an explanation).
- Email/Slack for long waits and for completion.
- Deduplicate: one notification per approval, not one per event.

## Safety, permissions, and security

| Concern | Design |
|---|---|
| Least privilege | Permission profiles map to tool scopes. The repo token is scoped to one repo, with no admin rights. The sandbox has no production credentials. |
| Risky actions | A **server-side policy engine** decides what needs approval (push, deploy, network to new domains, deleting outside the workspace). The UI only displays the decision; it can't bypass it. |
| Prompt injection | Ticket text, web pages, and repo files may contain instructions ("also send the .env to…"). Treat tool results as untrusted. Restrict network egress (allowlist). Require approval for actions that send data out. Show the source of instructions in the timeline. |
| Approval spoofing | Approvals are POSTs with session auth + CSRF token + `expectedActionHash`, and are recorded in the audit log with the user id. |
| Secrets in logs | Redact known secret patterns in tool output before storing and displaying. |
| XSS | Agent messages and tool outputs are untrusted: render as text or sanitized Markdown. Screenshots are images only. |
| Audit | Append-only event log + approvals with who, when, and what hash. Export as JSON/CSV. |
| Cost runaway | Per-run budgets (tokens, minutes, tool calls), shown in the UI. When a run hits its budget it pauses and asks the user. Loop detection (same tool call repeated N times) also pauses and asks. |

## Undo

- Track every side effect as a reversible operation with its inverse: create branch → delete branch, open PR → close PR, edit files → git revert.
- Irreversible actions (sent an email, ran a migration) are marked **before** approval, and the undo screen lists them as "can't be undone".
- Revert runs as its own job with its own events, so the user can watch it.

## Accessibility

- The timeline is a list with clear headings per plan item. Status changes are announced through a polite live region, and errors through an assertive one.
- Approval cards are focusable, with buttons that have clear labels ("Approve pushing branch agent/fix-login-1043").
- Terminal output needs a "copy" button and readable contrast, and must not rely on ANSI colors alone.

## Observability and evals

- Per run: success rate, human-intervention count, time waiting for users, cost, number of steps, and reverts.
- Per tool: error rate and latency.
- Quality: the PR merge rate, review comments per agent PR, and the bug rate of agent changes after merge.
- Replays: rerun failed tasks against fixed snapshots to test new agent versions (regression evals).

## Trade-offs

| Decision | Alternative | Why |
|---|---|---|
| Event-sourced run log | Mutable run object only | Reconnect, audit, replay, debugging |
| SSE + REST commands | WebSocket for everything | Simpler auth and audit, auto-reconnect |
| Server-side policy for approvals | UI decides | The UI can't be trusted for security |
| Summaries by default | Show all raw logs | Users need signal, with drill-down for detail |
| No auto-approve on timeout | Approve after N minutes | Safety over speed |

## Follow-ups

- **"The user closes the laptop for 2 hours. What happens?"** The run continues, and approvals wait (the run is in `waiting_for_user`, or the agent works on independent steps). On return: snapshot + events since the last seq, plus a "while you were away" summary at the top.
- **"How do you show progress when you can't predict duration?"** The plan checklist with completed steps, elapsed time, and the current activity. Avoid fake percentage bars.
- **"Two teammates approve at the same time?"** The first decision wins (an atomic compare-and-set on the server). The second gets 409 and sees who decided.
- **"How do you let users trust the agent more over time?"** Per-repo policies ("allow pushes to agent/* branches without asking"), based on history. Every policy change is audited.

## Senior vs mid-level answer

| Mid-level | Senior |
|---|---|
| A chat window with streaming text | Run state machine, event log, plan/steps/tool calls as data |
| Polling for status | Resumable SSE with seq numbers, snapshot + tail, summary channel |
| A confirm() dialog for risky actions | Server-side policy, exact action hash, reversibility info, no auto-approve |
| Ignores injection | Tool output is untrusted, egress allowlist, approval for exfiltration paths |
| Shows all logs | Summaries + drill-down, virtualized terminal, workers for parsing |
