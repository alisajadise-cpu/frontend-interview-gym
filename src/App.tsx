import { Component, StrictMode, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Markdown from './Markdown';

type AnyModule = Record<string, unknown>;
type DemoModule = { default: ComponentType<{ impl: AnyModule }> };
type Loader<T> = () => Promise<T>;

// Runnable demos (React / performance / some AI exercises).
const demos = import.meta.glob<DemoModule>('../{react,performance,ai}/*/demo.tsx');
const mine = import.meta.glob<AnyModule>('../{react,performance,ai}/*/index.tsx');
const solutions = import.meta.glob<AnyModule>('../{react,performance,ai}/*/solution.tsx');
// Every markdown file: exercise specs, answers, quizzes, concepts, study plans.
const markdown = import.meta.glob<string>(
  ['../{js,react,performance,system-design,ai}/**/*.md', '../README.md', '../PLAN.md'],
  { query: '?raw', import: 'default' },
);
// Reference solution source, shown on the Solution tab.
const solutionSources = import.meta.glob<string>('../{js,react,performance,ai}/*/solution.{ts,tsx}', {
  query: '?raw',
  import: 'default',
});

const strip = (key: string) => key.replace(/^\.\.\//, '');
const byPath = <T,>(globbed: Record<string, Loader<T>>) =>
  Object.fromEntries(Object.entries(globbed).map(([k, v]) => [strip(k), v])) as Record<string, Loader<T>>;

const md = byPath(markdown);
const sources = byPath(solutionSources);

// ---------- Build the catalog ----------

const SECTIONS = [
  { key: 'overview', label: 'Start here' },
  { key: 'js', label: 'JavaScript' },
  { key: 'react', label: 'React' },
  { key: 'performance', label: 'Performance' },
  { key: 'system-design', label: 'System design' },
  { key: 'ai', label: 'AI rounds' },
  { key: 'ai/system-design', label: 'AI system design' },
] as const;

type Tab = 'task' | 'demo' | 'solution';

type Entry = {
  id: string; // route, e.g. "js/01-debounce" or "react/concepts"
  section: string;
  label: string;
  kind: 'exercise' | 'doc';
  doc: string; // markdown file shown on the Task tab
  answer?: string; // SOLUTION.md / ANSWERS.md
  source?: string; // solution.ts(x)
  demo?: string; // demo.tsx folder, e.g. "react/01-autocomplete"
};

function sectionOf(path: string) {
  if (!path.includes('/')) return 'overview';
  if (path.startsWith('ai/system-design/')) return 'ai/system-design';
  return path.split('/')[0];
}

const humanize = (s: string) => s.replace(/^(\d+)-/, '$1 · ').replace(/-/g, ' ');

function buildCatalog(): Entry[] {
  const exercises = new Map<string, Entry>();
  const docs: Entry[] = [];

  for (const path of Object.keys(md)) {
    const parts = path.split('/');
    const file = parts.at(-1)!;
    const dir = parts.slice(0, -1).join('/');
    const folder = parts.at(-2) ?? '';
    const section = sectionOf(path);

    if (/^\d{2}-/.test(folder)) {
      const ex = exercises.get(dir) ?? { id: dir, section, label: humanize(folder), kind: 'exercise', doc: '' };
      if (file === 'README.md' || file === 'QUESTION.md') ex.doc = path;
      else if (file === 'SOLUTION.md' || file === 'ANSWERS.md') ex.answer = path;
      exercises.set(dir, ex);
      continue;
    }

    const rel = path.slice(section === 'overview' ? 0 : section.length + 1).replace(/\.md$/, '');
    const label = rel === 'README' ? (section === 'overview' ? 'README' : 'Overview') : rel === 'PLAN' ? 'Study plan' : humanize(rel).replace('/', ' / ');
    docs.push({ id: path.replace(/\.md$/, ''), section, label, kind: 'doc', doc: path });
  }

  for (const ex of exercises.values()) {
    ex.source = [`${ex.id}/solution.tsx`, `${ex.id}/solution.ts`].find((p) => p in sources);
    if (`../${ex.id}/demo.tsx` in demos) ex.demo = ex.id;
    if (!ex.doc) ex.doc = ex.answer ?? '';
  }

  const order = (e: Entry) => (e.kind === 'doc' ? (e.label === 'Overview' || e.label === 'README' ? '0' : '1') : '2') + e.id;
  return [...docs, ...exercises.values()].filter((e) => e.doc).sort((a, b) => order(a).localeCompare(order(b)));
}

const catalog = buildCatalog();
const entryById = new Map(catalog.map((e) => [e.id, e]));

/** Turns a repo path from a markdown link into a hash route inside the app. */
function linkFor(repoPath: string): string | null {
  const path = repoPath.replace(/\/$/, '/README.md');
  const doc = entryById.get(path.replace(/\.md$/, ''));
  if (doc) return `#/${doc.id}`;
  const dir = path.split('/').slice(0, -1).join('/');
  const file = path.split('/').at(-1) ?? '';
  const ex = entryById.get(dir) ?? entryById.get(path);
  if (!ex || ex.kind !== 'exercise') return null;
  if (/^(SOLUTION|ANSWERS)\.md$|^solution\./.test(file)) return `#/${ex.id}?tab=solution`;
  if (file === 'demo.tsx' && ex.demo) return `#/${ex.id}?tab=demo`;
  return `#/${ex.id}`;
}

// ---------- Routing ----------

type Mode = 'mine' | 'solution';
type Route = { id: string; tab: Tab | null; mode: Mode };

function readHash(): Route {
  const [id = '', query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  // Old links used "#/react/01-autocomplete?solution" for the demo running solution.tsx.
  if (params.has('solution')) return { id, tab: 'demo', mode: 'solution' };
  const tab = params.get('tab');
  return {
    id,
    tab: tab === 'task' || tab === 'demo' || tab === 'solution' ? tab : null,
    mode: params.get('mode') === 'solution' ? 'solution' : 'mine',
  };
}

function hrefFor(id: string, tab?: Tab | null, mode?: Mode) {
  const params = new URLSearchParams();
  if (tab && tab !== 'task') params.set('tab', tab);
  if (tab === 'demo' && mode === 'solution') params.set('mode', 'solution');
  const q = params.toString();
  return `#/${id}${q ? `?${q}` : ''}`;
}

// ---------- Small helpers ----------

function useLoaded<T>(key: string, load: (() => Promise<T>) | null) {
  const [state, setState] = useState<{ key: string; value?: T; error?: Error } | null>(null);
  useEffect(() => {
    if (!load) return;
    let ignore = false;
    load().then(
      (value) => !ignore && setState({ key, value }),
      (error: Error) => !ignore && setState({ key, error }),
    );
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state : null;
}

class ErrorBoundary extends Component<{ children: ReactNode; file: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="error">
          <strong>{this.state.error.message}</strong>
          <p>
            Edit <code>{this.props.file}</code> and save. The page reloads automatically.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function MarkdownFile({ path }: { path: string }) {
  const loaded = useLoaded(path, md[path] ?? null);
  if (!loaded) return <p className="muted">Loading…</p>;
  if (loaded.error) return <p className="error">{loaded.error.message}</p>;
  return <Markdown source={loaded.value ?? ''} path={path} linkFor={linkFor} />;
}

function SourceFile({ path }: { path: string }) {
  const loaded = useLoaded(path, sources[path] ?? null);
  if (!loaded) return <p className="muted">Loading…</p>;
  if (loaded.error) return <p className="error">{loaded.error.message}</p>;
  const lang = path.endsWith('.tsx') ? 'tsx' : 'ts';
  return <Markdown source={`\`\`\`${lang}\n${loaded.value ?? ''}\n\`\`\``} path={path} linkFor={linkFor} />;
}

function DemoStage({ dir, mode, strict }: { dir: string; mode: Mode; strict: boolean }) {
  const file = `${dir}/${mode === 'solution' ? 'solution' : 'index'}.tsx`;
  const loaded = useLoaded(file, () =>
    Promise.all([demos[`../${dir}/demo.tsx`](), (mode === 'solution' ? solutions : mine)[`../${file}`]()]),
  );
  const content = !loaded ? (
    <p className="muted">Loading…</p>
  ) : loaded.error ? (
    <div className="error">{loaded.error.message}</div>
  ) : (
    (() => {
      const [demo, impl] = loaded.value!;
      return (
        <ErrorBoundary key={file} file={file}>
          <demo.default impl={impl} />
        </ErrorBoundary>
      );
    })()
  );
  return (
    <>
      <p className="file">
        Running <code>{file}</code>
      </p>
      <div className="stage">{strict ? <StrictMode>{content}</StrictMode> : content}</div>
    </>
  );
}

// ---------- App ----------

export default function App() {
  const [route, setRoute] = useState(readHash);
  const [strict, setStrict] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const entry = entryById.get(route.id) ?? catalog[0];
  const tabs: Tab[] = entry ? (['task', entry.demo && 'demo', (entry.answer || entry.source) && 'solution'].filter(Boolean) as Tab[]) : [];
  const tab: Tab = route.tab && tabs.includes(route.tab) ? route.tab : 'task';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [entry?.id, tab]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? catalog.filter((e) => `${e.section} ${e.label} ${e.id}`.toLowerCase().includes(q)) : catalog;
  }, [filter]);

  if (!entry) return <p className="empty">No exercises found.</p>;

  const sectionLabel = SECTIONS.find((s) => s.key === entry.section)?.label ?? entry.section;
  const tabLabel: Record<Tab, string> = {
    task: entry.kind === 'doc' ? 'Read' : 'Task',
    demo: 'Try it',
    solution: entry.source && !entry.answer ? 'Solution' : 'Answer',
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <a className="brand" href="#/README">
          Interview Gym
        </a>
        <input
          className="search"
          type="search"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter exercises"
        />
        {SECTIONS.map((section) => {
          const items = visible.filter((e) => e.section === section.key);
          if (!items.length) return null;
          return (
            <section key={section.key}>
              <h2>{section.label}</h2>
              <ul>
                {items.map((e) => (
                  <li key={e.id}>
                    <a href={hrefFor(e.id)} aria-current={e === entry ? 'page' : undefined} className={e.kind}>
                      <span>{e.label}</span>
                      {e.demo ? <span className="badge" title="Has a runnable demo">demo</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>

      <main className="main">
        <header className="toolbar">
          <div className="title">
            <span className="section">{sectionLabel}</span> / {entry.label}
          </div>
          {tabs.length > 1 ? (
            <div className="toggle" role="tablist" aria-label="View">
              {tabs.map((t) => (
                <a key={t} role="tab" aria-selected={t === tab} href={hrefFor(entry.id, t, route.mode)}>
                  {tabLabel[t]}
                </a>
              ))}
            </div>
          ) : null}
        </header>

        {entry.kind === 'exercise' && entry.source && tab === 'task' ? (
          <p className="file">
            Write your code in <code>{entry.source.replace('solution', 'index')}</code>, then run{' '}
            <code>npm test {entry.id}</code>
          </p>
        ) : null}

        {tab === 'task' ? (
          <article className="paper">
            <MarkdownFile path={entry.doc} />
          </article>
        ) : null}

        {tab === 'demo' && entry.demo ? (
          <>
            <div className="demo-bar">
              <div className="toggle" role="group" aria-label="Which code to run">
                <a aria-pressed={route.mode === 'mine'} href={hrefFor(entry.id, 'demo', 'mine')}>
                  My code
                </a>
                <a aria-pressed={route.mode === 'solution'} href={hrefFor(entry.id, 'demo', 'solution')}>
                  Solution
                </a>
              </div>
              <label className="strict">
                <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> StrictMode
              </label>
            </div>
            <DemoStage dir={entry.demo} mode={route.mode} strict={strict} />
            <details className="paper task-peek">
              <summary>Task</summary>
              <MarkdownFile path={entry.doc} />
            </details>
          </>
        ) : null}

        {tab === 'solution' ? (
          <article className="paper">
            {entry.answer && entry.answer !== entry.doc ? <MarkdownFile path={entry.answer} /> : null}
            {entry.source ? (
              <>
                <h2 className="source-title">
                  <code>{entry.source}</code>
                </h2>
                <SourceFile path={entry.source} />
              </>
            ) : null}
          </article>
        ) : null}
      </main>
    </div>
  );
}
