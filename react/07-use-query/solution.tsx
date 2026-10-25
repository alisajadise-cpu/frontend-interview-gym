import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export type QueryStatus = 'pending' | 'success' | 'error';

export type QueryOptions = {
  /** How long (ms) data counts as fresh. Fresh data is never refetched on mount. Default 0. */
  staleTime?: number;
  /** When false, the query does not fetch. Default true. */
  enabled?: boolean;
};

export type QueryResult<T> = {
  data: T | undefined;
  error: unknown;
  status: QueryStatus;
  isFetching: boolean;
  refetch: () => void;
};

type Snapshot<T> = Omit<QueryResult<T>, 'refetch'>;

type Entry<T> = {
  snapshot: Snapshot<T>; // immutable object: a new one on every change (useSyncExternalStore needs this)
  dataUpdatedAt: number;
  listeners: Set<() => void>;
  promise: Promise<void> | null;
  controller: AbortController | null;
};

const cache = new Map<string, Entry<any>>();

/** Clears every query and aborts in-flight requests. Used by the tests. */
export function resetQueryCache() {
  for (const entry of cache.values()) entry.controller?.abort();
  cache.clear();
}

function getEntry<T>(key: string): Entry<T> {
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      snapshot: { data: undefined, error: undefined, status: 'pending', isFetching: false },
      dataUpdatedAt: 0,
      listeners: new Set(),
      promise: null,
      controller: null,
    };
    cache.set(key, entry);
  }
  return entry;
}

function update<T>(entry: Entry<T>, patch: Partial<Snapshot<T>>) {
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.listeners.forEach((l) => l());
}

function fetchQuery<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>) {
  const entry = getEntry<T>(key);
  if (entry.promise) return; // dedupe: one request per key at a time

  const controller = new AbortController();
  entry.controller = controller;
  update(entry, { isFetching: true });

  // Ignore results from a request that is no longer the current one (aborted or reset).
  const isCurrent = () => entry.controller === controller && cache.get(key) === entry;

  entry.promise = Promise.resolve()
    .then(() => fetcher(controller.signal))
    .then(
      (data) => {
        if (!isCurrent()) return;
        entry.promise = entry.controller = null;
        entry.dataUpdatedAt = Date.now();
        update(entry, { data, error: undefined, status: 'success', isFetching: false });
      },
      (error) => {
        if (!isCurrent()) return;
        entry.promise = entry.controller = null;
        // Keep old data (like TanStack Query): the UI can show data + error.
        update(entry, { error, status: 'error', isFetching: false });
      },
    );
}

export function useQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  { staleTime = 0, enabled = true }: QueryOptions = {},
): QueryResult<T> {
  // Latest fetcher without re-running effects when the caller passes an inline function.
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  const subscribe = useCallback(
    (onChange: () => void) => {
      const entry = getEntry<T>(key);
      entry.listeners.add(onChange);
      return () => {
        entry.listeners.delete(onChange);
        // Last subscriber gone: nobody needs the in-flight request any more.
        if (entry.listeners.size === 0 && entry.controller) {
          entry.controller.abort();
          entry.controller = null;
          entry.promise = null;
          entry.snapshot = { ...entry.snapshot, isFetching: false };
        }
      };
    },
    [key],
  );

  // Reads the snapshot for the CURRENT key, so data from a previous key is never returned.
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getEntry<T>(key).snapshot,
    () => getEntry<T>(key).snapshot,
  );

  useEffect(() => {
    if (!enabled) return;
    const entry = getEntry<T>(key);
    const isStale = entry.snapshot.status !== 'success' || Date.now() - entry.dataUpdatedAt >= staleTime;
    if (isStale) fetchQuery(key, (signal) => fetcherRef.current(signal));
  }, [key, enabled, staleTime]);

  const refetch = useCallback(() => {
    fetchQuery(key, (signal) => fetcherRef.current(signal));
  }, [key]);

  return { ...snapshot, refetch };
}
