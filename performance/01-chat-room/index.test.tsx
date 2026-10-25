import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { probeCount, resetProbes } from '../../shared/probe';
import { ChatRoom, resetUserCache, type ChatApi, type Message, type User } from './index';

function makeApi() {
  const pending = new Map<string, Array<(u: User) => void>>();
  const sockets: { roomId: string; close: ReturnType<typeof vi.fn> }[] = [];
  const api: ChatApi = {
    fetchUser: vi.fn((id: string) => new Promise<User>((resolve) => pending.set(id, [...(pending.get(id) ?? []), resolve]))),
    connect: vi.fn((options: { roomId: string; reconnect: boolean }) => {
      const socket = { roomId: options.roomId, close: vi.fn() };
      sockets.push(socket);
      return socket;
    }),
  };
  const resolveAll = () =>
    act(async () => {
      for (const [id, resolvers] of pending) resolvers.forEach((r) => r({ id, name: `User ${id}` }));
      pending.clear();
    });
  return { api, sockets, resolveAll };
}

function makeMessages(count: number, authors: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({ id: `m${i}`, authorId: `u${i % authors}`, text: `message ${i}` }));
}

beforeEach(() => {
  resetUserCache();
});

describe('ChatRoom: correctness', () => {
  it('Send posts the text that was typed and clears the box', () => {
    const { api } = makeApi();
    const onSend = vi.fn();
    render(<ChatRoom roomId="r1" messages={[]} onSend={onSend} api={api} />);
    const box = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('hello');
    expect(box).toHaveValue('');
  });

  it('does not render deleted messages', async () => {
    const { api, resolveAll } = makeApi();
    const messages = [
      { id: 'a', authorId: 'u1', text: 'visible' },
      { id: 'b', authorId: 'u1', text: 'gone', deleted: true },
    ];
    render(<ChatRoom roomId="r1" messages={messages} onSend={() => {}} api={api} />);
    await resolveAll();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('User u1: visible');
  });

  it('shows the correct author after a message changes author', async () => {
    const { api, resolveAll } = makeApi();
    const first = [
      { id: 'a', authorId: 'u1', text: 'one' },
      { id: 'b', authorId: 'u2', text: 'two' },
    ];
    const { rerender } = render(<ChatRoom roomId="r1" messages={first} onSend={() => {}} api={api} />);
    await resolveAll();
    rerender(<ChatRoom roomId="r1" messages={[{ ...first[0], authorId: 'u2' }, first[1]]} onSend={() => {}} api={api} />);
    await resolveAll();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('User u2: one');
  });
});

describe('ChatRoom: performance', () => {
  it('fetches each author once, even when 300 rows ask at the same time', async () => {
    const { api, resolveAll } = makeApi();
    render(<ChatRoom roomId="r1" messages={makeMessages(300, 5)} onSend={() => {}} api={api} />);
    await resolveAll();
    expect(api.fetchUser).toHaveBeenCalledTimes(5);
    expect(screen.getAllByRole('listitem')[7]).toHaveTextContent('User u2: message 7');
  });

  it('typing does not remount message rows', async () => {
    const { api, resolveAll } = makeApi();
    render(<ChatRoom roomId="r1" messages={makeMessages(50, 3)} onSend={() => {}} api={api} />);
    await resolveAll();
    expect(probeCount('Message:mount')).toBe(50);
    const box = screen.getByRole('textbox', { name: 'Message' });
    for (const text of ['h', 'he', 'hel', 'hell', 'hello']) fireEvent.change(box, { target: { value: text } });
    expect(probeCount('Message:mount')).toBe(50);
  });

  it('typing does not re-render message rows', async () => {
    const { api, resolveAll } = makeApi();
    render(<ChatRoom roomId="r1" messages={makeMessages(50, 3)} onSend={() => {}} api={api} />);
    await resolveAll();
    resetProbes();
    const box = screen.getByRole('textbox', { name: 'Message' });
    for (const text of ['h', 'he', 'hel', 'hell', 'hello']) fireEvent.change(box, { target: { value: text } });
    expect(probeCount('Message')).toBe(0);
  });

  it('connects once while typing, reconnects only when roomId changes, closes on unmount', () => {
    const { api, sockets } = makeApi();
    const { rerender, unmount } = render(<ChatRoom roomId="r1" messages={[]} onSend={() => {}} api={api} />);
    const box = screen.getByRole('textbox', { name: 'Message' });
    for (const text of ['a', 'ab', 'abc']) fireEvent.change(box, { target: { value: text } });
    rerender(<ChatRoom roomId="r1" messages={[]} onSend={() => {}} api={api} />);
    expect(api.connect).toHaveBeenCalledTimes(1);
    rerender(<ChatRoom roomId="r2" messages={[]} onSend={() => {}} api={api} />);
    expect(api.connect).toHaveBeenCalledTimes(2);
    expect(sockets[0].close).toHaveBeenCalledTimes(1);
    expect(sockets[1].roomId).toBe('r2');
    unmount();
    expect(sockets[1].close).toHaveBeenCalledTimes(1);
  });

  it('typing does not force layout (no scrollHeight reads)', async () => {
    const { api, resolveAll } = makeApi();
    render(<ChatRoom roomId="r1" messages={makeMessages(20, 2)} onSend={() => {}} api={api} />);
    await resolveAll();
    const reads = vi.spyOn(Element.prototype, 'scrollHeight', 'get');
    const box = screen.getByRole('textbox', { name: 'Message' });
    for (const text of ['h', 'he', 'hel']) fireEvent.change(box, { target: { value: text } });
    expect(reads).not.toHaveBeenCalled();
  });
});
