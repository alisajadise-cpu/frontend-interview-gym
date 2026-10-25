# Perf 06 · The dashboard that eats memory

**Difficulty:** Hard · **Time:** 30–40 min · **Format:** code review + fix

## The bug report

> Traders keep the dashboard open all day and switch between tabs. After a few hours the tab uses 2 GB of memory and Chrome shows "Aw, Snap!". The network panel shows stats requests for tickers that are not on screen. Battery drains even when the browser tab is in the background.

`index.tsx` contains `LiveTicker`, which is mounted and unmounted every time the user switches dashboard tabs. It shows a live price from a WebSocket-like feed, polls stats every few seconds, and draws a small sparkline.

## Your task

1. **Review first.** Find every leak. For each one, say what keeps the memory alive (which reference points to what) and how you'd find it in Chrome DevTools.
2. **Fix it** in `index.tsx` until `npm test performance/06` passes.
3. Compare with `ANSWERS.md` and `solution.tsx`.

## Rules

- Keep the exports: `LiveTicker`, `getHistory`, `resetHistory`, `HISTORY_LIMIT`, and the types.
- `feed` and `api` are injected so the tests can count subscribers and requests.

## What the tests check

- The price and stats show correctly. Stats are polled every `pollMs`, and the previous request is aborted when a new one starts.
- After 10 mount/unmount cycles, the feed has **0 listeners**.
- Changing `symbol` unsubscribes from the old symbol.
- After unmount: **0 timers**, no more polling, and the in-flight request is aborted.
- `visibilitychange` listeners: every one added is removed.
- History keeps at most `HISTORY_LIMIT` points per symbol.
- No polling while the browser tab is hidden.

## Try it in the browser

`npm run dev` → **performance / 06-memory-leaks**. Switch tabs 10 times and watch the subscriber counter. Then try the Memory panel: take a heap snapshot, switch tabs 20 times, take another one, and compare.
