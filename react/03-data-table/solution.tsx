import { useMemo, useState, type ReactNode } from 'react';

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

type Sort = { key: string; direction: 'ascending' | 'descending' } | null;

function defaultCompare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function DataTable<T>({ rows, columns, getRowId, pageSizeOptions = [10, 20, 50] }: DataTableProps<T>) {
  const [sort, setSort] = useState<Sort>(null);
  const [filter, setFilter] = useState('');
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [page, setPage] = useState(1);

  // 1) filter
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((col) => {
        const value = row[col.key];
        return typeof value === 'string' && value.toLowerCase().includes(q);
      }),
    );
  }, [rows, columns, filter]);

  // 2) sort — on a copy, with the original index as a tie-breaker (stable on purpose,
  //    so we don't depend on engine details and "none" is just the original order).
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const cmp = col.compare ?? ((a: T, b: T) => defaultCompare(a[col.key], b[col.key]));
    const sign = sort.direction === 'ascending' ? 1 : -1;
    return filtered
      .map((row, index) => ({ row, index }))
      .sort((x, y) => sign * cmp(x.row, y.row) || x.index - y.index)
      .map((x) => x.row);
  }, [filtered, columns, sort]);

  // 3) paginate — clamp the page instead of storing a corrected copy in state.
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  function cycleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'ascending' };
      if (prev.direction === 'ascending') return { key, direction: 'descending' };
      return null;
    });
  }

  function changePageSize(next: number) {
    setPage(Math.floor(start / next) + 1); // keep the first visible row on screen
    setPageSize(next);
  }

  return (
    <div>
      <input
        type="search"
        aria-label="Filter rows"
        placeholder="Filter…"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setPage(1);
        }}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            {columns.map((col) => {
              const direction = sort?.key === col.key ? sort.direction : 'none';
              return (
                <th
                  key={col.key + col.header}
                  aria-sort={col.sortable ? direction : undefined}
                  style={{ textAlign: 'left', padding: 6 }}
                >
                  {col.sortable ? (
                    <button type="button" onClick={() => cycleSort(col.key)}>
                      {col.header}
                      <span aria-hidden="true">{direction === 'ascending' ? ' ▲' : direction === 'descending' ? ' ▼' : ''}</span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No rows</td>
            </tr>
          ) : (
            visible.map((row) => (
              <tr key={getRowId(row)}>
                {columns.map((col) => (
                  <td key={col.key + col.header} style={{ padding: 6 }}>
                    {col.render ? col.render(row) : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
          Previous page
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
          Next page
        </button>
        <label>
          Rows per page{' '}
          <select value={pageSize} onChange={(e) => changePageSize(Number(e.target.value))}>
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
