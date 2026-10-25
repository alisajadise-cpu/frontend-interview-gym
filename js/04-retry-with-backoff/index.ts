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

export function retry<T>(
  fn: (attempt: number, signal: AbortSignal | undefined) => T | Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  throw new Error('Not implemented: retry');
}
