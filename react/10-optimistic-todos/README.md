# 10 · Optimistic todos with correct rollback

**Difficulty:** Hard · **Time:** 60 min · **Similar to:** the React 19 `useOptimistic` docs, the TanStack Query guide on optimistic updates, how Linear/Notion/Trello feel instant

## Why companies ask this

Users expect clicks to feel instant, so good apps update the UI **before** the server answers, and undo the change if the request fails. The easy version (save a copy, restore it on error) is **wrong** when several requests are in flight: restoring an old snapshot also throws away *other* changes that succeeded in the meantime. Senior interviews are about getting this right.

## Task

Build `<TodoApp api={api} />` in `index.tsx`.

```ts
type TodoApi = {
  list(): Promise<Todo[]>;
  create(title: string): Promise<Todo>;            // returns the todo with its server id
  toggle(id: string, done: boolean): Promise<Todo>;
  remove(id: string): Promise<void>;
};
```

## Requirements

**Loading**
1. Call `api.list()` on mount. Show `Loading…` until it resolves.

**UI contract (the tests use these)**
2. A text input labelled `New todo` and a submit button `Add` inside a `<form>`.
3. Each todo is an `<li>` with a checkbox whose accessible name is the todo title (wrap it in a `<label>`), and a button with `aria-label="Delete <title>"`.
4. Errors show in an element with `role="alert"`: `Could not add "<title>"`, `Could not update "<title>"`, or `Could not delete "<title>"`.

**Optimistic behaviour**
5. **Create:** trim the title and ignore empty ones. Clear the input and show the new todo at the end **immediately**, with a temporary id. When the server answers, use the server's id for later requests.
6. While a todo is still being created, its checkbox and delete button are **disabled** (there's no server id yet).
7. **Toggle** and **delete** update the UI immediately.
8. If a request fails, roll back **only that change** and show the alert.
   - A failed delete puts the todo back **in its original position**.
   - A failed create removes the temporary todo and puts the title back in the input, unless the user has already typed something new there.
9. **Concurrent requests:** a failure must never undo a different change that succeeded meanwhile. Example: toggle A (fails later) and toggle B (succeeds first) → A is rolled back, B stays checked.
10. Two quick toggles of the same todo end in the state the server returned last.

## Hint (read only if stuck)

<details><summary>The model that makes this easy</summary>

Don't store "the list". Store **confirmed server state** plus a **list of pending operations**. The screen shows `confirmed` with every pending op applied in order. On success: update `confirmed` and remove the op. On failure: just remove the op. A failed op can't undo anything else, because nothing else was ever stored inside it. React 19's `useOptimistic` is built on the same idea.
</details>

## Edge cases interviewers probe

- Why is "copy the list before, restore it on error" wrong? Write down a timeline that breaks it.
- Between "toggle #2 succeeded" and "toggle #1 failed", what does the user see for a moment? How would you avoid it? (Drop older pending ops for the same field once a newer one is confirmed.)
- What if the user deletes a todo that is still being created?
- Should the delete button be disabled while a toggle is pending?

## Follow-ups

- Rewrite it with React 19 `useOptimistic` + `startTransition`. What does `useOptimistic` do when the transition ends?
- With TanStack Query: `onMutate` (snapshot + optimistic update), `onError` (rollback), `onSettled` (invalidate). Where does the snapshot approach break, and why does TanStack recommend `invalidateQueries` in `onSettled`?
- Server ordering: two toggles can reach the server in the opposite order. How do you make the server win correctly? (Versions / `updatedAt`, or a per-item request queue.)
- Offline support: persisting the op queue and replaying it later. Conflicts?

## Run

```bash
npm test react/10-optimistic-todos
npm run test:solution react/10-optimistic-todos
npm run dev   # then open "react / 10-optimistic-todos"
```
