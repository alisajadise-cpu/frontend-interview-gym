import { describe, expect, it, vi } from 'vitest';
import { TaskQueue } from './index';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('TaskQueue: concurrency', () => {
  it('validates concurrency', () => {
    expect(() => new TaskQueue({ concurrency: 0 })).toThrow(TypeError);
  });

  it('never runs more than `concurrency` tasks; starts synchronously in add', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    const ds = [deferred(), deferred(), deferred(), deferred()];
    let running = 0;
    let max = 0;
    const results = ds.map((d, i) =>
      q.add(async () => {
        running++;
        max = Math.max(max, running);
        await d.promise;
        running--;
        return i;
      }),
    );
    expect(q.pending).toBe(2);
    expect(q.size).toBe(2);
    ds.forEach((d) => d.resolve());
    expect(await Promise.all(results)).toEqual([0, 1, 2, 3]);
    expect(max).toBe(2);
  });

  it('supports sync tasks and turns a sync throw into a rejection', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    expect(await q.add(() => 5)).toBe(5);
    await expect(
      q.add(() => {
        throw new Error('sync');
      }),
    ).rejects.toThrow('sync');
  });

  it('a failing task does not stop the queue', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const failing = q.add(async () => {
      throw new Error('fail');
    });
    const ok = q.add(async () => 'ok');
    await expect(failing).rejects.toThrow('fail');
    expect(await ok).toBe('ok');
  });
});

describe('TaskQueue: priority and pause', () => {
  it('runs higher priority first, FIFO within the same priority', async () => {
    const q = new TaskQueue({ concurrency: 1, autoStart: false });
    const order: string[] = [];
    const add = (name: string, priority?: number) => q.add(() => void order.push(name), { priority });
    const all = [add('low-1', -1), add('a'), add('high-1', 5), add('b'), add('high-2', 5), add('low-2', -1)];
    expect(q.isPaused).toBe(true);
    q.start();
    await Promise.all(all);
    expect(order).toEqual(['high-1', 'high-2', 'a', 'b', 'low-1', 'low-2']);
  });

  it('pause lets running tasks finish but starts no new ones', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const d = deferred();
    const first = q.add(() => d.promise);
    const second = vi.fn(async () => {});
    q.add(second);
    q.pause();
    d.resolve();
    await first;
    await tick();
    expect(second).not.toHaveBeenCalled();
    expect(q.size).toBe(1);
    q.start();
    await q.onIdle();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('TaskQueue: onEmpty / onIdle', () => {
  it('resolve immediately when already empty/idle', async () => {
    const q = new TaskQueue();
    await q.onEmpty();
    await q.onIdle();
  });

  it('onEmpty fires when nothing waits; onIdle when nothing runs too', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const d1 = deferred();
    const d2 = deferred();
    q.add(() => d1.promise);
    q.add(() => d2.promise);
    const events: string[] = [];
    q.onEmpty().then(() => events.push('empty'));
    q.onIdle().then(() => events.push('idle'));
    d1.resolve();
    await tick();
    expect(events).toEqual(['empty']); // task 2 started, nothing waiting
    d2.resolve();
    await tick();
    expect(events).toEqual(['empty', 'idle']);
  });
});

describe('TaskQueue: cancellation and clear', () => {
  it('aborting a waiting task removes it and rejects with AbortError', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const d = deferred();
    q.add(() => d.promise);
    const controller = new AbortController();
    const task = vi.fn(async () => 'never');
    const p = q.add(task, { signal: controller.signal });
    expect(q.size).toBe(1);
    controller.abort();
    expect(q.size).toBe(0);
    const error = await p.catch((e: unknown) => e);
    expect((error as DOMException).name).toBe('AbortError');
    d.resolve();
    await q.onIdle();
    expect(task).not.toHaveBeenCalled();
  });

  it('an already-aborted signal rejects without queueing', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn();
    const error = await q.add(task, { signal: controller.signal }).catch((e: unknown) => e);
    expect((error as DOMException).name).toBe('AbortError');
    expect(task).not.toHaveBeenCalled();
    expect(q.size).toBe(0);
  });

  it('aborting a running task does not affect the queue result', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const controller = new AbortController();
    const p = q.add(async () => 'done', { signal: controller.signal });
    controller.abort();
    expect(await p).toBe('done');
  });

  it('clear drops waiting tasks without settling them', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const d = deferred();
    q.add(() => d.promise);
    const dropped = vi.fn();
    const settled = vi.fn();
    q.add(dropped).then(settled, settled);
    q.clear();
    expect(q.size).toBe(0);
    d.resolve();
    await q.onIdle();
    await tick();
    expect(dropped).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
  });

  it('tasks can add more tasks while running', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const order: number[] = [];
    await q.add(async () => {
      order.push(1);
      q.add(() => void order.push(2));
    });
    await q.onIdle();
    expect(order).toEqual([1, 2]);
  });
});
