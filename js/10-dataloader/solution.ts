export type BatchFn<K, V> = (keys: readonly K[]) => Promise<ReadonlyArray<V | Error>>;

export type LoaderOptions = {
  maxBatchSize?: number;
  cache?: boolean;
  scheduler?: (callback: () => void) => void;
};

export type Loader<K, V> = {
  load(key: K): Promise<V>;
  loadMany(keys: readonly K[]): Promise<Array<V | Error>>;
  clear(key: K): Loader<K, V>;
  clearAll(): Loader<K, V>;
  prime(key: K, value: V | Error): Loader<K, V>;
};

type Callbacks<V> = { resolve: (v: V) => void; reject: (e: unknown) => void };

type Batch<K, V> = {
  dispatched: boolean;
  // Map keeps insertion order AND dedupes keys inside one batch.
  callbacks: Map<K, Callbacks<V>[]>;
};

export function createLoader<K, V>(batchFn: BatchFn<K, V>, options: LoaderOptions = {}): Loader<K, V> {
  const maxBatchSize = options.maxBatchSize ?? Infinity;
  const useCache = options.cache ?? true;
  const schedule = options.scheduler ?? ((cb: () => void) => queueMicrotask(cb));

  const cache = new Map<K, Promise<V>>();
  let current: Batch<K, V> | null = null;

  function getBatch(key: K): Batch<K, V> {
    const fits = current && !current.dispatched && (current.callbacks.has(key) || current.callbacks.size < maxBatchSize);
    if (fits) return current!;
    const batch: Batch<K, V> = { dispatched: false, callbacks: new Map() };
    current = batch;
    schedule(() => dispatch(batch));
    return batch;
  }

  function failKey(key: K, callbacks: Callbacks<V>[], error: unknown) {
    cache.delete(key); // allow a retry later
    for (const cb of callbacks) cb.reject(error);
  }

  async function dispatch(batch: Batch<K, V>) {
    batch.dispatched = true;
    if (current === batch) current = null;
    const entries = [...batch.callbacks];
    const keys = entries.map(([k]) => k);

    let values: ReadonlyArray<V | Error>;
    try {
      values = await batchFn(keys);
    } catch (error) {
      for (const [key, cbs] of entries) failKey(key, cbs, error);
      return;
    }

    if (!Array.isArray(values) || values.length !== keys.length) {
      const error = new Error(
        `DataLoader: batchFn must return an array of the same length as keys. Got ${
          Array.isArray(values) ? values.length : typeof values
        } values for ${keys.length} keys.`,
      );
      for (const [key, cbs] of entries) failKey(key, cbs, error);
      return;
    }

    entries.forEach(([key, cbs], i) => {
      const value = values[i];
      if (value instanceof Error) failKey(key, cbs, value);
      else for (const cb of cbs) cb.resolve(value);
    });
  }

  const loader: Loader<K, V> = {
    load(key) {
      if (useCache) {
        const cached = cache.get(key);
        if (cached) return cached;
      }
      const batch = getBatch(key);
      const promise = new Promise<V>((resolve, reject) => {
        const list = batch.callbacks.get(key) ?? [];
        list.push({ resolve, reject });
        batch.callbacks.set(key, list);
      });
      if (useCache) cache.set(key, promise);
      return promise;
    },

    loadMany(keys) {
      return Promise.all(keys.map((k) => loader.load(k).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))));
    },

    clear(key) {
      cache.delete(key);
      return loader;
    },

    clearAll() {
      cache.clear();
      return loader;
    },

    prime(key, value) {
      if (useCache && !cache.has(key)) {
        const promise = value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
        promise.catch(() => {}); // a primed error should not be an "unhandled rejection"
        cache.set(key, promise);
      }
      return loader;
    },
  };

  return loader;
}
