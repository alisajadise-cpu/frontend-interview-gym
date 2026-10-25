import { describe, expect, it } from 'vitest';
import { produce } from './index';

type Todo = { id: number; title: string; done: boolean; tags: string[] };
type AppState = { user: { name: string; prefs: { theme: string } }; todos: Todo[]; meta: { version: number } };

function makeState(): AppState {
  return {
    user: { name: 'Ali', prefs: { theme: 'dark' } },
    todos: [
      { id: 1, title: 'a', done: false, tags: ['x'] },
      { id: 2, title: 'b', done: false, tags: [] },
      { id: 3, title: 'c', done: true, tags: ['y'] },
    ],
    meta: { version: 1 },
  };
}

describe('produce: basics', () => {
  it('returns the same reference when nothing changes (even after reading nested data)', () => {
    const base = makeState();
    const next = produce(base, (d) => {
      void d.user.prefs.theme;
      void d.todos[1].tags.length;
    });
    expect(next).toBe(base);
  });

  it('does not mutate the base', () => {
    const base = makeState();
    const snapshot = JSON.stringify(base);
    produce(base, (d) => {
      d.user.name = 'Sara';
      d.todos.push({ id: 4, title: 'd', done: false, tags: [] });
      d.todos[0].tags.push('z');
      delete (d.meta as Partial<AppState['meta']>).version;
    });
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('copies only the changed path; siblings keep their identity', () => {
    const base = makeState();
    const next = produce(base, (d) => {
      d.todos[1].done = true;
    });
    expect(next).not.toBe(base);
    expect(next.todos).not.toBe(base.todos);
    expect(next.todos[1]).not.toBe(base.todos[1]);
    expect(next.todos[1]).toEqual({ ...base.todos[1], done: true });
    expect(next.todos[0]).toBe(base.todos[0]);
    expect(next.todos[2]).toBe(base.todos[2]);
    expect(next.user).toBe(base.user);
    expect(next.meta).toBe(base.meta);
  });

  it('assigning the same value is not a change', () => {
    const base = makeState();
    expect(produce(base, (d) => void (d.user.name = 'Ali'))).toBe(base);
    expect(produce(base, (d) => void (d.user = d.user))).toBe(base);
  });

  it('supports delete', () => {
    const base: { a?: number; b: number } = { a: 1, b: 2 };
    const next = produce(base, (d) => {
      delete d.a;
    });
    expect(next).toEqual({ b: 2 });
    expect('a' in next).toBe(false);
    expect(base).toEqual({ a: 1, b: 2 });
  });

  it('result is a plain object/array and is not frozen', () => {
    const next = produce(makeState(), (d) => {
      d.meta.version = 2;
    });
    expect(Object.isFrozen(next)).toBe(false);
    expect(Array.isArray(next.todos)).toBe(true);
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
  });
});

describe('produce: arrays', () => {
  it('push, index assignment, splice, pop and length', () => {
    const base = [1, 2, 3, 4, 5];
    expect(produce(base, (d) => void d.push(6))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(produce(base, (d) => void (d[0] = 9))).toEqual([9, 2, 3, 4, 5]);
    expect(produce(base, (d) => void d.splice(1, 2, 7))).toEqual([1, 7, 4, 5]);
    expect(produce(base, (d) => void d.pop())).toEqual([1, 2, 3, 4]);
    expect(produce(base, (d) => void (d.length = 0))).toEqual([]);
    expect(base).toEqual([1, 2, 3, 4, 5]);
  });

  it('the draft behaves like an array', () => {
    produce([{ n: 1 }, { n: 2 }], (d) => {
      expect(Array.isArray(d)).toBe(true);
      expect(d.map((x) => x.n)).toEqual([1, 2]);
      expect(Object.keys(d)).toEqual(['0', '1']);
      expect(JSON.stringify(d)).toBe('[{"n":1},{"n":2}]');
    });
  });

  it('moving items keeps unmodified items identical', () => {
    const base = makeState();
    const next = produce(base, (d) => {
      const [first] = d.todos.splice(0, 1);
      d.todos.push(first);
    });
    expect(next.todos.map((t) => t.id)).toEqual([2, 3, 1]);
    expect(next.todos[2]).toBe(base.todos[0]);
    expect(next.todos[0]).toBe(base.todos[1]);
  });

  it('filter-and-assign with drafts inside a new array', () => {
    const base = makeState();
    const next = produce(base, (d) => {
      d.todos = d.todos.filter((t) => !t.done);
      d.todos[0].title = 'A';
    });
    expect(next.todos.map((t) => t.title)).toEqual(['A', 'b']);
    expect(next.todos[1]).toBe(base.todos[1]);
    expect(base.todos[0].title).toBe('a');
  });
});

describe('produce: returning values', () => {
  it('the recipe may return a new value instead of mutating', () => {
    const base = { count: 1 };
    expect(produce(base, () => ({ count: 100 }))).toEqual({ count: 100 });
  });

  it('a returned value that contains drafts is finalized', () => {
    const base = makeState();
    const next = produce(base, (d) => ({ only: d.user }) as unknown as AppState) as unknown as { only: unknown };
    expect(next.only).toBe(base.user);
  });

  it('returning a new value AND modifying the draft throws', () => {
    expect(() =>
      produce({ a: 1 }, (d) => {
        d.a = 2;
        return { a: 3 };
      }),
    ).toThrow(/new value/);
  });

  it('using a draft after produce has finished throws a TypeError', () => {
    let leaked: AppState | undefined;
    produce(makeState(), (d) => {
      leaked = d;
    });
    expect(() => leaked!.user).toThrow(TypeError);
    expect(() => {
      leaked!.meta = { version: 9 };
    }).toThrow(TypeError);
  });
});
