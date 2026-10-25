export type ToolCall = { id: string; name: string; arguments: string };

export type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export type FitOptions = {
  system: string;
  messages: Message[];
  maxTokens: number;
  reserveForReply: number;
  countTokens: (text: string) => number;
  summary?: string;
  perMessageOverhead?: number;
};

export type FitResult = {
  system: string;
  messages: Message[];
  droppedCount: number;
  usedTokens: number;
  summarized: boolean;
};

export type Usage = { inputTokens: number; cachedInputTokens?: number; outputTokens: number };
export type Pricing = { input: number; cachedInput: number; output: number };

export function fitToContext(options: FitOptions): FitResult {
  throw new Error('Not implemented: fitToContext');
}

export function estimateCost(usage: Usage, pricing: Pricing): number {
  throw new Error('Not implemented: estimateCost');
}
