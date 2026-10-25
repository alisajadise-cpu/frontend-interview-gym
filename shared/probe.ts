import { useEffect } from 'react';

/**
 * Tiny instrumentation used by the performance exercises.
 * Tests read these counters to check how often things render or mount.
 * Keep the probe calls in place when you fix the code.
 */
const counts = new Map<string, number>();

/** Call in a component body: counts renders. */
export function probe(name: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

/** Call in a component: counts mounts (not re-renders). */
export function useMountProbe(name: string): void {
  useEffect(() => {
    probe(`${name}:mount`);
  }, [name]);
}

export function probeCount(name: string): number {
  return counts.get(name) ?? 0;
}

export function resetProbes(): void {
  counts.clear();
}
