# Quiz · Event loop and promises

Senior interviews often show a snippet and ask "what does this print?". Being fast and **explaining why** (microtasks vs macrotasks, how `await` desugars to `.then`) matters more than memorizing.

**Quick model:** run all sync code → empty the microtask queue (promise callbacks, `await` continuations, `queueMicrotask`) → run ONE macrotask (timer, I/O, UI event) → empty microtasks again → render (in browsers) → repeat.

For each snippet, write down the **exact output** (every line, in order) before you open the answer. Every answer was checked by running the code in Node.js 22. Browsers give the same results.

## 1. Sync code, microtasks, macrotasks

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
```

<details>
<summary>Answer</summary>

```text
1
4
3
2
```

Synchronous code runs first (`1`, `4`). Then the **microtask** queue is emptied (`3`, the promise callback). Only then does the event loop take the next **macrotask** (`2`, the timer). A `setTimeout(…, 0)` always waits for every queued microtask.

</details>

## 2. What `await` does to the rest of the function

```js
async function a() {
  console.log('a1');
  await null;
  console.log('a2');
}
console.log('start');
a();
console.log('end');
```

<details>
<summary>Answer</summary>

```text
start
a1
end
a2
```

`async` functions run **synchronously** until the first `await`. `await null` pauses `a` and schedules the rest (`a2`) as a microtask, so `end` is printed first. Think of the code after `await` as `.then(() => { … })`.

</details>

## 3. Timers scheduled from microtasks

```js
setTimeout(() => console.log('timeout'), 0);
Promise.resolve()
  .then(() => {
    console.log('then 1');
    setTimeout(() => console.log('timeout from then'), 0);
  })
  .then(() => console.log('then 2'));
queueMicrotask(() => console.log('microtask'));
```

<details>
<summary>Answer</summary>

```text
then 1
microtask
then 2
timeout
timeout from then
```

Microtasks run first: `then 1` (which schedules a **new** timer), then `microtask` (queued during the sync phase, after `then 1` was queued), then `then 2` (only queued once `then 1` finished). Timers run in the order they were scheduled: `timeout` was scheduled before `timeout from then`.

</details>

## 4. Two promise chains interleave

```js
Promise.resolve()
  .then(() => console.log('A1'))
  .then(() => console.log('A2'))
  .then(() => console.log('A3'));
Promise.resolve()
  .then(() => console.log('B1'))
  .then(() => console.log('B2'))
  .then(() => console.log('B3'));
```

<details>
<summary>Answer</summary>

```text
A1
B1
A2
B2
A3
B3
```

Each `.then` callback is queued only when the previous one **finishes**. So the two chains take turns, one step each: A1, B1, A2, B2, A3, B3. Many people expect A1 A2 A3 B1 B2 B3.

</details>

## 5. Returning a promise from `then` costs extra ticks

```js
Promise.resolve()
  .then(() => {
    console.log('A1');
    return Promise.resolve('x');
  })
  .then(() => console.log('A2'));
Promise.resolve()
  .then(() => console.log('B1'))
  .then(() => console.log('B2'))
  .then(() => console.log('B3'))
  .then(() => console.log('B4'));
```

<details>
<summary>Answer</summary>

```text
A1
B1
B2
B3
A2
B4
```

Returning a **promise** (not a plain value) from a `then` callback makes the outer promise *adopt* it. The spec does that with an extra job (`NewPromiseResolveThenableJob`) and one more `then`, which costs **two extra microtask ticks**. So `A2` runs after `B3`. This is a real source of ordering bugs in tests.

</details>

## 6. The executor runs synchronously

```js
new Promise((resolve) => {
  console.log('executor');
  resolve('done');
  console.log('after resolve');
}).then((v) => console.log(v));
console.log('sync');
```

<details>
<summary>Answer</summary>

```text
executor
after resolve
sync
done
```

The function you pass to `new Promise` runs **immediately**. `resolve()` doesn't stop it, so `after resolve` still prints. The `.then` callback is always asynchronous (a microtask), even if the promise is already resolved.

</details>

## 7. A promise settles only once

```js
const p = new Promise((resolve, reject) => {
  resolve(1);
  reject(new Error('ignored?'));
  resolve(2);
});
p.then((v) => console.log('value', v)).catch((e) => console.log('error', e.message));
```

<details>
<summary>Answer</summary>

```text
value 1
```

The first `resolve(1)` wins. Later `reject` and `resolve` calls are silently ignored. That's why `.catch` doesn't run.

</details>

## 8. `catch` recovers the chain; `finally` passes the value through

```js
Promise.reject(new Error('boom'))
  .then(() => console.log('then 1'))
  .catch((e) => {
    console.log('catch', e.message);
    return 'recovered';
  })
  .then((v) => console.log('then 2', v))
  .finally(() => console.log('finally'));
```

<details>
<summary>Answer</summary>

```text
catch boom
then 2 recovered
finally
```

The rejection skips `then 1` and goes to `catch`. A `catch` that returns a value **recovers**: the next `then` receives `'recovered'`. `finally` gets no arguments and runs last.

</details>

## 9. `return promise` vs `return await promise` inside try/catch

```js
async function f() {
  try {
    return Promise.reject(new Error('no await'));
  } catch {
    console.log('caught in f');
  }
}
async function g() {
  try {
    return await Promise.reject(new Error('with await'));
  } catch {
    console.log('caught in g');
  }
}
f().catch((e) => console.log('outside:', e.message));
g().then(() => console.log('g resolved'));
```

<details>
<summary>Answer</summary>

```text
caught in g
g resolved
outside: no await
```

In `f`, the rejected promise is returned **without** `await`, so the `try/catch` never sees the error: it escapes to the caller (`outside: no await`). In `g`, `await` throws inside the `try`, so `catch` handles it and `g` resolves. `outside:` prints last because `f`'s returned promise has to be adopted (extra ticks, see question 5). Lint rule: `@typescript-eslint/return-await` with `in-try-catch`.

</details>

## 10. Start in parallel, await in sequence

```js
const sleep = (ms, v) => new Promise((r) => setTimeout(() => { console.log('done', v); r(v); }, ms));
async function run() {
  const a = sleep(30, 'a');
  const b = sleep(10, 'b');
  console.log(await a, await b);
}
run();
```

<details>
<summary>Answer</summary>

```text
done b
done a
a b
```

Both timers start **before** the first `await`, so they run in parallel: `b` finishes at 10 ms, `a` at 30 ms. The total time is ~30 ms, not 40 ms. Compare with `await sleep(30); await sleep(10);`, which takes ~40 ms. `Promise.all` makes the intent clearer.

</details>

## 11. `var` vs `let` in loops (with async callbacks)

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var', i), 0);
}
for (let j = 0; j < 3; j++) {
  Promise.resolve().then(() => console.log('let', j));
}
```

<details>
<summary>Answer</summary>

```text
let 0
let 1
let 2
var 3
var 3
var 3
```

Microtasks before macrotasks, so all `let` lines print first. `let` creates a **new binding per iteration**, so each callback sees its own `j`. `var` has **one** function-scoped `i`, and by the time the timers run the loop has finished: `i` is `3`.

</details>

## 12. Putting it all together

```js
async function one() {
  console.log(1);
  await two();
  console.log(2);
}
async function two() {
  console.log(3);
}
setTimeout(() => console.log(4), 0);
one();
new Promise((r) => {
  console.log(5);
  r();
}).then(() => console.log(6));
console.log(7);
```

<details>
<summary>Answer</summary>

```text
1
3
5
7
2
6
4
```

Sync phase: `1`, then `two()` runs synchronously (`3`), then the executor (`5`), then `7`. Microtasks: the rest of `one` after `await` (`2`), then the `.then` (`6`). Macrotask: `4`. Note: `await two()` waits for an *already-resolved* promise from an async function, which takes one tick, so `2` comes before `6`.

</details>
