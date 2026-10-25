import { useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [concurrency, setConcurrency] = useState(3);
  const [duration, setDuration] = useState(2000);
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, fontSize: 14, marginBottom: 12 }}>
        <label>
          Concurrency{' '}
          <input type="number" min={1} max={10} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value) || 1)} style={{ width: 50 }} />
        </label>
        <label>
          Duration (ms){' '}
          <input type="number" min={200} step={100} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 2000)} style={{ width: 80 }} />
        </label>
      </div>
      <impl.ProgressBars durationMs={duration} concurrency={concurrency} />
    </div>
  );
}
