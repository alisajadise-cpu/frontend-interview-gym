import { memo, useEffect, useState } from 'react';
import { probe } from '../../shared/probe';

export type Order = { id: string; customer: string; amount: number };

/** Pretend this is expensive (tax rules per region, currency conversion, …). */
export function defaultComputeTax(order: Order): number {
  let x = 0;
  for (let i = 0; i < 2000; i++) x += Math.sqrt(i);
  return Math.round(order.amount * 0.09 * 100) / 100 + (x > 0 ? 0 : 1);
}

const money = (n: number, compact: boolean) => (compact ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

// ⚠️ Production code with performance problems and a leak. Review it, then fix it.

export function OrdersTable({
  orders,
  computeTax = defaultComputeTax,
}: {
  orders: Order[];
  computeTax?: (order: Order) => number;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const total = orders.reduce((sum, o) => sum + o.amount + computeTax(o), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setSelected(orders.map((o) => o.id))}>Select all</button>
        <button onClick={() => setSelected([])}>Clear selection</button>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">Select</th>
            <th scope="col">Customer</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <Row
              key={o.id}
              order={o}
              isSelected={selected.includes(o.id)}
              onToggle={() =>
                setSelected((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]))
              }
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <output aria-label="Summary">
                Selected: {selected.length} · Total incl. tax: ${total.toFixed(2)}
              </output>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const Row = memo(function Row({
  order,
  isSelected,
  onToggle,
}: {
  order: Order;
  isSelected: boolean;
  onToggle: () => void;
}) {
  probe('Row');
  const [compact, setCompact] = useState(window.innerWidth < 600);

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 600);
    window.addEventListener('resize', onResize);
  }, []);

  return (
    <tr>
      <td>
        <input type="checkbox" aria-label={`Select order ${order.id}`} checked={isSelected} onChange={onToggle} />
      </td>
      <td>{order.customer}</td>
      <td>{money(order.amount, compact)}</td>
    </tr>
  );
});
