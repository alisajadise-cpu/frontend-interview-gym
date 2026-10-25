# 05 · Build your own Promise (Promises/A+ core + statics)

**Difficulty:** Hard · **Time:** 60 min · **Similar to:** BFE.dev *create your own Promise*, GreatFrontEnd *Promise.all / Promise.any / Promise.race / Promise.allSettled*, the Promises/A+ spec

## Why companies ask this

You use promises every day, but few people can explain **why** `then` callbacks are always async, how a promise "adopts" the state of a thenable, or why `resolve(p)` with the same promise is a `TypeError`. Building one shows you understand the microtask queue, error propagation, and the contracts that `async/await` is built on. Senior interviewers also ask for the static helpers, because each one has its own small traps.

## Task

Implement the `MyPromise` class in `index.ts`.

```ts
new MyPromise<number>((resolve) => setTimeout(() => resolve(1), 100))
  .then((x) => x + 1)
  .then((x) => { throw new Error(`bad ${x}`); })
  .catch((e) => e.message)
  .finally(() => console.log('done'));

await MyPromise.all([1, MyPromise.resolve(2), Promise.resolve(3)]); // [1, 2, 3]
```

## Requirements

**Core (Promises/A+)**
1. States are `pending` → `fulfilled` or `rejected`. Once settled, the state never changes. Extra `resolve`/`reject` calls are ignored.
2. If the executor throws, the promise is rejected with that error (unless it was already resolved).
3. `then(onFulfilled, onRejected)` returns a **new** `MyPromise`.
   - Callbacks always run **asynchronously** as microtasks (`queueMicrotask`), never synchronously, even when the promise is already settled.
   - Callbacks run in the order they were registered.
   - A non-function argument passes the value (or the error) through to the next promise.
   - If a callback throws, the returned promise rejects with that error.
4. **Resolution procedure** (used by `resolve(x)` and for callback return values):
   - If `x` is the promise itself → reject with a `TypeError`.
   - If `x` is an object or function with a `then` method (a *thenable*, including native `Promise`), adopt its state. Read `x.then` **only once**. If reading it throws, reject. If the thenable calls its callbacks more than once, only the first call counts.
   - Otherwise fulfill with `x`.
5. `catch(onRejected)` is `then(undefined, onRejected)`.
6. `finally(onFinally)` runs `onFinally()` with no arguments and passes the original value or error through. If `onFinally` throws or returns a rejected promise, that error wins. If it returns a promise, wait for it first.
7. `MyPromise` must work with `await` and with native `Promise.resolve(myPromise)`.

**Statics**

8. `MyPromise.resolve(x)` returns `x` itself if it's already a `MyPromise`. `MyPromise.reject(e)` returns a rejected promise.
9. `all(iterable)`: values in input order, rejects with the first rejection, `[]` for empty input. Non-promise values are allowed.
10. `allSettled(iterable)`: `{ status: 'fulfilled', value }` / `{ status: 'rejected', reason }` in input order.
11. `race(iterable)`: settles like the first input that settles.
12. `any(iterable)`: fulfills with the first fulfillment. If **all** reject (or the input is empty), reject with an `AggregateError` whose `errors` are in input order.

## Edge cases interviewers probe

- `p.then(() => p)` → `TypeError` (chaining cycle).
- A thenable that calls `resolve` and then `reject`, or calls `resolve` twice.
- `MyPromise.resolve().then(() => console.log('a')); console.log('b')` prints `b` first.
- `then` callbacks must run before a `setTimeout(…, 0)` callback (microtask vs macrotask).

## Follow-ups

- Why did the spec choose microtasks instead of `setTimeout` for callbacks?
- What's an "unhandled rejection", and how would you detect one in your implementation?
- Why does resolving with a thenable take extra microtask ticks in native promises?
- How does `async/await` use this machinery? What does `await x` do with a thenable?

## Run

```bash
npm test js/05-my-promise
npm run test:solution js/05-my-promise
```
