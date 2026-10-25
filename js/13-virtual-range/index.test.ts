import { describe, expect, it, vi } from 'vitest';
import { createVirtualizer } from './index';

const fixed = (count: number, extra: { overscan?: number; paddingStart?: number } = {}) => {
  const estimateSize = vi.fn(() => 50);
  return { v: createVirtualizer({ count, estimateSize, ...extra }), estimateSize };
};

describe('createVirtualizer: sizes and offsets', () => {
  it('computes offsets and total size from estimates', () => {
    const { v } = fixed(100);
    expect(v.getItemOffset(0)).toBe(0);
    expect(v.getItemOffset(10)).toBe(500);
    expect(v.getTotalSize()).toBe(5000);
  });

  it('applies paddingStart', () => {
    const { v } = fixed(10, { paddingStart: 100 });
    expect(v.getItemOffset(0)).toBe(100);
    expect(v.getItemOffset(2)).toBe(200);
    expect(v.getTotalSize()).toBe(600);
  });

  it('uses variable estimates', () => {
    const v = createVirtualizer({ count: 4, estimateSize: (i) => (i + 1) * 10 });
    expect(v.getItemOffset(3)).toBe(60);
    expect(v.getTotalSize()).toBe(100);
  });

  it('measure() replaces the estimate and shifts later offsets', () => {
    const { v } = fixed(10);
    expect(v.getTotalSize()).toBe(500);
    v.measure(2, 120);
    expect(v.getItemOffset(2)).toBe(100);
    expect(v.getItemOffset(3)).toBe(220);
    expect(v.getTotalSize()).toBe(570);
  });

  it('count 0', () => {
    const { v } = fixed(0, { paddingStart: 8 });
    expect(v.getTotalSize()).toBe(8);
    expect(v.getRange(0, 500)).toBeNull();
    expect(v.getVirtualItems(0, 500)).toEqual([]);
  });
});

describe('createVirtualizer: range', () => {
  it('returns the visible range plus overscan', () => {
    const { v } = fixed(100);
    expect(v.getRange(0, 200)).toEqual({ start: 0, end: 5 }); // visible 0..3
    expect(v.getRange(1000, 200)).toEqual({ start: 18, end: 25 }); // visible 20..23
    expect(v.getRange(1010, 200)).toEqual({ start: 18, end: 26 }); // visible 20..24
  });

  it('respects a custom overscan', () => {
    const { v } = fixed(100, { overscan: 0 });
    expect(v.getRange(1000, 200)).toEqual({ start: 20, end: 23 });
  });

  it('clamps negative scrollTop and scroll past the end', () => {
    const { v } = fixed(100);
    expect(v.getRange(-80, 200)).toEqual({ start: 0, end: 5 });
    expect(v.getRange(999_999, 200)).toEqual({ start: 97, end: 99 });
  });

  it('works with measured sizes', () => {
    const v = createVirtualizer({ count: 100, estimateSize: () => 50, overscan: 0 });
    v.measure(0, 500); // a tall first row
    expect(v.getRange(0, 200)).toEqual({ start: 0, end: 0 });
    expect(v.getRange(450, 200)).toEqual({ start: 0, end: 3 }); // 0 ends at 500; 1..3 cover 500..650
  });

  it('getVirtualItems returns index, start and size', () => {
    const v = createVirtualizer({ count: 10, estimateSize: (i) => (i % 2 ? 20 : 40), overscan: 1, paddingStart: 10 });
    expect(v.getVirtualItems(0, 60)).toEqual([ // visible 0..1, overscan 1
      { index: 0, start: 10, size: 40 },
      { index: 1, start: 50, size: 20 },
      { index: 2, start: 70, size: 40 },
    ]);
  });
});

describe('createVirtualizer: performance (counted, not timed)', () => {
  it('is lazy: the top of a 100k list does not estimate every item', () => {
    const { v, estimateSize } = fixed(100_000);
    v.getVirtualItems(0, 800);
    expect(estimateSize.mock.calls.length).toBeLessThan(50);
  });

  it('getItemOffset(i) only computes up to i', () => {
    const { v, estimateSize } = fixed(100_000);
    expect(v.getItemOffset(5000)).toBe(250_000);
    expect(estimateSize.mock.calls.length).toBeLessThanOrEqual(5001);
  });

  it('reuses prefix sums: repeated range queries do not estimate again', () => {
    const { v, estimateSize } = fixed(100_000);
    v.getTotalSize();
    const after = estimateSize.mock.calls.length;
    for (let top = 0; top < 4_000_000; top += 40_000) v.getRange(top, 800);
    expect(estimateSize.mock.calls.length).toBe(after);
  });

  it('measure(i) only recomputes from i onward', () => {
    const { v, estimateSize } = fixed(100_000);
    v.getTotalSize();
    estimateSize.mockClear();
    v.measure(99_990, 70);
    expect(v.getTotalSize()).toBe(100_000 * 50 + 20);
    expect(estimateSize.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
