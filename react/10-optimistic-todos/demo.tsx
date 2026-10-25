import { useMemo, useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [failRate, setFailRate] = useState(0.3);
  const [latency, setLatency] = useState(1500);
  const settings = useMemo(() => ({ failRate, latency }), [failRate, latency]);

  // The fake server keeps its own copy of the data.
  const api = useMemo<Mod.TodoApi>(() => {
    let db: Mod.Todo[] = [
      { id: '1', title: 'Review pull request', done: false },
      { id: '2', title: 'Write tests', done: true },
      { id: '3', title: 'Deploy to staging', done: false },
    ];
    let next = 4;
    const respond = <T,>(fn: () => T) =>
      new Promise<T>((resolve, reject) =>
        setTimeout(() => (Math.random() < settings.failRate ? reject(new Error('500')) : resolve(fn())), settings.latency * (0.5 + Math.random())),
      );
    return {
      list: () => new Promise((r) => setTimeout(() => r(db), 500)),
      create: (title) =>
        respond(() => {
          const t = { id: String(next++), title, done: false };
          db = [...db, t];
          return t;
        }),
      toggle: (id, done) =>
        respond(() => {
          db = db.map((t) => (t.id === id ? { ...t, done } : t));
          return db.find((t) => t.id === id)!;
        }),
      remove: (id) =>
        respond(() => {
          db = db.filter((t) => t.id !== id);
        }),
    };
  }, [settings]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, fontSize: 14, flexWrap: 'wrap' }}>
        <label>
          Failure rate {Math.round(failRate * 100)}%{' '}
          <input type="range" min={0} max={1} step={0.1} value={failRate} onChange={(e) => setFailRate(Number(e.target.value))} />
        </label>
        <label>
          Latency {latency}ms{' '}
          <input type="range" min={200} max={4000} step={100} value={latency} onChange={(e) => setLatency(Number(e.target.value))} />
        </label>
      </div>
      <impl.TodoApp key={`${failRate}-${latency}`} api={api} />
      <p style={{ color: 'gray', fontSize: 13 }}>Click many things quickly. Failed actions roll back one by one; successful ones stay.</p>
    </div>
  );
}
