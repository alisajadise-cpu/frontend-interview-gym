import { useMemo } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

type Order = { id: string; customer: string; city: string; total: number; status: string };

const CUSTOMERS = ['Sara Ahmadi', 'Reza Karimi', 'Mina Rahimi', 'Omid Hosseini', 'Leila Moradi', 'Kian Jafari', 'Élodie Martin', 'Zoë Brown'];
const CITIES = ['Tehran', 'Isfahan', 'Shiraz', 'Tabriz', 'Mashhad', 'Berlin'];
const STATUS = ['paid', 'pending', 'refunded', 'shipped'];

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const rows = useMemo<Order[]>(
    () =>
      Array.from({ length: 137 }, (_, i) => ({
        id: `ord-${1000 + i}`,
        customer: CUSTOMERS[(i * 7) % CUSTOMERS.length],
        city: CITIES[(i * 5) % CITIES.length],
        total: Math.round(((i * 7919) % 5000) + 9.99),
        status: STATUS[i % STATUS.length],
      })),
    [],
  );
  return (
    <impl.DataTable<Order>
      rows={rows}
      getRowId={(r) => r.id}
      pageSizeOptions={[10, 25, 50]}
      columns={[
        { key: 'id', header: 'Order', sortable: true },
        { key: 'customer', header: 'Customer', sortable: true },
        { key: 'city', header: 'City', sortable: true },
        { key: 'total', header: 'Total', sortable: true, render: (r) => `$${r.total.toLocaleString()}` },
        { key: 'status', header: 'Status', sortable: true },
      ]}
    />
  );
}
