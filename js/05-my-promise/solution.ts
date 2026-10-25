type Resolver<T> = (value: T | PromiseLike<T>) => void;
type Rejecter = (reason?: unknown) => void;

export type SettledResult<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

type State<T> = { status: 'pending' } | { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

export class MyPromise<T> implements PromiseLike<T> {
  private state: State<T> = { status: 'pending' };
  private handlers: Array<() => void> = [];

  constructor(executor: (resolve: Resolver<T>, reject: Rejecter) => void) {
    const [resolve, reject] = this.createResolvers();
    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error); // ignored if resolve() was already called
    }
  }

  /** resolve/reject pair that share one "already called" flag. */
  private createResolvers(): [Resolver<T>, Rejecter] {
    let called = false;
    return [
      (value) => {
        if (called) return;
        called = true;
        this.resolveWith(value);
      },
      (reason) => {
        if (called) return;
        called = true;
        this.settle({ status: 'rejected', reason });
      },
    ];
  }

  /** The Promises/A+ "resolution procedure". */
  private resolveWith(x: unknown): void {
    if (x === this) {
      this.settle({ status: 'rejected', reason: new TypeError('Chaining cycle detected for promise') });
      return;
    }
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
      let then: unknown;
      try {
        then = (x as { then?: unknown }).then; // read exactly once (it may be a getter)
      } catch (error) {
        this.settle({ status: 'rejected', reason: error });
        return;
      }
      if (typeof then === 'function') {
        // Like native promises, adopt the thenable's state in a separate job.
        queueMicrotask(() => {
          const [resolve, reject] = this.createResolvers();
          try {
            then.call(x, resolve, reject);
          } catch (error) {
            reject(error); // ignored if the thenable already called back
          }
        });
        return;
      }
    }
    this.settle({ status: 'fulfilled', value: x as T });
  }

  private settle(state: State<T>): void {
    if (this.state.status !== 'pending') return;
    this.state = state;
    const handlers = this.handlers;
    this.handlers = [];
    handlers.forEach((run) => queueMicrotask(run));
  }

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): MyPromise<R1 | R2> {
    return new MyPromise<R1 | R2>((resolve, reject) => {
      const run = () => {
        const state = this.state;
        try {
          if (state.status === 'fulfilled') {
            if (typeof onFulfilled === 'function') resolve(onFulfilled(state.value));
            else resolve(state.value as unknown as R1); // pass-through
          } else if (state.status === 'rejected') {
            if (typeof onRejected === 'function') resolve(onRejected(state.reason));
            else reject(state.reason); // pass-through
          }
        } catch (error) {
          reject(error);
        }
      };
      if (this.state.status === 'pending') this.handlers.push(run);
      else queueMicrotask(run); // always async, even if already settled
    });
  }

  catch<R = never>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null): MyPromise<T | R> {
    return this.then(undefined, onRejected);
  }

  finally(onFinally?: (() => unknown) | null): MyPromise<T> {
    if (typeof onFinally !== 'function') return this.then();
    return this.then(
      (value) => MyPromise.resolve(onFinally()).then(() => value),
      (reason) =>
        MyPromise.resolve(onFinally()).then(() => {
          throw reason;
        }),
    );
  }

  static resolve<U>(value: U | PromiseLike<U>): MyPromise<U> {
    if (value instanceof MyPromise) return value;
    return new MyPromise<U>((resolve) => resolve(value));
  }

  static reject<U = never>(reason?: unknown): MyPromise<U> {
    return new MyPromise<U>((_, reject) => reject(reason));
  }

  static all<U>(values: Iterable<U | PromiseLike<U>>): MyPromise<U[]> {
    return new MyPromise<U[]>((resolve, reject) => {
      const items = Array.from(values);
      const results = new Array<U>(items.length);
      let remaining = items.length;
      if (remaining === 0) {
        resolve(results);
        return;
      }
      items.forEach((item, i) => {
        MyPromise.resolve(item).then((value) => {
          results[i] = value;
          if (--remaining === 0) resolve(results);
        }, reject);
      });
    });
  }

  static allSettled<U>(values: Iterable<U | PromiseLike<U>>): MyPromise<SettledResult<U>[]> {
    return MyPromise.all(
      Array.from(values, (item) =>
        MyPromise.resolve(item).then(
          (value): SettledResult<U> => ({ status: 'fulfilled', value }),
          (reason): SettledResult<U> => ({ status: 'rejected', reason }),
        ),
      ),
    );
  }

  static race<U>(values: Iterable<U | PromiseLike<U>>): MyPromise<U> {
    return new MyPromise<U>((resolve, reject) => {
      for (const item of values) MyPromise.resolve(item).then(resolve, reject);
    });
  }

  static any<U>(values: Iterable<U | PromiseLike<U>>): MyPromise<U> {
    return new MyPromise<U>((resolve, reject) => {
      const items = Array.from(values);
      const errors = new Array<unknown>(items.length);
      let remaining = items.length;
      if (remaining === 0) {
        reject(new AggregateError([], 'All promises were rejected'));
        return;
      }
      items.forEach((item, i) => {
        MyPromise.resolve(item).then(resolve, (reason) => {
          errors[i] = reason;
          if (--remaining === 0) reject(new AggregateError(errors, 'All promises were rejected'));
        });
      });
    });
  }
}
