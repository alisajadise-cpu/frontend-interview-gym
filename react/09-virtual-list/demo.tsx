import { useRef, useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const ITEMS = Array.from({ length: 100_000 }, (_, i) => ({ id: i, title: `Order #${100000 + i}`, total: ((i * 7919) % 50000) / 100 }));

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const ref = useRef<Mod.VirtualListHandle>(null);
  const [index, setIndex] = useState(5000);
  const [align, setAlign] = useState<Mod.ScrollAlign>('center');
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input aria-label="Index" type="number" value={index} onChange={(e) => setIndex(Number(e.target.value))} style={{ width: 100 }} />
        <select aria-label="Align" value={align} onChange={(e) => setAlign(e.target.value as Mod.ScrollAlign)}>
          {['auto', 'start', 'center', 'end'].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button onClick={() => ref.current?.scrollToIndex(index, align)}>scrollToIndex</button>
        <span style={{ color: 'gray', fontSize: 13 }}>100,000 rows. Open Elements panel: only ~20 rows exist.</span>
      </div>
      <impl.VirtualList
        ref={ref}
        aria-label="Orders"
        items={ITEMS}
        height={360}
        itemHeight={36}
        getKey={(o) => o.id}
        renderItem={(o, i) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eee', background: i % 2 ? 'transparent' : 'rgba(0,0,0,0.03)' }}>
            <span>{o.title}</span>
            <span>${o.total.toFixed(2)}</span>
          </div>
        )}
      />
    </div>
  );
}
