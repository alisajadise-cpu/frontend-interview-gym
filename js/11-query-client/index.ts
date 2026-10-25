export type QueryStatus = 'idle' | 'pending' | 'success' | 'error';

export type QueryState<T = unknown> = {
  status: QueryStatus;
  data: T | undefined;
  error: unknown;
  updatedAt: number;
  isFetching: boolean;
};

export type QueryClientOptions = { staleTime?: number; gcTime?: number };

export type QueryClient = {
  fetchQuery<T>(key: string, fn: () => Promise<T>): Promise<T>;
  getQueryState<T = unknown>(key: string): QueryState<T>;
  subscribe<T = unknown>(key: string, listener: (state: QueryState<T>) => void): () => void;
  invalidate(key: string): void;
  setQueryData<T>(key: string, updater: T | ((old: T | undefined) => T)): void;
};

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  throw new Error('Not implemented: createQueryClient');
}
