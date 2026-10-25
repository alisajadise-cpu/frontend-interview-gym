import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeCount, resetProbes } from '../../shared/probe';
import { ChatPanel, type HistoryItem, type Transport } from './index';

function createChannel(signal?: AbortSignal) {
  const queue: Array<{ chunk: string } | { end: true } | { error: unknown }> = [];
  let wake: (() => void) | null = null;
  const notify = () => {
    wake?.();
    wake = null;
  };
  signal?.addEventListener('abort', notify);
  async function* iterate() {
    for (;;) {
      while (queue.length === 0) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        await new Promise<void>((r) => (wake = r));
      }
      const item = queue.shift()!;
      if ('end' in item) return;
      if ('error' in item) throw item.error;
      yield item.chunk;
    }
  }
  return {
    signal,
    iterable: iterate(),
    push: (...chunks: string[]) => {
      chunks.forEach((chunk) => queue.push({ chunk }));
      notify();
    },
    end: () => {
      queue.push({ end: true });
      notify();
    },
    fail: (error: unknown) => {
      queue.push({ error });
      notify();
    },
  };
}

const line = (delta: string) => JSON.stringify({ delta }) + '\n';

function setup() {
  const channels: ReturnType<typeof createChannel>[] = [];
  const histories: HistoryItem[][] = [];
  let statusListener: ((online: boolean) => void) | null = null;
  const transport: Transport = {
    stream: vi.fn((history: HistoryItem[], options?: { signal?: AbortSignal }) => {
      histories.push(history);
      const c = createChannel(options?.signal);
      channels.push(c);
      return c.iterable;
    }),
    subscribeStatus: vi.fn((listener: (online: boolean) => void) => {
      statusListener = listener;
      return () => {
        if (statusListener === listener) statusListener = null;
      };
    }),
  };
  const utils = render(<ChatPanel transport={transport} />);
  const input = screen.getByRole('textbox', { name: 'Message' });
  const tick = (ms = 20) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  const send = async (text: string) => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await tick(0);
  };
  const reply = async (i: number, ...deltas: string[]) => {
    channels[i].push(...deltas.map(line));
    channels[i].end();
    await tick();
  };
  const items = (role: 'user' | 'assistant') => screen.queryAllByRole('listitem', { name: `${role} message` });
  return { ...utils, transport, channels, histories, tick, send, reply, items, setOnline: (v: boolean) => statusListener?.(v) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useChatStream / ChatPanel: correctness', () => {
  it('streams the reply into the assistant message', async () => {
    const { send, reply, items } = setup();
    await send('Hi');
    await reply(0, 'Hel', 'lo');
    expect(items('user')[0]).toHaveTextContent('Hi');
    expect(items('assistant')[0]).toHaveTextContent('Hello');
  });

  it('handles JSON lines split across network chunks', async () => {
    const { send, channels, tick, items } = setup();
    await send('Hi');
    channels[0].push('{"delta":"Hel', 'lo"}\n{"del', 'ta":" world"}\n');
    channels[0].end();
    await tick();
    expect(items('assistant')[0]).toHaveTextContent('Hello world');
  });

  it('shows an error when the stream fails (errors are not swallowed)', async () => {
    const { send, channels, tick } = setup();
    await send('Hi');
    channels[0].fail(new Error('network down'));
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('treats a complete malformed line as an error, not something to skip', async () => {
    const { send, channels, tick } = setup();
    await send('Hi');
    channels[0].push(line('ok'), '<html>502 Bad Gateway</html>\n');
    channels[0].end();
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('sends the previous reply in the history of the next turn', async () => {
    const { send, reply, histories } = setup();
    await send('Hi');
    await reply(0, 'Hello');
    await send('Bye');
    expect(histories[1]).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Bye' },
    ]);
  });

  it('a new message aborts the previous stream and no message is lost (stale closure)', async () => {
    const { send, channels, tick, items } = setup();
    await send('First');
    channels[0].push(line('par'));
    await tick();
    await send('Second');
    expect(channels[0].signal?.aborted).toBe(true);
    channels[1].push(line('answer'));
    await tick();
    expect(items('user').map((li) => li.querySelector('span')!.textContent)).toEqual(['First', 'Second']);
    expect(items('assistant')[1]).toHaveTextContent('answer');
  });

  it('aborts the request on unmount', async () => {
    const { send, channels, unmount } = setup();
    await send('Hi');
    unmount();
    expect(channels[0].signal?.aborted).toBe(true);
  });

  it('removing one message removes only that message (unique ids)', async () => {
    const { send, reply, items } = setup();
    await send('Hi');
    await reply(0, 'Hello');
    fireEvent.click(within(items('user')[0]).getByRole('button', { name: 'Remove' }));
    expect(items('user')).toHaveLength(0);
    expect(items('assistant')).toHaveLength(1);
  });

  it('per-message state stays with its message after an earlier one is removed (keys)', async () => {
    const { send, reply, items } = setup();
    await send('One');
    await reply(0, 'First reply');
    await send('Two');
    await reply(1, 'Second reply');
    const second = () => items('assistant').find((li) => li.textContent!.includes('Second reply'))!;
    fireEvent.click(within(second()).getByRole('button', { name: 'Helpful' }));
    fireEvent.click(within(items('user')[0]).getByRole('button', { name: 'Remove' }));
    expect(within(second()).getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'true');
    const first = items('assistant').find((li) => li.textContent!.includes('First reply'))!;
    expect(within(first).getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('useChatStream / ChatPanel: performance', () => {
  it('subscribes to connection status once, not on every render', async () => {
    const { send, reply, transport, setOnline } = setup();
    await send('Hi');
    await reply(0, 'a', 'b', 'c');
    expect(transport.subscribeStatus).toHaveBeenCalledTimes(1);
    act(() => setOnline(false));
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
  });

  it('batches streaming updates: 100 chunks, 1ms apart, cause fewer than 20 message renders', async () => {
    const { send, channels, tick, items } = setup();
    await send('Count');
    resetProbes();
    for (let i = 0; i < 100; i++) {
      channels[0].push(line(`${i} `)); // like a real network: one chunk per macrotask
      await tick(1);
    }
    channels[0].end();
    await tick(100);
    expect(items('assistant')[0]).toHaveTextContent('99');
    expect(probeCount('MessageItem')).toBeLessThan(20);
  });
});
