import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LRUCache } from './index';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('LRUCache: basics', () => {
  it('stores and reads values; missing keys give undefined', () => {
    const c = new LRUCache<string, number>({ maxSize: 2 });
    expect(c.set('a', 1)).toBe(c);
    expect(c.get('a')).toBe(1);
    expect(c.get('missing')).toBeUndefined();
    expect(c.has('a')).toBe(true);
    expect(c.size).toBe(1);
  });

  it('throws RangeError for an invalid maxSize', () => {
    expect(() => new LRUCache({ maxSize: 0 })).toThrow(RangeError);
    expect(() => new LRUCache({ maxSize: 2.5 })).toThrow(RangeError);
  });

  it('evicts the least recently used entry and calls onEvict', () => {
    const onEvict = vi.fn();
    const c = new LRUCache<string, number>({ maxSize: 2, onEvict });
    c.set('a', 1).set('b', 2).set('c', 3);
    expect(c.has('a')).toBe(false);
    expect(c.keys()).toEqual(['c', 'b']);
    expect(onEvict).toHaveBeenCalledWith('a', 1, 'evict');
  });

  it('get refreshes recency', () => {
    const c = new LRUCache<string, number>({ maxSize: 2 });
    c.set('a', 1).set('b', 2);
    c.get('a');
    c.set('c', 3);
    expect(c.keys()).toEqual(['c', 'a']);
  });

  it('peek and has do not refresh recency', () => {
    const c = new LRUCache<string, number>({ maxSize: 2 });
    c.set('a', 1).set('b', 2);
    expect(c.peek('a')).toBe(1);
    expect(c.has('a')).toBe(true);
    c.set('c', 3);
    expect(c.has('a')).toBe(false);
  });

  it('updating a key refreshes it, keeps size, and does not evict', () => {
    const onEvict = vi.fn();
    const c = new LRUCache<string, number>({ maxSize: 2, onEvict });
    c.set('a', 1).set('b', 2).set('a', 10);
    expect(c.size).toBe(2);
    expect(c.keys()).toEqual(['a', 'b']);
    expect(c.get('a')).toBe(10);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('delete removes the entry and reports "delete"', () => {
    const onEvict = vi.fn((key: string) => {
      expect(c.has(key)).toBe(false); // already gone when the callback runs
    });
    const c = new LRUCache<string, number>({ maxSize: 3, onEvict });
    c.set('a', 1).set('b', 2);
    expect(c.delete('a')).toBe(true);
    expect(c.delete('a')).toBe(false);
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict).toHaveBeenCalledWith('a', 1, 'delete');
    expect(c.keys()).toEqual(['b']);
    expect(c.size).toBe(1);
  });

  it('works with maxSize 1 and keeps the list consistent', () => {
    const c = new LRUCache<number, string>({ maxSize: 1 });
    for (let i = 0; i < 5; i++) c.set(i, `v${i}`);
    expect(c.keys()).toEqual([4]);
    c.delete(4);
    expect(c.keys()).toEqual([]);
    c.set(9, 'v9');
    expect(c.keys()).toEqual([9]);
  });

  it('clear removes everything without calling onEvict', () => {
    const onEvict = vi.fn();
    const c = new LRUCache<string, number>({ maxSize: 3, onEvict });
    c.set('a', 1).set('b', 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.keys()).toEqual([]);
    expect(onEvict).not.toHaveBeenCalled();
    c.set('c', 3);
    expect(c.get('c')).toBe(3);
  });
});

describe('LRUCache: TTL', () => {
  it('expires entries lazily and reports "expire"', () => {
    const onEvict = vi.fn();
    const c = new LRUCache<string, number>({ maxSize: 5, ttl: 1000, onEvict });
    c.set('a', 1);
    vi.advanceTimersByTime(999);
    expect(c.get('a')).toBe(1);
    vi.advanceTimersByTime(1);
    expect(c.size).toBe(1); // lazy: still stored until touched
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toBe(0);
    expect(onEvict).toHaveBeenCalledWith('a', 1, 'expire');
  });

  it('peek and has also expire entries', () => {
    const c = new LRUCache<string, number>({ maxSize: 5, ttl: 100 });
    c.set('a', 1).set('b', 2);
    vi.advanceTimersByTime(100);
    expect(c.peek('a')).toBeUndefined();
    expect(c.has('b')).toBe(false);
    expect(c.size).toBe(0);
  });

  it('keys() skips expired entries', () => {
    const c = new LRUCache<string, number>({ maxSize: 5, ttl: 100 });
    c.set('old', 1);
    vi.advanceTimersByTime(60);
    c.set('new', 2);
    vi.advanceTimersByTime(40);
    expect(c.keys()).toEqual(['new']);
  });

  it('per-entry ttl overrides the default, and ttl 0 means never expire', () => {
    const c = new LRUCache<string, number>({ maxSize: 5, ttl: 100 });
    c.set('short', 1, { ttl: 10 });
    c.set('forever', 2, { ttl: 0 });
    c.set('default', 3);
    vi.advanceTimersByTime(50);
    expect(c.has('short')).toBe(false);
    expect(c.has('default')).toBe(true);
    vi.advanceTimersByTime(1_000_000);
    expect(c.has('default')).toBe(false);
    expect(c.get('forever')).toBe(2);
  });

  it('set restarts the expiry time', () => {
    const c = new LRUCache<string, number>({ maxSize: 5, ttl: 100 });
    c.set('a', 1);
    vi.advanceTimersByTime(80);
    c.set('a', 2);
    vi.advanceTimersByTime(80);
    expect(c.get('a')).toBe(2);
  });
});
