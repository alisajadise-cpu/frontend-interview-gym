import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { probe } from '../../shared/probe';

export type Order = { id: string; customer: string; amount: number };

/** Pretend this is expensive (tax rules per region, currency conversion, …). */
export function defaultComputeTax(order: Order): number {
  let x = 0;
  for (let i = 0; i < 2000; i++) x += Math.sqrt(i);
  return Math.round(order.amount * 0.09 * 100) / 100 + (x > 0 ? 0 : 1);
}

const money = (n: number, compact: boolean) => (compact ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

/** ONE resize listener for the whole table instead of one per row. */
function useIsCompact(breakpoint = 600) {
  const [compact, setCompact] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return compact;
  // Even better: window.matchMedia('(max-width: 599px)') fires only when the
  // breakpoint is crossed, not on every resize pixel. Or plain CSS media queries.
}

export function OrdersTable({
  orders,
  computeTax = defaultComputeTax,
}: {
  orders: Order[];
  computeTax?: (order: Order) => number;
}) {
  // A Set gives O(1) lookups; selected.includes() in a 10,000-row map is O(n²).
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const compact = useIsCompact();

  // The total depends on the orders, not on the selection.
  const total = useMemo(() => orders.reduce((sum, o) => sum + o.amount + computeTax(o), 0), [orders, computeTax]);

  // One stable callback for all rows: the row passes its own id.
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setSelected(new Set(orders.map((o) => o.id)))}>Select all</button>
        <button onClick={() => setSelected(new Set())}>Clear selection</button>
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
            <Row key={o.id} order={o} isSelected={selected.has(o.id)} compact={compact} onToggle={toggle} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <output aria-label="Summary">
                Selected: {selected.size} · Total incl. tax: ${total.toFixed(2)}
              </output>
            </td>
          </tr>
        </tfoot>
      </table>
      {/* 10,000 <tr> is still a lot of DOM: virtualize the tbody for the real app. */}
    </div>
  );
}

const Row = memo(function Row({
  order,
  isSelected,
  compact,
  onToggle,
}: {
  order: Order;
  isSelected: boolean;
  compact: boolean;
  onToggle: (id: string) => void;
}) {
  probe('Row');
  return (
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label={`Select order ${order.id}`}
          checked={isSelected}
          onChange={() => onToggle(order.id)}
        />
      </td>
      <td>{order.customer}</td>
      <td>{money(order.amount, compact)}</td>
    </tr>
  );
});
