import { describe, expect, it, vi } from 'vitest';
import { parseSSE, streamChatCompletion, type SSEEvent } from './index';

const encoder = new TextEncoder();

/** Bytes of `text`, cut at the given byte offsets (or every N bytes). */
function bytes(text: string, cuts: number[] | { every: number }): Uint8Array[] {
  const all = encoder.encode(text);
  const points = Array.isArray(cuts)
    ? cuts
    : Array.from({ length: Math.ceil(all.length / cuts.every) - 1 }, (_, i) => (i + 1) * cuts.every);
  const out: Uint8Array[] = [];
  let prev = 0;
  for (const p of [...points, all.length]) {
    out.push(all.slice(prev, p));
    prev = p;
  }
  return out;
}

async function* iterable(chunks: Uint8Array[]): AsyncGenerator<Uint8Array> {
  for (const c of chunks) {
    await Promise.resolve();
    yield c;
  }
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of gen) out.push(x);
  return out;
}

const parse = (text: string, cuts: number[] | { every: number } = []) => collect(parseSSE(iterable(bytes(text, cuts))));
const msg = (data: string, extra: Partial<SSEEvent> = {}): SSEEvent => ({ event: 'message', data, id: '', ...extra });

describe('parseSSE', () => {
  it('parses one event', async () => {
    expect(await parse('data: hello\n\n')).toEqual([msg('hello')]);
  });

  it('parses event and id fields; id persists, event type resets', async () => {
    const text = 'event: delta\nid: 7\ndata: a\n\ndata: b\n\n';
    expect(await parse(text)).toEqual([msg('a', { event: 'delta', id: '7' }), msg('b', { id: '7' })]);
  });

  it('joins multi-line data with \\n', async () => {
    expect(await parse('data: line 1\ndata: line 2\n\n')).toEqual([msg('line 1\nline 2')]);
  });

  it('ignores comments and unknown fields; removes only one space after the colon', async () => {
    const text = ': keep-alive\nretry: 3000\nfoo: bar\ndata:  two spaces\ndata:none\n\n';
    expect(await parse(text)).toEqual([msg(' two spaces\nnone')]);
  });

  it('treats a line without a colon as a field with an empty value', async () => {
    expect(await parse('data\ndata\n\n')).toEqual([msg('\n')]);
  });

  it('supports \\r\\n and \\r line endings', async () => {
    expect(await parse('data: a\r\n\r\ndata: b\r\rdata: c\n\n')).toEqual([msg('a'), msg('b'), msg('c')]);
  });

  it('works when every chunk is a single byte', async () => {
    const text = 'event: e\r\ndata: {"x":1}\r\n\r\ndata: second\n\n';
    expect(await parse(text, { every: 1 })).toEqual([msg('{"x":1}', { event: 'e' }), msg('second')]);
  });

  it('does not treat \\r\\n split across chunks as two line breaks', async () => {
    const text = 'data: a\r\ndata: b\r\n\r\n';
    const cut = 'data: a\r'.length; // the chunk ends right after \r
    expect(await parse(text, [cut])).toEqual([msg('a\nb')]);
  });

  it('decodes multi-byte UTF-8 characters split across chunks (Persian)', async () => {
    const text = 'data: سلام دنیا\n\n';
    // Every 3 bytes: Persian letters are 2 bytes, so many cuts land mid-character.
    expect(await parse(text, { every: 3 })).toEqual([msg('سلام دنیا')]);
  });

  it('does not dispatch events with no data', async () => {
    expect(await parse('event: ping\n\n: comment\n\ndata: x\n\n')).toEqual([msg('x')]);
  });

  it('discards a final event without a trailing blank line', async () => {
    expect(await parse('data: complete\n\ndata: cut off\n')).toEqual([msg('complete')]);
  });

  it('strips a leading BOM', async () => {
    expect(await parse('﻿data: x\n\n', [1])).toEqual([msg('x')]);
  });

  it('accepts a ReadableStream', async () => {
    const chunks = bytes('data: from stream\n\n', { every: 4 });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(c));
        controller.close();
      },
    });
    expect(await collect(parseSSE(stream))).toEqual([msg('from stream')]);
  });
});

const chunk = (content: unknown, role?: string) => `data: ${JSON.stringify({ choices: [{ delta: { content, role } }] })}\n\n`;

describe('streamChatCompletion', () => {
  it('yields text deltas and skips role-only / empty deltas', async () => {
    const text = `data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n${chunk('Hel')}${chunk('')}${chunk('lo')}${chunk(' سلام')}data: [DONE]\n\n`;
    expect(await collect(streamChatCompletion(iterable(bytes(text, { every: 5 }))))).toEqual(['Hel', 'lo', ' سلام']);
  });

  it('stops at [DONE] without reading further', async () => {
    const text = `${chunk('ok')}data: [DONE]\n\ndata: {not json\n\n`;
    expect(await collect(streamChatCompletion(iterable(bytes(text, []))))).toEqual(['ok']);
  });

  it('cancels the ReadableStream after [DONE]', async () => {
    const cancel = vi.fn();
    const parts = [chunk('a'), 'data: [DONE]\n\n', chunk('never')];
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < parts.length) controller.enqueue(encoder.encode(parts[i++]));
        else controller.close();
      },
      cancel,
    });
    expect(await collect(streamChatCompletion(stream))).toEqual(['a']);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error on malformed JSON', async () => {
    const text = `${chunk('a')}data: {"choices": [\n\n`;
    await expect(collect(streamChatCompletion(iterable(bytes(text, []))))).rejects.toThrow(/Malformed/);
  });

  it('throws the server error message', async () => {
    const text = `data: {"error":{"message":"Rate limit exceeded"}}\n\n`;
    await expect(collect(streamChatCompletion(iterable(bytes(text, []))))).rejects.toThrow('Rate limit exceeded');
  });
});
