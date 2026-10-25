import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

export type Todo = { id: string; title: string; done: boolean };

export type TodoApi = {
  list: () => Promise<Todo[]>;
  create: (title: string) => Promise<Todo>;
  toggle: (id: string, done: boolean) => Promise<Todo>;
  remove: (id: string) => Promise<void>;
};

/**
 * Pending mutations. The screen shows: confirmed server state + every pending
 * mutation applied in order. A failed mutation is simply DROPPED from the list,
 * so it can never undo another mutation (this is how useOptimistic and
 * TanStack Query's optimistic updates think about it too).
 */
type Op =
  | { opId: number; type: 'create'; tempId: string; title: string }
  | { opId: number; type: 'toggle'; id: string; done: boolean }
  | { opId: number; type: 'remove'; id: string };

type ViewTodo = Todo & { pending: boolean };

function applyOps(confirmed: Todo[], ops: Op[]): ViewTodo[] {
  let list: ViewTodo[] = confirmed.map((t) => ({ ...t, pending: false }));
  for (const op of ops) {
    if (op.type === 'create') list = [...list, { id: op.tempId, title: op.title, done: false, pending: true }];
    if (op.type === 'toggle') list = list.map((t) => (t.id === op.id ? { ...t, done: op.done } : t));
    if (op.type === 'remove') list = list.filter((t) => t.id !== op.id);
  }
  return list;
}

export function TodoApp({ api }: { api: TodoApi }) {
  const [confirmed, setConfirmed] = useState<Todo[]>([]);
  const [ops, setOps] = useState<Op[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const nextId = useRef(0);

  useEffect(() => {
    let ignore = false;
    api.list().then(
      (todos) => {
        if (ignore) return;
        setConfirmed(todos);
        setStatus('ready');
      },
      () => {
        if (!ignore) setStatus('error');
      },
    );
    return () => {
      ignore = true;
    };
  }, [api]);

  const todos = useMemo(() => applyOps(confirmed, ops), [confirmed, ops]);

  /** Runs one optimistic mutation: show it now, confirm or drop it later. */
  function mutate<R>(op: Op, request: Promise<R>, onSuccess: (result: R) => void, onError: () => void) {
    setOps((list) => [...list, op]);
    const done = () => setOps((list) => list.filter((o) => o.opId !== op.opId));
    request.then(
      (result) => {
        onSuccess(result); // same tick as `done`: React batches both, so no flicker
        done();
      },
      () => {
        done();
        onError();
      },
    );
  }

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    setTitle('');
    setError(null);
    const opId = nextId.current++;
    mutate(
      { opId, type: 'create', tempId: `temp-${opId}`, title: text },
      api.create(text),
      (todo) => setConfirmed((list) => [...list, todo]),
      () => {
        setError(`Could not add "${text}"`);
        // Give the text back, but never overwrite something new the user typed.
        setTitle((current) => (current === '' ? text : current));
      },
    );
  }

  function toggle(todo: ViewTodo) {
    setError(null);
    const done = !todo.done;
    mutate(
      { opId: nextId.current++, type: 'toggle', id: todo.id, done },
      api.toggle(todo.id, done),
      (server) => setConfirmed((list) => list.map((t) => (t.id === server.id ? server : t))),
      () => setError(`Could not update "${todo.title}"`),
    );
  }

  function remove(todo: ViewTodo) {
    setError(null);
    mutate(
      { opId: nextId.current++, type: 'remove', id: todo.id },
      api.remove(todo.id),
      () => setConfirmed((list) => list.filter((t) => t.id !== todo.id)),
      () => setError(`Could not delete "${todo.title}"`),
    );
  }

  return (
    <div>
      <form onSubmit={add} style={{ display: 'flex', gap: 8 }}>
        <input aria-label="New todo" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
        <button type="submit">Add</button>
      </form>

      {error ? (
        <p role="alert">
          {error} <button onClick={() => setError(null)}>Dismiss</button>
        </p>
      ) : null}

      {status === 'loading' ? <p>Loading…</p> : null}
      {status === 'error' ? <p role="alert">Could not load todos</p> : null}

      <ul aria-label="Todos">
        {todos.map((todo) => (
          <li key={todo.id} aria-busy={todo.pending} style={{ opacity: todo.pending ? 0.6 : 1 }}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                // A todo that is still being created has no server id yet.
                disabled={todo.pending}
                onChange={() => toggle(todo)}
              />
              {todo.title}
            </label>{' '}
            <button aria-label={`Delete ${todo.title}`} disabled={todo.pending} onClick={() => remove(todo)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
