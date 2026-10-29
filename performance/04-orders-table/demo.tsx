import { useMemo, useState } from 'react';
import { ProbeCounter } from '../../shared/ProbeCounter';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [size, setSize] = useState(2000);
  const orders = useMemo(
    () => Array.from({ length: size }, (_, i) => ({ id: `${i + 1}`, customer: `Customer ${i + 1}`, amount: 20 + ((i * 13) % 300) + 0.99 })),
    [size],
  );
  return (
    <div>
      <p style={{ fontSize: 13 }}>
        <label>
          Rows{' '}
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[200, 2000, 10000].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>{' '}
        · <ProbeCounter names={{ 'Row renders': 'Row' }} /> · Click a checkbox and watch the counter. Resize the window
        a few times, then switch exercises and check the listener count in DevTools (getEventListeners(window)).
      </p>
      <div style={{ maxHeight: 480, overflow: 'auto' }}>
        <impl.OrdersTable orders={orders} />
      </div>
    </div>
  );
}
