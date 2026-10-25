export type Task<T> = () => T | Promise<T>;
export type AddOptions = { priority?: number; signal?: AbortSignal };
export type TaskQueueOptions = { concurrency?: number; autoStart?: boolean };

type Job = {
  priority: number;
  run: () => void; // starts the task and settles the add() promise
  cleanup: () => void; // removes the abort listener
};

function abortError() {
  return new DOMException('The task was aborted before it started', 'AbortError');
}

export class TaskQueue {
  private readonly concurrency: number;
  private paused: boolean;
  private running = 0;
  // Sorted by priority (desc). Insertion keeps FIFO for equal priorities.
  private waiting: Job[] = [];
  private emptyWaiters: Array<() => void> = [];
  private idleWaiters: Array<() => void> = [];

  constructor(options: TaskQueueOptions = {}) {
    const concurrency = options.concurrency ?? Infinity;
    if (!(concurrency >= 1)) throw new TypeError(`concurrency must be >= 1, got ${concurrency}`);
    this.concurrency = concurrency;
    this.paused = options.autoStart === false;
  }

  add<T>(task: Task<T>, options: AddOptions = {}): Promise<T> {
    const { priority = 0, signal } = options;
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError());
        return;
      }

      const onAbort = () => {
        const index = this.waiting.indexOf(job);
        if (index === -1) return; // already running: nothing to do here
        this.waiting.splice(index, 1);
        reject(abortError());
        this.checkWaiters();
      };

      const job: Job = {
        priority,
        cleanup: () => signal?.removeEventListener('abort', onAbort),
        run: () => {
          job.cleanup();
          this.running++;
          // new Promise + call inside: a synchronous throw becomes a rejection
          new Promise<T>((res) => res(task())).then(resolve, reject).finally(() => {
            this.running--;
            this.next();
          });
        },
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      this.insert(job);
      this.next();
    });
  }

  private insert(job: Job) {
    // Binary search for the first job with a LOWER priority: insert before it.
    let lo = 0;
    let hi = this.waiting.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.waiting[mid].priority >= job.priority) lo = mid + 1;
      else hi = mid;
    }
    this.waiting.splice(lo, 0, job);
  }

  private next() {
    while (!this.paused && this.running < this.concurrency && this.waiting.length) {
      this.waiting.shift()!.run();
    }
    this.checkWaiters();
  }

  private checkWaiters() {
    if (this.waiting.length === 0) {
      const empty = this.emptyWaiters;
      this.emptyWaiters = [];
      empty.forEach((r) => r());
      if (this.running === 0) {
        const idle = this.idleWaiters;
        this.idleWaiters = [];
        idle.forEach((r) => r());
      }
    }
  }

  pause(): void {
    this.paused = true;
  }

  start(): void {
    if (!this.paused) return;
    this.paused = false;
    this.next();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get size(): number {
    return this.waiting.length;
  }

  get pending(): number {
    return this.running;
  }

  onEmpty(): Promise<void> {
    if (this.waiting.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.emptyWaiters.push(resolve));
  }

  onIdle(): Promise<void> {
    if (this.waiting.length === 0 && this.running === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  /** Drops waiting tasks. Their add() promises never settle (same trade-off as p-queue). */
  clear(): void {
    for (const job of this.waiting) job.cleanup();
    this.waiting = [];
    this.checkWaiters();
  }
}
