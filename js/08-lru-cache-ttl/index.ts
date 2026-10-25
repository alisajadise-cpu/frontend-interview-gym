export type EvictReason = 'evict' | 'expire' | 'delete';

export type LRUCacheOptions<K, V> = {
  maxSize: number;
  ttl?: number;
  onEvict?: (key: K, value: V, reason: EvictReason) => void;
};

export class LRUCache<K, V> {
  constructor(options: LRUCacheOptions<K, V>) {
    throw new Error('Not implemented: LRUCache');
  }

  get size(): number {
    throw new Error('Not implemented: size');
  }

  get(key: K): V | undefined {
    throw new Error('Not implemented: get');
  }

  peek(key: K): V | undefined {
    throw new Error('Not implemented: peek');
  }

  has(key: K): boolean {
    throw new Error('Not implemented: has');
  }

  set(key: K, value: V, options?: { ttl?: number }): this {
    throw new Error('Not implemented: set');
  }

  delete(key: K): boolean {
    throw new Error('Not implemented: delete');
  }

  keys(): K[] {
    throw new Error('Not implemented: keys');
  }

  clear(): void {
    throw new Error('Not implemented: clear');
  }
}
