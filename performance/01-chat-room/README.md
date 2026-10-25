# Perf 01 · Chat room that gets slower the longer you use it

**Difficulty:** Hard · **Time:** 45 min · **Format:** code review + fix

## The bug report

> Rooms have 2,000+ messages. Typing in the message box feels laggy. The Network tab is full of `/api/users/:id` requests. Memory keeps growing in long sessions. Sometimes "Send" posts an **empty** message.

`index.tsx` contains the component as it is in production. It works, but it has **at least 10 problems**: performance, correctness, and memory.

## Your task

1. **Review first (15 min).** Before touching code, write down every issue. For each one, say what's wrong, what the user would notice, and how you'd *prove* it (which tool, what you'd look for). Rank them by impact.
2. **Fix it (30 min)** in `index.tsx` until `npm test performance/01` passes.
3. Compare with `ANSWERS.md` and `solution.tsx`.

## Rules

- Keep the exported API: `ChatRoom`, `resetUserCache`, and the types.
- Keep the `probe('Message')` and `useMountProbe('Message')` calls inside the message row component. The tests count renders and mounts with them.
- `api.fetchUser` and `api.connect` are injected so the tests can count requests and socket connections.

## What the tests check

- "Send" posts the text that was typed.
- Typing does **not** remount or re-render the message rows.
- Each author is fetched **once**, even when 300 rows ask at the same moment.
- The socket connects once and reconnects only when `roomId` changes. It closes on unmount.
- Typing doesn't force layout by reading `scrollHeight`.
- A row shows the correct author after its `authorId` changes.

## Try it in the browser

`npm run dev` → **performance / 01-chat-room**. Open React DevTools → Profiler → "Highlight updates when components render" and type in the box. Then switch the toggle to **Solution** and compare.
