export type Listener<Args extends unknown[]> = (...args: Args) => void;

/**
 * Each registration is its own object. That gives every registration an identity:
 * - the same function registered twice = two records
 * - "removed during emit" = record.active === false, checked right before calling it
 */
type Registration = { fn: Listener<any>; once: boolean; active: boolean };

export class EventEmitter<Events extends Record<string, unknown[]>> {
  private listeners = new Map<keyof Events, Registration[]>();

  private add(event: keyof Events, fn: Listener<any>, once: boolean): () => void {
    const reg: Registration = { fn, once, active: true };
    const list = this.listeners.get(event) ?? [];
    // Copy-on-write: an emit in progress keeps iterating its own snapshot,
    // so listeners added now do not run in that emit.
    this.listeners.set(event, [...list, reg]);
    return () => this.remove(event, reg);
  }

  private remove(event: keyof Events, reg: Registration) {
    if (!reg.active) return; // unsubscribe twice is a no-op
    reg.active = false; // a running emit will skip it
    const list = this.listeners.get(event);
    if (!list) return;
    const next = list.filter((r) => r !== reg);
    if (next.length) this.listeners.set(event, next);
    else this.listeners.delete(event);
  }

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    return this.add(event, listener, false);
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    return this.add(event, listener, true);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    const reg = this.listeners.get(event)?.find((r) => r.fn === listener);
    if (reg) this.remove(event, reg);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const snapshot = this.listeners.get(event);
    if (!snapshot || snapshot.length === 0) return false;

    const errors: unknown[] = [];
    for (const reg of snapshot) {
      if (!reg.active) continue; // removed earlier in this same emit
      // Remove `once` listeners BEFORE calling them, so a recursive emit
      // from inside the listener cannot run it a second time.
      if (reg.once) this.remove(event, reg);
      try {
        reg.fn(...args);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, `${errors.length} listeners for "${String(event)}" threw`);
    return true;
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  removeAllListeners<K extends keyof Events>(event?: K): void {
    const events = event === undefined ? [...this.listeners.keys()] : [event];
    for (const e of events) {
      for (const reg of this.listeners.get(e) ?? []) reg.active = false;
      this.listeners.delete(e);
    }
  }
}
