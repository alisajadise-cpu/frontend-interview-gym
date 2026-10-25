export type MapLimitOptions = { signal?: AbortSignal };

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

export function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => R | Promise<R>,
  options: MapLimitOptions = {},
): Promise<R[]> {
  // Validate synchronously: a programmer error should fail loudly, not as a rejected promise.
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`limit must be an integer >= 1, got ${limit}`);
  }
  const { signal } = options;

  return new Promise<R[]>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    if (items.length === 0) {
      resolve([]);
      return;
    }

    const results = new Array<R>(items.length);
    let nextIndex = 0;
    let completed = 0;
    let settled = false;

    const onAbort = () => fail(abortReason(signal!));
    signal?.addEventListener('abort', onAbort);

    function finish() {
      settled = true;
      signal?.removeEventListener('abort', onAbort);
    }

    function fail(error: unknown) {
      if (settled) return;
      finish();
      reject(error);
    }

    function startNext() {
      const index = nextIndex++;
      let promise: Promise<R>;
      try {
        promise = Promise.resolve(mapper(items[index], index));
      } catch (error) {
        promise = Promise.reject(error); // sync throw = rejection
      }
      promise.then((value) => {
        if (settled) return; // late result after failure/abort: ignore
        results[index] = value;
        completed++;
        if (completed === items.length) {
          finish();
          resolve(results);
        } else if (nextIndex < items.length) {
          startNext(); // a slot is free: refill it immediately (no batching)
        }
      }, fail);
    }

    const initial = Math.min(limit, items.length);
    for (let i = 0; i < initial && !settled; i++) startNext();
  });
}
