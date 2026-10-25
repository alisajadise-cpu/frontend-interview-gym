import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from './index';

type Events = { msg: [text: string, n: number]; ping: []; other: [] };

describe('EventEmitter: basics', () => {
  it('calls listeners in order with the arguments and returns true', () => {
    const e = new EventEmitter<Events>();
    const order: string[] = [];
    e.on('msg', (t, n) => order.push(`a:${t}:${n}`));
    e.on('msg', (t) => order.push(`b:${t}`));
    expect(e.emit('msg', 'hi', 1)).toBe(true);
    expect(order).toEqual(['a:hi:1', 'b:hi']);
  });

  it('returns false when there are no listeners', () => {
    const e = new EventEmitter<Events>();
    expect(e.emit('ping')).toBe(false);
    const off = e.on('ping', () => {});
    off();
    expect(e.emit('ping')).toBe(false);
  });

  it('on() returns an unsubscribe function that is safe to call twice', () => {
    const e = new EventEmitter<Events>();
    const fn = vi.fn();
    const off = e.on('ping', fn);
    off();
    off();
    e.emit('ping');
    expect(fn).not.toHaveBeenCalled();
    expect(e.listenerCount('ping')).toBe(0);
  });

  it('the same function registered twice runs twice; off removes one registration', () => {
    const e = new EventEmitter<Events>();
    const fn = vi.fn();
    e.on('ping', fn);
    e.on('ping', fn);
    expect(e.listenerCount('ping')).toBe(2);
    e.emit('ping');
    expect(fn).toHaveBeenCalledTimes(2);
    e.off('ping', fn);
    expect(e.listenerCount('ping')).toBe(1);
    e.emit('ping');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('unsubscribing one registration does not remove the other one of the same fn', () => {
    const e = new EventEmitter<Events>();
    const fn = vi.fn();
    e.on('ping', fn);
    const off2 = e.on('ping', fn);
    off2();
    off2();
    expect(e.listenerCount('ping')).toBe(1);
  });

  it('once() runs only once, and off() works with once listeners', () => {
    const e = new EventEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    e.once('ping', a);
    e.once('ping', b);
    e.off('ping', b);
    e.emit('ping');
    e.emit('ping');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(e.listenerCount('ping')).toBe(0);
  });

  it('a once listener that emits the same event recursively runs only once', () => {
    const e = new EventEmitter<Events>();
    let calls = 0;
    e.once('ping', () => {
      calls++;
      e.emit('ping');
    });
    e.emit('ping');
    expect(calls).toBe(1);
  });

  it('removeAllListeners(event) and removeAllListeners()', () => {
    const e = new EventEmitter<Events>();
    const fn = vi.fn();
    e.on('ping', fn);
    e.on('other', fn);
    e.removeAllListeners('ping');
    expect(e.listenerCount('ping')).toBe(0);
    expect(e.listenerCount('other')).toBe(1);
    e.removeAllListeners();
    expect(e.emit('other')).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('EventEmitter: changes during emit', () => {
  it('listeners added during emit do not run in that emit', () => {
    const e = new EventEmitter<Events>();
    const late = vi.fn();
    e.on('ping', () => {
      e.on('ping', late);
    });
    e.emit('ping');
    expect(late).not.toHaveBeenCalled();
    e.emit('ping');
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('a listener removed during emit (before its turn) does not run', () => {
    const e = new EventEmitter<Events>();
    const second = vi.fn();
    const third = vi.fn();
    let offSecond = () => {};
    e.on('ping', () => offSecond());
    offSecond = e.on('ping', second);
    e.on('ping', third);
    e.emit('ping');
    expect(second).not.toHaveBeenCalled();
    expect(third).toHaveBeenCalledTimes(1); // no index-shifting bug
  });

  it('a listener that removes itself does not make the next one skip', () => {
    const e = new EventEmitter<Events>();
    const next = vi.fn();
    const off = e.on('ping', () => off());
    e.on('ping', next);
    e.emit('ping');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('removeAllListeners during emit stops the remaining listeners', () => {
    const e = new EventEmitter<Events>();
    const after = vi.fn();
    e.on('ping', () => e.removeAllListeners());
    e.on('ping', after);
    e.emit('ping');
    expect(after).not.toHaveBeenCalled();
  });
});

describe('EventEmitter: errors', () => {
  it('one throwing listener does not stop the others; the error is rethrown as-is', () => {
    const e = new EventEmitter<Events>();
    const boom = new Error('boom');
    const after = vi.fn();
    e.on('ping', () => {
      throw boom;
    });
    e.on('ping', after);
    let caught: unknown;
    try {
      e.emit('ping');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(boom);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('multiple errors are thrown together as an AggregateError', () => {
    const e = new EventEmitter<Events>();
    const e1 = new Error('one');
    const e2 = new Error('two');
    e.on('ping', () => {
      throw e1;
    });
    e.on('ping', () => {
      throw e2;
    });
    let caught: any;
    try {
      e.emit('ping');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    expect(caught.errors).toEqual([e1, e2]);
    expect(caught.errors[0]).toBe(e1);
  });
});
