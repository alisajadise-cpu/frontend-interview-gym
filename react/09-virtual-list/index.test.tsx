import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VirtualList, type VirtualListHandle } from './index';

const ITEMS = Array.from({ length: 10_000 }, (_, i) => `Item ${i}`);

function setup(props: { items?: string[]; overscan?: number } = {}) {
  const ref = { current: null as VirtualListHandle | null };
  const renderItem = vi.fn((item: string) => <span>{item}</span>);
  const utils = render(
    <VirtualList
      ref={ref}
      aria-label="Items"
      items={props.items ?? ITEMS}
      height={200}
      itemHeight={20}
      overscan={props.overscan ?? 3}
      renderItem={renderItem}
    />,
  );
  const list = screen.getByRole('list', { name: 'Items' });
  const rows = () => screen.getAllByRole('listitem');
  const positions = () => rows().map((r) => Number(r.getAttribute('aria-posinset')));
  const scrollTo = (top: number) => {
    list.scrollTop = top;
    fireEvent.scroll(list);
  };
  return { ...utils, ref, renderItem, list, rows, positions, scrollTo };
}

describe('VirtualList: rendering', () => {
  it('renders only the visible rows plus overscan below', () => {
    const { rows, positions } = setup();
    // 200 / 20 = 10 visible rows (1..10) + 3 overscan below. Nothing above row 1.
    expect(rows()).toHaveLength(13);
    expect(positions()[0]).toBe(1);
    expect(positions().at(-1)).toBe(13);
  });

  it('calls renderItem only for rendered rows', () => {
    const { renderItem } = setup();
    expect(renderItem.mock.calls.length).toBe(13);
  });

  it('has a spacer with the full scroll height', () => {
    const { list } = setup();
    expect((list.firstElementChild as HTMLElement).style.height).toBe('200000px');
  });

  it('positions rows with translateY and exposes aria-setsize / aria-posinset', () => {
    const { rows } = setup();
    const sixth = rows()[5];
    expect(sixth).toHaveTextContent('Item 5');
    expect(sixth.style.transform).toBe('translateY(100px)');
    expect(sixth).toHaveAttribute('aria-setsize', '10000');
    expect(sixth).toHaveAttribute('aria-posinset', '6');
  });

  it('is keyboard focusable', () => {
    const { list } = setup();
    expect(list).toHaveAttribute('tabindex', '0');
  });
});

describe('VirtualList: scrolling', () => {
  it('updates the rendered range on scroll (with overscan on both sides)', () => {
    const { positions, scrollTo } = setup();
    scrollTo(1000); // first visible index = 50
    expect(positions()[0]).toBe(48); // index 47 = 50 - 3
    expect(positions().at(-1)).toBe(63); // index 62 = 59 + 3
    expect(screen.getByText('Item 50')).toBeInTheDocument();
    expect(screen.queryByText('Item 0')).toBeNull();
  });

  it('handles the end of the list', () => {
    const { positions, scrollTo } = setup();
    scrollTo(199_800); // max scroll
    expect(positions().at(-1)).toBe(10_000);
    expect(positions()[0]).toBe(9_988);
  });

  it('keeps working when items shrink below the scroll position', () => {
    const { positions, scrollTo, rerender, ref } = setup();
    scrollTo(100_000);
    rerender(<VirtualList ref={ref} aria-label="Items" items={ITEMS.slice(0, 30)} height={200} itemHeight={20} renderItem={(x) => x} />);
    expect(positions().at(-1)).toBe(30);
    expect(screen.getByText('Item 29')).toBeInTheDocument();
  });

  it('End / Home keys jump to the bottom / top', () => {
    const { list, positions } = setup();
    fireEvent.keyDown(list, { key: 'End' });
    expect(list.scrollTop).toBe(199_800);
    expect(positions().at(-1)).toBe(10_000);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(list.scrollTop).toBe(0);
    expect(positions()[0]).toBe(1);
  });
});

describe('VirtualList: scrollToIndex', () => {
  it("align 'start' puts the item at the top", () => {
    const { ref, list } = setup();
    act(() => ref.current!.scrollToIndex(500, 'start'));
    expect(list.scrollTop).toBe(10_000);
    expect(screen.getByText('Item 500')).toBeInTheDocument();
  });

  it("align 'end' puts the item at the bottom", () => {
    const { ref, list } = setup();
    act(() => ref.current!.scrollToIndex(500, 'end'));
    expect(list.scrollTop).toBe(9_820);
  });

  it("align 'center' centers the item", () => {
    const { ref, list } = setup();
    act(() => ref.current!.scrollToIndex(500, 'center'));
    expect(list.scrollTop).toBe(9_910);
  });

  it("align 'auto' does nothing if visible, otherwise scrolls the least", () => {
    const { ref, list } = setup();
    act(() => ref.current!.scrollToIndex(5, 'auto'));
    expect(list.scrollTop).toBe(0);
    act(() => ref.current!.scrollToIndex(500, 'auto')); // below → aligned to the end
    expect(list.scrollTop).toBe(9_820);
    act(() => ref.current!.scrollToIndex(100, 'auto')); // above → aligned to the start
    expect(list.scrollTop).toBe(2_000);
  });

  it('clamps to the valid scroll range', () => {
    const { ref, list } = setup();
    act(() => ref.current!.scrollToIndex(9_999, 'start'));
    expect(list.scrollTop).toBe(199_800);
    act(() => ref.current!.scrollToIndex(-5, 'start'));
    expect(list.scrollTop).toBe(0);
  });
});
