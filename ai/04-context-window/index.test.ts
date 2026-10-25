import { describe, expect, it } from 'vitest';
import { estimateCost, fitToContext, type Message } from './index';

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const user = (content: string): Message => ({ role: 'user', content });
const assistant = (content: string): Message => ({ role: 'assistant', content });
/** n-word text */
const text = (n: number, w = 'w') => Array.from({ length: n }, () => w).join(' ');

const base = { system: 'be nice', countTokens: words, perMessageOverhead: 0, reserveForReply: 0 };

describe('fitToContext', () => {
  it('returns everything when it fits', () => {
    const messages = [user('hi there'), assistant('hello'), user('how are you')];
    const r = fitToContext({ ...base, messages, maxTokens: 100 });
    expect(r.messages).toEqual(messages);
    expect(r.system).toBe('be nice');
    expect(r.droppedCount).toBe(0);
    expect(r.usedTokens).toBe(2 + 2 + 1 + 3);
    expect(r.summarized).toBe(false);
  });

  it('drops the oldest messages first and respects reserveForReply', () => {
    const messages = [user(text(10)), assistant(text(10)), user(text(10)), assistant(text(10)), user('latest question')];
    // budget = 40 - 6 = 34; system 2 + latest 2 = 4; room for 30 → the 3 newest older messages
    const r = fitToContext({ ...base, messages, maxTokens: 40, reserveForReply: 6 });
    expect(r.messages).toEqual(messages.slice(1));
    expect(r.droppedCount).toBe(1);
    expect(r.usedTokens).toBe(34);
  });

  it('counts the per-message overhead (default 4)', () => {
    const messages = [user('a b'), assistant('c')];
    const r = fitToContext({ system: 's', messages, maxTokens: 1000, reserveForReply: 0, countTokens: words });
    // system 4+1, user 4+2, assistant 4+1 → but the current turn starts at the last user message
    expect(r.usedTokens).toBe(5 + 6 + 5);
  });

  it('always keeps the system prompt and the latest user message; throws if they do not fit', () => {
    const messages = [user(text(5)), assistant(text(5)), user(text(20))];
    const r = fitToContext({ ...base, messages, maxTokens: 25 });
    expect(r.messages).toEqual([messages[2]]);
    expect(() => fitToContext({ ...base, messages, maxTokens: 21 })).toThrow(/does not fit|do not fit/);
  });

  it('keeps the whole current turn, including tool calls and results after the last user message', () => {
    const call: Message = { role: 'assistant', content: '', toolCalls: [{ id: 't1', name: 'search', arguments: '{"q": "x"}' }] };
    const result: Message = { role: 'tool', toolCallId: 't1', content: text(5) };
    const messages = [user(text(30)), assistant(text(30)), user('find x'), call, result];
    const r = fitToContext({ ...base, messages, maxTokens: 20 });
    expect(r.messages).toEqual([messages[2], call, result]);
    expect(r.usedTokens).toBe(2 + 2 + (0 + 1 + 2) + 5);
  });

  it('keeps tool calls and their results together (drops both or neither)', () => {
    const call: Message = { role: 'assistant', content: 'checking', toolCalls: [{ id: 'a', name: 'f', arguments: 'x' }, { id: 'b', name: 'f', arguments: 'y' }] };
    const r1: Message = { role: 'tool', toolCallId: 'a', content: text(5) };
    const r2: Message = { role: 'tool', toolCallId: 'b', content: text(5) };
    const messages = [user('q1'), call, r1, r2, assistant('done'), user('q2')];
    // unit [call, r1, r2] costs 1 + 4 + 10 = 15
    const small = fitToContext({ ...base, messages, maxTokens: 2 + 1 + 1 + 14 });
    expect(small.messages).toEqual([assistant('done'), user('q2')]);
    const big = fitToContext({ ...base, messages, maxTokens: 2 + 1 + 1 + 15 });
    expect(big.messages).toEqual([call, r1, r2, assistant('done'), user('q2')]);
  });

  it('keeps a contiguous block: no older small message after a bigger one was dropped', () => {
    const messages = [user('tiny'), assistant(text(50)), user('q')];
    const r = fitToContext({ ...base, messages, maxTokens: 10 });
    expect(r.messages).toEqual([user('q')]);
    expect(r.droppedCount).toBe(2);
  });

  it('drops orphan tool results (their call is not in the history)', () => {
    const orphan: Message = { role: 'tool', toolCallId: 'gone', content: 'old result' };
    const messages = [orphan, user('q1'), assistant('a1'), user('q2')];
    const r = fitToContext({ ...base, messages, maxTokens: 100 });
    expect(r.messages).toEqual([user('q1'), assistant('a1'), user('q2')]);
    expect(r.droppedCount).toBe(1);
  });

  it('adds the summary to the system prompt when history was dropped', () => {
    const messages = [user(text(20)), assistant(text(20)), user(text(3)), assistant(text(3)), user('now')];
    const r = fitToContext({ ...base, messages, maxTokens: 20, summary: 'user likes tea' });
    expect(r.summarized).toBe(true);
    expect(r.system).toBe('be nice\n\nSummary of earlier conversation:\nuser likes tea');
    // system with summary = 2 + 4 + 3 = 9 words, now = 1 → 10 used, 10 left for history
    expect(r.messages).toEqual([user(text(3)), assistant(text(3)), user('now')]);
    expect(r.usedTokens).toBe(16);
  });

  it('skips the summary when it does not fit, and when nothing was dropped', () => {
    const messages = [user(text(20)), user('now')];
    const tooBig = fitToContext({ ...base, messages, maxTokens: 6, summary: text(50) });
    expect(tooBig.summarized).toBe(false);
    expect(tooBig.system).toBe('be nice');
    const nothingDropped = fitToContext({ ...base, messages, maxTokens: 100, summary: 'x' });
    expect(nothingDropped.summarized).toBe(false);
    expect(nothingDropped.system).toBe('be nice');
  });

  it('counts tool call names and arguments', () => {
    const call: Message = { role: 'assistant', content: 'a', toolCalls: [{ id: '1', name: 'get weather', arguments: 'city tehran now' }] };
    const r = fitToContext({ ...base, messages: [user('q'), call], maxTokens: 100 });
    expect(r.usedTokens).toBe(2 + 1 + (1 + 2 + 3));
  });
});

describe('estimateCost', () => {
  const pricing = { input: 3, cachedInput: 0.3, output: 15 }; // USD per million tokens

  it('prices input and output tokens', () => {
    expect(estimateCost({ inputTokens: 1_000_000, outputTokens: 100_000 }, pricing)).toBeCloseTo(3 + 1.5, 10);
  });

  it('prices cached input tokens separately (prompt caching)', () => {
    // 100k input of which 90k came from cache
    const cost = estimateCost({ inputTokens: 100_000, cachedInputTokens: 90_000, outputTokens: 0 }, pricing);
    expect(cost).toBeCloseTo(10_000 * 3e-6 + 90_000 * 0.3e-6, 10);
  });

  it('rejects cached > input', () => {
    expect(() => estimateCost({ inputTokens: 10, cachedInputTokens: 11, outputTokens: 0 }, pricing)).toThrow(RangeError);
  });
});
