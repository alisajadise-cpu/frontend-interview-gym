import { useEffect, useMemo, useRef, useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const REPLY = 'Streaming works, but look closely: some words go missing when a network chunk ends in the middle of a JSON line.';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [online, setOnline] = useState(true);
  const [subscriptions, setSubscriptions] = useState(0);
  // Counted in a ref and shown twice a second. Calling setState from subscribeStatus
  // would re-render the buggy component, which re-subscribes, forever.
  const subscribeCalls = useRef(0);
  useEffect(() => {
    const id = setInterval(() => setSubscriptions(subscribeCalls.current), 500);
    return () => clearInterval(id);
  }, []);

  const transport = useMemo<Mod.Transport>(() => {
    const listeners = new Set<(v: boolean) => void>();
    (window as unknown as { __setOnline?: (v: boolean) => void }).__setOnline = (v) => listeners.forEach((l) => l(v));
    return {
      async *stream(_history, options) {
        // NDJSON for the whole reply, then cut into random-sized chunks (like TCP does).
        const ndjson = REPLY.split(/(\s+)/)
          .map((w) => JSON.stringify({ delta: w }) + '\n')
          .join('');
        let i = 0;
        while (i < ndjson.length) {
          if (options?.signal?.aborted) return;
          const size = 5 + Math.floor(Math.random() * 25);
          await new Promise((r) => setTimeout(r, 40));
          yield ndjson.slice(i, i + size);
          i += size;
        }
      },
      subscribeStatus(listener) {
        subscribeCalls.current++;
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }, []);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 13, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={() => {
            const next = !online;
            setOnline(next);
            (window as unknown as { __setOnline?: (v: boolean) => void }).__setOnline?.(next);
          }}
        >
          Go {online ? 'offline' : 'online'}
        </button>
        <span>
          subscribeStatus calls: <b>{subscriptions}</b>
        </span>
      </div>
      <impl.ChatPanel transport={transport} />
    </div>
  );
}
