import { useMemo, useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [log, setLog] = useState<string[]>([]);
  const [failNext, setFailNext] = useState(false);
  const flags = useMemo(() => ({ failNext: false }), []);
  flags.failNext = failNext;

  const fetchPage = (cursor: string | null, signal: AbortSignal) =>
    new Promise<Mod.FeedPage>((resolve, reject) => {
      const start = cursor ? Number(cursor) : 0;
      setLog((l) => [`→ cursor=${cursor ?? 'null'}`, ...l].slice(0, 15));
      const t = setTimeout(() => {
        if (flags.failNext) {
          setFailNext(false);
          reject(new Error('503'));
          return;
        }
        // Overlap by 2 items on purpose: as if new posts were inserted on the server.
        const from = Math.max(0, start - 2);
        const items = Array.from({ length: 10 }, (_, i) => ({ id: `p${from + i}`, title: `Post #${from + i + 1}` }));
        resolve({ items, nextCursor: start + 8 >= 60 ? null : String(start + 8) });
      }, 700);
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: 16 }}>
      <div style={{ height: 420, overflow: 'auto', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '0 12px' }}>
        <impl.InfiniteFeed fetchPage={fetchPage} />
      </div>
      <div>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} /> Fail next request
        </label>
        <pre style={{ fontSize: 12 }}>{log.join('\n')}</pre>
      </div>
    </div>
  );
}
