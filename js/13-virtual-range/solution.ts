export type VirtualizerOptions = {
  count: number;
  estimateSize: (index: number) => number;
  overscan?: number;
  paddingStart?: number;
};

export type VirtualItem = { index: number; start: number; size: number };

export type Virtualizer = {
  measure(index: number, size: number): void;
  getTotalSize(): number;
  getItemOffset(index: number): number;
  getRange(scrollTop: number, viewportHeight: number): { start: number; end: number } | null;
  getVirtualItems(scrollTop: number, viewportHeight: number): VirtualItem[];
};

export function createVirtualizer({ count, estimateSize, overscan = 2, paddingStart = 0 }: VirtualizerOptions): Virtualizer {
  const measured = new Map<number, number>();
  // ends[i] = paddingStart + size(0) + … + size(i). Valid for indexes < valid.
  const ends = new Float64Array(count);
  let valid = 0;

  const sizeOf = (i: number) => measured.get(i) ?? estimateSize(i);

  /** Make ends[0..i] valid. Work is proportional to how far we extend, nothing more. */
  function ensure(i: number) {
    for (; valid <= i; valid++) {
      ends[valid] = (valid === 0 ? paddingStart : ends[valid - 1]) + sizeOf(valid);
    }
  }

  /** Extend the prefix sums only until they reach `position` (or the end of the list). */
  function ensureUntil(position: number) {
    if (valid > 0 && ends[valid - 1] >= position) return;
    while (valid < count) {
      ensure(valid);
      if (ends[valid - 1] >= position) return;
    }
  }

  /** First index in [0, valid) with ends[i] > or >= target. Classic lower bound: O(log n). */
  function lowerBound(target: number, inclusive: boolean) {
    let lo = 0;
    let hi = valid;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const hit = inclusive ? ends[mid] >= target : ends[mid] > target;
      if (hit) hi = mid;
      else lo = mid + 1;
    }
    return lo; // === valid if nothing matched
  }

  function getItemOffset(index: number) {
    if (index <= 0) return paddingStart;
    ensure(Math.min(index, count) - 1);
    return ends[Math.min(index, count) - 1];
  }

  function getRange(scrollTop: number, viewportHeight: number) {
    if (count === 0) return null;
    const top = Math.max(0, scrollTop);
    const bottom = top + Math.max(0, viewportHeight);
    ensureUntil(bottom);

    let first = lowerBound(top, false);
    if (first >= count) first = count - 1; // scrolled past the end
    let last = lowerBound(bottom, true);
    if (last >= count) last = count - 1;
    if (last < first) last = first;

    return { start: Math.max(0, first - overscan), end: Math.min(count - 1, last + overscan) };
  }

  return {
    measure(index, size) {
      if (index < 0 || index >= count) return;
      if (measured.get(index) === size) return;
      measured.set(index, size);
      // Everything from `index` on is now wrong; everything before it is still right.
      if (index < valid) valid = index;
    },

    getTotalSize() {
      if (count === 0) return paddingStart;
      ensure(count - 1);
      return ends[count - 1];
    },

    getItemOffset,
    getRange,

    getVirtualItems(scrollTop, viewportHeight) {
      const range = getRange(scrollTop, viewportHeight);
      if (!range) return [];
      ensure(range.end);
      const items: VirtualItem[] = [];
      for (let i = range.start; i <= range.end; i++) {
        const start = i === 0 ? paddingStart : ends[i - 1];
        items.push({ index: i, start, size: ends[i] - start });
      }
      return items;
    },
  };
}
