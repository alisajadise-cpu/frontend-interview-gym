export type MapLimitOptions = { signal?: AbortSignal };

export function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => R | Promise<R>,
  options: MapLimitOptions = {},
): Promise<R[]> {
  throw new Error('Not implemented: mapLimit');
}
