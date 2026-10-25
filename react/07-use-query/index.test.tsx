import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetQueryCache, useQuery } from './index';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A fake API: every call returns a promise the test resolves by hand. */
function makeApi() {
  const calls: { key: string; signal: AbortSignal; d: ReturnType<typeof deferred<string>> }[] = [];
  const fetcherFor = (key: string) =>
    vi.fn((signal: AbortSignal) => {
      const d = deferred<string>();
      calls.push({ key, signal, d });
      return d.promise;
    });
  const resolve = (i: number, value: string) =>
    act(async () => {
      calls[i].d.resolve(value);
    });
  const reject = (i: number, error: Error) =>
    act(async () => {
      calls[i].d.reject(error);
    });
  return { calls, fetcherFor, resolve, reject };
}

function View({
  id,
  qkey,
  fetcher,
  staleTime,
  enabled,
}: {
  id: string;
  qkey: string;
  fetcher: (signal: AbortSignal) => Promise<string>;
  staleTime?: number;
  enabled?: boolean;
}) {
  const q = useQuery(qkey, fetcher, { staleTime, enabled });
  const error = q.error instanceof Error ? q.error.message : '';
  return (
    <div>
      <output data-testid={id}>{`${q.status}|${q.isFetching ? 'fetching' : 'idle'}|${q.data ?? ''}|${error}`}</output>
      <button onClick={q.refetch}>refetch {id}</button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

beforeEach(() => {
  resetQueryCache();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useQuery: basics', () => {
  it('starts pending + fetching, then shows the data', async () => {
    const api = makeApi();
    render(<View id="a" qkey="user" fetcher={api.fetcherFor('user')} />);
    await flush();
    expect(text('a')).toBe('pending|fetching||');
    await api.resolve(0, 'Ali');
    expect(text('a')).toBe('success|idle|Ali|');
  });

  it('shows the error and keeps working', async () => {
    const api = makeApi();
    render(<View id="a" qkey="user" fetcher={api.fetcherFor('user')} />);
    await flush();
    await api.reject(0, new Error('500'));
    expect(text('a')).toBe('error|idle||500');
    fireEvent.click(screen.getByRole('button', { name: 'refetch a' }));
    await flush();
    await api.resolve(1, 'Ali');
    expect(text('a')).toBe('success|idle|Ali|');
  });

  it('two components with the same key share ONE request', async () => {
    const api = makeApi();
    const fetcher = api.fetcherFor('user');
    render(
      <>
        <View id="a" qkey="user" fetcher={fetcher} />
        <View id="b" qkey="user" fetcher={fetcher} />
      </>,
    );
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await api.resolve(0, 'Ali');
    expect(text('a')).toBe('success|idle|Ali|');
    expect(text('b')).toBe('success|idle|Ali|');
  });

  it('enabled: false does not fetch until enabled', async () => {
    const api = makeApi();
    const fetcher = api.fetcherFor('user');
    const { rerender } = render(<View id="a" qkey="user" fetcher={fetcher} enabled={false} />);
    await flush();
    expect(fetcher).not.toHaveBeenCalled();
    expect(text('a')).toBe('pending|idle||');
    rerender(<View id="a" qkey="user" fetcher={fetcher} enabled />);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('useQuery: caching', () => {
  it('fresh cached data shows immediately with no request', async () => {
    const api = makeApi();
    const fetcher = api.fetcherFor('user');
    const first = render(<View id="a" qkey="user" fetcher={fetcher} staleTime={10_000} />);
    await flush();
    await api.resolve(0, 'Ali');
    first.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    render(<View id="b" qkey="user" fetcher={fetcher} staleTime={10_000} />);
    expect(text('b')).toBe('success|idle|Ali|');
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stale data shows immediately and refetches in the background', async () => {
    const api = makeApi();
    const fetcher = api.fetcherFor('user');
    const first = render(<View id="a" qkey="user" fetcher={fetcher} staleTime={1_000} />);
    await flush();
    await api.resolve(0, 'Ali');
    first.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    render(<View id="b" qkey="user" fetcher={fetcher} staleTime={1_000} />);
    await flush();
    expect(text('b')).toBe('success|fetching|Ali|');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await api.resolve(1, 'Ali Sajadi');
    expect(text('b')).toBe('success|idle|Ali Sajadi|');
  });

  it('refetch() forces a request even when data is fresh', async () => {
    const api = makeApi();
    const fetcher = api.fetcherFor('user');
    render(<View id="a" qkey="user" fetcher={fetcher} staleTime={60_000} />);
    await flush();
    await api.resolve(0, 'v1');
    fireEvent.click(screen.getByRole('button', { name: 'refetch a' }));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(text('a')).toBe('success|fetching|v1|');
    await api.resolve(1, 'v2');
    expect(text('a')).toBe('success|idle|v2|');
  });
});

describe('useQuery: key changes and cancellation', () => {
  it("never shows the previous key's data for a new key", async () => {
    const api = makeApi();
    const { rerender } = render(<View id="a" qkey="user-1" fetcher={api.fetcherFor('user-1')} />);
    await flush();
    await api.resolve(0, 'User 1');
    rerender(<View id="a" qkey="user-2" fetcher={api.fetcherFor('user-2')} />);
    expect(text('a')).not.toContain('User 1');
    await flush();
    expect(text('a')).toBe('pending|fetching||');
    await api.resolve(1, 'User 2');
    expect(text('a')).toBe('success|idle|User 2|');
  });

  it('a late response for an old key does not leak into the new key', async () => {
    const api = makeApi();
    const { rerender } = render(<View id="a" qkey="user-1" fetcher={api.fetcherFor('user-1')} />);
    await flush();
    rerender(<View id="a" qkey="user-2" fetcher={api.fetcherFor('user-2')} />);
    await flush();
    await api.resolve(0, 'User 1 (late)');
    expect(text('a')).toBe('pending|fetching||');
  });

  it('aborts the request only when the LAST subscriber for the key unmounts', async () => {
    const api = makeApi();
    const fetcher = api.fetcherFor('user');
    const a = render(<View id="a" qkey="user" fetcher={fetcher} />);
    const b = render(<View id="b" qkey="user" fetcher={fetcher} />);
    await flush();
    expect(api.calls).toHaveLength(1);
    a.unmount();
    expect(api.calls[0].signal.aborted).toBe(false);
    b.unmount();
    expect(api.calls[0].signal.aborted).toBe(true);
  });

  it('after an abort, the next subscriber starts a fresh request', async () => {
    const api = makeApi();
    const fetcher = api.fetcherFor('user');
    const a = render(<View id="a" qkey="user" fetcher={fetcher} />);
    await flush();
    a.unmount();
    render(<View id="b" qkey="user" fetcher={fetcher} />);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    await api.resolve(1, 'Ali');
    expect(text('b')).toBe('success|idle|Ali|');
  });
});
