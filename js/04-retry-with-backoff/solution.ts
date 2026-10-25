export type RetryOptions = {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: 'none' | 'full';
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
  signal?: AbortSignal;
  random?: () => number;
};

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

/** Settles with `promise`, or rejects as soon as `signal` aborts (whichever comes first). */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    // Always attach handlers, so a late rejection from `promise` is never "unhandled".
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer); // don't leak the timer
      reject(abortReason(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function retry<T>(
  fn: (attempt: number, signal: AbortSignal | undefined) => T | Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    baseDelay = 100,
    maxDelay = Infinity,
    factor = 2,
    jitter = 'none',
    shouldRetry = () => true,
    onRetry,
    signal,
    random = Math.random,
  } = options;

  function delayFor(error: unknown, attempt: number): number {
    const retryAfter = (error as { retryAfterMs?: unknown } | null)?.retryAfterMs;
    if (typeof retryAfter === 'number' && Number.isFinite(retryAfter)) {
      return Math.min(maxDelay, Math.max(0, retryAfter)); // the server knows best
    }
    const capped = Math.min(maxDelay, baseDelay * factor ** (attempt - 1));
    return jitter === 'full' ? Math.floor(random() * capped) : capped;
  }

  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw abortReason(signal);

    let promise: Promise<T>;
    try {
      promise = Promise.resolve(fn(attempt, signal));
    } catch (error) {
      promise = Promise.reject(error);
    }

    try {
      return await raceAbort(promise, signal);
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal); // never retry after abort
      if (attempt > retries || !shouldRetry(error, attempt)) throw error;
      const delay = delayFor(error, attempt);
      onRetry?.(error, attempt, delay);
      await sleep(delay, signal);
    }
  }
}
