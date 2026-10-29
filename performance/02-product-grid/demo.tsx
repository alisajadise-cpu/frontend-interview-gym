import { useEffect, useMemo, useState } from 'react';
import { probeCount, resetProbes } from '../../shared/probe';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const WORDS = ['Red', 'Blue', 'Green', 'Vintage', 'Modern', 'Classic', 'Tiny', 'Giant', 'Silk', 'Oak'];
const THINGS = ['Lamp', 'Chair', 'Vase', 'Print', 'Rug', 'Mirror', 'Clock', 'Bowl', 'Frame', 'Shelf'];

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const products = useMemo(
    () =>
      Array.from({ length: 5000 }, (_, i) => ({
        id: `p${i}`,
        name: `${WORDS[i % 10]} ${THINGS[Math.floor(i / 10) % 10]} #${i}`,
        price: 5 + ((i * 37) % 500),
        rating: Math.round((3 + ((i * 7) % 20) / 10) * 10) / 10,
      })),
    [],
  );
  const [counts, setCounts] = useState('');
  useEffect(() => {
    const id = setInterval(() => setCounts(`ProductCard renders: ${probeCount('ProductCard')} · CartBadge renders: ${probeCount('CartBadge')}`), 300);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <p style={{ fontSize: 13 }}>
        {counts} <button onClick={resetProbes}>reset</button>
      </p>
      <ul style={{ fontSize: 13, color: 'gray', margin: '0 0 12px', paddingLeft: 18 }}>
        <li>
          <b>Coupon code</b> box: type anything (e.g. SAVE10). It only stores the text, it applies no discount. That's on purpose:
          typing in an unrelated box should <i>not</i> re-render 5,000 cards. Watch the ProductCard counter.
        </li>
        <li>
          <b>Quantity bug:</b> set quantity 5 on the first card, then change the sort. With <i>My code</i> the 5 stays in the first
          slot and moves to a different product.
        </li>
        <li>
          <b>Search</b> box: type fast and feel the lag.
        </li>
      </ul>
      <div style={{ maxHeight: 500, overflow: 'auto' }}>
        <impl.ProductGrid products={products} />
      </div>
    </div>
  );
}
