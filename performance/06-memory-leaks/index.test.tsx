import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_LIMIT, LiveTicker, getHistory, resetHistory, type PriceFeed, type Stats, type TickerApi } from './index';

function makeFeed() {
  const listeners = new Map<string, Set<(p: number) => void>>();
  const feed: PriceFeed & { emit(symbol: string, price: number): void; listenerCount(symbol?: string): number } = {
    subscribe: vi.fn((symbol: string, listener: (p: number) => void) => {
      const set = listeners.get(symbol) ?? new Set();
      set.add(listener);
      listeners.set(symbol, set);
      return () => {
        set.delete(listener);
      };
    }),
    emit(symbol, price) {
      act(() => {
        listeners.get(symbol)?.forEach((l) => l(price));
      });
    },
    listenerCount(symbol) {
      if (symbol) return listeners.get(symbol)?.size ?? 0;
      let n = 0;
      listeners.forEach((s) => (n += s.size));
      return n;
    },
  };
  return feed;
}

function makeApi() {
  const calls: { symbol: string; signal: AbortSignal; resolve: (s: Stats) => void }[] = [];
  const api: TickerApi = {
    fetchStats: vi.fn(
      (symbol: string, signal: AbortSignal) =>
        new Promise<Stats>((resolve) => {
          calls.push({ symbol, signal, resolve });
        }),
    ),
  };
  return { api, calls };
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  resetHistory();
});

describe('LiveTicker: behaviour', () => {
  it('shows the latest price and the stats', async () => {
    const feed = makeFeed();
    const { api, calls } = makeApi();
    render(<LiveTicker symbol="AAPL" feed={feed} api={api} />);
    feed.emit('AAPL', 101.5);
    expect(screen.getByText('Price: 101.50')).toBeInTheDocument();
    await act(async () => calls[0].resolve({ high: 110, low: 90 }));
    expect(screen.getByText('High: 110 · Low: 90')).toBeInTheDocument();
  });

  it('polls the stats every pollMs and aborts the previous request', async () => {
    const { api, calls } = makeApi();
    render(<LiveTicker symbol="AAPL" feed={makeFeed()} api={api} pollMs={5000} />);
    expect(api.fetchStats).toHaveBeenCalledTimes(1);
    await advance(5000);
    expect(api.fetchStats).toHaveBeenCalledTimes(2);
    expect(calls[0].signal.aborted).toBe(true);
  });
});

describe('LiveTicker: leaks', () => {
  it('unsubscribes from the feed on unmount (10 mount/unmount cycles)', () => {
    const feed = makeFeed();
    const { api } = makeApi();
    for (let i = 0; i < 10; i++) {
      const { unmount } = render(<LiveTicker symbol="AAPL" feed={feed} api={api} />);
      expect(feed.listenerCount()).toBe(1);
      unmount();
    }
    expect(feed.listenerCount()).toBe(0);
  });

  it('re-subscribes when the symbol changes', () => {
    const feed = makeFeed();
    const { api } = makeApi();
    const { rerender } = render(<LiveTicker symbol="AAPL" feed={feed} api={api} />);
    rerender(<LiveTicker symbol="MSFT" feed={feed} api={api} />);
    expect(feed.listenerCount('AAPL')).toBe(0);
    expect(feed.listenerCount('MSFT')).toBe(1);
  });

  it('leaves no timers behind and stops polling after unmount', async () => {
    const { api } = makeApi();
    const { unmount } = render(<LiveTicker symbol="AAPL" feed={makeFeed()} api={api} />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await advance(20000);
    expect(api.fetchStats).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight request on unmount', () => {
    const { api, calls } = makeApi();
    const { unmount } = render(<LiveTicker symbol="AAPL" feed={makeFeed()} api={api} />);
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('removes its visibilitychange listener on unmount', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { api } = makeApi();
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(<LiveTicker symbol="AAPL" feed={makeFeed()} api={api} />);
      unmount();
    }
    const added = add.mock.calls.filter((c: unknown[]) => c[0] === 'visibilitychange').map((c: unknown[]) => c[1]);
    const removed = remove.mock.calls.filter((c: unknown[]) => c[0] === 'visibilitychange').map((c: unknown[]) => c[1]);
    expect(added).toHaveLength(3);
    expect(removed).toEqual(added);
  });

  it(`keeps at most ${HISTORY_LIMIT} price points per symbol`, () => {
    const feed = makeFeed();
    const { api } = makeApi();
    render(<LiveTicker symbol="AAPL" feed={feed} api={api} />);
    for (let i = 1; i <= 250; i++) feed.emit('AAPL', i);
    const points = getHistory('AAPL');
    expect(points).toHaveLength(HISTORY_LIMIT);
    expect(points[0]).toBe(151);
    expect(points[points.length - 1]).toBe(250);
  });

  it('does not poll while the tab is hidden', async () => {
    const { api } = makeApi();
    render(<LiveTicker symbol="AAPL" feed={makeFeed()} api={api} pollMs={1000} />);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByText('Paused')).toBeInTheDocument();
    const before = (api.fetchStats as ReturnType<typeof vi.fn>).mock.calls.length;
    await advance(10000);
    expect(api.fetchStats).toHaveBeenCalledTimes(before);
  });
});
