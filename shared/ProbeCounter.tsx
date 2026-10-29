import { useEffect, useState } from 'react';
import { probeCount, resetProbes } from './probe';

/**
 * Shows live render counts for the demos.
 * Its polling state lives here, not in the demo, so each update re-renders only this
 * component and never the exercise being measured.
 */
export function ProbeCounter({ names, interval = 300 }: { names: Record<string, string>; interval?: number }) {
  const read = () =>
    Object.entries(names)
      .map(([label, name]) => `${label}: ${probeCount(name)}`)
      .join(' · ');
  const [text, setText] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setText(read()), interval);
    return () => clearInterval(id);
    // `names` is a constant per demo, so the first one is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);
  return (
    <>
      {text} <button onClick={() => (resetProbes(), setText(read()))}>reset</button>
    </>
  );
}
