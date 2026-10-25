import { useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const ITEMS = [
  'Angular', 'Astro', 'Backbone', 'Ember', 'Express', 'Fastify', 'Gatsby', 'Hono', 'Jotai', 'Lit', 'MobX', 'NestJS', 'Next.js',
  'Nuxt', 'Preact', 'Qwik', 'React', 'React Native', 'React Query', 'Redux', 'Remix', 'Recoil', 'RxJS', 'SolidJS', 'Svelte',
  'SvelteKit', 'Tailwind CSS', 'TanStack Router', 'TanStack Table', 'Three.js', 'tRPC', 'Vite', 'Vitest', 'Vue', 'Zustand',
];

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState('');

  const fetchSuggestions = (query: string, signal: AbortSignal) =>
    new Promise<string[]>((resolve, reject) => {
      // Shorter queries are slower on purpose, to expose race conditions.
      const latency = Math.max(150, 1200 - query.length * 300) + Math.random() * 200;
      setLog((l) => [`→ "${query}" (${Math.round(latency)}ms)`, ...l].slice(0, 12));
      const t = setTimeout(() => {
        if (query.toLowerCase() === 'error') reject(new Error('Server error'));
        else resolve(ITEMS.filter((x) => x.toLowerCase().includes(query.toLowerCase())).slice(0, 8));
      }, latency);
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        setLog((l) => [`✗ aborted "${query}"`, ...l].slice(0, 12));
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr) 260px' }}>
      <div>
        <impl.Autocomplete label="Search frameworks" fetchSuggestions={fetchSuggestions} onSelect={setSelected} />
        <p>Selected: {selected || '—'}</p>
        <p style={{ color: 'gray', fontSize: 13 }}>Type "error" to trigger a failure. Short queries are slow on purpose.</p>
      </div>
      <pre style={{ fontSize: 12, margin: 0 }}>{log.join('\n') || 'Network log'}</pre>
    </div>
  );
}
