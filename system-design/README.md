# Frontend System Design

Senior frontend interviews almost always have one system design round. You get a product ("design a news feed") and 45–60 minutes. There is no code to run. You talk, draw boxes, and write a few types. The interviewer wants to see **how you think**: what you ask, what you prioritize, and which trade-offs you notice.

This folder has 9 questions. Each folder has:

- `QUESTION.md`: the prompt as the interviewer says it, the questions you should ask, and what the interviewer is looking for.
- `SOLUTION.md`: a full senior-level answer.

**How to practice:** read only `QUESTION.md`. Set a 45-minute timer. Answer out loud or on paper (Excalidraw works well). Then read `SOLUTION.md` and write down what you missed.

---

## How the round runs

| Phase | Time (45 min) | Time (60 min) | What you do |
|---|---|---|---|
| Requirements | 5–7 min | 8–10 min | Ask questions. Agree on scope. Write the list down. |
| Architecture | 8–10 min | 10–12 min | Draw the boxes: server, CDN, client modules, data flow. |
| Data model | 5 min | 7 min | Write the client-side types and where each piece of state lives. |
| Interface (API) | 5–7 min | 8 min | Endpoints, request/response shapes, pagination, real-time protocol. Component props if it's a component. |
| Optimizations / deep dive | 12–15 min | 15–20 min | Performance, network, a11y, i18n, security, offline. Go deep on 2–3 topics. |
| Wrap-up | 2 min | 3 min | Summarize trade-offs and what you'd do next. |

The interviewer often steers the deep dive. Follow them, and don't defend your plan when they want to go somewhere else.

---

## The RADIO framework

**R — Requirements**
- Functional: what the user can do. Pick the 3–5 core features. Say out loud what's *out of scope*.
- Non-functional: performance targets, devices (low-end Android? desktop?), network (3G?), scale (number of items, users, updates per second), accessibility, i18n, SEO, offline.
- Write them down. Come back to them at the end.

**A — Architecture**
- Boxes and arrows: server/API, CDN, client app, and the client modules inside it (view, controller/state, client store, network layer, workers).
- The rendering strategy (CSR / SSR / SSG / ISR / streaming / React Server Components) and **why**.
- Data flow for the main user action, step by step.

**D — Data model**
- TypeScript types for the main entities.
- Where each piece of state lives: server cache (React Query style), global client store, URL, local component state, or persistent storage (IndexedDB).
- Normalized vs nested data, and why.

**I — Interface (API)**
- The HTTP/GraphQL/WebSocket API between client and server: methods, paths, request and response shapes.
- Pagination: cursor vs offset, and why. (Feeds and chats almost always use cursors.)
- For a component or library question, the **component API** (props, events, render props, headless hooks) matters more than HTTP.

**O — Optimizations**
- This is where seniors win. Go deep. Use the checklist below.

---

## Senior checklist: topics to raise (pick the relevant ones)

**Performance and Core Web Vitals**
- LCP (largest contentful paint, under 2.5s): hero image priority, SSR, preload, CDN.
- INP (Interaction to Next Paint, under 200ms): keep handlers small, split long tasks (`scheduler.yield()` / `setTimeout`), `startTransition`, Web Workers, virtualization.
- CLS (layout shift, under 0.1): reserve space for images, ads, and async content.
- Bundle size: code splitting by route and by interaction, tree shaking, lazy loading below-the-fold widgets.
- Rendering: virtualization for long lists, memoization only where the Profiler shows it helps, `content-visibility: auto`.

**Rendering strategy**
- CSR: simple, bad for SEO and first paint on slow devices.
- SSR: good first paint and SEO, costs server CPU, needs hydration.
- SSG/ISR: pre-built HTML on a CDN, best for content that changes rarely. ISR rebuilds pages in the background.
- Streaming SSR + Suspense: send the shell first, stream slow parts later.
- React Server Components: zero JS for non-interactive parts, data fetching on the server.

**Network and caching layers** (from far to near)
1. CDN / edge cache (`Cache-Control: s-maxage`, `stale-while-revalidate`).
2. HTTP browser cache (`Cache-Control`, `ETag`, immutable hashed assets).
3. Service worker cache (offline, app shell).
4. Client data cache (React Query/SWR/Apollo/Relay): dedupe, stale-while-revalidate, invalidation.
5. Component state.
- Also: request batching, prefetching on hover/viewport, HTTP/2 multiplexing, compression (Brotli), `preconnect`.

**State management**
- Server state ≠ client state. Server state goes in a query cache. UI state stays local. Shareable state goes in the **URL**.
- Normalize entities that appear in many places (a user's avatar in 50 posts).
- Optimistic updates with rollback.

**Accessibility**
- Semantic HTML first, ARIA patterns second (combobox, dialog, grid, tabs).
- Keyboard support and visible focus. Focus management on route change and in modals.
- `aria-live` for updates (new messages, results count). Respect `prefers-reduced-motion`.
- Color contrast, zoom to 200%, and screen reader testing (VoiceOver, NVDA).

**i18n and RTL** (Persian, Arabic, Hebrew)
- Use CSS logical properties (`margin-inline-start`, not `margin-left`) and `dir="rtl"` on `<html>`.
- Mirror icons with direction (arrows, back buttons), but not logos or media controls.
- `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.PluralRules`. Persian digits (۱۲۳) and the Jalali calendar via `Intl` with `fa-IR` / `u-ca-persian`.
- Mixed-direction text: `dir="auto"` on user content, `<bdi>` for usernames.
- Translation strings loaded per locale and split per route. Text expansion (German is about 30% longer).

**Security**
- XSS: never inject untrusted HTML. If you must, sanitize (DOMPurify). React escapes text by default. Watch `dangerouslySetInnerHTML`, `href="javascript:"`, and markdown renderers.
- CSP (Content Security Policy) with nonces. Trusted Types.
- CSRF: `SameSite` cookies plus CSRF tokens for cookie-based auth.
- Auth tokens: prefer `HttpOnly` `Secure` cookies over `localStorage` (which any XSS can read). Short-lived access token plus refresh.
- Clickjacking: `frame-ancestors`. Rate limiting. Validate on the server. Never trust the client.

**Offline / PWA**
- Service worker for the app shell. IndexedDB for data. An outbox queue for writes made offline, replayed with idempotency keys.
- Show the connection status. Conflict handling when coming back online.

**Observability**
- RUM: Core Web Vitals from real users (`web-vitals` library), split by device and country.
- Error tracking (Sentry-style) with source maps and release tags.
- Logs and metrics for key flows (funnel events). Performance marks (`performance.mark`). Alerting on regressions.

**Testing strategy**
- Unit tests for logic, component tests (Testing Library), a few E2E tests (Playwright) for critical flows.
- Visual regression for a design system. Contract tests for APIs. Performance budgets in CI (Lighthouse CI, bundle-size checks).

**Feature flags and rollout**
- Ship behind flags. Percentage rollout. A/B tests. Kill switch.
- Canary releases. Monitor errors and vitals per release, and roll back fast.

---

## Common mistakes

- Starting to draw before asking any questions.
- Designing the backend (databases, sharding, Kafka). This is a **frontend** round. Mention the backend only as a box with an API.
- Saying "I'd use Redux" without saying *what state* goes there and why.
- Listing buzzwords ("we'll add caching") without saying *what* is cached, *where*, and *for how long*.
- Forgetting accessibility, error states, loading states, and empty states.
- Ignoring low-end devices and slow networks. Most users don't have your MacBook.
- Going deep on one topic for 30 minutes and never reaching optimizations.
- Not summarizing trade-offs. Every choice has a cost. Say it.

---

## Questions

| # | Question | Difficulty | Key topics |
|---|---|---|---|
| 01 | [Autocomplete component](./01-autocomplete/QUESTION.md) | Medium–Hard | Component API, debounce, race conditions, caching, combobox a11y |
| 02 | [News feed](./02-news-feed/QUESTION.md) | Hard | Cursor pagination, virtualization, normalization, optimistic updates, real-time |
| 03 | [Chat app](./03-chat-app/QUESTION.md) | Hard | WebSocket, ordering, receipts, offline outbox, reverse virtualization |
| 04 | [E-commerce PLP + PDP](./04-ecommerce-plp-pdp/QUESTION.md) | Hard | SEO, SSR/ISR, URL state, images, Core Web Vitals, cart |
| 05 | [Collaborative editor](./05-collaborative-editor/QUESTION.md) | Very hard | OT vs CRDT, presence, offline, shared undo |
| 06 | [Design system](./06-design-system/QUESTION.md) | Hard | Component API, tokens, theming, a11y, versioning, RTL |
| 07 | [Video player](./07-video-player/QUESTION.md) | Very hard | HLS/DASH, MSE, ABR, buffering, captions, DRM |
| 08 | [Real-time dashboard](./08-realtime-dashboard/QUESTION.md) | Very hard | WebSocket vs SSE, backpressure, workers, canvas/WebGL |
| 09 | [Spreadsheet](./09-spreadsheet/QUESTION.md) | Very hard | 2D virtualization, formula engine, dependency graph, clipboard |

Suggested order: 01 → 02 → 04 → 03 → 06 → 08 → 07 → 09 → 05.
