export type Listener<Args extends unknown[]> = (...args: Args) => void;

export class EventEmitter<Events extends Record<string, unknown[]>> {
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    throw new Error('Not implemented: on');
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    throw new Error('Not implemented: once');
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    throw new Error('Not implemented: off');
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    throw new Error('Not implemented: emit');
  }

  listenerCount<K extends keyof Events>(event: K): number {
    throw new Error('Not implemented: listenerCount');
  }

  removeAllListeners<K extends keyof Events>(event?: K): void {
    throw new Error('Not implemented: removeAllListeners');
  }
}
