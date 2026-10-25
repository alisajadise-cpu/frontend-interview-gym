export type Task<T> = () => T | Promise<T>;
export type AddOptions = { priority?: number; signal?: AbortSignal };
export type TaskQueueOptions = { concurrency?: number; autoStart?: boolean };

export class TaskQueue {
  constructor(options: TaskQueueOptions = {}) {
    throw new Error('Not implemented: TaskQueue');
  }

  add<T>(task: Task<T>, options: AddOptions = {}): Promise<T> {
    throw new Error('Not implemented: add');
  }

  pause(): void {
    throw new Error('Not implemented: pause');
  }

  start(): void {
    throw new Error('Not implemented: start');
  }

  get isPaused(): boolean {
    throw new Error('Not implemented: isPaused');
  }

  get size(): number {
    throw new Error('Not implemented: size');
  }

  get pending(): number {
    throw new Error('Not implemented: pending');
  }

  onEmpty(): Promise<void> {
    throw new Error('Not implemented: onEmpty');
  }

  onIdle(): Promise<void> {
    throw new Error('Not implemented: onIdle');
  }

  clear(): void {
    throw new Error('Not implemented: clear');
  }
}
