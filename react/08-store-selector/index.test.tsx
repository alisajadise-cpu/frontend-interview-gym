import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { probe, probeCount } from '../../shared/probe';
import { createStore, shallow, useStore, type StoreApi } from './index';

type Counter = {
  count: number;
  name: string;
  tags: string[];
  increment: () => void;
  rename: (name: string) => void;
};

const makeCounter = () =>
  createStore<Counter>((set, get) => ({
    count: 0,
    name: 'Ali',
    tags: ['a'],
    increment: () => set({ count: get().count + 1 }),
    rename: (name) => set(() => ({ name })),
  }));

describe('createStore', () => {
  it('getState returns the initial state with actions', () => {
    const store = makeCounter();
    expect(store.getState().count).toBe(0);
    store.getState().increment();
    store.getState().increment();
    expect(store.getState().count).toBe(2);
  });

  it('setState merges partial state and accepts an updater', () => {
    const store = makeCounter();
    const before = store.getState();
    store.setState({ count: 5 });
    store.setState((s) => ({ count: s.count * 2 }));
    expect(store.getState()).toMatchObject({ count: 10, name: 'Ali' });
    expect(store.getState()).not.toBe(before);
    expect(before.count).toBe(0); // old state is never mutated
  });

  it('replace: true replaces the whole state', () => {
    const store = createStore<{ a?: number; b?: number }>(() => ({ a: 1, b: 2 }));
    store.setState({ b: 3 }, true);
    expect(store.getState()).toEqual({ b: 3 });
  });

  it('subscribe gets (state, prevState); unsubscribe stops it', () => {
    const store = makeCounter();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].count).toBe(1);
    expect(listener.mock.calls[0][1].count).toBe(0);
    unsubscribe();
    store.setState({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify when an updater returns the same state', () => {
    const store = makeCounter();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState((s) => s);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a listener can unsubscribe another listener during notify without breaking the loop', () => {
    const store = makeCounter();
    const second = vi.fn();
    let unsubSecond = () => {};
    store.subscribe(() => unsubSecond());
    unsubSecond = store.subscribe(second);
    expect(() => store.setState({ count: 1 })).not.toThrow();
    store.setState({ count: 2 });
    expect(second.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('shallow', () => {
  it('compares the top level with Object.is', () => {
    expect(shallow({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallow({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallow({ a: NaN }, { a: NaN })).toBe(true);
    expect(shallow([1, 2], [1, 2])).toBe(true);
    expect(shallow([1, 2], [1, 2, 3])).toBe(false);
  });

  it('is not deep', () => {
    expect(shallow({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false);
    const inner = { x: 1 };
    expect(shallow({ a: inner }, { a: inner })).toBe(true);
  });
});

describe('useStore', () => {
  function Count({ store }: { store: StoreApi<Counter> }) {
    probe('Count');
    const count = useStore(store, (s) => s.count);
    const increment = useStore(store, (s) => s.increment);
    return <button onClick={increment}>count {count}</button>;
  }
  function Name({ store }: { store: StoreApi<Counter> }) {
    probe('Name');
    const name = useStore(store, (s) => s.name);
    return <p>name {name}</p>;
  }
  function Summary({ store }: { store: StoreApi<Counter> }) {
    probe('Summary');
    // A new object every call: only safe because of `shallow`.
    const { count, name } = useStore(store, (s) => ({ count: s.count, name: s.name }), shallow);
    return <p>{`summary ${name}:${count}`}</p>;
  }

  it('re-renders only the components whose selected slice changed', () => {
    const store = makeCounter();
    render(
      <>
        <Count store={store} />
        <Name store={store} />
      </>,
    );
    expect(probeCount('Count')).toBe(1);
    expect(probeCount('Name')).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'count 0' }));
    expect(screen.getByRole('button', { name: 'count 1' })).toBeInTheDocument();
    expect(probeCount('Count')).toBe(2);
    expect(probeCount('Name')).toBe(1);
    act(() => store.getState().rename('Sara'));
    expect(screen.getByText('name Sara')).toBeInTheDocument();
    expect(probeCount('Count')).toBe(2);
    expect(probeCount('Name')).toBe(2);
  });

  it('object selectors + shallow: no infinite loop and no re-render for unrelated changes', () => {
    const store = makeCounter();
    render(<Summary store={store} />);
    expect(screen.getByText('summary Ali:0')).toBeInTheDocument();
    const after = probeCount('Summary');
    act(() => store.setState({ tags: ['a', 'b'] }));
    expect(probeCount('Summary')).toBe(after);
    act(() => store.setState({ count: 3 }));
    expect(screen.getByText('summary Ali:3')).toBeInTheDocument();
    expect(probeCount('Summary')).toBe(after + 1);
  });

  it('uses the latest selector when it depends on props', () => {
    const store = createStore<{ users: Record<string, string> }>(() => ({ users: { u1: 'Ali', u2: 'Sara' } }));
    function User({ id }: { id: string }) {
      const name = useStore(store, (s) => s.users[id]);
      return <p>{`user ${name}`}</p>;
    }
    const { rerender } = render(<User id="u1" />);
    expect(screen.getByText('user Ali')).toBeInTheDocument();
    rerender(<User id="u2" />);
    expect(screen.getByText('user Sara')).toBeInTheDocument();
  });

  it('unsubscribes on unmount', () => {
    const store = makeCounter();
    const unsubs: ReturnType<typeof vi.fn>[] = [];
    const original = store.subscribe;
    store.subscribe = (listener) => {
      const unsub = vi.fn(original(listener));
      unsubs.push(unsub);
      return unsub;
    };
    const { unmount } = render(<Name store={store} />);
    expect(unsubs.length).toBeGreaterThan(0);
    unmount();
    expect(unsubs.every((u) => u.mock.calls.length >= 1)).toBe(true);
    expect(() => store.setState({ name: 'after unmount' })).not.toThrow();
  });
});
