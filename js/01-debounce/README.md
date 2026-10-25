# 01 · Debounce (lodash-grade)

**Difficulty:** Hard · **Time:** 30–40 min · **Similar to:** GreatFrontEnd *Debounce II*, BFE.dev #7, LeetCode 2627, `lodash.debounce`

## Why companies ask this

Every search box, autosave, resize handler, and analytics batcher uses debounce. The basic version takes 10 minutes. Senior interviews go straight to the follow-ups: `leading`/`trailing`, `maxWait`, `cancel`, `flush`, and keeping `this` and the return value right. Most candidates break one of these.

## Task

Implement `debounce(fn, wait, options)` in `index.ts`.

```ts
const save = debounce(saveDraft, 500, { maxWait: 2000 });
save(text);      // waits until typing stops for 500ms…
                 // …but never waits more than 2s while the user keeps typing
save.flush();    // save right now (e.g. on page unload)
save.cancel();   // drop the pending call (e.g. on unmount)
```

## Requirements

1. **Trailing (default):** `fn` runs `wait` ms after the *last* call, with the **latest** arguments and the latest `this`.
2. **`leading: true`:** `fn` runs immediately on the first call of a burst.
   - With `leading: true, trailing: true`: a burst with only **one** call invokes `fn` **once** (leading only). A burst with 2+ calls invokes on both edges, and the trailing call uses the latest args.
   - With `leading: true, trailing: false`: only the leading edge runs. A new call after the burst is over (`wait` ms of silence) runs immediately again.
3. **`maxWait`:** while calls keep coming, `fn` must still run at least once every `maxWait` ms. `maxWait` smaller than `wait` is treated as `wait`.
4. The debounced function **returns the result of the last `fn` invocation** (or `undefined` if it never ran).
5. `debounced.cancel()` drops any pending invocation.
6. `debounced.flush()` runs the pending invocation now and returns its result. If nothing is pending, it returns the last result without calling `fn`.
7. `debounced.pending()` returns `true` while an invocation is scheduled.
8. Use `Date.now()` and `setTimeout`. The tests use fake timers.

## Edge cases interviewers probe

- Calling the debounced function as a method: `obj.save = debounce(fn)` then `obj.save()`. `this` must be `obj`.
- Trailing call after `leading` when nothing new was called: it must **not** fire.
- `flush()` twice in a row.
- The timer is not reset blindly on every call when `maxWait` is set. Think about *why* lodash compares timestamps instead of clearing/re-setting the timer on every call.

## Follow-ups

- Why does lodash keep **one** timer and compare `Date.now()` values instead of `clearTimeout` + `setTimeout` on every call? (Hint: thousands of keystrokes → thousands of timer allocations.)
- How would you write a React `useDebouncedCallback` that always calls the *latest* `fn` without resetting the timer when `fn` changes?
- Debounce vs throttle: when would you pick each for a scroll handler? For a search box?

## Run

```bash
npm test js/01-debounce              # your code (watch mode)
npm run test:solution js/01-debounce # reference solution
```
