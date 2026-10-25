import { describe, expect, it, vi } from 'vitest';
import { MyPromise } from './index';

const macrotask = () => new Promise((r) => setTimeout(r, 0));

describe('MyPromise: core', () => {
  it('resolves asynchronously and works with await', async () => {
    const p = new MyPromise<number>((resolve) => setTimeout(() => resolve(7), 5));
    expect(await p).toBe(7);
  });

  it('runs then callbacks as microtasks, in order, before macrotasks', async () => {
    const log: string[] = [];
    setTimeout(() => log.push('timeout'), 0);
    const p = MyPromise.resolve(1);
    p.then(() => log.push('then 1'));
    p.then(() => log.push('then 2'));
    log.push('sync');
    await macrotask();
    expect(log).toEqual(['sync', 'then 1', 'then 2', 'timeout']);
  });

  it('settles only once', async () => {
    const p = new MyPromise<string>((resolve, reject) => {
      resolve('first');
      resolve('second');
      reject(new Error('ignored'));
    });
    expect(await p).toBe('first');
  });

  it('rejects when the executor throws, unless already resolved', async () => {
    const err = new Error('boom');
    await expect(
      new MyPromise(() => {
        throw err;
      }),
    ).rejects.toBe(err);
    const resolved = new MyPromise<number>((resolve) => {
      resolve(1);
      throw new Error('ignored');
    });
    expect(await resolved).toBe(1);
  });

  it('chains values and turns thrown errors into rejections', async () => {
    const result = await MyPromise.resolve(1)
      .then((x) => x + 1)
      .then((x) => {
        throw new Error(`bad ${x}`);
      })
      .then(() => 'skipped')
      .catch((e: unknown) => (e as Error).message);
    expect(result).toBe('bad 2');
  });

  it('passes values and errors through non-function arguments', async () => {
    expect(await MyPromise.resolve('v').then(null).then(undefined, null)).toBe('v');
    const err = new Error('e');
    await expect(MyPromise.reject(err).then((x) => x)).rejects.toBe(err);
  });

  it('flattens returned MyPromise and native promise values', async () => {
    const value = await MyPromise.resolve(1)
      .then((x) => MyPromise.resolve(x + 1))
      .then((x) => Promise.resolve(x + 1));
    expect(value).toBe(3);
  });

  it('rejects with TypeError on a chaining cycle', async () => {
    const p: MyPromise<unknown> = MyPromise.resolve(1).then(() => p);
    await expect(p).rejects.toBeInstanceOf(TypeError);
  });

  it('adopts thenables: reads then once, only the first callback counts', async () => {
    const thenGetter = vi.fn(() => (resolve: (v: string) => void, reject: (e: unknown) => void) => {
      resolve('from thenable');
      reject(new Error('ignored'));
      resolve('ignored too');
    });
    const thenable = {
      get then() {
        return thenGetter();
      },
    };
    expect(await MyPromise.resolve(thenable)).toBe('from thenable');
    expect(thenGetter).toHaveBeenCalledTimes(1);
  });

  it('rejects when reading `then` throws, and when then() throws before calling back', async () => {
    const err = new Error('getter');
    const badGetter = {
      get then() {
        throw err;
      },
    };
    await expect(MyPromise.resolve(1).then(() => badGetter)).rejects.toBe(err);
    const thrower = {
      then() {
        throw new Error('then threw');
      },
    };
    await expect(MyPromise.resolve(thrower)).rejects.toThrow('then threw');
  });

  it('is accepted by native Promise.resolve', async () => {
    expect(await Promise.resolve(new MyPromise<string>((r) => r('interop')))).toBe('interop');
  });
});

describe('MyPromise: catch and finally', () => {
  it('finally passes the value through and gets no arguments', async () => {
    const onFinally = vi.fn(() => 'ignored');
    expect(await MyPromise.resolve('value').finally(onFinally)).toBe('value');
    expect(onFinally).toHaveBeenCalledWith();
  });

  it('finally passes the error through', async () => {
    const err = new Error('original');
    await expect(MyPromise.reject(err).finally(() => {})).rejects.toBe(err);
  });

  it('finally waits for a returned promise, and its error wins', async () => {
    const log: string[] = [];
    const value = await MyPromise.resolve('v').finally(
      () => new MyPromise<void>((r) => setTimeout(() => (log.push('cleanup'), r()), 5)),
    );
    log.push(`value ${value}`);
    expect(log).toEqual(['cleanup', 'value v']);
    await expect(
      MyPromise.resolve('v').finally(() => {
        throw new Error('cleanup failed');
      }),
    ).rejects.toThrow('cleanup failed');
  });
});

describe('MyPromise: statics', () => {
  it('resolve returns the same instance for a MyPromise', () => {
    const p = MyPromise.resolve(1);
    expect(MyPromise.resolve(p)).toBe(p);
  });

  it('all keeps input order, accepts plain values, and handles empty input', async () => {
    const slow = new MyPromise<string>((r) => setTimeout(() => r('slow'), 10));
    expect(await MyPromise.all([slow, 'plain', Promise.resolve('native')])).toEqual(['slow', 'plain', 'native']);
    expect(await MyPromise.all([])).toEqual([]);
  });

  it('all rejects with the first rejection', async () => {
    const err = new Error('first');
    const later = new MyPromise((_, reject) => setTimeout(() => reject(new Error('later')), 10));
    await expect(MyPromise.all([later, MyPromise.reject(err), 1])).rejects.toBe(err);
  });

  it('allSettled reports every outcome in input order', async () => {
    const err = new Error('no');
    expect(await MyPromise.allSettled([MyPromise.reject(err), 2])).toEqual([
      { status: 'rejected', reason: err },
      { status: 'fulfilled', value: 2 },
    ]);
  });

  it('race settles like the first input to settle', async () => {
    const fast = new MyPromise<string>((r) => setTimeout(() => r('fast'), 1));
    const slow = new MyPromise<string>((r) => setTimeout(() => r('slow'), 20));
    expect(await MyPromise.race([slow, fast])).toBe('fast');
    const err = new Error('fast fail');
    await expect(MyPromise.race([slow, MyPromise.reject(err)])).rejects.toBe(err);
  });

  it('any fulfills with the first fulfillment', async () => {
    const slowOk = new MyPromise<string>((r) => setTimeout(() => r('ok'), 5));
    expect(await MyPromise.any([MyPromise.reject(new Error('a')), slowOk])).toBe('ok');
  });

  it('any rejects with AggregateError (errors in input order) when all reject', async () => {
    const e1 = new Error('1');
    const e2 = new Error('2');
    const late = new MyPromise((_, reject) => setTimeout(() => reject(e1), 5));
    const error = await MyPromise.any([late, MyPromise.reject(e2)]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([e1, e2]);
    const empty = await MyPromise.any([]).catch((e: unknown) => e);
    expect(empty).toBeInstanceOf(AggregateError);
  });
});
