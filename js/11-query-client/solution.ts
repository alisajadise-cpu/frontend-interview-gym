export type QueryStatus = 'idle' | 'pending' | 'success' | 'error';

export type QueryState<T = unknown> = {
  status: QueryStatus;
  data: T | undefined;
  error: unknown;
  updatedAt: number;
  isFetching: boolean;
};

export type QueryClientOptions = { staleTime?: number; gcTime?: number };

export type QueryClient = {
  fetchQuery<T>(key: string, fn: () => Promise<T>): Promise<T>;
  getQueryState<T = unknown>(key: string): QueryState<T>;
  subscribe<T = unknown>(key: string, listener: (state: QueryState<T>) => void): () => void;
  invalidate(key: string): void;
  setQueryData<T>(key: string, updater: T | ((old: T | undefined) => T)): void;
};

const IDLE: QueryState<any> = Object.freeze({
  status: 'idle',
  data: undefined,
  error: null,
  updatedAt: 0,
  isFetching: false,
}) as QueryState<any>;

type Entry = {
  state: QueryState<any>;
  listeners: Set<(s: QueryState<any>) => void>;
  promise: Promise<any> | null; // the latest in-flight fetch
  fetchId: number; // increases with every fetch: older fetches compare and give up
  lastFn: (() => Promise<any>) | null;
  invalidated: boolean;
  gcTimer: ReturnType<typeof setTimeout> | undefined;
};

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  const staleTime = options.staleTime ?? 0;
  const gcTime = options.gcTime ?? 5 * 60_000;
  const entries = new Map<string, Entry>();

  function getEntry(key: string): Entry {
    let entry = entries.get(key);
    if (!entry) {
      entry = { state: IDLE, listeners: new Set(), promise: null, fetchId: 0, lastFn: null, invalidated: false, gcTimer: undefined };
      entries.set(key, entry);
    }
    return entry;
  }

  // The only place state changes: new object + notify. Keeps snapshots immutable.
  function update(entry: Entry, patch: Partial<QueryState<any>>) {
    entry.state = { ...entry.state, ...patch };
    for (const listener of [...entry.listeners]) listener(entry.state);
  }

  function isFresh(entry: Entry) {
    return entry.state.status === 'success' && !entry.invalidated && Date.now() - entry.state.updatedAt < staleTime;
  }

  function startFetch<T>(key: string, entry: Entry, fn: () => Promise<T>): Promise<T> {
    const id = ++entry.fetchId;
    entry.lastFn = fn;
    entry.invalidated = false;
    update(entry, {
      isFetching: true,
      // Keep showing old data while revalidating: 'pending' only if there is nothing to show.
      status: entry.state.data === undefined && entry.state.status !== 'success' ? 'pending' : entry.state.status,
    });

    const promise = Promise.resolve()
      .then(fn)
      .then(
        (data) => {
          if (entry.fetchId === id && entries.get(key) === entry) {
            entry.promise = null;
            update(entry, { status: 'success', data, error: null, updatedAt: Date.now(), isFetching: false });
          }
          return data;
        },
        (error) => {
          if (entry.fetchId === id && entries.get(key) === entry) {
            entry.promise = null;
            update(entry, { status: 'error', error, isFetching: false });
          }
          throw error;
        },
      );
    entry.promise = promise;
    return promise;
  }

  return {
    fetchQuery(key, fn) {
      const entry = getEntry(key);
      if (entry.promise) return entry.promise; // dedupe in-flight
      if (isFresh(entry)) return Promise.resolve(entry.state.data);
      return startFetch(key, entry, fn);
    },

    getQueryState(key) {
      return (entries.get(key)?.state ?? IDLE) as any;
    },

    subscribe(key, listener) {
      const entry = getEntry(key);
      clearTimeout(entry.gcTimer); // someone is interested again
      entry.gcTimer = undefined;
      const wrapped = (s: QueryState<any>) => listener(s);
      entry.listeners.add(wrapped);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        entry.listeners.delete(wrapped);
        if (entry.listeners.size === 0) {
          entry.gcTimer = setTimeout(() => {
            if (entry.listeners.size === 0 && entries.get(key) === entry) entries.delete(key);
          }, gcTime);
        }
      };
    },

    invalidate(key) {
      const entry = entries.get(key);
      if (!entry) return;
      entry.invalidated = true;
      if (entry.listeners.size > 0 && entry.lastFn) {
        // Start a new fetch even if one is in flight; the old one becomes stale via fetchId.
        startFetch(key, entry, entry.lastFn).catch(() => {});
      }
    },

    setQueryData(key, updater) {
      const entry = getEntry(key);
      const data =
        typeof updater === 'function' ? (updater as (old: unknown) => unknown)(entry.state.data) : updater;
      entry.invalidated = false;
      update(entry, { status: 'success', data, error: null, updatedAt: Date.now() });
    },
  };
}
