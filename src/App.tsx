import { Component, StrictMode, useEffect, useState, type ComponentType, type ReactNode } from 'react';

type AnyModule = Record<string, unknown>;
type DemoModule = { default: ComponentType<{ impl: AnyModule }> };

// Every React / performance exercise has a demo.tsx that renders the exercise with fake data.
const demos = import.meta.glob<DemoModule>('../{react,performance,ai}/*/demo.tsx');
const mine = import.meta.glob<AnyModule>('../{react,performance,ai}/*/index.tsx');
const solutions = import.meta.glob<AnyModule>('../{react,performance,ai}/*/solution.tsx');
const readmes = import.meta.glob<string>('../{react,performance,ai}/*/README.md', {
  query: '?raw',
  import: 'default',
});

type Entry = { section: string; slug: string; dir: string };

const entries: Entry[] = Object.keys(demos)
  .map((path) => {
    const [, section, slug] = path.match(/^\.\.\/(\w+)\/([^/]+)\/demo\.tsx$/) ?? [];
    return { section, slug, dir: `../${section}/${slug}` };
  })
  .sort((a, b) => (a.section + a.slug).localeCompare(b.section + b.slug));

type Mode = 'mine' | 'solution';

function readHash(): { id: string; mode: Mode } {
  const [id = '', query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { id, mode: query === 'solution' ? 'solution' : 'mine' };
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

export default function App() {
  const [{ id, mode }, setRoute] = useState(readHash);
  const [strict, setStrict] = useState(false);
  const [loaded, setLoaded] = useState<{ key: string; Demo: DemoModule['default']; impl: AnyModule; readme: string } | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const entry = entries.find((e) => `${e.section}/${e.slug}` === id) ?? entries[0];

  useEffect(() => {
    if (!entry) return;
    let ignore = false;
    const key = `${entry.dir}:${mode}`;
    const implLoader = (mode === 'solution' ? solutions : mine)[`${entry.dir}/${mode === 'solution' ? 'solution' : 'index'}.tsx`];
    Promise.all([demos[`${entry.dir}/demo.tsx`](), implLoader(), readmes[`${entry.dir}/README.md`]?.() ?? ''])
      .then(([demo, impl, readme]) => {
        if (!ignore) {
          setLoadError(null);
          setLoaded({ key, Demo: demo.default, impl, readme });
        }
      })
      .catch((error: Error) => {
        if (!ignore) setLoadError(error);
      });
    return () => {
      ignore = true;
    };
  }, [entry, mode]);

  if (!entry) return <p className="empty">No exercises found.</p>;

  const go = (next: Entry, nextMode: Mode) => {
    window.location.hash = `/${next.section}/${next.slug}${nextMode === 'solution' ? '?solution' : ''}`;
  };

  const file = `${entry.section}/${entry.slug}/${mode === 'solution' ? 'solution' : 'index'}.tsx`;
  const content =
    loaded && loaded.key === `${entry.dir}:${mode}` ? (
      <ErrorBoundary key={loaded.key} file={file}>
        <loaded.Demo impl={loaded.impl} />
      </ErrorBoundary>
    ) : loadError ? (
      <div className="error">{loadError.message}</div>
    ) : (
      <p className="muted">Loading…</p>
    );

  return (
    <div className="layout">
      <nav className="sidebar">
        <h1>Interview Gym</h1>
        {['react', 'performance', 'ai'].map((section) => (
          <section key={section}>
            <h2>{section}</h2>
            <ul>
              {entries
                .filter((e) => e.section === section)
                .map((e) => (
                  <li key={e.slug}>
                    <a
                      href={`#/${e.section}/${e.slug}${mode === 'solution' ? '?solution' : ''}`}
                      aria-current={e === entry ? 'page' : undefined}
                    >
                      {e.slug}
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </nav>
      <main className="main">
        <header className="toolbar">
          <div className="title">
            <span className="section">{entry.section}</span> / {entry.slug}
          </div>
          <div className="toggle" role="group" aria-label="Which code to run">
            <button aria-pressed={mode === 'mine'} onClick={() => go(entry, 'mine')}>
              My code
            </button>
            <button aria-pressed={mode === 'solution'} onClick={() => go(entry, 'solution')}>
              Solution
            </button>
          </div>
          <label className="strict">
            <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> StrictMode
          </label>
        </header>
        <p className="file">
          Running <code>{file}</code>
        </p>
        <div className="stage">{strict ? <StrictMode>{content}</StrictMode> : content}</div>
        {loaded?.readme ? (
          <details className="readme">
            <summary>Task (README.md)</summary>
            <pre>{loaded.readme}</pre>
          </details>
        ) : null}
      </main>
    </div>
  );
}
