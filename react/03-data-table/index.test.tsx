import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type Column } from './index';

type User = { id: string; name: string; age: number; city: string };

const CITIES = ['Tehran', 'Isfahan', 'Shiraz', 'Tabriz'];
// 23 users: names "User 01".."User 23", ages repeat so we can test stability.
const users: User[] = Object.freeze(
  Array.from({ length: 23 }, (_, i) => ({
    id: `u${i + 1}`,
    name: `User ${String(i + 1).padStart(2, '0')}`,
    age: 20 + (i % 5),
    city: CITIES[i % 4],
  })),
) as User[];

const columns: Column<User>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'age', header: 'Age', sortable: true },
  { key: 'city', header: 'City', sortable: true },
  { key: 'id', header: 'Profile', render: (u) => <a href={`/u/${u.id}`}>Open {u.id}</a> },
];

function setup(rows: readonly User[] = users, cols = columns) {
  const utils = render(<DataTable<User> rows={rows} columns={cols} getRowId={(u) => u.id} pageSizeOptions={[5, 10, 20]} />);
  return utils;
}

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
const names = () => bodyRows().map((r) => within(r).getAllByRole('cell')[0].textContent);
const header = (name: string) => screen.getByRole('columnheader', { name });

describe('DataTable', () => {
  it('renders the first page with cells and custom render', () => {
    setup();
    expect(names()).toEqual(['User 01', 'User 02', 'User 03', 'User 04', 'User 05']);
    expect(within(bodyRows()[0]).getByRole('link', { name: 'Open u1' })).toHaveAttribute('href', '/u/u1');
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
  });

  it('cycles sort ascending → descending → none and sets aria-sort', () => {
    setup();
    const nameHeader = header('Name');
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    expect(header('Profile')).not.toHaveAttribute('aria-sort');
    const button = within(nameHeader).getByRole('button', { name: 'Name' });
    fireEvent.click(button);
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(names()[0]).toBe('User 01');
    fireEvent.click(button);
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['User 23', 'User 22', 'User 21', 'User 20', 'User 19']);
    fireEvent.click(button);
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    expect(names()).toEqual(['User 01', 'User 02', 'User 03', 'User 04', 'User 05']);
  });

  it('sorts numbers numerically and stably', () => {
    const rows = Object.freeze([
      { id: 'a', name: 'A', age: 10, city: 'X' },
      { id: 'b', name: 'B', age: 9, city: 'X' },
      { id: 'c', name: 'C', age: 100, city: 'X' },
      { id: 'd', name: 'D', age: 9, city: 'X' },
    ]) as User[];
    setup(rows);
    fireEvent.click(within(header('Age')).getByRole('button', { name: 'Age' }));
    expect(names()).toEqual(['B', 'D', 'A', 'C']);
    fireEvent.click(within(header('Age')).getByRole('button', { name: 'Age' }));
    expect(names()).toEqual(['C', 'A', 'B', 'D']);
  });

  it('clicking another column starts it at ascending and resets the first', () => {
    setup();
    fireEvent.click(within(header('Name')).getByRole('button', { name: 'Name' }));
    fireEvent.click(within(header('Name')).getByRole('button', { name: 'Name' }));
    fireEvent.click(within(header('Age')).getByRole('button', { name: 'Age' }));
    expect(header('Age')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('Name')).toHaveAttribute('aria-sort', 'none');
    // age 20 users in original order: 01, 06, 11, 16, 21
    expect(names()).toEqual(['User 01', 'User 06', 'User 11', 'User 16', 'User 21']);
  });

  it('uses a custom compare function', () => {
    const cols: Column<User>[] = [
      { key: 'name', header: 'Name' },
      { key: 'city', header: 'City', sortable: true, compare: (a, b) => a.city.length - b.city.length },
    ];
    setup(users.slice(0, 4), cols);
    fireEvent.click(within(header('City')).getByRole('button', { name: 'City' }));
    expect(bodyRows().map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual(['Tehran', 'Shiraz', 'Tabriz', 'Isfahan']);
  });

  it('filters case-insensitively across string columns and resets to page 1', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter rows' }), { target: { value: '  SHIRAZ ' } });
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(names()).toEqual(['User 03', 'User 07', 'User 11', 'User 15', 'User 19']);
  });

  it('does not match on non-string values', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter rows' }), { target: { value: '21' } });
    // "User 21" matches by name; age 21 rows must NOT match through the number column.
    expect(names()).toEqual(['User 21']);
  });

  it('shows "No rows" and Page 1 of 1 when nothing matches', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter rows' }), { target: { value: 'zzz' } });
    expect(screen.getByText('No rows')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('Previous/Next are disabled at the ends', () => {
    setup();
    const prev = screen.getByRole('button', { name: 'Previous page' });
    const next = screen.getByRole('button', { name: 'Next page' });
    expect(prev).toBeDisabled();
    for (let i = 0; i < 4; i++) fireEvent.click(next);
    expect(screen.getByText('Page 5 of 5')).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(names()).toEqual(['User 21', 'User 22', 'User 23']);
    fireEvent.click(prev);
    expect(screen.getByText('Page 4 of 5')).toBeInTheDocument();
  });

  it('changing page size keeps the first visible row on screen', () => {
    setup();
    const next = screen.getByRole('button', { name: 'Next page' });
    fireEvent.click(next);
    fireEvent.click(next); // page 3 → first visible is index 10 (User 11)
    expect(names()[0]).toBe('User 11');
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '20' } });
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(names()).toContain('User 11');
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '10' } });
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('page size change from page 4 lands on the right page', () => {
    setup();
    const next = screen.getByRole('button', { name: 'Next page' });
    for (let i = 0; i < 3; i++) fireEvent.click(next); // page 4 → index 15 (User 16)
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '10' } });
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(names()[0]).toBe('User 11');
    expect(names()).toContain('User 16');
  });

  it('shows the last page when the data shrinks', () => {
    const { rerender } = setup();
    const next = screen.getByRole('button', { name: 'Next page' });
    for (let i = 0; i < 4; i++) fireEvent.click(next);
    rerender(<DataTable<User> rows={users.slice(0, 7)} columns={columns} getRowId={(u) => u.id} pageSizeOptions={[5, 10, 20]} />);
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(names()).toEqual(['User 06', 'User 07']);
  });

  it('never mutates the rows prop (frozen array)', () => {
    setup();
    expect(() => fireEvent.click(within(header('Name')).getByRole('button', { name: 'Name' }))).not.toThrow();
    fireEvent.click(within(header('Name')).getByRole('button', { name: 'Name' }));
    expect(users[0].id).toBe('u1');
    expect(names()[0]).toBe('User 23');
  });
});
