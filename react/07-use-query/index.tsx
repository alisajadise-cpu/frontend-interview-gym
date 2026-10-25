export type QueryStatus = 'pending' | 'success' | 'error';

export type QueryOptions = {
  /** How long (ms) data counts as fresh. Fresh data is never refetched on mount. Default 0. */
  staleTime?: number;
  /** When false, the query does not fetch. Default true. */
  enabled?: boolean;
};

export type QueryResult<T> = {
  data: T | undefined;
  error: unknown;
  status: QueryStatus;
  isFetching: boolean;
  refetch: () => void;
};

/** Clears every query and aborts in-flight requests. Used by the tests. */
export function resetQueryCache() {
  // TODO
}

export function useQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions = {},
): QueryResult<T> {
  throw new Error('Not implemented: useQuery');
}
