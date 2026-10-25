import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { probeCount, resetProbes } from '../../shared/probe';
import { ProductGrid, defaultHelpers, type GridHelpers, type Product } from './index';

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Mango', price: 4, rating: 4.1 },
  { id: 'p2', name: 'Apple', price: 2, rating: 4.8 },
  { id: 'p3', name: 'Cherry', price: 9, rating: 3.9 },
  { id: 'p4', name: 'Banana', price: 1, rating: 4.5 },
  { id: 'p5', name: 'Kiwi', price: 3, rating: 4.0 },
  { id: 'p6', name: 'Apricot', price: 6, rating: 4.3 },
];

function countingHelpers() {
  const helpers: GridHelpers = {
    matches: vi.fn(defaultHelpers.matches),
    compare: vi.fn(defaultHelpers.compare),
  };
  return helpers as GridHelpers & { matches: ReturnType<typeof vi.fn>; compare: ReturnType<typeof vi.fn> };
}

const names = () =>
  within(screen.getByRole('list', { name: 'Products' }))
    .getAllByRole('listitem')
    .map((li) => li.firstElementChild?.textContent);

describe('ProductGrid: correctness', () => {
  it('sorts by name by default and by price when selected', () => {
    render(<ProductGrid products={PRODUCTS} />);
    expect(names()).toEqual(['Apple', 'Apricot', 'Banana', 'Cherry', 'Kiwi', 'Mango']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'price-asc' } });
    expect(names()).toEqual(['Banana', 'Apple', 'Kiwi', 'Mango', 'Apricot', 'Cherry']);
  });

  it('filters case-insensitively', () => {
    render(<ProductGrid products={PRODUCTS} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), { target: { value: '  AP ' } });
    expect(names()).toEqual(['Apple', 'Apricot']);
  });

  it('does not mutate the products prop', () => {
    const products = [...PRODUCTS];
    const before = products.map((p) => p.id);
    render(<ProductGrid products={products} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'rating' } });
    expect(products.map((p) => p.id)).toEqual(before);
  });

  it('keeps each card’s quantity with its product after re-sorting', () => {
    render(<ProductGrid products={PRODUCTS} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity for Banana' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'price-desc' } });
    expect(screen.getByRole('spinbutton', { name: 'Quantity for Banana' })).toHaveValue(5);
    expect(screen.getByRole('spinbutton', { name: 'Quantity for Apple' })).toHaveValue(1);
  });

  it('adds the chosen quantity to the cart', () => {
    render(<ProductGrid products={PRODUCTS} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity for Kiwi' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Kiwi to cart' }));
    expect(screen.getByRole('status', { name: 'Cart' })).toHaveTextContent('Cart: 3');
  });
});

describe('ProductGrid: performance', () => {
  it('typing in an unrelated input does not re-render cards or recompute the list', () => {
    const helpers = countingHelpers();
    render(<ProductGrid products={PRODUCTS} helpers={helpers} />);
    resetProbes();
    helpers.matches.mockClear();
    helpers.compare.mockClear();
    const coupon = screen.getByRole('textbox', { name: 'Coupon code' });
    for (const value of ['S', 'SA', 'SAV', 'SAVE']) fireEvent.change(coupon, { target: { value } });
    expect(probeCount('ProductCard')).toBe(0);
    expect(helpers.matches).not.toHaveBeenCalled();
    expect(helpers.compare).not.toHaveBeenCalled();
  });

  it('adding to cart re-renders the badge, not the cards', () => {
    const helpers = countingHelpers();
    render(<ProductGrid products={PRODUCTS} helpers={helpers} />);
    resetProbes();
    helpers.compare.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Add Apple to cart' }));
    expect(screen.getByRole('status', { name: 'Cart' })).toHaveTextContent('Cart: 1');
    expect(probeCount('CartBadge')).toBe(1);
    expect(probeCount('ProductCard')).toBeLessThanOrEqual(1);
    expect(helpers.compare).not.toHaveBeenCalled();
  });

  it('searching does not re-sort the list', () => {
    const helpers = countingHelpers();
    render(<ProductGrid products={PRODUCTS} helpers={helpers} />);
    helpers.compare.mockClear();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), { target: { value: 'an' } });
    expect(names()).toEqual(['Banana', 'Mango']);
    expect(helpers.compare).not.toHaveBeenCalled();
  });
});
