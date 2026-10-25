import { useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

let requests = 0;

function fakeFetchUser(id: number) {
  return (signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      requests++;
      const t = setTimeout(() => resolve(`User #${id} (loaded at ${new Date().toLocaleTimeString()})`), 800);
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
}

function Card({ impl, id, label }: { impl: typeof Mod; id: number; label: string }) {
  const q = impl.useQuery(`user-${id}`, fakeFetchUser(id), { staleTime: 5000 });
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
      <b>{label}</b>
      <div>status: {q.status}{q.isFetching ? ' · fetching…' : ''}</div>
      <div>{q.data ?? '—'}</div>
      <button onClick={q.refetch}>Refetch</button>
    </div>
  );
}

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [id, setId] = useState(1);
  const [showSecond, setShowSecond] = useState(true);
  const [, force] = useState(0);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setId((i) => i + 1)}>Next user (id {id})</button>
        <button onClick={() => setId((i) => Math.max(1, i - 1))}>Previous user</button>
        <button onClick={() => setShowSecond((s) => !s)}>{showSecond ? 'Unmount' : 'Mount'} second card</button>
        <button onClick={() => force((n) => n + 1)}>Requests so far: {requests}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card impl={impl} id={id} label="Card A" />
        {showSecond ? <Card impl={impl} id={id} label="Card B (same key)" /> : null}
      </div>
      <p style={{ color: 'gray', fontSize: 13 }}>
        Both cards share one request. Data is fresh for 5s: going back to a user within 5s shows it with no request.
      </p>
    </div>
  );
}
