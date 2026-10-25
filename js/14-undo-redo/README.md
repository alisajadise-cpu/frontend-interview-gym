# 14 · Undo / Redo History (with coalescing and batching)

**Difficulty:** Hard · **Time:** 40 min · **Similar to:** GreatFrontEnd *Undo / Redo Manager* (I and II), *Undoable Counter*. Used in Figma, Google Docs, VS Code, every form builder.

## Why companies ask this

Undo looks like "two stacks". Real editors need more:
- **Coalescing:** typing "hello" is **one** undo step, not five.
- **Batching:** "align 20 shapes" is one step, even though it sets 20 values.
- A **limit**, so memory doesn't grow forever.
- Clear rules for what happens to the redo stack.

Interviewers use this to see whether you can turn fuzzy product rules into a precise state machine.

## Task

Implement `createHistory(initial, options)` in `index.ts`.

```ts
const h = createHistory({ title: '' }, { limit: 100, coalesceMs: 500 });

h.set({ title: 'H' }, { coalesceKey: 'title' });
h.set({ title: 'He' }, { coalesceKey: 'title' });   // within 500ms → same undo step
h.batch(() => {
  h.set({ title: 'Hello' });
  h.set({ title: 'Hello!' });                        // one step for the whole batch
});
h.undo();          // { title: 'He' }
h.undo();          // { title: '' }
h.redo();          // { title: 'He' }
```

## Requirements

1. `get()` returns the current value.
2. `set(next)` makes `next` current and creates an undo step. Setting the **same** value (`Object.is`) does nothing: no step, no notification.
3. Any `set` after an `undo` **clears the redo stack**.
4. **Coalescing:** if `set` gets a `coalesceKey` that equals the previous step's key, and less than `coalesceMs` ms passed since the previous `set` (use `Date.now()`), the change **merges** into the previous step instead of creating a new one. The window **slides**: each merged set restarts it. `coalesceMs: 0` (the default) never merges. `undo`/`redo` end the current merge group.
5. `undo()` / `redo()` move one step and return `true`. If there's nothing to undo/redo, they return `false` and change nothing.
6. `canUndo()` / `canRedo()`.
7. `batch(fn)`: all sets inside `fn` become **one** step (or none, if the value didn't change). Listeners are notified **once**, at the end. Nested `batch` calls join the outer batch. Calling `undo`/`redo` inside a batch throws an `Error`. If `fn` throws, the batch still ends (use `finally`) and the error propagates.
8. `limit` (default `100`) is the maximum number of undo steps. The oldest steps are dropped.
9. `subscribe(listener)` calls `listener(value)` after every change (`set`, `undo`, `redo`, end of batch). It returns an unsubscribe function.

## Edge cases interviewers probe

- Typing, pause 2 seconds, typing again: that's two steps.
- Typing in the title, then typing in the description: different keys, so two steps even if quick.
- Undo while a coalescing group is "open", then type again: a new step, and redo is cleared.
- What do you store: full snapshots or patches/commands? (See follow-ups.)

## Follow-ups

- Snapshots vs the **command pattern** (`do`/`undo` functions) vs **patches** (Immer's `produceWithPatches`, see `js/15`). Memory and complexity trade-offs.
- Collaborative editing: why is global undo wrong when two users edit? (Each user undoes only **their own** changes. This is hard. CRDTs like Yjs have an `UndoManager` that tracks origins.)
- Persisting history across reloads.
- Keyboard: `Cmd/Ctrl+Z`, `Cmd+Shift+Z` and `Ctrl+Y`. And why you must not hijack them inside a text input that has its own native undo.

## Run

```bash
npm test js/14-undo-redo
npm run test:solution js/14-undo-redo
```
