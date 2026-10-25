export type HistoryOptions = { limit?: number; coalesceMs?: number };
export type SetOptions = { coalesceKey?: string };

export type History<T> = {
  get(): T;
  set(next: T, options?: SetOptions): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  batch(fn: () => void): void;
  subscribe(listener: (value: T) => void): () => void;
};

export function createHistory<T>(initial: T, options: HistoryOptions = {}): History<T> {
  throw new Error('Not implemented: createHistory');
}
