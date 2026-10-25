import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { probeCount, resetProbes } from '../../shared/probe';
import { OrdersTable, type Order } from './index';

const ORDERS: Order[] = Array.from({ length: 20 }, (_, i) => ({
  id: `o${i + 1}`,
  customer: `Customer ${i + 1}`,
  amount: 10 + i + 0.5,
}));

const tax = (o: Order) => Math.round(o.amount * 10) / 100; // 10%
const summary = () => screen.getByRole('status', { name: 'Summary' });
const box = (id: string) => screen.getByRole('checkbox', { name: `Select order ${id}` });

describe('OrdersTable: correctness', () => {
  it('shows the total including tax', () => {
    render(<OrdersTable orders={ORDERS.slice(0, 2)} computeTax={tax} />);
    // 10.5 + 1.05 + 11.5 + 1.15 = 24.2
    expect(summary()).toHaveTextContent('Selected: 0 · Total incl. tax: $24.20');
  });

  it('toggles single rows', () => {
    render(<OrdersTable orders={ORDERS} computeTax={tax} />);
    fireEvent.click(box('o3'));
    fireEvent.click(box('o7'));
    expect(box('o3')).toBeChecked();
    expect(box('o7')).toBeChecked();
    expect(summary()).toHaveTextContent('Selected: 2');
    fireEvent.click(box('o3'));
    expect(box('o3')).not.toBeChecked();
    expect(summary()).toHaveTextContent('Selected: 1');
  });

  it('select all and clear selection', () => {
    render(<OrdersTable orders={ORDERS} computeTax={tax} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getAllByRole('checkbox').every((c) => (c as HTMLInputElement).checked)).toBe(true);
    expect(summary()).toHaveTextContent('Selected: 20');
    fireEvent.click(box('o5'));
    expect(summary()).toHaveTextContent('Selected: 19');
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(summary()).toHaveTextContent('Selected: 0');
    expect(screen.getAllByRole('checkbox').some((c) => (c as HTMLInputElement).checked)).toBe(false);
  });

  it('switches to compact amounts on small screens', () => {
    render(<OrdersTable orders={ORDERS.slice(0, 1)} computeTax={tax} />);
    expect(screen.getByRole('cell', { name: '$10.50' })).toBeInTheDocument();
    vi.stubGlobal('innerWidth', 500);
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('cell', { name: '$11' })).toBeInTheDocument();
  });
});

describe('OrdersTable: performance', () => {
  it('toggling one row re-renders at most that row', () => {
    render(<OrdersTable orders={ORDERS} computeTax={tax} />);
    resetProbes();
    fireEvent.click(box('o4'));
    expect(probeCount('Row')).toBeLessThanOrEqual(1);
  });

  it('does not recompute tax when the selection changes', () => {
    const computeTax = vi.fn(tax);
    render(<OrdersTable orders={ORDERS} computeTax={computeTax} />);
    expect(computeTax).toHaveBeenCalledTimes(20);
    computeTax.mockClear();
    fireEvent.click(box('o1'));
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(computeTax).not.toHaveBeenCalled();
  });

  it('uses at most one resize listener and removes it on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<OrdersTable orders={ORDERS} computeTax={tax} />);
    const added = add.mock.calls.filter((c: unknown[]) => c[0] === 'resize');
    expect(added.length).toBeLessThanOrEqual(1);
    unmount();
    const removed = remove.mock.calls.filter((c: unknown[]) => c[0] === 'resize');
    expect(removed).toHaveLength(added.length);
    expect(removed.map((c: unknown[]) => c[1])).toEqual(added.map((c: unknown[]) => c[1]));
  });
});
