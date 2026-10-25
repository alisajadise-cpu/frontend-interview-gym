import { useEffect, useRef, useState } from 'react';

export type ProgressBarsProps = {
  durationMs?: number;
  concurrency?: number;
};

type Bar = { id: number; elapsed: number };

const TICK_MS = 50;

/** Returns the ids of the bars that are allowed to fill right now. */
function fillingIds(bars: Bar[], durationMs: number, concurrency: number): Set<number> {
  const ids = new Set<number>();
  for (const bar of bars) {
    if (ids.size >= concurrency) break;
    if (bar.elapsed < durationMs) ids.add(bar.id);
  }
  return ids;
}

export function ProgressBars({ durationMs = 2000, concurrency = 3 }: ProgressBarsProps) {
  const [bars, setBars] = useState<Bar[]>([]);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(0);

  const hasWork = bars.some((b) => b.elapsed < durationMs);
  const running = hasWork && !paused;

  // One interval for the whole component, alive only while something is filling.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      // Functional update: always works on the latest bars (no stale closure).
      setBars((prev) => {
        const filling = fillingIds(prev, durationMs, concurrency);
        return prev.map((b) => (filling.has(b.id) ? { ...b, elapsed: Math.min(durationMs, b.elapsed + TICK_MS) } : b));
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, durationMs, concurrency]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setBars((prev) => [...prev, { id: nextId.current++, elapsed: 0 }])}>
          Add
        </button>
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={() => {
            setBars([]);
            setPaused(false);
          }}
        >
          Reset
        </button>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {bars.map((bar) => {
          const percent = Math.round((bar.elapsed / durationMs) * 100);
          return (
            <div
              key={bar.id}
              role="progressbar"
              aria-label={`Bar ${bar.id + 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              style={{ height: 12, background: 'rgba(128,128,128,0.2)', borderRadius: 6, overflow: 'hidden' }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#3b5bdb',
                  // transform is compositor-only: no layout work per tick.
                  transform: `scaleX(${percent / 100})`,
                  transformOrigin: 'left',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
