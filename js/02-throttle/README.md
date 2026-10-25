# 02 · Throttle (lodash-grade)

**Difficulty:** Hard · **Time:** 30 min · **Similar to:** GreatFrontEnd *Throttle*, LeetCode 2676 *Throttle*, `lodash.throttle`

## Why companies ask this

Scroll handlers, resize handlers, drag-and-drop, "save position" calls, and analytics on mouse move all need throttling. The interviewer checks that you know the difference from debounce. Throttle guarantees **regular** calls while events keep coming, and debounce waits for **silence**. Then they check the edges: does the *last* event get through? With which arguments?

## Task

Implement `throttle(fn, wait, options)` in `index.ts`.

```ts
const onScroll = throttle(() => savePosition(window.scrollY), 200);
window.addEventListener('scroll', onScroll);
// later
onScroll.cancel();
```

## Requirements

1. At most **one** call of `fn` per `wait` ms while the throttled function keeps being called.
2. **`leading`** (default `true`): the first call of a burst runs `fn` immediately.
3. **`trailing`** (default `true`): if calls happened during the wait window, `fn` runs once more at the end of the window, with the **latest** arguments and the latest `this`.
4. `leading: false` → the first run happens `wait` ms after the first call.
5. `trailing: false` → calls inside the window are dropped. After the window ends, the next call runs immediately.
6. A single call with `leading: true, trailing: true` runs `fn` only **once**.
7. The throttled function returns the result of the last `fn` invocation (`undefined` if none yet).
8. `throttled.cancel()` drops any pending trailing call and resets the state.
9. `throttled.flush()` runs the pending trailing call now and returns its result. With nothing pending, it returns the last result.
10. Use `Date.now()` and `setTimeout`. The tests use fake timers.

## Edge cases interviewers probe

- `this` when used as a method: `obj.onScroll = throttle(fn, 100)`.
- A burst that stops in the middle of a window: the trailing call must still fire.
- After the trailing call fires, a new call must not run immediately again if it is still inside the next window.

## Follow-ups

- lodash implements `throttle` as `debounce(fn, wait, { leading, trailing, maxWait: wait })`. Explain why that works.
- For scroll-linked visuals, why is `requestAnimationFrame` throttling usually better than `setTimeout` throttling?
- How do you throttle in React without recreating the throttled function on every render? (`useRef` / `useMemo`, and cancel in the effect cleanup.)

## Run

```bash
npm test js/02-throttle
npm run test:solution js/02-throttle
```
