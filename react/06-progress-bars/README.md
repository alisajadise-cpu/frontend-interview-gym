# 06 · Progress Bars with a Concurrency Limit (pause / resume)

**Difficulty:** Hard · **Time:** 40–50 min · **Similar to:** GreatFrontEnd *Progress Bars I–IV* (asked at Uber, Stripe, and others), upload queues in Google Drive / Dropbox

## Why companies ask this

It's a disguised **scheduling** problem: a queue, a concurrency limit, and timers, inside React state. Interviewers look for one source of truth for progress, **no leaking timers**, no `setInterval` per bar, correct behavior when you pause, and the classic stale-closure bug in interval callbacks. Level IV of the GreatFrontEnd series (pause/resume with a limit of 3) is a common onsite question.

## Task

Build `<ProgressBars />` in `index.tsx`.

```tsx
<ProgressBars durationMs={2000} concurrency={3} />   // both props optional, these are the defaults
```

The component has three buttons and a list of bars:

- **Add** adds a new empty bar at the end of the list.
- **Pause** / **Resume** (one button, its label changes) pauses or resumes all filling.
- **Reset** removes all bars (and un-pauses).

## Requirements

1. Each bar fills from 0% to 100% in `durationMs` of **running** time.
2. At most `concurrency` bars fill at the same time: the **first** unfinished bars in list order. The rest wait at 0% and start in order as earlier bars finish.
3. Use **one** `setInterval` with a 50 ms tick for the whole component (not one per bar). Each tick adds 50 ms to every filling bar. No interval may run when nothing is filling: no bars, all done, or paused.
4. **Pause** stops all filling and keeps progress. **Resume** continues from where it stopped. The button's accessible name is `Pause` while running and `Resume` while paused.
5. Each bar is `role="progressbar"` with `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-valuenow` = the **integer** percentage (`Math.round`).
6. No timers are left after unmount. The tests check `vi.getTimerCount() === 0`.
7. Adding a bar while others are filling starts it immediately if there is a free slot.

## Edge cases interviewers probe

- The stale closure: `setInterval(() => setBars(bars.map(...)), 50)` reads `bars` from the first render forever. Use the **functional** updater form.
- Pausing at 49%, then adding 5 bars, then resuming.
- Browser tabs in the background throttle timers to ≥1s. A tick-counting design then "slows down" time. How would you make progress **time-based** (`Date.now()` deltas) instead? What are the trade-offs?
- `requestAnimationFrame` vs `setInterval` for smooth visuals. Why might you animate the bar with a CSS `transition` (or `transform: scaleX`) and keep state updates cheap?

## Follow-ups

- Make it a real **upload queue**: each bar is an XHR with real progress events, a concurrency limit of 3, cancel per item, and retry on failure.
- Persist the queue in `sessionStorage` so a refresh resumes it.
- How would you test this without waiting 2 real seconds? (Fake timers, as the tests do.)

## Run

```bash
npm test react/06-progress-bars
npm run test:solution react/06-progress-bars
npm run dev   # then open "react / 06-progress-bars"
```
