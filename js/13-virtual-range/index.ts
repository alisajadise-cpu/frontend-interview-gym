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

export function createVirtualizer(options: VirtualizerOptions): Virtualizer {
  throw new Error('Not implemented: createVirtualizer');
}
