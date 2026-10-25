import { useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './index';

afterEach(() => {
  document.body.style.overflow = '';
});

function Harness({ onClose = () => {}, withInitial = false, empty = false }: { onClose?: () => void; withInitial?: boolean; empty?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        open={open}
        title="Edit profile"
        initialFocusRef={withInitial ? ref : undefined}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        {empty ? (
          <p>Nothing to focus here.</p>
        ) : (
          <>
            <button>First</button>
            <input ref={ref} aria-label="Name" />
            <button disabled>Disabled</button>
            <button onClick={() => setOpen(false)}>Last</button>
          </>
        )}
      </Modal>
    </div>
  );
}

function openModal(props: Parameters<typeof Harness>[0] = {}) {
  const utils = render(<Harness {...props} />);
  const trigger = screen.getByRole('button', { name: 'Open' });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return { ...utils, trigger, dialog: screen.getByRole('dialog', { name: 'Edit profile' }) };
}

describe('Modal: structure', () => {
  it('renders nothing when closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog rendered in a portal on document.body', () => {
    const { dialog, container } = openModal();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement!.parentElement).toBe(document.body);
  });
});

describe('Modal: focus', () => {
  it('focuses the first focusable element on open', () => {
    openModal();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('focuses initialFocusRef when given', () => {
    openModal({ withInitial: true });
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('focuses the dialog itself when nothing inside is focusable', () => {
    const { dialog } = openModal({ empty: true });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('Tab on the last element wraps to the first, Shift+Tab on the first wraps to the last', () => {
    const { dialog } = openModal();
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    act(() => last.focus());
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    act(() => dialog.focus());
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('restores focus to the trigger on close', () => {
    const { trigger } = openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Last' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe('Modal: closing', () => {
  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    openModal({ onClose });
    fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking the backdrop closes, clicking inside does not', () => {
    const onClose = vi.fn();
    const { dialog } = openModal({ onClose });
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the press started inside the dialog', () => {
    const onClose = vi.fn();
    const { dialog } = openModal({ onClose });
    fireEvent.mouseDown(screen.getByRole('textbox', { name: 'Name' }));
    fireEvent.click(dialog.parentElement!);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Modal: scroll lock and stacking', () => {
  it('locks body scroll and restores the previous value', () => {
    document.body.style.overflow = 'scroll';
    openModal();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('Escape closes only the top modal; scroll lock is released after the last one', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    function Stacked() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(false);
      return (
        <>
          <Modal open={a} title="Form" onClose={() => (closeA(), setA(false))}>
            <button onClick={() => setB(true)}>Delete</button>
          </Modal>
          <Modal open={b} title="Are you sure?" onClose={() => (closeB(), setB(false))}>
            <button>Yes</button>
          </Modal>
        </>
      );
    }
    render(<Stacked />);
    const del = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(del);
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Yes' }), { key: 'Escape' });
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Form' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(del).toHaveFocus();

    fireEvent.keyDown(del, { key: 'Escape' });
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('cleans up on unmount while open', () => {
    const { unmount, trigger } = openModal();
    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(trigger.isConnected).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
