# 04 · Accessible Modal Dialog (focus trap, stacking, scroll lock)

**Difficulty:** Hard · **Time:** 45–60 min · **Similar to:** GreatFrontEnd *Modal Dialog I–IV*, WAI-ARIA APG "Dialog (Modal)" pattern, Radix/Headless UI `Dialog`

## Why companies ask this

A modal looks like a `div` with `position: fixed`. A *correct* modal is one of the hardest small components: portals, focus management, keyboard trapping, restoring focus, scroll locking, and stacked modals. Big companies (Google, Meta, Airbnb, Atlassian) ask it because accessibility bugs here block keyboard and screen-reader users completely.

## Task

Build `<Modal />` in `index.tsx`.

```tsx
const [open, setOpen] = useState(false);
const nameRef = useRef<HTMLInputElement>(null);

<button onClick={() => setOpen(true)}>Edit profile</button>
<Modal open={open} onClose={() => setOpen(false)} title="Edit profile" initialFocusRef={nameRef}>
  <input ref={nameRef} aria-label="Name" />
  <button onClick={() => setOpen(false)}>Save</button>
</Modal>
```

## Requirements

**Structure**
1. When `open` is false, render nothing.
2. Render through a **portal** into `document.body`. The structure is a backdrop element whose **direct child** is the dialog element.
3. The dialog has `role="dialog"`, `aria-modal="true"`, `tabIndex={-1}`, and `aria-labelledby` pointing at a heading that shows `title`.

**Focus**
4. On open, focus `initialFocusRef.current` if given. Otherwise focus the first focusable element inside the dialog. If there is none, focus the dialog itself.
5. `Tab` on the **last** focusable element moves focus to the **first**. `Shift+Tab` on the first (or on the dialog itself) moves to the last. Handle this with a `keydown` listener on the dialog.
6. On close (`open` becomes false, or unmount), give focus back to the element that had focus before the modal opened.

**Closing**
7. `Escape` calls `onClose`.
8. Clicking the backdrop calls `onClose`. Clicking inside the dialog does **not**.
9. If the mouse was pressed **inside** the dialog and released on the backdrop (for example while selecting text), do **not** close. Only close when both `mousedown` and `click` happen on the backdrop itself.

**Scroll lock**
10. While open, set `document.body.style.overflow = 'hidden'`. When closed, restore the **previous** value (not just `''`).

**Stacking**
11. Two modals can be open at once (a confirm dialog on top of a form dialog). `Escape` closes **only the top** one.
12. The scroll lock is released only when the **last** open modal closes.

## Edge cases interviewers probe

- Why a portal? `overflow: hidden`, `transform`, or `z-index` on an ancestor can clip or hide the modal.
- Where does `Escape` go if focus somehow left the dialog? (Listen on `document`, not only on the dialog.)
- Focusable elements that are `disabled`, `tabindex="-1"`, or hidden.
- The element that opened the modal is removed while the modal is open. Don't crash when restoring focus.
- React StrictMode runs effects twice. Does your stack or scroll-lock counter survive that?

## Follow-ups

- The native `<dialog>` element with `showModal()`: what does it give you for free (top layer, `inert` background, Escape)? What's still missing?
- `inert` on the rest of the page vs a JS focus trap.
- Animating open/close without breaking focus restore (mount during the exit animation).
- Scroll lock on iOS Safari: `overflow: hidden` on body isn't enough. Mention `position: fixed` + saving the scroll position, and `scrollbar-gutter: stable` to avoid layout shift.

## Run

```bash
npm test react/04-modal-dialog
npm run test:solution react/04-modal-dialog
npm run dev   # then open "react / 04-modal-dialog"
```
