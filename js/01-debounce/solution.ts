export type DebounceOptions = {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
};

export type Debounced<F extends (...args: any[]) => any> = {
  (this: ThisParameterType<F>, ...args: Parameters<F>): ReturnType<F> | undefined;
  cancel(): void;
  flush(): ReturnType<F> | undefined;
  pending(): boolean;
};

/**
 * Same algorithm as lodash: keep ONE timer and decide what to do by comparing
 * timestamps, instead of clearing and re-creating a timer on every call.
 */
export function debounce<F extends (...args: any[]) => any>(
  fn: F,
  wait = 0,
  options: DebounceOptions = {},
): Debounced<F> {
  const leading = options.leading ?? false;
  const trailing = options.trailing ?? true;
  const maxing = options.maxWait !== undefined;
  const maxWait = maxing ? Math.max(options.maxWait!, wait) : 0;

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

  function remainingWait(time: number) {
    const sinceLastCall = time - lastCallTime!;
    const sinceLastInvoke = time - lastInvokeTime;
    const waitLeft = wait - sinceLastCall;
    return maxing ? Math.min(waitLeft, maxWait - sinceLastInvoke) : waitLeft;
  }

  function shouldInvoke(time: number) {
    if (lastCallTime === undefined) return true; // first call ever (or after cancel)
    const sinceLastCall = time - lastCallTime;
    const sinceLastInvoke = time - lastInvokeTime;
    return (
      sinceLastCall >= wait ||
      sinceLastCall < 0 || // system clock moved backwards
      (maxing && sinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge(time);
      return;
    }
    // Calls happened while we waited: sleep only for the time that is left.
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function leadingEdge(time: number) {
    lastInvokeTime = time; // starts the maxWait window
    timerId = setTimeout(timerExpired, wait);
    return leading ? invoke(time) : result;
  }

  function trailingEdge(time: number) {
    timerId = undefined;
    // Only fire if there was a call that has not been invoked yet.
    if (trailing && lastArgs) return invoke(time);
    lastArgs = lastThis = undefined;
    return result;
  }

  function debounced(this: ThisParameterType<F>, ...args: Parameters<F>) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) return leadingEdge(time);
      if (maxing) {
        // maxWait reached during a continuous burst: invoke now and restart.
        clearTimeout(timerId);
        timerId = setTimeout(timerExpired, wait);
        return invoke(time);
      }
    }
    if (timerId === undefined) timerId = setTimeout(timerExpired, wait);
    return result;
  }

  debounced.cancel = () => {
    if (timerId !== undefined) clearTimeout(timerId);
    lastInvokeTime = 0;
    lastArgs = lastThis = lastCallTime = timerId = undefined;
  };

  debounced.flush = () => (timerId === undefined ? result : trailingEdge(Date.now()));

  debounced.pending = () => timerId !== undefined;

  return debounced as Debounced<F>;
}
