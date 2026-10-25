import type { Key, ReactNode, Ref } from 'react';

export type ScrollAlign = 'start' | 'center' | 'end' | 'auto';

export type VirtualListHandle = {
  scrollToIndex: (index: number, align?: ScrollAlign) => void;
};

export type VirtualListProps<T> = {
  items: readonly T[];
  /** Height of the scroll container in px. */
  height: number;
  /** Height of every row in px. */
  itemHeight: number;
  /** Extra rows rendered above and below the visible area. Default 3. */
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => Key;
  'aria-label'?: string;
  /** React 19: `ref` is a normal prop for function components (no forwardRef needed). */
  ref?: Ref<VirtualListHandle>;
};

export function VirtualList<T>(props: VirtualListProps<T>) {
  // TODO: implement. See README.md.
  return <div>TODO: implement VirtualList</div>;
}
