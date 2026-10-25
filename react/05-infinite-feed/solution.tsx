import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type FeedItem = { id: string; title: string };
export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

export type InfiniteFeedProps = {
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<FeedPage>;
};

type Status = 'loading' | 'idle' | 'error' | 'done';

export function InfiniteFeed({ fetchPage }: InfiniteFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  // Refs, not state, for things the async code must read synchronously:
  // a state value read inside a callback can be one render stale.
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const seenIds = useRef(new Set<string>());
  const doneRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchRef = useRef(fetchPage);
  useLayoutEffect(() => {
    fetchRef.current = fetchPage;
  });

  const loadMore = useCallback(() => {
    if (inFlightRef.current || doneRef.current) return; // one request at a time
    const controller = new AbortController();
    inFlightRef.current = controller;
    setStatus('loading');

    fetchRef.current(cursorRef.current, controller.signal).then(
      (page) => {
        if (controller.signal.aborted) return;
        inFlightRef.current = null;
        const fresh = page.items.filter((item) => !seenIds.current.has(item.id));
        fresh.forEach((item) => seenIds.current.add(item.id));
        cursorRef.current = page.nextCursor;
        doneRef.current = page.nextCursor === null;
        setItems((prev) => [...prev, ...fresh]);
        setStatus(doneRef.current ? 'done' : 'idle');
      },
      () => {
        if (controller.signal.aborted) return;
        inFlightRef.current = null; // cursor is unchanged, so Retry asks for the same page
        setStatus('error');
      },
    );
  }, []);

  // First page. The cleanup also covers StrictMode's mount → unmount → mount.
  useEffect(() => {
    loadMore();
    return () => {
      inFlightRef.current?.abort();
      inFlightRef.current = null;
    };
  }, [loadMore]);

  // Observe the sentinel only while more pages can be loaded automatically.
  // Depending on `status` (not just a boolean) re-creates the observer after each
  // page. A fresh observe() always delivers an initial entry, so if the sentinel is
  // still on screen (a short page), the next page loads without any scrolling.
  const observing = status === 'idle' || status === 'loading';
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!observing || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [observing, status, loadMore]);

  const loading = status === 'loading';

  return (
    <div>
      <div role="feed" aria-busy={loading} aria-label="Posts">
        {items.map((item, i) => (
          <article key={item.id} aria-posinset={i + 1} aria-setsize={status === 'done' ? items.length : -1}
            style={{ padding: '12px 0', borderBottom: '1px solid rgba(128,128,128,0.25)' }}>
            {item.title}
          </article>
        ))}
      </div>
      {loading ? <p>Loading…</p> : null}
      {status === 'error' ? (
        <p role="alert">
          Something went wrong{' '}
          <button type="button" onClick={loadMore}>
            Retry
          </button>
        </p>
      ) : null}
      {status === 'done' ? <p>You're all caught up</p> : null}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
    </div>
  );
}
