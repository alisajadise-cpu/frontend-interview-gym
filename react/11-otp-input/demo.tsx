import { useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0 }}>Enter the 6-digit code we sent to your phone. Try pasting "12 34-56" or "987654".</p>
      <impl.OtpInput length={6} onComplete={(code) => setLog((l) => [`onComplete("${code}")`, ...l].slice(0, 8))} />
      <pre style={{ fontSize: 12, margin: 0 }}>{log.join('\n') || 'onComplete calls appear here'}</pre>
    </div>
  );
}
