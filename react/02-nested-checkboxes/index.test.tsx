import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CheckboxTree, type TreeNode } from './index';

const nodes: TreeNode[] = [
  {
    id: 'fruits',
    label: 'Fruits',
    children: [
      { id: 'apple', label: 'Apple' },
      {
        id: 'citrus',
        label: 'Citrus',
        children: [
          { id: 'orange', label: 'Orange' },
          { id: 'lemon', label: 'Lemon' },
        ],
      },
    ],
  },
  { id: 'bread', label: 'Bread' },
];

const box = (name: string) => screen.getByRole('checkbox', { name });

describe('CheckboxTree', () => {
  it('renders every node as a labelled checkbox, all expanded', () => {
    render(<CheckboxTree nodes={nodes} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    for (const name of ['Fruits', 'Apple', 'Citrus', 'Orange', 'Lemon', 'Bread']) {
      expect(box(name)).not.toBeChecked();
    }
    expect(screen.getByRole('button', { name: 'Toggle Fruits' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: 'Toggle Bread' })).toBeNull();
  });

  it('renders children inside a labelled group', () => {
    render(<CheckboxTree nodes={nodes} />);
    const group = screen.getByRole('group', { name: 'Citrus' });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(group).getByRole('checkbox', { name: 'Lemon' })).toBeInTheDocument();
  });

  it('checking a parent checks all descendants at any depth', () => {
    const onChange = vi.fn();
    render(<CheckboxTree nodes={nodes} onChange={onChange} />);
    fireEvent.click(box('Fruits'));
    for (const name of ['Fruits', 'Apple', 'Citrus', 'Orange', 'Lemon']) expect(box(name)).toBeChecked();
    expect(box('Bread')).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(['apple', 'orange', 'lemon']);
  });

  it('a parent becomes indeterminate when some leaves are checked (at every level)', () => {
    render(<CheckboxTree nodes={nodes} />);
    fireEvent.click(box('Orange'));
    expect(box('Citrus')).toBePartiallyChecked();
    expect(box('Citrus')).toHaveAttribute('aria-checked', 'mixed');
    expect((box('Citrus') as HTMLInputElement).indeterminate).toBe(true);
    expect(box('Citrus')).not.toBeChecked();
    expect(box('Fruits')).toBePartiallyChecked();
    expect((box('Fruits') as HTMLInputElement).indeterminate).toBe(true);
  });

  it('a parent becomes checked when all its leaves are checked', () => {
    render(<CheckboxTree nodes={nodes} />);
    fireEvent.click(box('Orange'));
    fireEvent.click(box('Lemon'));
    expect(box('Citrus')).toBeChecked();
    expect((box('Citrus') as HTMLInputElement).indeterminate).toBe(false);
    expect(box('Fruits')).toBePartiallyChecked();
    fireEvent.click(box('Apple'));
    expect(box('Fruits')).toBeChecked();
    expect((box('Fruits') as HTMLInputElement).indeterminate).toBe(false);
  });

  it('clicking a fully checked parent unchecks all descendants', () => {
    const onChange = vi.fn();
    render(<CheckboxTree nodes={nodes} onChange={onChange} />);
    fireEvent.click(box('Fruits'));
    fireEvent.click(box('Fruits'));
    for (const name of ['Fruits', 'Apple', 'Citrus', 'Orange', 'Lemon']) expect(box(name)).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('clicking an indeterminate parent checks all descendants', () => {
    render(<CheckboxTree nodes={nodes} />);
    fireEvent.click(box('Lemon'));
    expect(box('Fruits')).toBePartiallyChecked();
    fireEvent.click(box('Fruits'));
    for (const name of ['Fruits', 'Apple', 'Citrus', 'Orange', 'Lemon']) expect(box(name)).toBeChecked();
  });

  it('derives parent state from defaultChecked on the first render', () => {
    render(<CheckboxTree nodes={nodes} defaultChecked={['orange', 'lemon']} />);
    expect(box('Citrus')).toBeChecked();
    expect(box('Fruits')).toBePartiallyChecked();
    expect(box('Apple')).not.toBeChecked();
  });

  it('calls onChange with leaf ids in tree order, not click order', () => {
    const onChange = vi.fn();
    render(<CheckboxTree nodes={nodes} onChange={onChange} />);
    fireEvent.click(box('Bread'));
    fireEvent.click(box('Lemon'));
    fireEvent.click(box('Apple'));
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith(['apple', 'lemon', 'bread']);
  });

  it('collapsing hides children and keeps their checked state', () => {
    render(<CheckboxTree nodes={nodes} />);
    fireEvent.click(box('Orange'));
    const toggle = screen.getByRole('button', { name: 'Toggle Citrus' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: 'Orange' })).toBeNull();
    expect(box('Citrus')).toBePartiallyChecked();
    fireEvent.click(toggle);
    expect(box('Orange')).toBeChecked();
  });

  it('treats a node with an empty children array as a leaf', () => {
    const onChange = vi.fn();
    render(<CheckboxTree nodes={[{ id: 'empty', label: 'Empty', children: [] }]} onChange={onChange} />);
    fireEvent.click(box('Empty'));
    expect(box('Empty')).toBeChecked();
    expect(onChange).toHaveBeenCalledWith(['empty']);
  });
});
