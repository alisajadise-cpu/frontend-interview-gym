# 08 · LRU cache with TTL (O(1), doubly linked list)

**Difficulty:** Hard · **Time:** 40–50 min · **Similar to:** LeetCode 146 *LRU Cache*, LeetCode 2622 *Cache With Time Limit*, the `lru-cache` npm package

## Why companies ask this

Frontends cache API responses, decoded images, computed layouts, and autocomplete results. An unbounded `Map` is a memory leak. An LRU ("least recently used") cache keeps memory bounded and keeps the *useful* entries. Adding a TTL ("time to live") stops it from serving stale data. Interviewers expect **O(1)** for every operation and clean handling of expiry and eviction callbacks.

## Task

Implement `class LRUCache<K, V>` in `index.ts`.

```ts
const cache = new LRUCache<string, Response>({
  maxSize: 100,
  ttl: 60_000,
  onEvict: (key, value, reason) => console.log('removed', key, reason),
});
cache.set('/api/me', res);
cache.set('/api/feed', feed, { ttl: 5_000 }); // shorter TTL for this entry
cache.get('/api/me');  // refreshes recency
cache.peek('/api/me'); // does NOT refresh recency
```

## Requirements

1. `new LRUCache({ maxSize, ttl?, onEvict? })`. `maxSize` must be an integer ≥ 1, otherwise throw a `RangeError`. `ttl` in ms; `0` or missing means no expiry.
2. `set(key, value, { ttl? })`: insert or update. The entry becomes the **most recently used**. Its expiry time restarts. The per-entry `ttl` overrides the default (`0` = never expires). Returns `this`. Updating an existing key does **not** call `onEvict`.
3. When a new key would make `size > maxSize`, remove the **least recently used** entry and call `onEvict(key, value, 'evict')`.
4. `get(key)`: returns the value and makes it most recently used. Returns `undefined` if missing.
5. `peek(key)`: returns the value **without** changing recency.
6. `has(key)`: `true` if present and not expired. Doesn't change recency.
7. `delete(key)`: removes the entry, calls `onEvict(key, value, 'delete')`, and returns `true` if something was removed.
8. **Expiry is lazy:** an entry expires when `Date.now() >= setTime + ttl`. When `get`/`peek`/`has` find an expired entry, they remove it, call `onEvict(key, value, 'expire')`, and act as if it were missing.
9. `size`: the number of stored entries (expired entries count until they're removed).
10. `keys()`: an array of non-expired keys, **most recently used first**.
11. `clear()`: removes everything, without calling `onEvict`.
12. All operations except `keys()` and `clear()` are **O(1)**. Use a `Map` plus a **doubly linked list**.
13. When `onEvict` runs, the entry is already gone from the cache.

## Edge cases interviewers probe

- `set` on an existing key when the cache is full: no eviction.
- `maxSize: 1`.
- `get` on an expired key must not count as "recently used".

## Follow-ups

- A JS `Map` already keeps insertion order, so `delete` + `set` moves a key to the end. That gives you a very short LRU. Why do interviewers still ask for the linked list? (They want to know you can build it in any language. Also, `Map` re-insertion does extra hashing work. Both are O(1), but the linked list makes the cost explicit.)
- Size by **bytes** instead of count (`sizeCalculation`), for caching images.
- Active expiry: a timer per entry vs lazy expiry vs a periodic sweep. What are the trade-offs?
- How would you share this cache between browser tabs? (`BroadcastChannel`, IndexedDB.)

## Run

```bash
npm test js/08-lru-cache-ttl
npm run test:solution js/08-lru-cache-ttl
```
