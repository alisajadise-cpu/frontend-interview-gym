import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodoApp, type Todo, type TodoApi } from './index';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const INITIAL: Todo[] = [
  { id: 'a', title: 'Walk dog', done: false },
  { id: 'b', title: 'Read book', done: false },
  { id: 'c', title: 'Pay rent', done: false },
];

/** Every API call returns a promise the test settles by hand. */
function makeApi() {
  const list = deferred<Todo[]>();
  const pending: { name: string; args: unknown[]; d: ReturnType<typeof deferred<any>> }[] = [];
  const call =
    (name: string) =>
    (...args: unknown[]) => {
      const d = deferred<any>();
      pending.push({ name, args, d });
      return d.promise;
    };
  const api: TodoApi = {
    list: vi.fn(() => list.promise),
    create: vi.fn(call('create')),
    toggle: vi.fn(call('toggle')),
    remove: vi.fn(call('remove')),
  };
  const settle = (i: number, ok: boolean, value?: unknown) =>
    act(async () => {
      if (ok) pending[i].d.resolve(value);
      else pending[i].d.reject(new Error('500'));
    });
  return { api, list, pending, settle };
}

async function setup() {
  const s = makeApi();
  render(<TodoApp api={s.api} />);
  await act(async () => {
    s.list.resolve(INITIAL);
  });
  return s;
}

const box = (title: string) => screen.getByRole('checkbox', { name: title });
const titles = () => screen.queryAllByRole('checkbox').map((c) => c.closest('li')!.textContent!.replace('✕', '').trim());
const alertText = () => screen.getByRole('alert').textContent;

function addTodo(title: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'New todo' }), { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

describe('TodoApp: loading', () => {
  it('shows Loading… and then the list', async () => {
    const s = makeApi();
    render(<TodoApp api={s.api} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await act(async () => {
      s.list.resolve(INITIAL);
    });
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(titles()).toEqual(['Walk dog', 'Read book', 'Pay rent']);
  });
});

describe('TodoApp: create', () => {
  it('adds immediately, clears the input, and swaps the temp id for the server id', async () => {
    const { api, settle } = await setup();
    addTodo('  Buy milk  ');
    expect(api.create).toHaveBeenCalledWith('Buy milk');
    expect(titles()).toEqual(['Walk dog', 'Read book', 'Pay rent', 'Buy milk']);
    expect(screen.getByRole('textbox', { name: 'New todo' })).toHaveValue('');
    expect(box('Buy milk')).toBeDisabled(); // no server id yet
    await settle(0, true, { id: 's1', title: 'Buy milk', done: false });
    expect(box('Buy milk')).toBeEnabled();
    fireEvent.click(box('Buy milk'));
    expect(api.toggle).toHaveBeenCalledWith('s1', true);
  });

  it('ignores empty titles', async () => {
    const { api } = await setup();
    addTodo('   ');
    expect(api.create).not.toHaveBeenCalled();
    expect(titles()).toHaveLength(3);
  });

  it('on failure: removes the item, shows an alert and gives the text back', async () => {
    const { settle } = await setup();
    addTodo('Buy milk');
    await settle(0, false);
    expect(titles()).toEqual(['Walk dog', 'Read book', 'Pay rent']);
    expect(alertText()).toContain('Could not add "Buy milk"');
    expect(screen.getByRole('textbox', { name: 'New todo' })).toHaveValue('Buy milk');
  });

  it('on failure: does not overwrite new text the user typed meanwhile', async () => {
    const { settle } = await setup();
    addTodo('Buy milk');
    fireEvent.change(screen.getByRole('textbox', { name: 'New todo' }), { target: { value: 'Call mom' } });
    await settle(0, false);
    expect(screen.getByRole('textbox', { name: 'New todo' })).toHaveValue('Call mom');
  });
});

describe('TodoApp: toggle and delete', () => {
  it('toggles immediately and keeps it on success', async () => {
    const { api, settle } = await setup();
    fireEvent.click(box('Walk dog'));
    expect(api.toggle).toHaveBeenCalledWith('a', true);
    expect(box('Walk dog')).toBeChecked();
    await settle(0, true, { id: 'a', title: 'Walk dog', done: true });
    expect(box('Walk dog')).toBeChecked();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rolls a failed toggle back and names it in the alert', async () => {
    const { settle } = await setup();
    fireEvent.click(box('Walk dog'));
    await settle(0, false);
    expect(box('Walk dog')).not.toBeChecked();
    expect(alertText()).toContain('Could not update "Walk dog"');
  });

  it('deletes immediately; a failed delete puts it back in the same position', async () => {
    const { settle } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Read book' }));
    expect(titles()).toEqual(['Walk dog', 'Pay rent']);
    await settle(0, false);
    expect(titles()).toEqual(['Walk dog', 'Read book', 'Pay rent']);
    expect(alertText()).toContain('Could not delete "Read book"');
  });

  it('a successful delete stays deleted', async () => {
    const { settle } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Read book' }));
    await settle(0, true);
    expect(titles()).toEqual(['Walk dog', 'Pay rent']);
  });
});

describe('TodoApp: concurrent mutations', () => {
  it('an earlier failure does not undo a later success on another todo', async () => {
    const { settle } = await setup();
    fireEvent.click(box('Walk dog')); // op 0 (will fail)
    fireEvent.click(box('Read book')); // op 1 (will succeed)
    await settle(1, true, { id: 'b', title: 'Read book', done: true });
    await settle(0, false);
    expect(box('Walk dog')).not.toBeChecked();
    expect(box('Read book')).toBeChecked();
  });

  it('a failed delete does not undo a toggle that finished in the meantime', async () => {
    const { settle } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Walk dog' })); // op 0
    fireEvent.click(box('Pay rent')); // op 1
    await settle(1, true, { id: 'c', title: 'Pay rent', done: true });
    await settle(0, false);
    expect(titles()).toEqual(['Walk dog', 'Read book', 'Pay rent']);
    expect(box('Pay rent')).toBeChecked();
  });

  it('two quick toggles of the same todo end in the server state', async () => {
    const { api, settle } = await setup();
    fireEvent.click(box('Walk dog')); // → true
    fireEvent.click(box('Walk dog')); // → false
    expect(api.toggle).toHaveBeenNthCalledWith(1, 'a', true);
    expect(api.toggle).toHaveBeenNthCalledWith(2, 'a', false);
    expect(box('Walk dog')).not.toBeChecked();
    await settle(1, true, { id: 'a', title: 'Walk dog', done: false });
    await settle(0, false);
    expect(box('Walk dog')).not.toBeChecked();
  });
});
