export type ThrottleOptions = {
  leading?: boolean;
  trailing?: boolean;
};

export type Throttled<F extends (...args: any[]) => any> = {
  (this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined;
  cancel(): void;
  flush(): ReturnType<F> | undefined;
};

export function throttle<F extends (...args: any[]) => any>(
  fn: F,
  wait = 0,
  options: ThrottleOptions = {},
): Throttled<F> {
  throw new Error('Not implemented: throttle');
}
