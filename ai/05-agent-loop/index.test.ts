import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAgent, type AgentEvent, type AgentMessage, type ModelResponse, type Tool, type ToolCall } from './index';

/** A scripted model: returns responses in order and records what it saw. */
function scripted(...responses: Array<ModelResponse | ((messages: AgentMessage[]) => ModelResponse)>) {
  const seen: AgentMessage[][] = [];
  const model = vi.fn(async (messages: AgentMessage[]) => {
    seen.push(messages.map((m) => ({ ...m })));
    const next = responses[Math.min(seen.length - 1, responses.length - 1)];
    return typeof next === 'function' ? next(messages) : next;
  });
  return { model, seen };
}

const call = (id: string, name: string, args: unknown): ToolCall => ({
  id,
  name,
  arguments: typeof args === 'string' ? args : JSON.stringify(args),
});

const toolMessages = (messages: AgentMessage[]) =>
  messages.filter((m): m is Extract<AgentMessage, { role: 'tool' }> => m.role === 'tool');

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('runAgent: basics', () => {
  it('returns the final answer when the model calls no tools', async () => {
    const { model } = scripted({ content: 'Hello!', usage: { inputTokens: 10, outputTokens: 2 } });
    const result = await runAgent({ model, tools: [], input: 'Hi' });
    expect(result).toMatchObject({ status: 'done', output: 'Hello!', steps: 1, usage: { inputTokens: 10, outputTokens: 2 } });
    expect(result.messages).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ]);
  });

  it('runs a tool and feeds the result back to the model', async () => {
    const weather: Tool = { name: 'weather', run: vi.fn(async (args: unknown) => ({ city: (args as { city: string }).city, temp: 21 })) };
    const { model, seen } = scripted(
      { content: '', toolCalls: [call('c1', 'weather', { city: 'Tehran' })], usage: { inputTokens: 5, outputTokens: 5 } },
      { content: 'It is 21°C in Tehran.', usage: { inputTokens: 20, outputTokens: 8 } },
    );
    const result = await runAgent({ model, tools: [weather], input: 'Weather in Tehran?' });
    expect(weather.run).toHaveBeenCalledWith({ city: 'Tehran' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(toolMessages(seen[1])).toEqual([{ role: 'tool', toolCallId: 'c1', content: '{"city":"Tehran","temp":21}' }]);
    expect(result).toMatchObject({ status: 'done', output: 'It is 21°C in Tehran.', steps: 2, usage: { inputTokens: 25, outputTokens: 13 } });
  });

  it('propagates model errors', async () => {
    const model = vi.fn(async () => {
      throw new Error('429 rate limited');
    });
    await expect(runAgent({ model, tools: [], input: 'x' })).rejects.toThrow('429 rate limited');
  });
});

describe('runAgent: tool execution', () => {
  it('runs tool calls of one step in parallel and adds results in call order', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const tools: Tool[] = [
      { name: 'slow', run: vi.fn(() => slow.promise) },
      { name: 'fast', run: vi.fn(() => fast.promise) },
    ];
    const { model, seen } = scripted({ content: '', toolCalls: [call('a', 'slow', {}), call('b', 'fast', {})] }, { content: 'done' });
    const promise = runAgent({ model, tools, input: 'go' });
    await new Promise((r) => setTimeout(r, 0));
    expect(tools[0].run).toHaveBeenCalled();
    expect(tools[1].run).toHaveBeenCalled(); // started before `slow` finished
    fast.resolve('fast result');
    slow.resolve('slow result');
    await promise;
    expect(toolMessages(seen[1]).map((m) => m.toolCallId)).toEqual(['a', 'b']);
    expect(toolMessages(seen[1]).map((m) => m.content)).toEqual(['slow result', 'fast result']);
  });

  it('turns unknown tools, invalid JSON and thrown errors into error results for the model', async () => {
    const tools: Tool[] = [
      {
        name: 'boom',
        run: async () => {
          throw new Error('disk full');
        },
      },
      { name: 'echo', run: async (a) => a },
    ];
    const { model, seen } = scripted(
      { content: '', toolCalls: [call('1', 'nope', {}), call('2', 'echo', '{bad json'), call('3', 'boom', {})] },
      { content: 'recovered' },
    );
    const result = await runAgent({ model, tools, input: 'x' });
    expect(result.status).toBe('done');
    const results = toolMessages(seen[1]);
    expect(results.map((m) => m.isError)).toEqual([true, true, true]);
    expect(results[0].content).toMatch(/Unknown tool/);
    expect(results[1].content).toMatch(/Invalid JSON/);
    expect(results[2].content).toMatch(/disk full/);
  });

  it('times out a slow tool, aborts its signal, and leaves no timers', async () => {
    vi.useFakeTimers();
    let toolSignal: AbortSignal | undefined;
    const tools: Tool[] = [
      {
        name: 'hang',
        run: (_args, { signal }) => {
          toolSignal = signal;
          return new Promise(() => {});
        },
      },
    ];
    const { model, seen } = scripted({ content: '', toolCalls: [call('1', 'hang', {})] }, { content: 'gave up' });
    const promise = runAgent({ model, tools, input: 'x', timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;
    expect(result.status).toBe('done');
    expect(toolMessages(seen[1])[0].content).toMatch(/timed out after 50ms/);
    expect(toolSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('limits tool calls per step but still answers every call', async () => {
    const run = vi.fn(async () => 'ok');
    const { model, seen } = scripted(
      { content: '', toolCalls: [call('1', 't', { n: 1 }), call('2', 't', { n: 2 }), call('3', 't', { n: 3 })] },
      { content: 'done' },
    );
    await runAgent({ model, tools: [{ name: 't', run }], input: 'x', maxToolCallsPerStep: 2 });
    expect(run).toHaveBeenCalledTimes(2);
    const results = toolMessages(seen[1]);
    expect(results).toHaveLength(3);
    expect(results[2]).toMatchObject({ toolCallId: '3', isError: true });
    expect(results[2].content).toMatch(/Too many tool calls/);
  });
});

describe('runAgent: guardrails', () => {
  it('stops at maxSteps', async () => {
    let n = 0;
    const { model } = scripted(() => ({ content: `step ${++n}`, toolCalls: [call(`c${n}`, 't', { n })] }));
    const result = await runAgent({ model, tools: [{ name: 't', run: async () => 'ok' }], input: 'x', maxSteps: 3 });
    expect(result.status).toBe('max_steps');
    expect(result.steps).toBe(3);
    expect(model).toHaveBeenCalledTimes(3);
    expect(result.output).toBe('step 3');
  });

  it('detects the same call with the same arguments 3 times (key order does not matter)', async () => {
    const run = vi.fn(async () => 'same answer');
    const args = ['{"q":"x","page":1}', '{"page":1,"q":"x"}', '{"q":"x","page":1}'];
    let n = 0;
    const { model } = scripted(() => ({ content: 'searching', toolCalls: [call(`c${n}`, 'search', args[n++ % 3])] }));
    const result = await runAgent({ model, tools: [{ name: 'search', run }], input: 'x', maxSteps: 10 });
    expect(result.status).toBe('loop_detected');
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.steps).toBe(3);
  });

  it('asks for approval and does not run denied tools', async () => {
    const run = vi.fn(async () => 'deleted');
    const tools: Tool[] = [{ name: 'delete_file', requiresApproval: true, run }];
    const approve = vi.fn(async (c: ToolCall) => JSON.parse(c.arguments).path === '/tmp/a');
    const { model, seen } = scripted(
      { content: '', toolCalls: [call('1', 'delete_file', { path: '/etc/passwd' }), call('2', 'delete_file', { path: '/tmp/a' })] },
      { content: 'done' },
    );
    await runAgent({ model, tools, input: 'clean up', approve });
    expect(approve).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ path: '/tmp/a' }, expect.anything());
    const results = toolMessages(seen[1]);
    expect(results[0]).toMatchObject({ toolCallId: '1', isError: true });
    expect(results[0].content).toMatch(/denied/);
    expect(results[1]).toMatchObject({ toolCallId: '2', content: 'deleted' });
  });

  it('denies tools that need approval when no approve callback is given', async () => {
    const run = vi.fn(async () => 'sent');
    const { model } = scripted({ content: '', toolCalls: [call('1', 'send_email', {})] }, { content: 'ok' });
    await runAgent({ model, tools: [{ name: 'send_email', requiresApproval: true, run }], input: 'x' });
    expect(run).not.toHaveBeenCalled();
  });

  it('aborts: returns status aborted and aborts the running tool', async () => {
    const controller = new AbortController();
    let toolSignal: AbortSignal | undefined;
    const tools: Tool[] = [
      {
        name: 'work',
        run: (_a, { signal }) => {
          toolSignal = signal;
          return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
        },
      },
    ];
    const { model } = scripted({ content: '', toolCalls: [call('1', 'work', {})] }, { content: 'never' });
    const promise = runAgent({ model, tools, input: 'x', signal: controller.signal });
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    const result = await promise;
    expect(result.status).toBe('aborted');
    expect(toolSignal?.aborted).toBe(true);
    expect(model).toHaveBeenCalledTimes(1);
  });
});

describe('runAgent: observability', () => {
  it('emits events in order', async () => {
    const events: AgentEvent['type'][] = [];
    const { model } = scripted({ content: '', toolCalls: [call('1', 't', {})] }, { content: 'done' });
    await runAgent({ model, tools: [{ name: 't', run: async () => 1 }], input: 'x', onEvent: (e) => events.push(e.type) });
    expect(events).toEqual(['model_call', 'tool_start', 'tool_end', 'model_call', 'finish']);
  });
});
