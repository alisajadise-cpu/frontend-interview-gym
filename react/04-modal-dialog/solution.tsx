import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Module-level state shared by all modals: which ones are open (in order) and
// the body overflow value from before the FIRST modal opened.
const openStack: object[] = [];
let savedOverflow: string | null = null;

function lockScroll() {
  if (openStack.length === 1) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}
function unlockScroll() {
  if (openStack.length === 0 && savedOverflow !== null) {
    document.body.style.overflow = savedOverflow;
    savedOverflow = null;
  }
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[hidden], [inert]'));
}

export function Modal({ open, onClose, title, children, initialFocusRef }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const mouseDownOnBackdrop = useRef(false);

  // Read the latest onClose from listeners without re-subscribing every render.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const token = {};
    const previouslyFocused = document.activeElement as HTMLElement | null;

    openStack.push(token);
    lockScroll();

    const dialog = dialogRef.current!;
    const target = initialFocusRef?.current ?? getFocusable(dialog)[0] ?? dialog;
    target.focus();

    // On document, so Escape works even if focus escaped the dialog.
    // Only the top-most modal reacts.
    function onDocumentKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape' || openStack[openStack.length - 1] !== token) return;
      e.preventDefault();
      onCloseRef.current();
    }
    document.addEventListener('keydown', onDocumentKeyDown);

    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown);
      const index = openStack.indexOf(token);
      if (index !== -1) openStack.splice(index, 1);
      unlockScroll();
      // The trigger might have been removed from the page while we were open.
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
    };
    // initialFocusRef is read once on open on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current!;
    const items = getFocusable(dialog);
    if (items.length === 0) {
      e.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000 }}
      onMouseDown={(e) => {
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose();
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{ background: 'white', color: '#111', padding: 20, borderRadius: 12, minWidth: 320, maxWidth: '90vw' }}
      >
        <h2 id={titleId} style={{ marginTop: 0 }}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
