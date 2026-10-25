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

export function debounce<F extends (...args: any[]) => any>(
  fn: F,
  wait = 0,
  options: DebounceOptions = {},
): Debounced<F> {
  throw new Error('Not implemented: debounce');
}
