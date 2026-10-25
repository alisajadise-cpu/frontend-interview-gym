import { describe, expect, it, vi } from 'vitest';
import { createLoader } from './index';

const double = vi.fn(async (keys: readonly number[]) => keys.map((k) => k * 2));

function makeBatch() {
  return vi.fn(async (keys: readonly number[]) => keys.map((k) => k * 2));
}

describe('createLoader: batching', () => {
  it('batches loads made in the same tick into one call', async () => {
    const batch = makeBatch();
    const loader = createLoader(batch);
    const results = await Promise.all([loader.load(1), loader.load(2), loader.load(3)]);
    expect(results).toEqual([2, 4, 6]);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('loads in a later tick go to a new batch', async () => {
    const batch = makeBatch();
    const loader = createLoader(batch);
    await loader.load(1);
    await loader.load(2);
    expect(batch.mock.calls).toEqual([[[1]], [[2]]]);
  });

  it('dedupes keys within a batch (cache on and off)', async () => {
    for (const cache of [true, false]) {
      const batch = makeBatch();
      const loader = createLoader(batch, { cache });
      const [a, b, c] = await Promise.all([loader.load(5), loader.load(6), loader.load(5)]);
      expect([a, b, c]).toEqual([10, 12, 10]);
      expect(batch).toHaveBeenCalledWith([5, 6]);
    }
  });

  it('respects maxBatchSize', async () => {
    const batch = makeBatch();
    const loader = createLoader(batch, { maxBatchSize: 2 });
    const results = await Promise.all([1, 2, 3, 4, 5].map((k) => loader.load(k)));
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(batch.mock.calls.map((c: unknown[]) => c[0])).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('uses a custom scheduler', async () => {
    vi.useFakeTimers();
    const batch = makeBatch();
    const loader = createLoader(batch, { scheduler: (cb) => setTimeout(cb, 10) });
    const p1 = loader.load(1);
    await Promise.resolve();
    const p2 = loader.load(2); // later microtask, still inside the 10ms window
    expect(batch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(await Promise.all([p1, p2])).toEqual([2, 4]);
    expect(batch).toHaveBeenCalledWith([1, 2]);
    vi.useRealTimers();
  });
});

describe('createLoader: errors', () => {
  it('an Error in the results rejects only that key', async () => {
    const loader = createLoader(async (keys: readonly number[]) => keys.map((k) => (k === 2 ? new Error('no 2') : k)));
    const results = await Promise.allSettled([loader.load(1), loader.load(2), loader.load(3)]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect((results[1] as PromiseRejectedResult).reason.message).toBe('no 2');
  });

  it('a batchFn rejection rejects every key of the batch', async () => {
    const boom = new Error('network');
    const loader = createLoader<number, number>(async () => {
      throw boom;
    });
    const results = await Promise.allSettled([loader.load(1), loader.load(2)]);
    expect(results).toEqual([
      { status: 'rejected', reason: boom },
      { status: 'rejected', reason: boom },
    ]);
  });

  it('a wrong-length result rejects every key with an Error', async () => {
    const loader = createLoader(async (keys: readonly number[]) => keys.slice(1));
    const results = await Promise.allSettled([loader.load(1), loader.load(2)]);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    }
  });

  it('failed keys are removed from the cache so they can be retried', async () => {
    let fail = true;
    const batch = vi.fn(async (keys: readonly number[]) => {
      if (fail) throw new Error('down');
      return keys.map((k) => k * 2);
    });
    const loader = createLoader(batch);
    await expect(loader.load(1)).rejects.toThrow('down');
    fail = false;
    await expect(loader.load(1)).resolves.toBe(2);
    expect(batch).toHaveBeenCalledTimes(2);
  });

  it('loadMany never rejects: it returns values and Errors', async () => {
    const loader = createLoader(async (keys: readonly number[]) => keys.map((k) => (k < 0 ? new Error('negative') : k)));
    const out = await loader.loadMany([1, -1, 2]);
    expect(out[0]).toBe(1);
    expect(out[1]).toBeInstanceOf(Error);
    expect(out[2]).toBe(2);
  });
});

describe('createLoader: cache', () => {
  it('returns the same promise for a cached key and does not refetch', async () => {
    const batch = makeBatch();
    const loader = createLoader(batch);
    const p1 = loader.load(7);
    const p2 = loader.load(7);
    expect(p1).toBe(p2);
    await p1;
    await loader.load(7);
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it('cache: false asks again in every tick', async () => {
    const batch = makeBatch();
    const loader = createLoader(batch, { cache: false });
    await loader.load(1);
    await loader.load(1);
    expect(batch).toHaveBeenCalledTimes(2);
  });

  it('clear, clearAll and prime (chainable)', async () => {
    const batch = makeBatch();
    const loader = createLoader(batch);
    await loader.load(1);
    await loader.load(2);
    expect(loader.clear(1)).toBe(loader);
    await loader.load(1);
    expect(batch).toHaveBeenCalledTimes(3);
    loader.clearAll().prime(2, 999).prime(3, 300);
    loader.prime(3, 1); // already primed: ignored
    expect(await loader.load(2)).toBe(999);
    expect(await loader.load(3)).toBe(300);
    expect(batch).toHaveBeenCalledTimes(3);
  });

  it('prime with an Error makes load reject', async () => {
    const loader = createLoader(double);
    loader.prime(4, new Error('primed'));
    await expect(loader.load(4)).rejects.toThrow('primed');
  });
});
