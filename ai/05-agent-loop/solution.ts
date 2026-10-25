export type ToolCall = { id: string; name: string; arguments: string };

export type AgentMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string; isError?: boolean };

export type ModelResponse = {
  content: string;
  toolCalls?: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
};

export type Model = (messages: AgentMessage[], options: { signal: AbortSignal }) => Promise<ModelResponse>;

export type Tool = {
  name: string;
  requiresApproval?: boolean;
  run: (args: unknown, context: { signal: AbortSignal }) => Promise<unknown>;
};

export type AgentStatus = 'done' | 'max_steps' | 'aborted' | 'loop_detected';

export type AgentEvent =
  | { type: 'model_call'; step: number }
  | { type: 'tool_start'; call: ToolCall }
  | { type: 'tool_end'; call: ToolCall; ok: boolean; durationMs: number }
  | { type: 'approval'; call: ToolCall; approved: boolean }
  | { type: 'finish'; status: AgentStatus };

export type RunAgentOptions = {
  model: Model;
  tools: Tool[];
  input: string;
  maxSteps?: number;
  maxToolCallsPerStep?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  approve?: (call: ToolCall) => boolean | Promise<boolean>;
};

export type AgentResult = {
  status: AgentStatus;
  output: string;
  steps: number;
  messages: AgentMessage[];
  usage: { inputTokens: number; outputTokens: number };
};

const LOOP_LIMIT = 3;

/** JSON with sorted keys, so {"a":1,"b":2} and {"b":2,"a":1} count as the same call. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function signature(call: ToolCall) {
  try {
    return `${call.name}:${stableStringify(JSON.parse(call.arguments))}`;
  } catch {
    return `${call.name}:${call.arguments}`;
  }
}

class ToolError extends Error {}

export async function runAgent({
  model,
  tools,
  input,
  maxSteps = 8,
  maxToolCallsPerStep = 5,
  timeoutMs = 10_000,
  signal,
  onEvent,
  approve,
}: RunAgentOptions): Promise<AgentResult> {
  const messages: AgentMessage[] = [{ role: 'user', content: input }];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const seen = new Map<string, number>();
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const emit = (e: AgentEvent) => onEvent?.(e);

  // One controller for the whole run, linked to the caller's signal.
  const run = new AbortController();
  const onAbort = () => run.abort(signal?.reason);
  if (signal?.aborted) run.abort(signal.reason);
  signal?.addEventListener('abort', onAbort);

  let steps = 0;
  let output = '';
  const finish = (status: AgentStatus): AgentResult => {
    signal?.removeEventListener('abort', onAbort);
    emit({ type: 'finish', status });
    return { status, output, steps, messages, usage };
  };

  /** Runs one tool call and always returns a tool message (errors are data for the model). */
  async function execute(call: ToolCall, approved: boolean): Promise<AgentMessage> {
    const fail = (content: string): AgentMessage => ({ role: 'tool', toolCallId: call.id, content, isError: true });
    const tool = toolsByName.get(call.name);
    if (!tool) return fail(`Error: Unknown tool "${call.name}"`);
    let args: unknown;
    try {
      args = JSON.parse(call.arguments);
    } catch {
      return fail(`Error: Invalid JSON arguments for "${call.name}": ${call.arguments.slice(0, 200)}`);
    }
    if (!approved) return fail('Error: The user denied this tool call');

    const controller = new AbortController();
    const abortTool = () => controller.abort();
    run.signal.addEventListener('abort', abortTool);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    emit({ type: 'tool_start', call });
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ToolError(`Tool "${call.name}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      const value = await Promise.race([tool.run(args, { signal: controller.signal }), timeout]);
      emit({ type: 'tool_end', call, ok: true, durationMs: Date.now() - started });
      return { role: 'tool', toolCallId: call.id, content: typeof value === 'string' ? value : JSON.stringify(value) };
    } catch (err) {
      emit({ type: 'tool_end', call, ok: false, durationMs: Date.now() - started });
      return fail(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer); // no timers left behind
      run.signal.removeEventListener('abort', abortTool);
    }
  }

  while (steps < maxSteps) {
    if (run.signal.aborted) return finish('aborted');
    steps++;
    emit({ type: 'model_call', step: steps });

    let response: ModelResponse;
    try {
      response = await model(messages, { signal: run.signal });
    } catch (err) {
      if (run.signal.aborted) return finish('aborted');
      signal?.removeEventListener('abort', onAbort);
      throw err; // model/API errors are the caller's problem (retry with backoff there)
    }
    usage.inputTokens += response.usage?.inputTokens ?? 0;
    usage.outputTokens += response.usage?.outputTokens ?? 0;
    output = response.content;

    const calls = response.toolCalls ?? [];
    messages.push({ role: 'assistant', content: response.content, ...(calls.length ? { toolCalls: calls } : {}) });
    if (calls.length === 0) return finish('done');

    // Loop guard: the same call with the same arguments 3 times means the agent is stuck.
    for (const call of calls) {
      const key = signature(call);
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (count >= LOOP_LIMIT) return finish('loop_detected');
    }

    // Approvals one at a time (a person answers them), in call order.
    const allowed = calls.slice(0, maxToolCallsPerStep);
    const approvals: boolean[] = [];
    for (const call of allowed) {
      const tool = toolsByName.get(call.name);
      if (!tool?.requiresApproval) {
        approvals.push(true);
        continue;
      }
      const ok = approve ? await approve(call) : false;
      emit({ type: 'approval', call, approved: ok });
      approvals.push(ok);
      if (run.signal.aborted) return finish('aborted');
    }

    // Independent calls run in parallel; results are added in CALL order.
    const settled = await Promise.allSettled(allowed.map((call, i) => execute(call, approvals[i])));
    for (const [i, s] of settled.entries()) {
      messages.push(
        s.status === 'fulfilled' ? s.value : { role: 'tool', toolCallId: allowed[i].id, content: `Error: ${String(s.reason)}`, isError: true },
      );
    }
    // Every call needs a result, even the ones over the limit.
    for (const call of calls.slice(maxToolCallsPerStep)) {
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        content: `Error: Too many tool calls in one step (limit is ${maxToolCallsPerStep}). Call it again in the next step.`,
        isError: true,
      });
    }
    if (run.signal.aborted) return finish('aborted');
  }
  return finish('max_steps');
}
