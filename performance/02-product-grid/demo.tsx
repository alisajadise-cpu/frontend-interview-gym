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
      <p style={{ fontSize: 13, color: 'gray' }}>
        Try: type in "Coupon code", set a quantity then change the sort, type fast in search.
      </p>
      <div style={{ maxHeight: 500, overflow: 'auto' }}>
        <impl.ProductGrid products={products} />
      </div>
    </div>
  );
}
