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

export async function runAgent(options: RunAgentOptions): Promise<AgentResult> {
  throw new Error('Not implemented: runAgent');
}
