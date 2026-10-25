# 08 · Real-time Dashboard — Solution

## 1. Requirements

### Functional
1. **Watchlist table:** thousands of instruments with live price, change %, volume. Sortable, filterable. Flash cells green/red on change.
2. **Charts:** candlestick/line charts with history + live updates, zoom and pan, multiple timeframes.
3. **Order book (depth):** live bids/asks for the selected instrument.
4. **Alerts:** notify when a price crosses a threshold.
5. **Layouts:** drag/resize widgets, save layouts per user, pop-out windows.
6. **Data freshness indicator:** show when data is delayed or the connection is down.

### Non-functional
- **Throughput:** handle bursts of ~10,000 updates/second without freezing.
- **Latency:** < 100 ms from message arrival to pixels for visible data.
- **Smoothness:** 60 fps scrolling and chart interaction. INP < 200 ms even during bursts.
- **Correctness:** never show a wrong "latest" value. Detect gaps. Clearly mark stale data.
- **Long-running:** stable memory over days (no leaks, bounded history).
- **Efficient:** only receive data that's on screen.

---

## 2. Architecture

```
┌────────────────────────────────────────── Browser ───────────────────────────────────────────┐
│                                                                                               │
│  Main thread                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ Layout shell (React): widget grid, toolbars, settings, dialogs                         │   │
│  │ ┌─────────────────┐ ┌──────────────────────┐ ┌──────────────┐ ┌───────────────────┐   │   │
│  │ │ WatchlistTable  │ │ Chart                │ │ OrderBook    │ │ Alerts / toasts   │   │   │
│  │ │ virtualized DOM │ │ <canvas> (or WebGL)  │ │ canvas/DOM   │ │                   │   │   │
│  │ │ per-cell writes │ │ OffscreenCanvas in   │ │              │ │                   │   │   │
│  │ │ per frame       │ │ worker where possible│ │              │ │                   │   │   │
│  │ └───────▲─────────┘ └──────────▲───────────┘ └──────▲───────┘ └─────────▲─────────┘   │   │
│  │         │      frame scheduler (requestAnimationFrame): pull latest, draw dirty only   │   │
│  │  ┌──────┴──────────────────────┴────────────────────┴───────────────────┴──────────┐   │   │
│  │  │ Client view store: latest snapshot per subscribed key + dirty flags              │   │   │
│  │  └──────────────────────────────────▲───────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────┼───────────────────────────────────────────────────┘   │
│                       postMessage (batched, ≤ 1 per frame, transferable buffers)             │
│  ┌─────────────────────────────────────┴───────────────────────────────────────────────────┐ │
│  │ Data worker (SharedWorker for multiple tabs/windows, or one DedicatedWorker per tab)    │ │
│  │  WebSocket · decode (binary) · seq/gap check · conflate · aggregate candles ·          │ │
│  │  order book merge · alert rules · subscription manager · reconnect + resync           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────────┘ │
└────────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                         │ WSS (binary frames)        HTTPS (history, layouts)
                              ┌──────────▼──────────┐          ┌──────────────────────┐
                              │ Market data gateway │          │ REST: candles, meta, │
                              │ (fan-out, conflated │          │ user layouts, alerts │
                              │  per client)        │          └──────────────────────┘
                              └─────────────────────┘
```

**Principle:** the network can be faster than the screen. **Decouple data arrival from rendering.** The worker absorbs the firehose and keeps only the latest state. The UI pulls the latest state **once per animation frame** and draws only what changed and is visible.

---

## 3. Data model

```ts
type Symbol = string;

interface Quote {
  symbol: Symbol;
  seq: number;          // per-symbol sequence from the server
  ts: number;           // exchange timestamp (ms)
  bid: number;
  ask: number;
  last: number;
  changePct: number;
  volume: number;
}

interface Candle {
  t: number;            // bucket start time
  o: number; h: number; l: number; c: number;
  v: number;
}

// Charts store columns in typed arrays (fast, compact, transferable)
interface CandleSeries {
  symbol: Symbol;
  timeframe: '1s' | '1m' | '5m' | '1h' | '1d';
  time: Float64Array;
  open: Float32Array; high: Float32Array; low: Float32Array; close: Float32Array;
  volume: Float32Array;
  length: number;       // used part of a ring buffer
}

interface OrderBook {
  symbol: Symbol;
  seq: number;
  bids: Array<[price: number, size: number]>;   // sorted desc, top N levels kept
  asks: Array<[price: number, size: number]>;   // sorted asc
}

interface Subscription {
  key: string;          // e.g. 'quote:AAPL', 'book:AAPL:20', 'candles:AAPL:1m'
  refCount: number;     // how many widgets need it
  lastSeq: number;
}

interface ConnectionStatus {
  state: 'connecting' | 'live' | 'reconnecting' | 'offline';
  lastMessageAt: number;
  lagMs: number;        // now - exchange ts (needs clock offset correction)
}
```

**Why typed arrays for charts?** 100k candles as JS objects = millions of small objects and slow GC. As `Float64Array`/`Float32Array` columns, they are compact, fast to iterate, and can be **transferred** (zero-copy) between worker and main thread.

**Floating point:** prices displayed with the instrument's tick size. For anything financial that is computed (P&L, order totals), use integer minor units or a decimal library, not raw float math.

---

## 4. Interface (protocol)

### Transport

| Option | Fit |
|---|---|
| **WebSocket** | **Chosen.** Bi-directional (subscribe/unsubscribe), low overhead per message, binary frames. |
| SSE | One-way, text only (UTF-8). Fine for low-rate dashboards. Subscriptions need separate HTTP calls. With HTTP/1.1 there's a ~6 connections per domain limit across tabs (HTTP/2 helps). |
| Polling | Simple, cacheable. OK for metrics updating every 5–30 s. Bad for ticks. |
| WebTransport | Interesting (unreliable datagrams, no head-of-line blocking), but browser support and infra are less mature. Mention as future. |

### Messages (binary encoding like Protobuf/FlatBuffers/MessagePack; JSON shown for reading)

```jsonc
// client → server
{ "op": "sub",   "keys": ["quote:AAPL", "quote:MSFT", "book:AAPL:20", "candles:AAPL:1m"] }
{ "op": "unsub", "keys": ["quote:MSFT"] }
{ "op": "throttle", "key": "quote:*", "maxHz": 4 }      // ask server to conflate for us

// server → client
{ "type": "snapshot", "key": "book:AAPL:20", "seq": 1000, "bids": [...], "asks": [...] }
{ "type": "delta",    "key": "book:AAPL:20", "seq": 1001, "changes": [["bid", 189.10, 0], ["ask", 189.12, 300]] }
{ "type": "quotes",   "batch": [[ "AAPL", 5512, 1700000000123, 189.10, 189.12, 189.11, 0.42, 51234000 ], ...] }
{ "type": "heartbeat", "serverTime": 1700000000200 }
```

- **Snapshot + delta:** subscribe → full snapshot with `seq` → deltas with `seq+1, seq+2...`. If a delta's `seq` isn't `last + 1`, there's a **gap**: drop the state and request a new snapshot. Very important for order books, where a missed delta means wrong data.
- **Batching on the server:** many quotes in one frame (an array of tuples) saves overhead.
- **Server-side conflation:** if the client is slow, the server sends only the latest quote per symbol, not every tick. This is backpressure at the source.

### REST

```
GET /api/candles?symbol=AAPL&tf=1m&from=...&to=...     → binary/columnar candles (cacheable for closed buckets)
GET /api/instruments                                   → metadata (tick size, name), cached long
GET/PUT /api/layouts/:id                               → user layout JSON
POST /api/alerts                                       → server-side alerts (work when the tab is closed)
```

---

## 5. Deep dives

### 5.1 Backpressure: data faster than the screen

A 60 Hz screen draws every ~16.7 ms. If 10,000 updates arrive per second and each triggers a React `setState`, the main thread drowns: long tasks, input lag (bad INP), growing queues, and memory spikes.

Layers of defense:
1. **Subscribe only to what's visible.** The watchlist subscribes to the ~40 visible rows (+ overscan), not 5,000. Scrolling changes subscriptions (debounced). Hidden tabs (`visibilitychange`) reduce or pause subscriptions.
2. **Server conflation** for slow consumers, and the client can request a max rate per key.
3. **Client conflation in the worker:** keep a `Map<key, latest>` and a dirty set. Ten updates to AAPL between frames = **one** value to send.
4. **One message to the main thread per frame** (or every ~50–100 ms for tables), containing only dirty keys. Use transferable `ArrayBuffer`s for big data.
5. **Render per frame:** a `requestAnimationFrame` loop reads the latest store values and updates only visible, dirty cells.
6. **Drop, don't queue:** for "latest value" data, intermediate values are safe to drop. For **data that must not be dropped** (trades list, candle aggregation, order book deltas), **aggregate** them in the worker (update the current candle's high/low/close/volume; apply deltas) and send the result.
7. If the main thread still falls behind (frame time > budget), lower the UI update rate (e.g. table to 4 Hz) and show it subtly.

### 5.2 Web Workers

- The **worker owns the WebSocket**: decoding, sequence checks, conflation, candle aggregation, order book merging, and alert checks all run off the main thread.
- **SharedWorker** for multiple windows/tabs: one connection and one subscription set for all windows (pop-out charts). Fallback when SharedWorker is unavailable: one tab leads (Web Locks) and shares via BroadcastChannel, or each tab has its own worker.
- `postMessage` cost: structured cloning large objects is slow. Send **typed arrays as transferables**, or use a `SharedArrayBuffer` ring buffer (needs cross-origin isolation headers COOP/COEP, which complicate third-party embeds).
- **OffscreenCanvas:** the chart can be drawn entirely in a worker (`canvas.transferControlToOffscreen()`), so even heavy redraws don't block input on the main thread.

### 5.3 The watchlist table

- **Virtualized rows** (only visible rows in the DOM) with fixed row height (fast math, no measuring).
- **Don't re-render React per tick.** Two common approaches:
  - Rows subscribe to their symbol via `useSyncExternalStore` with a selector. React re-renders only changed rows, batched per frame. Fine up to a few hundred updates per second on screen.
  - For extreme rates: React renders the row structure once, and the frame loop **writes `textContent` directly** to cell nodes (refs) for price changes. This avoids reconciliation entirely. This is what many trading UIs do.
- **Flash on change:** toggle a CSS class to run a short background animation. Restart it with the Web Animations API, or toggle between two classes. Avoid animating layout properties. Respect `prefers-reduced-motion` (use an arrow icon instead).
- **Sorting live data:** re-sorting 5,000 rows on every tick makes rows jump and is unreadable. Options: sort on demand (click), re-sort at a slow fixed interval (e.g. every 2 s) with a "live sort" toggle, or freeze order while the user hovers/interacts.
- Use `font-variant-numeric: tabular-nums` so digits don't jiggle when prices change. Fixed column widths.
- `contain: strict` (or `content`) on the table body to limit layout work to the table.

### 5.4 Charts

- **DOM/SVG** works for a few hundred points. For 100k candles and live updates use **Canvas 2D**, or **WebGL** for very large series (millions of points, heatmaps).
- **Downsample** to the number of pixels: you can't show 100k candles in 1,000 px. Aggregate into display buckets per zoom level (min/max/first/last per bucket), or LTTB-style downsampling for line charts. Compute in the worker.
- **Incremental drawing:** a new tick only changes the last candle. Redraw only the last candle region, or use layers: a static history layer (redrawn on zoom/pan only), a live layer (last candle, price line), and an interaction layer (crosshair, tooltip). Stack several canvases.
- Handle **devicePixelRatio** (sharp lines on retina) and resize with `ResizeObserver`.
- Pan/zoom: pointer events + wheel, throttled to frames. Load more history when panning near the left edge (REST, cached by time range; closed candles never change, so cache them hard).
- Live + history merge: the history response ends at time T. Live updates may overlap. Merge by bucket time; the live value for the current bucket wins.

### 5.5 Order book

- Apply deltas to sorted price levels (a sorted array with binary search, or a map + sorted keys). Keep only the top N levels for display.
- Strict `seq` checking: gap → resubscribe for a snapshot, show "resyncing" instead of wrong data.
- Render at a limited rate (e.g. 10 Hz) with depth bars drawn in canvas or as CSS widths (transform `scaleX` for bars, not `width`, to avoid layout).

### 5.6 Correctness and freshness

- Per-symbol `seq` dedupes and orders. Out-of-order older ticks are ignored.
- **Heartbeats** detect dead connections. Reconnect with backoff + jitter, then **resubscribe and resync** (new snapshots).
- **Stale indicators:** if a symbol hasn't updated in X seconds while the market is open, or the connection is down, grey out values and show "Delayed"/"Disconnected". A trading screen showing old prices as if live is dangerous.
- Clock offset: compute `serverTime - Date.now()` from heartbeats to show accurate "lag".

### 5.7 Layout and widgets

- Grid layout (drag/resize) state saved as JSON per user (debounced PUT) and in `localStorage` for instant load.
- Each widget is **lazy-loaded** (chart library is big), and declares its data subscriptions. The subscription manager **ref-counts** keys, so two widgets on AAPL share one subscription, and closing a widget unsubscribes when the count is 0.
- Widgets that are **offscreen or in a hidden tab** pause rendering (IntersectionObserver, `visibilitychange`).
- An error boundary per widget: one broken widget doesn't kill the dashboard.

### 5.8 Memory over long sessions

- Ring buffers with fixed capacity for chart data and trade lists.
- Unsubscribe and free data when widgets close.
- Avoid closures holding big arrays, listeners never removed, and detached DOM nodes from virtualization.
- Monitor `performance.memory` (Chrome only) or `performance.measureUserAgentSpecificMemory()` (needs cross-origin isolation) in RUM to catch leaks after release.

### 5.9 Accessibility

- Fast-changing numbers must **not** be announced on every change. Screen reader users would hear nothing else.
- The table is a real `table`/`grid` with headers. The current value is readable on focus. Offer an "announce changes for this symbol" option, throttled (e.g. at most every 5 s), via `aria-live="polite"`.
- Price changes shown with **color plus a symbol/arrow** (▲▼) and text, not color alone (red/green color blindness is common).
- Keyboard: navigate the grid with arrows, open a symbol's chart with Enter, shortcuts for timeframes.
- Option to reduce or stop flashing (`prefers-reduced-motion`, and a setting), also for users with photosensitivity.
- Charts get a text summary (e.g. "AAPL, 1 day, up 2.3%, high 190.1, low 185.4") and a data-table alternative.

### 5.10 i18n

- Number formatting with `Intl.NumberFormat` (reuse formatter instances; creating them per cell per frame is expensive).
- Persian/Arabic UI in RTL, but **numbers and charts' time axis stay LTR** (numbers are LTR in RTL text anyway). Time zones: show exchange time and local time clearly.

### 5.11 Security

- Auth token on WebSocket connect, short-lived, refreshed. Server checks entitlements per subscription (paid real-time data vs delayed data).
- Validate and bound all inbound data (a bad message shouldn't crash the worker).
- CSP, no `eval`. If using SharedArrayBuffer, set COOP/COEP headers properly.

### 5.12 Observability

- Client metrics: message rate in, conflation ratio (received vs rendered), frame time / long animation frames, end-to-end latency (exchange ts → paint), reconnects, gap resyncs, memory over time.
- Sampled to the backend, dashboards by release and browser.

---

## 6. Trade-offs

| Topic | Options | Choice |
|---|---|---|
| Transport | WS / SSE / polling | **WebSocket** with binary frames. Polling for slow metric widgets. |
| Processing | Main thread / worker | **(Shared)Worker** owns the socket and heavy processing. |
| Update strategy | Render every message / per frame | **Per frame**, conflated latest values, aggregated non-droppable data. |
| Table updates | React state per row / direct DOM writes | **useSyncExternalStore per row** first. **Direct writes** if profiling shows React is the bottleneck. |
| Charts | SVG / Canvas / WebGL | **Canvas** (layers), WebGL for huge series. |
| Sorting live data | Continuous / on demand | **Throttled or on demand**, readable UI over raw speed. |
| Multi-window | Socket per window / SharedWorker | **SharedWorker** with fallback. |

---

## 7. Follow-up questions

**"How do you test this?"**
A fake data server that replays recorded market data at 1×–100× speed. Performance tests in CI with Playwright + tracing (frame times, long tasks) under a fixed load. Unit tests for gap detection, conflation, and candle aggregation. Chaos tests: drop/duplicate/reorder messages, kill the socket.

**"The UI freezes for 2 s every few minutes. What is it?"**
Likely GC pauses from allocating many objects per message, or a periodic heavy task (re-sorting the full table, saving layouts synchronously, a third-party script). Profile with the Performance panel (look for GC and long tasks), then switch to typed arrays/object pools, and move work to the worker.

**"How do alerts work when the tab is closed?"**
Alerts must be evaluated on the **server** and delivered via Web Push / email / mobile push. Client-side alert checks are only a convenience for instant in-app toasts.

**"How do you show 'delayed by 15 minutes' data for free users?"**
Entitlements on the server choose the feed (real-time vs delayed). The client shows a clear badge on every widget using delayed data.

**"Would you use React at all?"**
Yes, for the shell, layout, forms and menus. The hot path (cells, charts) bypasses React's render cycle with refs/canvas. This hybrid keeps developer productivity and performance.

---

## 8. What separates a senior answer from a mid-level one

- **Mid-level:** "WebSocket → Redux → components re-render. Use a chart library."
- **Senior:**
  - Separates **data rate from frame rate**: conflation, per-frame rendering, dropping vs aggregating.
  - Moves the socket and processing into a **(Shared)Worker**, uses **transferables**, mentions OffscreenCanvas.
  - **Visible-only subscriptions** with ref-counting, pausing hidden widgets.
  - **Snapshot + delta with seq and gap resync**, and **stale data indicators**.
  - **Canvas layers and downsampling** for charts, **typed arrays** to avoid GC.
  - Table details: direct DOM writes when needed, tabular numbers, throttled sorting.
  - **Accessibility of live data** (no announcement storms, color + symbol) and long-session memory.
