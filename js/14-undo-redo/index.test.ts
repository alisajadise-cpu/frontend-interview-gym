import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHistory } from './index';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createHistory: basics', () => {
  it('set / undo / redo', () => {
    const h = createHistory(0);
    h.set(1);
    h.set(2);
    expect(h.get()).toBe(2);
    expect(h.undo()).toBe(true);
    expect(h.get()).toBe(1);
    expect(h.undo()).toBe(true);
    expect(h.get()).toBe(0);
    expect(h.undo()).toBe(false);
    expect(h.get()).toBe(0);
    expect(h.redo()).toBe(true);
    expect(h.redo()).toBe(true);
    expect(h.redo()).toBe(false);
    expect(h.get()).toBe(2);
  });

  it('canUndo / canRedo', () => {
    const h = createHistory('a');
    expect([h.canUndo(), h.canRedo()]).toEqual([false, false]);
    h.set('b');
    expect([h.canUndo(), h.canRedo()]).toEqual([true, false]);
    h.undo();
    expect([h.canUndo(), h.canRedo()]).toEqual([false, true]);
  });

  it('a new set after undo clears the redo stack', () => {
    const h = createHistory(0);
    h.set(1);
    h.set(2);
    h.undo();
    h.set(3);
    expect(h.canRedo()).toBe(false);
    expect(h.redo()).toBe(false);
    h.undo();
    expect(h.get()).toBe(1);
  });

  it('setting the same value does nothing', () => {
    const h = createHistory(1);
    const listener = vi.fn();
    h.subscribe(listener);
    h.set(1);
    expect(h.canUndo()).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('limit drops the oldest steps', () => {
    const h = createHistory(0, { limit: 3 });
    for (let i = 1; i <= 10; i++) h.set(i);
    let undos = 0;
    while (h.undo()) undos++;
    expect(undos).toBe(3);
    expect(h.get()).toBe(7);
  });

  it('subscribe is notified on set, undo and redo; unsubscribe stops it', () => {
    const h = createHistory(0);
    const seen: number[] = [];
    const off = h.subscribe((v) => seen.push(v));
    h.set(1);
    h.undo();
    h.redo();
    off();
    h.set(5);
    expect(seen).toEqual([1, 0, 1]);
  });
});

describe('createHistory: coalescing', () => {
  it('merges sets with the same key inside a sliding window', () => {
    const h = createHistory('', { coalesceMs: 500 });
    for (const text of ['h', 'he', 'hel', 'hell', 'hello']) {
      h.set(text, { coalesceKey: 'title' });
      vi.advanceTimersByTime(400); // each set restarts the window
    }
    h.undo();
    expect(h.get()).toBe('');
  });

  it('starts a new step after a pause', () => {
    const h = createHistory('', { coalesceMs: 500 });
    h.set('a', { coalesceKey: 't' });
    h.set('ab', { coalesceKey: 't' });
    vi.advanceTimersByTime(500);
    h.set('abc', { coalesceKey: 't' });
    h.undo();
    expect(h.get()).toBe('ab');
  });

  it('different keys never merge', () => {
    const h = createHistory({ a: '', b: '' }, { coalesceMs: 500 });
    h.set({ a: 'x', b: '' }, { coalesceKey: 'a' });
    h.set({ a: 'x', b: 'y' }, { coalesceKey: 'b' });
    h.undo();
    expect(h.get()).toEqual({ a: 'x', b: '' });
  });

  it('coalesceMs 0 (default) never merges', () => {
    const h = createHistory('');
    h.set('a', { coalesceKey: 't' });
    h.set('ab', { coalesceKey: 't' });
    h.undo();
    expect(h.get()).toBe('a');
  });

  it('undo closes the merge group, and a merged set still clears redo', () => {
    const h = createHistory('', { coalesceMs: 500 });
    h.set('a', { coalesceKey: 't' });
    h.set('b', { coalesceKey: 't' });
    h.undo(); // ''
    h.set('c', { coalesceKey: 't' }); // new step, not merged into anything
    expect(h.canRedo()).toBe(false);
    h.undo();
    expect(h.get()).toBe('');
  });
});

describe('createHistory: batch', () => {
  it('turns many sets into one step and notifies once', () => {
    const h = createHistory(0);
    const listener = vi.fn();
    h.subscribe(listener);
    h.batch(() => {
      h.set(1);
      h.set(2);
      h.batch(() => h.set(3)); // nested joins the outer batch
    });
    expect(h.get()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(3);
    h.undo();
    expect(h.get()).toBe(0);
  });

  it('a batch that ends with no change creates no step', () => {
    const h = createHistory(0);
    h.batch(() => {
      h.set(1);
      h.set(0);
    });
    expect(h.canUndo()).toBe(false);
  });

  it('undo inside a batch throws; a throwing batch still ends', () => {
    const h = createHistory(0);
    h.set(1);
    expect(() => h.batch(() => h.undo())).toThrow();
    expect(() =>
      h.batch(() => {
        h.set(2);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(h.get()).toBe(2);
    h.undo();
    expect(h.get()).toBe(1);
    h.set(5); // works normally again (not stuck in batch mode)
    h.undo();
    expect(h.get()).toBe(1);
  });
});
