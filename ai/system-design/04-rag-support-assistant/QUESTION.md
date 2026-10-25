# 04 · Design a RAG customer-support assistant

**Time:** 60 min · **Format:** full-stack / applied-AI design. AI-engineer interviews ask this often ("design a support assistant, then tell me how you'd know it helps and doesn't make things worse"). Product engineers at AI-feature teams get it too.

## The prompt

> "We have about 20,000 help-center articles, PDFs, and internal runbooks. Build an assistant on our website that answers customer questions using these documents, with citations. It should hand off to a human agent when it can't help. Design the system end to end, and tell me how you'd know it actually works."

## Clarifying questions (with assumed answers)

| Question | Assume |
|---|---|
| Traffic? | 50k conversations/day, with spikes during incidents. |
| Languages? | English and Persian. Some docs exist only in English. |
| How often do docs change? | Daily. Answers must reflect a change within an hour. |
| Can it take actions (refunds, account changes)? | Not in v1. Read-only answers plus a handoff to a human. |
| Which docs can a user see? | Public docs for everyone. Plan-specific docs only for logged-in customers on that plan. |
| Latency target? | First token in under ~2 s, a complete answer in under ~10 s. |
| Budget? | A cost per conversation target, for example under $0.02 on average. |
| Success metric? | Deflection (resolved without a human) **without** lowering CSAT, plus answer accuracy. |

## What the interviewer is looking for

- **Ingestion pipeline**: parsing, chunking, metadata, incremental updates, deletions.
- **Retrieval**: embeddings + keyword (hybrid), filtering by permissions, reranking.
- **Generation**: grounded prompting, citations, refusing when there's no answer.
- **Frontend**: streaming chat widget, citations UI, feedback, handoff.
- **Evals**: offline (retrieval recall@k, faithfulness) and online (feedback, deflection, escalations), plus LLM-as-judge calibration.
- **Guardrails**: prompt injection through documents, PII, off-topic use.
- **Cost and latency** budgets, and knowing **when not to use RAG**.

## Time split

| Min | Part |
|---|---|
| 0–7 | Requirements, success metrics |
| 7–20 | Ingestion + retrieval architecture |
| 20–30 | Generation, prompt, citations, frontend widget |
| 30–45 | Evals and feedback loop |
| 45–55 | Guardrails, cost, latency, failure modes |
| 55–60 | Trade-offs |
