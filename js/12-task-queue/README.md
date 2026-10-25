# 12 · Priority Task Queue (p-queue)

**Difficulty:** Hard · **Time:** 45 min · **Similar to:** `p-queue` (sindresorhus), GreatFrontEnd *Map Async Limit* follow-ups, LeetCode 2636 *Promise Pool*, upload managers in Google Drive and Dropbox

## Why companies ask this

Uploading 200 photos, prefetching images, syncing offline edits: you can't start everything at once (browsers allow about 6 connections per host, and servers rate-limit you). You need a queue with a **concurrency limit**, **priorities** (the image the user is looking at goes first), **pause/resume** (going offline), and **cancellation** (the user removed a file from the list). This is a real production component, and it tests promises, scheduling and careful bookkeeping.

## Task

Implement the `TaskQueue` class in `index.ts`.

```ts
const queue = new TaskQueue({ concurrency: 3 });

const result = await queue.add(() => upload(file));                      // priority 0
queue.add(() => upload(visibleFile), { priority: 10 });                 // jumps ahead
queue.add(() => upload(other), { signal: controller.signal });          // can be cancelled while waiting

queue.pause();                 // e.g. went offline: running tasks finish, no new ones start
queue.start();
await queue.onIdle();          // everything is done
```

## Requirements

1. `new TaskQueue({ concurrency })`. `concurrency` defaults to `Infinity` and must be `>= 1` (throw a `TypeError` otherwise). `autoStart` defaults to `true`. With `autoStart: false` the queue starts paused.
2. `add(task, { priority = 0, signal })` returns a promise that settles with the task's result or error. A task may be sync or async. A **sync throw** becomes a rejection.
3. At most `concurrency` tasks run at the same time. A task starts **synchronously inside `add`** if there is a free slot and the queue isn't paused.
4. Waiting tasks start by **higher priority first**, and in **FIFO** order for the same priority.
5. `pause()`: running tasks continue, no new task starts. `start()` resumes and fills the free slots. `isPaused` tells which state it's in.
6. `size` is the number of waiting tasks. `pending` is the number of running tasks.
7. `onEmpty()` resolves when no task is **waiting** (immediately if that's already true). `onIdle()` resolves when nothing is waiting **and** nothing is running.
8. Aborting the `signal` of a **waiting** task removes it from the queue and rejects its promise with a `DOMException` named `'AbortError'`. An already-aborted signal rejects right away without queueing. Aborting a task that is already **running** does nothing here (the task itself may listen to the signal).
9. A failing task does not stop the queue.
10. `clear()` drops all waiting tasks. Their promises are **not** rejected: they just never settle (same as p-queue). Write this down as a known trade-off.

## Edge cases interviewers probe

- `concurrency: 1` makes it a serial queue. Order must be exact.
- A task that adds another task while it is running.
- Priority: why is a plain binary heap **not** enough? (A heap isn't stable, so FIFO within the same priority breaks. Add a sequence number.)
- Memory: don't keep references to finished tasks.

## Follow-ups

- Rate limiting ("max 10 tasks per second") on top of concurrency (`interval` + `intervalCap` in p-queue).
- Per-task timeout, and retry with backoff (combine with `js/04-retry`).
- Should `clear()` reject the dropped promises instead? Who might be `await`-ing them?
- Change a task's priority after it was added (`setPriority(id, p)`).
- How would you show upload progress for the whole queue in a React UI?

## Run

```bash
npm test js/12-task-queue
npm run test:solution js/12-task-queue
```
