export type MapLimitOptions = { signal?: AbortSignal };

export function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => R | Promise<R>,
  options: MapLimitOptions = {},
): Promise<R[]> {
  let index = 0;
  let results: Array<Awaited<R>> = [];
  let rejected = false;
  let fullfilled = 0;
  const { signal } = options;
  if (limit <= 0 || !Number.isInteger(limit) || Number.isNaN(limit)) {
    throw new RangeError();
  }
  return new Promise((resolve, reject) => {
    if (items.length === 0) {
      resolve([]);
      return;
    }
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const proccess = (i: number) => {
      if (i >= items.length) return;
      if (rejected) return;
      let result;
      try {
        result = mapper(items[i], i);
      } catch (error) {
        rejected = true;
        signal?.removeEventListener("abort", onAbort);
        reject(error);
        return;
      }

      Promise.resolve(result)
        .then((res) => {
          results[i] = res;
          fullfilled++;
          if (fullfilled === items.length) {
            resolve(results);
            signal?.removeEventListener("abort", onAbort);
            return;
          }
          proccess(index++);
        })
        .catch((error) => {
          rejected = true;
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        });
    };

    while (index < Math.min(limit, items.length)) {
      proccess(index);
      index++;
    }
    const onAbort = () => {
      rejected = true; // stops scheduling new mappers
      signal!.removeEventListener("abort", onAbort);
      reject(signal!.reason); // reason is an AbortError DOMException if none was given
    };
    signal?.addEventListener("abort", onAbort);
  });
}
