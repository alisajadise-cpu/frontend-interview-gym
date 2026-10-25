import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from './index';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('throttle: defaults (leading + trailing)', () => {
  it('runs immediately on the first call and returns the result', () => {
    const fn = vi.fn((x: number) => x * 10);
    const t = throttle(fn, 100);
    expect(t(1)).toBe(10);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a single call runs only once', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs a trailing call at the end of the window with the latest args', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t('a');
    vi.advanceTimersByTime(20);
    t('b');
    vi.advanceTimersByTime(20);
    t('c');
    expect(fn.mock.calls).toEqual([['a']]);
    vi.advanceTimersByTime(60);
    expect(fn.mock.calls).toEqual([['a'], ['c']]);
  });

  it('calls at most once per wait during a continuous stream', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    for (let i = 0; i < 25; i++) {
      t(i); // every 10ms for 250ms
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(500);
    expect(fn.mock.calls).toEqual([[0], [9], [19], [24]]);
  });

  it('keeps `this` of the latest call', () => {
    const names: string[] = [];
    const t = throttle(function (this: { name: string }) {
      names.push(this.name);
    }, 100);
    const a = { name: 'a', t };
    const b = { name: 'b', t };
    a.t();
    b.t();
    vi.advanceTimersByTime(100);
    expect(names).toEqual(['a', 'b']);
  });
});

describe('throttle: options', () => {
  it('leading: false waits for the end of the first window', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100, { leading: false });
    t('a');
    t('b');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([['b']]);
  });

  it('trailing: false drops calls inside the window', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100, { trailing: false });
    t('a');
    t('b');
    vi.advanceTimersByTime(50);
    t('c');
    vi.advanceTimersByTime(200);
    expect(fn.mock.calls).toEqual([['a']]);
    t('d'); // window is over: runs immediately
    expect(fn.mock.calls).toEqual([['a'], ['d']]);
  });
});

describe('throttle: cancel / flush', () => {
  it('cancel drops the pending trailing call and resets', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t('a');
    t('b');
    t.cancel();
    vi.advanceTimersByTime(500);
    expect(fn.mock.calls).toEqual([['a']]);
    t('c'); // fresh start: leading call runs immediately
    expect(fn.mock.calls).toEqual([['a'], ['c']]);
  });

  it('flush runs the pending trailing call now', () => {
    const fn = vi.fn((x: string) => x.toUpperCase());
    const t = throttle(fn, 100);
    t('a');
    t('b');
    expect(t.flush()).toBe('B');
    expect(fn.mock.calls).toEqual([['a'], ['b']]);
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('flush with nothing pending returns the last result', () => {
    const fn = vi.fn(() => 42);
    const t = throttle(fn, 100);
    expect(t.flush()).toBeUndefined();
    t();
    vi.advanceTimersByTime(200);
    expect(t.flush()).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
