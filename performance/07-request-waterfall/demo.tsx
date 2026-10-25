import { useMemo, useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

type LogLine = { name: string; start: number; end?: number };

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [userId, setUserId] = useState('u1');
  const [run, setRun] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [, setTick] = useState(0);

  const api = useMemo<Mod.ProfileApi>(() => {
    const t0 = performance.now();
    const track = <T,>(name: string, value: T, ms = 400): Promise<T> => {
      const line: LogLine = { name, start: Math.round(performance.now() - t0) };
      setLog((l) => [...l, line]);
      return new Promise((resolve) =>
        setTimeout(() => {
          line.end = Math.round(performance.now() - t0);
          setTick((x) => x + 1);
          resolve(value);
        }, ms),
      );
    };
    const posts = (uid: string) => Array.from({ length: 6 }, (_, i) => ({ id: `${uid}-p${i}`, title: `Post ${i + 1} by ${uid}` }));
    return {
      getUser: (id) => track(`getUser(${id})`, { id, name: id === 'u1' ? 'Ada Lovelace' : 'Bob Kahn' }),
      getPosts: (uid) => track(`getPosts(${uid})`, posts(uid)),
      getCommentCount: (pid) => track(`getCommentCount(${pid})`, pid.length % 7),
      getCommentCounts: (ids) => track(`getCommentCounts(${ids.length} ids)`, Object.fromEntries(ids.map((id) => [id, id.length % 7]))),
    };
  }, [run]);

  const total = Math.max(0, ...log.map((l) => l.end ?? 0));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16 }}>
      <div>
        <p style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setLog([]); setRun((r) => r + 1); }}>Reload (fresh network log)</button>
          <button onClick={() => setUserId((u) => (u === 'u1' ? 'u2' : 'u1'))}>Switch user</button>
        </p>
        <impl.ProfilePage key={run} userId={userId} api={api} />
      </div>
      <div style={{ fontSize: 12 }}>
        <strong>
          Network: {log.length} requests, done at {total} ms
        </strong>
        {log.map((l, i) => (
          <div key={i} style={{ position: 'relative', height: 16, marginTop: 2 }}>
            <div
              style={{
                position: 'absolute',
                left: `${(l.start / Math.max(total, 1)) * 60}%`,
                width: `${(((l.end ?? total) - l.start) / Math.max(total, 1)) * 60}%`,
                minWidth: 2,
                height: 12,
                background: '#8ea2ff',
              }}
            />
            <span style={{ position: 'absolute', left: '62%', whiteSpace: 'nowrap' }}>{l.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
