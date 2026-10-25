import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './index';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('debounce: trailing (default)', () => {
  it('calls once, wait ms after the last call, with the latest args', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    vi.advanceTimersByTime(50);
    d('b');
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('keeps `this` of the latest call', () => {
    const seen: unknown[] = [];
    const obj = {
      name: 'obj',
      save: debounce(function (this: { name: string }) {
        seen.push(this.name);
      }, 50),
    };
    obj.save();
    vi.advanceTimersByTime(50);
    expect(seen).toEqual(['obj']);
  });

  it('starts a new burst after the trailing call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    vi.advanceTimersByTime(100);
    d(2);
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[1], [2]]);
  });

  it('returns the result of the last invocation', () => {
    const d = debounce((x: number) => x * 2, 100);
    expect(d(1)).toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(d(5)).toBe(2);
    vi.advanceTimersByTime(100);
    expect(d(7)).toBe(10);
  });
});

describe('debounce: leading', () => {
  it('leading only: fires immediately and ignores the rest of the burst', () => {
    const fn = vi.fn((x: string) => x);
    const d = debounce(fn, 100, { leading: true, trailing: false });
    expect(d('a')).toBe('a');
    d('b');
    d('c');
    vi.advanceTimersByTime(200);
    expect(fn.mock.calls).toEqual([['a']]);
    d('d'); // new burst
    expect(fn.mock.calls).toEqual([['a'], ['d']]);
  });

  it('leading + trailing: a single call fires only once', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100, { leading: true, trailing: true });
    d('only');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('leading + trailing: 2+ calls fire on both edges, trailing gets latest args', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100, { leading: true, trailing: true });
    d('a');
    vi.advanceTimersByTime(30);
    d('b');
    vi.advanceTimersByTime(30);
    d('c');
    expect(fn.mock.calls).toEqual([['a']]);
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([['a'], ['c']]);
  });
});

describe('debounce: maxWait', () => {
  it('invokes at least every maxWait ms during a continuous burst', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100, { maxWait: 200 });
    for (let i = 0; i < 20; i++) {
      d(i); // a call every 50ms for 1 second
      vi.advanceTimersByTime(50);
    }
    // Without maxWait this would be 0 calls so far.
    expect(fn).toHaveBeenCalledTimes(5);
    expect(fn.mock.calls[0]).toEqual([3]);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(5); // the last call was already flushed at t=1000
  });

  it('treats maxWait < wait as wait', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100, { maxWait: 10 });
    d();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('debounce: cancel / flush / pending', () => {
  it('cancel drops the pending call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    expect(d.pending()).toBe(true);
    d.cancel();
    expect(d.pending()).toBe(false);
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush runs the pending call now and returns its result', () => {
    const fn = vi.fn((x: number) => x + 1);
    const d = debounce(fn, 100);
    d(1);
    d(41);
    expect(d.flush()).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(41);
    expect(d.pending()).toBe(false);
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending returns the last result without calling fn', () => {
    const fn = vi.fn(() => 'saved');
    const d = debounce(fn, 100);
    expect(d.flush()).toBeUndefined();
    d();
    vi.advanceTimersByTime(100);
    expect(d.flush()).toBe('saved');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('works again normally after cancel', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100, { leading: true });
    d('a');
    d.cancel();
    d('b');
    expect(fn.mock.calls).toEqual([['a'], ['b']]);
  });
});
