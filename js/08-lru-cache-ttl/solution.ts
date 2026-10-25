export type EvictReason = 'evict' | 'expire' | 'delete';

export type LRUCacheOptions<K, V> = {
  maxSize: number;
  ttl?: number;
  onEvict?: (key: K, value: V, reason: EvictReason) => void;
};

type Node<K, V> = {
  key: K;
  value: V;
  expiresAt: number; // Infinity = never
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
};

/**
 * Map gives O(1) lookup by key; the doubly linked list gives O(1) "move to front"
 * and "remove the oldest". head = most recently used, tail = least recently used.
 */
export class LRUCache<K, V> {
  private readonly map = new Map<K, Node<K, V>>();
  private head: Node<K, V> | null = null;
  private tail: Node<K, V> | null = null;
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly onEvict?: (key: K, value: V, reason: EvictReason) => void;

  constructor(options: LRUCacheOptions<K, V>) {
    if (!Number.isInteger(options.maxSize) || options.maxSize < 1) {
      throw new RangeError(`maxSize must be an integer >= 1, got ${options.maxSize}`);
    }
    this.maxSize = options.maxSize;
    this.ttl = options.ttl ?? 0;
    this.onEvict = options.onEvict;
  }

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const node = this.live(key);
    if (!node) return undefined;
    this.moveToFront(node);
    return node.value;
  }

  peek(key: K): V | undefined {
    return this.live(key)?.value;
  }

  has(key: K): boolean {
    return this.live(key) !== undefined;
  }

  set(key: K, value: V, options: { ttl?: number } = {}): this {
    const ttl = options.ttl ?? this.ttl;
    const expiresAt = ttl > 0 ? Date.now() + ttl : Infinity;
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      this.moveToFront(existing);
      return this;
    }
    const node: Node<K, V> = { key, value, expiresAt, prev: null, next: null };
    this.map.set(key, node);
    this.addToFront(node);
    if (this.map.size > this.maxSize) this.remove(this.tail!, 'evict');
    return this;
  }

  delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.remove(node, 'delete');
    return true;
  }

  keys(): K[] {
    const now = Date.now();
    const out: K[] = [];
    for (let n = this.head; n; n = n.next) if (n.expiresAt > now) out.push(n.key);
    return out;
  }

  clear(): void {
    this.map.clear();
    this.head = this.tail = null;
  }

  /** Returns the node if present and fresh; lazily removes it if expired. */
  private live(key: K): Node<K, V> | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    if (Date.now() >= node.expiresAt) {
      this.remove(node, 'expire');
      return undefined;
    }
    return node;
  }

  private remove(node: Node<K, V>, reason: EvictReason) {
    this.map.delete(node.key);
    this.unlink(node);
    this.onEvict?.(node.key, node.value, reason); // called after the cache is consistent
  }

  private unlink(node: Node<K, V>) {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = node.next = null;
  }

  private addToFront(node: Node<K, V>) {
    node.next = this.head;
    node.prev = null;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private moveToFront(node: Node<K, V>) {
    if (this.head === node) return;
    this.unlink(node);
    this.addToFront(node);
  }
}
