import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeCount } from '../../shared/probe';
import { Chat, type HistoryMessage } from './index';

/** A controllable token stream. The test pushes tokens; the component consumes them. */
function createStream(signal: AbortSignal, ignoreAbort = false) {
  const queue: Array<{ token: string } | { end: true } | { error: unknown }> = [];
  let wake: (() => void) | null = null;
  const notify = () => {
    wake?.();
    wake = null;
  };
  signal.addEventListener('abort', notify);
  async function* iterate() {
    for (;;) {
      while (queue.length === 0) {
        if (signal.aborted && !ignoreAbort) throw new DOMException('Aborted', 'AbortError');
        await new Promise<void>((r) => (wake = r));
      }
      const item = queue.shift()!;
      if ('end' in item) return;
      if ('error' in item) throw item.error;
      yield item.token;
    }
  }
  return {
    signal,
    iterable: iterate(),
    push: (...tokens: string[]) => {
      tokens.forEach((token) => queue.push({ token }));
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

function setup({ ignoreAbort = false } = {}) {
  const streams: ReturnType<typeof createStream>[] = [];
  const histories: HistoryMessage[][] = [];
  const streamReply = vi.fn((history: HistoryMessage[], signal: AbortSignal) => {
    histories.push(history.map((m) => ({ ...m })));
    const s = createStream(signal, ignoreAbort);
    streams.push(s);
    return s.iterable;
  });
  const utils = render(<Chat streamReply={streamReply} />);
  const box = screen.getByRole('textbox', { name: 'Message' });
  const tick = (ms = 20) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  const send = async (text: string) => {
    fireEvent.change(box, { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await tick(0);
  };
  const assistant = () => screen.getAllByRole('article', { name: 'Assistant message' });
  const log = () => screen.getByRole('log', { name: 'Conversation' });
  return { ...utils, box, streams, histories, streamReply, tick, send, assistant, log };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Chat: sending', () => {
  it('sends on click, shows the user message, clears the input', async () => {
    const { send, box, streamReply, histories } = setup();
    await send('  Hi there  ');
    expect(screen.getByRole('article', { name: 'Your message' })).toHaveTextContent('Hi there');
    expect(box).toHaveValue('');
    expect(streamReply).toHaveBeenCalledTimes(1);
    expect(histories[0]).toEqual([{ role: 'user', content: 'Hi there' }]);
    expect(streamReply.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it('Enter sends, Shift+Enter and whitespace do not', async () => {
    const { box, streamReply, tick } = setup();
    fireEvent.change(box, { target: { value: 'line' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(streamReply).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: '   ' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(streamReply).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: 'go' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await tick(0);
    expect(streamReply).toHaveBeenCalledTimes(1);
  });

  it('keeps the input enabled while streaming', async () => {
    const { send, box } = setup();
    await send('Hi');
    expect(box).toBeEnabled();
  });
});

describe('Chat: streaming', () => {
  it('shows tokens as they arrive and toggles aria-busy / Stop', async () => {
    const { send, streams, tick, assistant, log } = setup();
    await send('Hi');
    expect(log()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    streams[0].push('Hel');
    await tick();
    expect(assistant()[0]).toHaveTextContent('Hel');
    streams[0].push('lo', '!');
    await tick();
    expect(assistant()[0]).toHaveTextContent('Hello!');
    streams[0].end();
    await tick();
    expect(log()).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('batches token updates: 200 tokens cause fewer than 10 renders', async () => {
    const { send, streams, tick, assistant } = setup();
    await send('Count');
    streams[0].push(...Array.from({ length: 200 }, (_, i) => `${i} `));
    streams[0].end();
    await tick(100);
    expect(assistant()[0]).toHaveTextContent('0 1 2');
    expect(assistant()[0]).toHaveTextContent('199');
    expect(probeCount('AssistantMessage')).toBeLessThan(10);
  });

  it('renders model output as text, not HTML', async () => {
    const { send, streams, tick, assistant } = setup();
    await send('x');
    streams[0].push('<img src=x onerror="alert(1)">');
    streams[0].end();
    await tick();
    expect(assistant()[0].querySelector('img')).toBeNull();
    expect(assistant()[0]).toHaveTextContent('<img src=x onerror="alert(1)">');
  });

  it('second turn history includes the finished assistant reply', async () => {
    const { send, streams, tick, histories } = setup();
    await send('Hi');
    streams[0].push('Hello');
    streams[0].end();
    await tick();
    await send('Bye');
    expect(histories[1]).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Bye' },
    ]);
  });
});

describe('Chat: stop, interrupt, errors', () => {
  it('Stop aborts, keeps the partial text, shows Stopped', async () => {
    const { send, streams, tick, assistant, log } = setup();
    await send('Hi');
    streams[0].push('Part');
    await tick();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await tick();
    expect(streams[0].signal.aborted).toBe(true);
    expect(assistant()[0]).toHaveTextContent('Part');
    expect(assistant()[0]).toHaveTextContent('Stopped');
    expect(log()).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a new message mid-stream stops the old reply first and includes its partial text', async () => {
    const { send, streams, tick, assistant, histories } = setup();
    await send('First');
    streams[0].push('Hal');
    await tick(0); // the token is consumed but still in the 16ms buffer: it must not be lost
    await send('Second');
    expect(streams[0].signal.aborted).toBe(true);
    expect(histories[1]).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Hal' },
      { role: 'user', content: 'Second' },
    ]);
    streams[1].push('New answer');
    streams[1].end();
    await tick();
    expect(assistant()).toHaveLength(2);
    expect(assistant()[0]).toHaveTextContent('Hal');
    expect(assistant()[0]).toHaveTextContent('Stopped');
    expect(assistant()[1]).toHaveTextContent('New answer');
  });

  it('ignores late tokens from a stopped stream even if it ignores the signal', async () => {
    const { send, streams, tick, assistant } = setup({ ignoreAbort: true });
    await send('First');
    streams[0].push('one');
    await tick();
    await send('Second');
    streams[0].push(' LATE');
    streams[1].push('two');
    await tick();
    expect(assistant()[0]).toHaveTextContent('one');
    expect(assistant()[0]).not.toHaveTextContent('LATE');
    expect(assistant()[1]).toHaveTextContent('two');
    expect(assistant()[1]).not.toHaveTextContent('LATE');
  });

  it('shows an error with Retry, which regenerates from the same history', async () => {
    const { send, streams, tick, assistant, histories, streamReply } = setup();
    await send('Hi');
    streams[0].push('Hal');
    await tick();
    streams[0].fail(new Error('500'));
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await tick(0);
    expect(streamReply).toHaveBeenCalledTimes(2);
    expect(histories[1]).toEqual([{ role: 'user', content: 'Hi' }]);
    streams[1].push('Hello');
    streams[1].end();
    await tick();
    expect(assistant()).toHaveLength(1);
    expect(assistant()[0]).toHaveTextContent('Hello');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('aborts the active stream on unmount', async () => {
    const { send, streams, unmount } = setup();
    await send('Hi');
    unmount();
    expect(streams[0].signal.aborted).toBe(true);
  });
});
