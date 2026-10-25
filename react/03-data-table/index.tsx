import type { ReactNode } from 'react';

export type Column<T> = {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  compare?: (a: T, b: T) => number;
  render?: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  rows: readonly T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  pageSizeOptions?: number[];
};

export function DataTable<T>(props: DataTableProps<T>) {
  // TODO: implement. See README.md for the full spec.
  return <div>TODO: implement DataTable</div>;
}
