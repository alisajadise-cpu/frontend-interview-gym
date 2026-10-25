import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InfiniteFeed, type FeedPage } from './index';

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed = new Set<Element>();
  constructor(public callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  takeRecords() {
    return [];
  }
}

/** Pretend the sentinel scrolled into view. */
function intersect() {
  act(() => {
    for (const io of FakeIntersectionObserver.instances) {
      for (const target of io.observed) {
        io.callback([{ isIntersecting: true, target } as unknown as IntersectionObserverEntry], io as unknown as IntersectionObserver);
      }
    }
  });
}
const observedCount = () => FakeIntersectionObserver.instances.reduce((n, io) => n + io.observed.size, 0);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const calls: { cursor: string | null; signal: AbortSignal; d: ReturnType<typeof deferred<FeedPage>> }[] = [];
  const fetchPage = vi.fn((cursor: string | null, signal: AbortSignal) => {
    const d = deferred<FeedPage>();
    calls.push({ cursor, signal, d });
    return d.promise;
  });
  const utils = render(<InfiniteFeed fetchPage={fetchPage} />);
  const respond = (i: number, page: FeedPage) => act(async () => calls[i].d.resolve(page));
  const fail = (i: number) => act(async () => calls[i].d.reject(new Error('503')));
  return { ...utils, calls, fetchPage, respond, fail };
}

const page = (ids: number[], nextCursor: string | null): FeedPage => ({
  items: ids.map((n) => ({ id: `p${n}`, title: `Post ${n}` })),
  nextCursor,
});
const titles = () => screen.queryAllByRole('article').map((a) => a.textContent);

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

describe('InfiniteFeed', () => {
  it('loads the first page on mount with a null cursor', async () => {
    const { calls, respond } = setup();
    expect(calls).toHaveLength(1);
    expect(calls[0].cursor).toBeNull();
    const feed = screen.getByRole('feed');
    expect(feed).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await respond(0, page([1, 2, 3], 'c1'));
    expect(titles()).toEqual(['Post 1', 'Post 2', 'Post 3']);
    expect(feed).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('loads the next page with nextCursor when the sentinel intersects', async () => {
    const { calls, respond } = setup();
    await respond(0, page([1, 2], 'c1'));
    intersect();
    expect(calls).toHaveLength(2);
    expect(calls[1].cursor).toBe('c1');
    await respond(1, page([3, 4], 'c2'));
    expect(titles()).toEqual(['Post 1', 'Post 2', 'Post 3', 'Post 4']);
  });

  it('never has more than one request in flight', async () => {
    const { calls, respond } = setup();
    intersect();
    intersect();
    expect(calls).toHaveLength(1);
    await respond(0, page([1], 'c1'));
    intersect();
    intersect();
    intersect();
    expect(calls).toHaveLength(2);
  });

  it('dedupes items by id when pages overlap', async () => {
    const { respond } = setup();
    await respond(0, page([1, 2, 3], 'c1'));
    intersect();
    await respond(1, page([3, 4, 5], 'c2'));
    expect(titles()).toEqual(['Post 1', 'Post 2', 'Post 3', 'Post 4', 'Post 5']);
  });

  it('shows an error with Retry that reloads the same cursor', async () => {
    const { calls, respond, fail } = setup();
    await respond(0, page([1], 'c1'));
    intersect();
    await fail(1);
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByRole('feed')).toHaveAttribute('aria-busy', 'false');
    intersect(); // no auto-loading while in the error state
    expect(calls).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(calls).toHaveLength(3);
    expect(calls[2].cursor).toBe('c1');
    await respond(2, page([2], 'c2'));
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    expect(titles()).toEqual(['Post 1', 'Post 2']);
  });

  it('can retry a failed first page', async () => {
    const { calls, fail, respond } = setup();
    await fail(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(calls[1].cursor).toBeNull();
    await respond(1, page([1], null));
    expect(titles()).toEqual(['Post 1']);
  });

  it('shows "You\'re all caught up" and stops observing at the end', async () => {
    const { calls, respond } = setup();
    await respond(0, page([1], 'c1'));
    expect(observedCount()).toBe(1);
    intersect();
    await respond(1, page([2], null));
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(observedCount()).toBe(0);
    intersect();
    expect(calls).toHaveLength(2);
  });

  it('aborts the in-flight request and disconnects on unmount', async () => {
    const { calls, respond, unmount } = setup();
    await respond(0, page([1], 'c1'));
    intersect();
    unmount();
    expect(calls[1].signal.aborted).toBe(true);
    expect(observedCount()).toBe(0);
  });

  it('ignores the result of an aborted request', async () => {
    const { calls, unmount } = setup();
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
    await act(async () => calls[0].d.resolve(page([1], 'c1')));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });
});
