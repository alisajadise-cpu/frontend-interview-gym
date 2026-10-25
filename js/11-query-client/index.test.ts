import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from './index';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createQueryClient: fetching', () => {
  it('unknown keys are idle', () => {
    const client = createQueryClient();
    expect(client.getQueryState('x')).toEqual({ status: 'idle', data: undefined, error: null, updatedAt: 0, isFetching: false });
  });

  it('dedupes concurrent fetches for the same key', async () => {
    const client = createQueryClient();
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);
    const p1 = client.fetchQuery('a', fn);
    const p2 = client.fetchQuery('a', fn);
    d.resolve('data');
    expect(await p1).toBe('data');
    expect(await p2).toBe('data');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('goes pending → success with updatedAt', async () => {
    const client = createQueryClient();
    const d = deferred<number>();
    const p = client.fetchQuery('a', () => d.promise);
    expect(client.getQueryState('a')).toMatchObject({ status: 'pending', isFetching: true, data: undefined });
    d.resolve(42);
    await p;
    expect(client.getQueryState('a')).toEqual({ status: 'success', data: 42, error: null, updatedAt: 1_000_000, isFetching: false });
  });

  it('returns fresh data without calling fn, and refetches once stale', async () => {
    const client = createQueryClient({ staleTime: 1000 });
    const fn = vi.fn(async () => 'v');
    await client.fetchQuery('a', fn);
    vi.advanceTimersByTime(999);
    expect(await client.fetchQuery('a', fn)).toBe('v');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await client.fetchQuery('a', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('staleTime 0 (default): refetch keeps old data visible (stale-while-revalidate)', async () => {
    const client = createQueryClient();
    await client.fetchQuery('a', async () => 'old');
    const d = deferred<string>();
    const p = client.fetchQuery('a', () => d.promise);
    expect(client.getQueryState('a')).toMatchObject({ status: 'success', data: 'old', isFetching: true });
    d.resolve('new');
    await p;
    expect(client.getQueryState('a')).toMatchObject({ status: 'success', data: 'new', isFetching: false });
  });

  it('errors reject the promise, set status error, and keep old data', async () => {
    const client = createQueryClient();
    await client.fetchQuery('a', async () => 'old');
    const boom = new Error('500');
    await expect(
      client.fetchQuery('a', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(client.getQueryState('a')).toMatchObject({ status: 'error', error: boom, data: 'old', isFetching: false });
  });

  it('keys are independent', async () => {
    const client = createQueryClient({ staleTime: 10_000 });
    const fn = vi.fn(async () => 1);
    await client.fetchQuery('a', fn);
    await client.fetchQuery('b', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('createQueryClient: subscriptions', () => {
  it('notifies on every change with a new object; unchanged state keeps its identity', async () => {
    const client = createQueryClient();
    const seen: unknown[] = [];
    const unsubscribe = client.subscribe('a', (s) => seen.push(s));
    const before = client.getQueryState('a');
    expect(client.getQueryState('a')).toBe(before);
    await client.fetchQuery('a', async () => 1);
    expect(seen).toHaveLength(2); // fetching started, then success
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen[1]).toBe(client.getQueryState('a'));
    unsubscribe();
    await client.fetchQuery('a', async () => 2);
    expect(seen).toHaveLength(2);
  });

  it('setQueryData accepts a value or an updater and notifies', () => {
    const client = createQueryClient();
    const listener = vi.fn();
    client.subscribe('n', listener);
    client.setQueryData('n', 1);
    client.setQueryData<number>('n', (old) => (old ?? 0) + 10);
    expect(client.getQueryState('n')).toMatchObject({ status: 'success', data: 11, updatedAt: 1_000_000 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('createQueryClient: invalidation and races', () => {
  it('invalidate without subscribers only marks stale', async () => {
    const client = createQueryClient({ staleTime: 60_000 });
    const fn = vi.fn(async () => 'v');
    await client.fetchQuery('a', fn);
    client.invalidate('a');
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);
    await client.fetchQuery('a', fn); // fresh by time, but invalidated
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('invalidate with subscribers refetches with the last fn', async () => {
    const client = createQueryClient({ staleTime: 60_000 });
    let n = 0;
    const fn = vi.fn(async () => ++n);
    client.subscribe('a', () => {});
    await client.fetchQuery('a', fn);
    client.invalidate('a');
    await flush();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(client.getQueryState('a').data).toBe(2);
  });

  it('an older response never overwrites a newer one', async () => {
    const client = createQueryClient();
    const slow = deferred<string>();
    const fast = deferred<string>();
    const fn = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    client.subscribe('a', () => {});
    const first = client.fetchQuery('a', fn);
    client.invalidate('a'); // starts fetch #2 while #1 is in flight
    await flush();
    expect(fn).toHaveBeenCalledTimes(2);
    fast.resolve('new');
    await flush();
    slow.resolve('old');
    expect(await first).toBe('old'); // the original caller still gets its own value
    expect(client.getQueryState('a')).toMatchObject({ status: 'success', data: 'new', isFetching: false });
  });

  it('an older error does not overwrite newer data', async () => {
    const client = createQueryClient();
    const slow = deferred<string>();
    const fn = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValueOnce('new');
    client.subscribe('a', () => {});
    const first = client.fetchQuery('a', fn).catch(() => 'failed');
    client.invalidate('a');
    await flush();
    slow.reject(new Error('old error'));
    await first;
    expect(client.getQueryState('a')).toMatchObject({ status: 'success', data: 'new', error: null });
  });
});

describe('createQueryClient: garbage collection', () => {
  it('deletes the entry gcTime ms after the last subscriber leaves', async () => {
    const client = createQueryClient({ gcTime: 1000 });
    const a = client.subscribe('a', () => {});
    const b = client.subscribe('a', () => {});
    await client.fetchQuery('a', async () => 'v');
    a();
    vi.advanceTimersByTime(5000);
    expect(client.getQueryState('a').data).toBe('v'); // b is still subscribed
    b();
    vi.advanceTimersByTime(999);
    expect(client.getQueryState('a').data).toBe('v');
    vi.advanceTimersByTime(1);
    expect(client.getQueryState('a').status).toBe('idle');
  });

  it('subscribing again cancels garbage collection', async () => {
    const client = createQueryClient({ gcTime: 1000 });
    const off = client.subscribe('a', () => {});
    await client.fetchQuery('a', async () => 'v');
    off();
    vi.advanceTimersByTime(500);
    client.subscribe('a', () => {});
    vi.advanceTimersByTime(5000);
    expect(client.getQueryState('a').data).toBe('v');
  });
});
