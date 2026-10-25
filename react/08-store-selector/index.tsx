export type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
export type GetState<T> = () => T;
export type Listener<T> = (state: T, prevState: T) => void;

export type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: Listener<T>) => () => void;
};

export function createStore<T extends object>(initializer: (set: SetState<T>, get: GetState<T>) => T): StoreApi<T> {
  throw new Error('Not implemented: createStore');
}

export function shallow<A>(a: A, b: A): boolean {
  throw new Error('Not implemented: shallow');
}

export function useStore<T extends object, S>(
  store: StoreApi<T>,
  selector: (state: T) => S,
  equalityFn: (a: S, b: S) => boolean = Object.is,
): S {
  throw new Error('Not implemented: useStore');
}
