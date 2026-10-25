import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { probeCount, resetProbes } from '../../shared/probe';
import { getDomLog, resetDomLog } from './dom';
import { EqualHeightGrid, ScrollProgressHeader, type Card } from './index';

const CARDS: Card[] = Array.from({ length: 6 }, (_, i) => ({
  id: `c${i}`,
  title: `Card ${i}`,
  body: 'Lorem ipsum '.repeat(i + 1),
}));

const nextFrame = () =>
  act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });

beforeEach(() => {
  resetDomLog();
});

describe('EqualHeightGrid', () => {
  it('reads every card once, then writes every card once (no interleaving)', () => {
    render(<EqualHeightGrid cards={CARDS} columns={3} />);
    expect(getDomLog()).toEqual([...Array(6).fill('read'), ...Array(6).fill('write')]);
  });

  it('gives every card in a row the same height', () => {
    const { container } = render(<EqualHeightGrid cards={CARDS} columns={3} />);
    const cards = Array.from(container.firstElementChild!.children) as HTMLElement[];
    expect(cards).toHaveLength(6);
    expect(new Set(cards.slice(0, 3).map((c) => c.style.height)).size).toBe(1);
    expect(new Set(cards.slice(3).map((c) => c.style.height)).size).toBe(1);
    expect(cards[0].style.height).toMatch(/px$/);
  });

  it('does not measure again on an unrelated re-render', () => {
    const { rerender } = render(<EqualHeightGrid cards={CARDS} columns={3} />);
    resetDomLog();
    rerender(<EqualHeightGrid cards={CARDS} columns={3} highlightedId="c2" />);
    expect(getDomLog()).toEqual([]);
  });

  it('measures again when the cards or columns change', () => {
    const { rerender } = render(<EqualHeightGrid cards={CARDS} columns={3} />);
    resetDomLog();
    rerender(<EqualHeightGrid cards={CARDS} columns={2} />);
    expect(getDomLog()).toEqual([...Array(6).fill('read'), ...Array(6).fill('write')]);
  });
});

describe('ScrollProgressHeader', () => {
  it('updates the progress after scrolling', async () => {
    render(<ScrollProgressHeader getScrollProgress={() => 0.42} />);
    fireEvent.scroll(window);
    await nextFrame();
    expect(screen.getByRole('banner')).toHaveTextContent('Progress: 42%');
  });

  it('reads layout and renders at most once per frame, however many scroll events', async () => {
    let value = 0;
    const getScrollProgress = vi.fn(() => value);
    render(<ScrollProgressHeader getScrollProgress={getScrollProgress} />);
    resetProbes();
    for (let i = 1; i <= 10; i++) {
      value = i / 10;
      fireEvent.scroll(window);
    }
    await nextFrame();
    expect(getScrollProgress.mock.calls.length).toBeLessThanOrEqual(1);
    expect(probeCount('ScrollProgressHeader')).toBeLessThanOrEqual(1);
    expect(screen.getByRole('banner')).toHaveTextContent('Progress: 100%');
  });

  it('removes its scroll listener on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ScrollProgressHeader getScrollProgress={() => 0} />);
    const added = add.mock.calls.filter((c: unknown[]) => c[0] === 'scroll').map((c: unknown[]) => c[1]);
    expect(added).toHaveLength(1);
    unmount();
    const removed = remove.mock.calls.filter((c: unknown[]) => c[0] === 'scroll').map((c: unknown[]) => c[1]);
    expect(removed).toEqual(added);
  });

  it('does nothing after unmount, even with a frame pending', async () => {
    const getScrollProgress = vi.fn(() => 0.5);
    const { unmount } = render(<ScrollProgressHeader getScrollProgress={getScrollProgress} />);
    fireEvent.scroll(window);
    unmount();
    await nextFrame();
    fireEvent.scroll(window);
    await nextFrame();
    expect(getScrollProgress).not.toHaveBeenCalled();
  });
});
