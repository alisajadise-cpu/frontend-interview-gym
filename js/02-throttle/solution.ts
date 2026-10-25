export type ThrottleOptions = {
  leading?: boolean;
  trailing?: boolean;
};

export type Throttled<F extends (...args: any[]) => any> = {
  (this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined;
  cancel(): void;
  flush(): ReturnType<F> | undefined;
};

/**
 * Throttle is debounce with `maxWait === wait` (that is exactly how lodash builds it).
 * One timer, and decisions are made by comparing timestamps.
 */
export function throttle<F extends (...args: any[]) => any>(
  fn: F,
  wait = 0,
  options: ThrottleOptions = {},
): Throttled<F> {
  const leading = options.leading ?? true;
  const trailing = options.trailing ?? true;
  const maxWait = wait;

  let lastArgs: Parameters<F> | undefined;
  let lastThis: ThisParameterType<F> | undefined;
  let result: ReturnType<F> | undefined;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let lastCallTime: number | undefined;
  let lastInvokeTime = 0;

  function invoke(time: number) {
    const args = lastArgs!;
    const ctx = lastThis;
    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = fn.apply(ctx, args);
    return result;
  }

  function shouldInvoke(time: number) {
    if (lastCallTime === undefined) return true;
    const sinceLastCall = time - lastCallTime;
    const sinceLastInvoke = time - lastInvokeTime;
    return sinceLastCall >= wait || sinceLastCall < 0 || sinceLastInvoke >= maxWait;
  }

  function remainingWait(time: number) {
    const waitLeft = wait - (time - lastCallTime!);
    return Math.min(waitLeft, maxWait - (time - lastInvokeTime));
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge(time);
      return;
    }
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function leadingEdge(time: number) {
    lastInvokeTime = time; // the window starts now
    timerId = setTimeout(timerExpired, wait);
    return leading ? invoke(time) : result;
  }

  function trailingEdge(time: number) {
    timerId = undefined;
    if (trailing && lastArgs) return invoke(time);
    lastArgs = lastThis = undefined;
    return result;
  }

  function throttled(this: ThisParameterType<F>, ...args: Parameters<F>) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) return leadingEdge(time);
      // A full window passed while calls kept coming: invoke now, start a new window.
      clearTimeout(timerId);
      timerId = setTimeout(timerExpired, wait);
      return invoke(time);
    }
    if (timerId === undefined) timerId = setTimeout(timerExpired, wait);
    return result;
  }

  throttled.cancel = () => {
    if (timerId !== undefined) clearTimeout(timerId);
    lastInvokeTime = 0;
    lastArgs = lastThis = lastCallTime = timerId = undefined;
  };

  throttled.flush = () => (timerId === undefined ? result : trailingEdge(Date.now()));

  return throttled as Throttled<F>;
}
