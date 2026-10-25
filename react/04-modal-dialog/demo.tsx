import { useRef, useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [form, setForm] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const { Modal } = impl;
  return (
    <div>
      <button onClick={() => setForm(true)}>Edit profile</button>
      <p style={{ color: 'gray', fontSize: 13 }}>Try Tab / Shift+Tab, Escape, clicking the backdrop, and the stacked confirm dialog.</p>
      {Array.from({ length: 30 }, (_, i) => (
        <p key={i}>Background paragraph {i + 1}. Scroll should be locked while a modal is open.</p>
      ))}
      <Modal open={form} onClose={() => setForm(false)} title="Edit profile" initialFocusRef={nameRef}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Name <input ref={nameRef} defaultValue="Ali" />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Email <input defaultValue="ali@example.com" />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setConfirm(true)}>Delete account</button>
          <button onClick={() => setForm(false)}>Save</button>
        </div>
      </Modal>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Are you sure?">
        <p>This cannot be undone.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setConfirm(false)}>Cancel</button>
          <button
            onClick={() => {
              setConfirm(false);
              setForm(false);
            }}
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
