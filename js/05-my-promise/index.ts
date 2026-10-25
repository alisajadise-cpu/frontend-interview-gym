type Resolver<T> = (value: T | PromiseLike<T>) => void;
type Rejecter = (reason?: unknown) => void;

export type SettledResult<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

export class MyPromise<T> implements PromiseLike<T> {
  constructor(executor: (resolve: Resolver<T>, reject: Rejecter) => void) {
    throw new Error('Not implemented: MyPromise');
  }

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): MyPromise<R1 | R2> {
    throw new Error('Not implemented: then');
  }

  catch<R = never>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null): MyPromise<T | R> {
    throw new Error('Not implemented: catch');
  }

  finally(onFinally?: (() => unknown) | null): MyPromise<T> {
    throw new Error('Not implemented: finally');
  }

  static resolve<U>(value: U | PromiseLike<U>): MyPromise<U> {
    throw new Error('Not implemented: MyPromise.resolve');
  }

  static reject<U = never>(reason?: unknown): MyPromise<U> {
    throw new Error('Not implemented: MyPromise.reject');
  }

  static all<U>(values: Iterable<U | PromiseLike<U>>): MyPromise<U[]> {
    throw new Error('Not implemented: MyPromise.all');
  }

  static allSettled<U>(values: Iterable<U | PromiseLike<U>>): MyPromise<SettledResult<U>[]> {
    throw new Error('Not implemented: MyPromise.allSettled');
  }

  static race<U>(values: Iterable<U | PromiseLike<U>>): MyPromise<U> {
    throw new Error('Not implemented: MyPromise.race');
  }

  static any<U>(values: Iterable<U | PromiseLike<U>>): MyPromise<U> {
    throw new Error('Not implemented: MyPromise.any');
  }
}
