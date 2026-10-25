# Perf 07 · The profile page waterfall

**Difficulty:** Hard · **Time:** 30–40 min · **Format:** code review + fix

## The bug report

> The profile page takes 1.5 s to show comment counts, but each API call takes only ~400 ms. The Network panel looks like a staircase. The backend team says one profile view makes 50+ requests. Also, sometimes after clicking quickly from Ada's profile to Bob's, Bob's page shows Ada's name.

`index.tsx` has `ProfilePage` → `Posts` → `PostItem`. Each component fetches its own data in `useEffect`.

## Your task

1. **Review first.** Draw the request timeline (which request waits for which). How many round trips does the current code need? What is the minimum?
2. **Fix it** in `index.tsx` until `npm test performance/07` passes.
3. Compare with `ANSWERS.md` and `solution.tsx`.

## Rules

- Keep the exports and the `ProfileApi` shape. You may stop using `getCommentCount` (singular). `getCommentCounts` is the batch endpoint.
- Keep the visible text: `Loading profile…`, `Loading posts…`, the `<h1>` with the name, and list items like `Hello — 3 comments`.

## What the tests check (each API call takes 100 ms)

- The user and posts requests start **immediately and in parallel**.
- Everything (name, posts, comment counts) is on screen after **200 ms**: 2 round trips, not 3.
- Comment counts use **one** batched request: no N+1.
- Re-rendering the parent does not refetch.
- After switching `userId`, a slow response for the old user never shows up.

## Try it in the browser

`npm run dev` → **performance / 07-request-waterfall**. The demo draws its own network timeline (400 ms per request). Compare the staircase with the solution's two parallel columns.
