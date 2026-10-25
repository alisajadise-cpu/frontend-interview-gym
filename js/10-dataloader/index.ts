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

export function createLoader<K, V>(batchFn: BatchFn<K, V>, options: LoaderOptions = {}): Loader<K, V> {
  throw new Error('Not implemented: createLoader');
}
