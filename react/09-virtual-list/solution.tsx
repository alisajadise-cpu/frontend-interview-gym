import { useImperativeHandle, useRef, useState, type KeyboardEvent, type Key, type ReactNode, type Ref } from 'react';

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

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  overscan = 3,
  renderItem,
  getKey,
  'aria-label': ariaLabel,
  ref,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const count = items.length;
  const totalHeight = count * itemHeight;
  const maxScroll = Math.max(0, totalHeight - height);
  // The list may have shrunk since the last scroll: clamp before computing the range.
  const top = Math.min(scrollTop, maxScroll);

  const firstVisible = Math.floor(top / itemHeight);
  const lastVisible = Math.min(count - 1, Math.ceil((top + height) / itemHeight) - 1);
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(count - 1, lastVisible + overscan);

  function scrollTo(next: number) {
    const value = Math.max(0, Math.min(maxScroll, next));
    if (containerRef.current) containerRef.current.scrollTop = value;
    // Update state directly too: a programmatic scroll fires its `scroll` event
    // asynchronously in browsers (and never in jsdom).
    setScrollTop(value);
  }

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex(index, align = 'auto') {
        const i = Math.max(0, Math.min(count - 1, index));
        const itemTop = i * itemHeight;
        const itemBottom = itemTop + itemHeight;
        const current = containerRef.current?.scrollTop ?? top;
        let mode = align;
        if (mode === 'auto') {
          if (itemTop >= current && itemBottom <= current + height) return; // already fully visible
          mode = itemTop < current ? 'start' : 'end';
        }
        if (mode === 'start') scrollTo(itemTop);
        else if (mode === 'end') scrollTo(itemBottom - height);
        else scrollTo(itemTop - height / 2 + itemHeight / 2);
      },
    }),
    [count, itemHeight, height, top, maxScroll],
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = containerRef.current?.scrollTop ?? top;
    const moves: Record<string, number> = {
      ArrowDown: current + itemHeight,
      ArrowUp: current - itemHeight,
      PageDown: current + height,
      PageUp: current - height,
      Home: 0,
      End: maxScroll,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    scrollTo(moves[e.key]);
  }

  const rows: ReactNode[] = [];
  for (let i = start; i <= end; i++) {
    rows.push(
      <div
        key={getKey ? getKey(items[i], i) : i}
        role="listitem"
        aria-setsize={count}
        aria-posinset={i + 1}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: itemHeight,
          // transform: moving rows doesn't trigger layout of the other rows.
          transform: `translateY(${i * itemHeight}px)`,
        }}
      >
        {renderItem(items[i], i)}
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      role="list"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onKeyDown={onKeyDown}
      style={{ height, overflowY: 'auto', position: 'relative', willChange: 'transform' }}
    >
      {/* The spacer gives the container its real scroll height. */}
      <div style={{ height: totalHeight, position: 'relative' }}>{rows}</div>
    </div>
  );
}
