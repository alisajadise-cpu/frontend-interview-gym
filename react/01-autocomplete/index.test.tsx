import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autocomplete } from './index';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Call = { query: string; signal: AbortSignal; d: ReturnType<typeof deferred<string[]>> };

function setup(props: { minChars?: number } = {}) {
  const calls: Call[] = [];
  const fetchSuggestions = vi.fn((query: string, signal: AbortSignal) => {
    const d = deferred<string[]>();
    calls.push({ query, signal, d });
    return d.promise;
  });
  const onSelect = vi.fn();
  const utils = render(<Autocomplete label="Search" fetchSuggestions={fetchSuggestions} onSelect={onSelect} {...props} />);
  const input = screen.getByRole('combobox', { name: 'Search' });
  const type = (value: string) => fireEvent.change(input, { target: { value } });
  const wait = (ms: number) => act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  const respond = (i: number, items: string[]) => act(async () => {
    calls[i].d.resolve(items);
  });
  return { ...utils, input, type, wait, respond, calls, fetchSuggestions, onSelect };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Autocomplete: fetching', () => {
  it('debounces and fetches once with the trimmed latest query', async () => {
    const { type, wait, fetchSuggestions } = setup();
    type('r');
    await wait(100);
    type('re');
    await wait(100);
    type(' rea ');
    await wait(299);
    expect(fetchSuggestions).not.toHaveBeenCalled();
    await wait(1);
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(fetchSuggestions.mock.calls[0][0]).toBe('rea');
  });

  it('shows Loading… and then the options', async () => {
    const { type, wait, respond, input } = setup();
    type('re');
    await wait(300);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await respond(0, ['React', 'Redux']);
    expect(screen.queryByText('Loading…')).toBeNull();
    const listbox = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['React', 'Redux']);
  });

  it('highlights the matching part with <mark>', async () => {
    const { type, wait, respond } = setup();
    type('du');
    await wait(300);
    await respond(0, ['Redux']);
    const mark = screen.getByRole('option', { name: 'Redux' }).querySelector('mark');
    expect(mark?.textContent).toBe('du');
  });

  it('aborts the previous request when a new one starts', async () => {
    const { type, wait, calls } = setup();
    type('a');
    await wait(300);
    type('ab');
    await wait(300);
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);
  });

  it('never shows results for an old query (race condition)', async () => {
    const { type, wait, respond } = setup();
    type('a');
    await wait(300);
    type('ab');
    await wait(300);
    await respond(1, ['Abacus']); // the newer, fast request
    await respond(0, ['Apple', 'Avocado']); // the older, slow request resolves last
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Abacus']);
  });

  it('uses the cache immediately for a query seen before', async () => {
    const { type, wait, respond, fetchSuggestions } = setup();
    type('a');
    await wait(300);
    await respond(0, ['Apple']);
    type('ab');
    await wait(300);
    await respond(1, ['Abacus']);
    type('a'); // back to a cached query: no timers, no request
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Apple']);
    await wait(1000);
    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
  });

  it('does not fetch below minChars and closes the list', async () => {
    const { type, wait, fetchSuggestions, input } = setup({ minChars: 2 });
    type('a');
    await wait(500);
    type('   ');
    await wait(500);
    expect(fetchSuggestions).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows "No results" and "Something went wrong"', async () => {
    const { type, wait, respond, calls } = setup();
    type('zz');
    await wait(300);
    await respond(0, []);
    expect(screen.getByText('No results')).toBeInTheDocument();
    type('err');
    await wait(300);
    await act(async () => {
      calls[1].d.reject(new Error('500'));
    });
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('cancels the pending debounce on unmount', async () => {
    const { type, wait, unmount, fetchSuggestions } = setup();
    type('a');
    unmount();
    await wait(1000);
    expect(fetchSuggestions).not.toHaveBeenCalled();
  });

  it('aborts the in-flight request on unmount', async () => {
    const { type, wait, unmount, calls } = setup();
    type('a');
    await wait(300);
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
  });
});

describe('Autocomplete: keyboard and selection', () => {
  async function withOptions() {
    const s = setup();
    s.type('r');
    await s.wait(300);
    await s.respond(0, ['React', 'Redux', 'Remix']);
    return s;
  }

  it('ArrowDown / ArrowUp move the active option and wrap', async () => {
    const { input } = await withOptions();
    const opts = () => screen.getAllByRole('option');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(opts()[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', opts()[0].id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(opts()[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(opts()[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(opts()[2]).toHaveAttribute('aria-selected', 'true');
    expect(opts().filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(new Set(opts().map((o) => o.id)).size).toBe(3);
  });

  it('Enter selects the active option without starting a new search', async () => {
    const { input, onSelect, wait, fetchSuggestions } = await withOptions();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('Redux');
    expect(input).toHaveValue('Redux');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await wait(1000);
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
  });

  it('Escape closes the list', async () => {
    const { input } = await withOptions();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking an option selects it', async () => {
    const { input, onSelect } = await withOptions();
    fireEvent.click(screen.getByRole('option', { name: 'Remix' }));
    expect(onSelect).toHaveBeenCalledWith('Remix');
    expect(input).toHaveValue('Remix');
  });
});
