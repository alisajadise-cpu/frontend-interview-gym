# 09 · Typed Event Emitter (safe during emit)

**Difficulty:** Hard · **Time:** 30–40 min · **Similar to:** GreatFrontEnd *Event Emitter* and *Event Emitter II*, Node.js `EventEmitter`, `mitt`

## Why companies ask this

Event emitters are everywhere: WebSocket clients, design-system components, analytics, plugin systems. The happy path is easy. The senior part is **what happens while `emit` is running**: a listener that unsubscribes itself, a listener that adds another listener, and a listener that throws. Bugs here cause "random" skipped handlers in production.

## Task

Implement `EventEmitter` in `index.ts`.

```ts
type Events = { message: [text: string, from: string]; close: [] };

const chat = new EventEmitter<Events>();
const off = chat.on('message', (text, from) => console.log(from, text)); // typed args
chat.once('close', () => console.log('bye'));
chat.emit('message', 'hi', 'ali'); // true (there were listeners)
off();
```

## Requirements

1. `on(event, listener)` registers a listener and returns an **unsubscribe** function. Calling it twice is safe.
2. The same function can be registered more than once. It then runs once per registration.
3. `once(event, listener)` runs at most once, then removes itself. It also returns an unsubscribe function.
4. `off(event, listener)` removes **one** registration of that listener (the earliest one). This also works for listeners added with `once`.
5. `emit(event, ...args)` calls listeners in registration order with the args. It returns `true` if there were listeners, `false` otherwise.
6. Listeners **added during** an `emit` do not run in that same `emit`.
7. Listeners **removed during** an `emit`, before their turn, do **not** run.
8. If listeners throw, the other listeners still run. After all of them ran: one error is rethrown as-is. Two or more errors are thrown as one `AggregateError` (with `.errors`).
9. `listenerCount(event)` returns the number of registrations.
10. `removeAllListeners(event?)` removes the listeners of one event, or of all events.

## Edge cases interviewers probe

- `once` listener that calls `emit` for the same event again (recursion): it must not run twice.
- Unsubscribing listener #2 from inside listener #1.
- Why not just iterate the live array? (Index shifting skips the next listener.)
- Why not `[...listeners]` alone? (Then requirement 7 breaks: removed listeners still run.)

## Follow-ups

- Memory leaks: why does Node warn after 10 listeners (`setMaxListeners`)?
- How would you add wildcard events (`'*'`) or namespaces (`'user:*'`)?
- Typed events with `keyof Events` vs a string union — what does each give you?
- Sync vs async emit. When would you queue listeners in a microtask?

## Run

```bash
npm test js/09-event-emitter
npm run test:solution js/09-event-emitter
```
