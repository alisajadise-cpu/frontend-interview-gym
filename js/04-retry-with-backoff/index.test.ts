import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retry } from './index';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** fn that fails `failures` times, then resolves with 'ok'. */
function flaky(failures: number, makeError = (n: number) => new Error(`fail ${n}`)) {
  let calls = 0;
  return vi.fn(async () => {
    calls++;
    if (calls <= failures) throw makeError(calls);
    return 'ok';
  });
}

describe('retry: basics', () => {
  it('resolves on the first try and passes (attempt, signal)', async () => {
    const fn = vi.fn(async () => 42);
    await expect(retry(fn)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1, undefined);
  });

  it('retries with exponential delays (100, 200) and then succeeds', async () => {
    const fn = flaky(2);
    const p = retry(fn);
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toBe(2);
    await vi.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after `retries` and rejects with the last error', async () => {
    const fn = flaky(10);
    const result = retry(fn, { retries: 2 }).catch((e: Error) => e);
    await vi.runAllTimersAsync();
    expect(((await result) as Error).message).toBe('fail 3');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries: 0 means exactly one call', async () => {
    const fn = flaky(5);
    const result = retry(fn, { retries: 0 }).catch((e: Error) => e);
    await vi.runAllTimersAsync();
    expect(((await result) as Error).message).toBe('fail 1');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('treats a synchronous throw as a failure', async () => {
    let n = 0;
    const p = retry(() => {
      n++;
      if (n === 1) throw new Error('sync');
      return 'second time';
    });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('second time');
  });
});

describe('retry: delays', () => {
  it('caps delays at maxDelay and reports them via onRetry(error, attempt, delay)', async () => {
    const onRetry = vi.fn();
    const fn = flaky(3);
    const p = retry(fn, { baseDelay: 1000, factor: 10, maxDelay: 5000, onRetry });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
    expect(onRetry.mock.calls.map((c: unknown[]) => [(c[0] as Error).message, c[1], c[2]])).toEqual([
      ['fail 1', 1, 1000],
      ['fail 2', 2, 5000],
      ['fail 3', 3, 5000],
    ]);
  });

  it('full jitter uses random() * cappedDelay, rounded down', async () => {
    const onRetry = vi.fn();
    const p = retry(flaky(3), { jitter: 'full', random: () => 0.5, onRetry });
    await vi.runAllTimersAsync();
    await p;
    expect(onRetry.mock.calls.map((c: unknown[]) => c[2])).toEqual([50, 100, 200]);
  });

  it('uses err.retryAfterMs when present (still capped by maxDelay)', async () => {
    const onRetry = vi.fn();
    const p = retry(
      flaky(2, (n) => Object.assign(new Error(`429 #${n}`), { retryAfterMs: n === 1 ? 3000 : 90_000 })),
      { jitter: 'full', random: () => 0.1, maxDelay: 60_000, onRetry },
    );
    await vi.runAllTimersAsync();
    await p;
    expect(onRetry.mock.calls.map((c: unknown[]) => c[2])).toEqual([3000, 60_000]);
  });

  it('stops when shouldRetry returns false', async () => {
    const shouldRetry = vi.fn((err: unknown) => (err as Error).message !== 'fail 2');
    const fn = flaky(5);
    const result = retry(fn, { shouldRetry }).catch((e: Error) => e);
    await vi.runAllTimersAsync();
    expect(((await result) as Error).message).toBe('fail 2');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(shouldRetry.mock.calls.map((c: unknown[]) => c[1])).toEqual([1, 2]);
  });
});

describe('retry: abort', () => {
  it('rejects without calling fn when already aborted', async () => {
    const controller = new AbortController();
    const reason = new Error('left the page');
    controller.abort(reason);
    const fn = vi.fn();
    await expect(retry(fn, { signal: controller.signal })).rejects.toBe(reason);
    expect(fn).not.toHaveBeenCalled();
  });

  it('aborting during the wait rejects immediately and clears the timer', async () => {
    const controller = new AbortController();
    const fn = flaky(5);
    const result = retry(fn, { baseDelay: 10_000, signal: controller.signal }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1); // waiting 10s
    controller.abort();
    const error = await result;
    expect((error as DOMException).name).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborting while fn runs rejects right away and does not retry', async () => {
    const controller = new AbortController();
    const fn = vi.fn((attempt: number, signal: AbortSignal | undefined) => new Promise<string>(() => {})); // ignores the signal, never settles
    const result = retry(fn, { signal: controller.signal }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(fn.mock.calls[0][1]).toBe(controller.signal);
    const reason = new Error('cancelled');
    controller.abort(reason);
    expect(await result).toBe(reason);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
