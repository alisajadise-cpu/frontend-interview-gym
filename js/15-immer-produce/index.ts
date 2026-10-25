export type Recipe<T> = (draft: T) => T | void | undefined;

export function produce<T>(base: T, recipe: Recipe<T>): T {
  throw new Error('Not implemented: produce');
}
