# 08 · Design a Real-time Analytics / Trading Dashboard

**Difficulty:** Very hard · **Time:** 45–60 min

## The prompt (as the interviewer says it)

> "Design a web dashboard that shows live data: for example a trading screen with live prices, an order book, charts, and a table of thousands of instruments, or an operations dashboard with live metrics. Data updates many times per second. It must stay smooth and correct."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| How much data and how fast? | ~5,000 instruments. Popular ones update 10–50 times/second. In total up to ~10,000 updates/second at peaks. |
| What widgets? | Watchlist table (sortable, thousands of rows), price charts (candles, up to 100k points of history), order book depth, alerts/notifications. |
| Must every update be shown? | No. Humans can't see 50 changes per second. The latest value must be correct, and charts must be accurate. |
| Do users act on the data (place orders)? | Yes, but order placement is a separate flow. We must show data age clearly. |
| Custom layouts? | Users arrange widgets (drag, resize) and save layouts. |
| Devices? | Desktop first, many monitors. Mobile is a simpler view. |
| Multiple tabs/windows? | Pro users open several windows (pop-out charts). |
| History? | Charts load history via REST and then continue live. |
| Latency target? | Under ~100 ms from server to screen for prices. |

## What the interviewer is looking for

- Transport choice: **WebSocket vs SSE vs polling**, subscriptions, snapshot + delta.
- **Backpressure:** what happens when data arrives faster than you can render.
- Moving work **off the main thread** (Web Workers, SharedWorker, OffscreenCanvas).
- Rendering: **virtualized tables**, **canvas/WebGL** charts, frame-based batching, avoiding React re-render storms.
- **Correctness:** sequence numbers, gaps, resync, stale data indicators.
- Memory limits over long sessions (dashboards stay open for days).
- Accessibility of fast-changing data.

## Suggested time split

- Requirements: 5–7 min
- Architecture (data pipeline: socket → worker → store → UI): 12 min
- Data model + protocol: 8 min
- Deep dive (backpressure, rendering, charts, tables): 15–18 min
- Reliability, a11y, observability: 5 min
- Wrap-up: 3 min
