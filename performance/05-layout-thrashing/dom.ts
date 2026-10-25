/**
 * Tiny DOM read/write helpers (like the `fastdom` library, without the batching).
 * Use them for every layout read and style write in this exercise:
 * the tests read the log to check the ORDER of reads and writes.
 */
export type DomOp = 'read' | 'write';

const log: DomOp[] = [];

/** Layout READ. Forces a synchronous reflow if there are pending style writes. */
export function measure(el: HTMLElement): number {
  log.push('read');
  return el.offsetHeight;
}

/** Style WRITE. Invalidates layout. */
export function mutate(el: HTMLElement, height: number): void {
  log.push('write');
  el.style.height = `${height}px`;
}

export function getDomLog(): DomOp[] {
  return [...log];
}

export function resetDomLog(): void {
  log.length = 0;
}
