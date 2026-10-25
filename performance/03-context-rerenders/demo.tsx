import { useEffect, useState } from 'react';
import { probeCount, resetProbes } from '../../shared/probe';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [counts, setCounts] = useState('');
  useEffect(() => {
    const id = setInterval(
      () =>
        setCounts(
          `ThemedButton renders: ${probeCount('ThemedButton')} · Clock: ${probeCount('Clock')} · UserBadge: ${probeCount('UserBadge')}`,
        ),
      500,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <p style={{ fontSize: 13 }}>
        {counts} <button onClick={resetProbes}>reset</button>
      </p>
      <impl.AppProvider>
        <impl.Dashboard buttonCount={200} />
      </impl.AppProvider>
    </div>
  );
}
