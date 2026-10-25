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

export function createHistory<T>(initial: T, { limit = 100, coalesceMs = 0 }: HistoryOptions = {}): History<T> {
  let past: T[] = [];
  let present = initial;
  let future: T[] = [];
  const listeners = new Set<(value: T) => void>();

  // The currently "open" merge group. null = the next set starts a new step.
  let group: { key: string; time: number } | null = null;

  // Batch state: the value before the batch started, and how deep we are.
  let batchDepth = 0;
  let batchStart: T = initial;

  const notify = () => {
    for (const l of [...listeners]) l(present);
  };

  function pushStep(previous: T) {
    past.push(previous);
    if (past.length > limit) past = past.slice(past.length - limit);
    future = [];
  }

  function set(next: T, options: SetOptions = {}) {
    if (Object.is(next, present)) return;

    if (batchDepth > 0) {
      present = next; // the step is created once, when the batch ends
      return;
    }

    const now = Date.now();
    const key = options.coalesceKey;
    const merge = key !== undefined && group !== null && group.key === key && now - group.time < coalesceMs;

    if (merge) {
      future = []; // still a new edit: redo is no longer valid
    } else {
      pushStep(present);
    }
    group = key !== undefined ? { key, time: now } : null;
    present = next;
    notify();
  }

  function move(from: T[], to: T[]): boolean {
    if (batchDepth > 0) throw new Error('Cannot undo/redo inside batch()');
    if (from.length === 0) return false;
    to.push(present);
    present = from.pop()!;
    group = null;
    notify();
    return true;
  }

  return {
    get: () => present,
    set,
    undo: () => move(past, future),
    redo: () => move(future, past),
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    batch(fn) {
      if (batchDepth === 0) batchStart = present;
      batchDepth++;
      try {
        fn();
      } finally {
        batchDepth--;
        if (batchDepth === 0) {
          group = null;
          if (!Object.is(batchStart, present)) {
            pushStep(batchStart);
            notify();
          }
        }
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
