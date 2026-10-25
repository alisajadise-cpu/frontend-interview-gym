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

export function fitToContext({
  system,
  messages,
  maxTokens,
  reserveForReply,
  countTokens,
  summary,
  perMessageOverhead = 4,
}: FitOptions): FitResult {
  const budget = maxTokens - reserveForReply;

  const costOf = (m: Message) => {
    let tokens = perMessageOverhead + countTokens(m.content);
    if (m.role === 'assistant' && m.toolCalls) {
      for (const call of m.toolCalls) tokens += countTokens(call.name) + countTokens(call.arguments);
    }
    return tokens;
  };
  const systemCost = (text: string) => perMessageOverhead + countTokens(text);
  const sum = (ms: Message[]) => ms.reduce((n, m) => n + costOf(m), 0);

  // 1. The current turn: last user message and everything after it. Always kept.
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUser = i;
      break;
    }
  }
  const current = lastUser === -1 ? messages.slice() : messages.slice(lastUser);
  const older = lastUser === -1 ? [] : messages.slice(0, lastUser);
  const currentCost = sum(current);

  // 2. Group older history into units that must stay together.
  const units: Message[][] = [];
  let orphans = 0;
  for (const m of older) {
    if (m.role === 'tool') {
      const prev = units[units.length - 1];
      const owner = prev?.[0];
      if (owner?.role === 'assistant' && owner.toolCalls?.some((c) => c.id === m.toolCallId)) {
        prev.push(m);
      } else {
        orphans++; // a result without its call is invalid for the provider APIs
      }
      continue;
    }
    units.push([m]);
  }

  // 3. Keep the newest contiguous block of units that fits next to `sys` + current turn.
  const select = (sys: string) => {
    let used = systemCost(sys) + currentCost;
    let firstKept = units.length;
    for (let i = units.length - 1; i >= 0; i--) {
      const cost = sum(units[i]);
      if (used + cost > budget) break; // no gaps: stop at the first unit that doesn't fit
      used += cost;
      firstKept = i;
    }
    return { firstKept, used };
  };

  if (systemCost(system) + currentCost > budget) {
    throw new Error(
      `System prompt and current turn do not fit: need ${systemCost(system) + currentCost} tokens, budget is ${budget}`,
    );
  }

  const build = (sys: string, firstKept: number, used: number, summarized: boolean): FitResult => {
    const kept = units.slice(firstKept).flat();
    return {
      system: sys,
      messages: [...kept, ...current],
      droppedCount: older.length - kept.length,
      usedTokens: used,
      summarized,
    };
  };

  const plain = select(system);
  const droppedSomething = plain.firstKept > 0 || orphans > 0;
  if (!droppedSomething || !summary) return build(system, plain.firstKept, plain.used, false);

  // 4. Some history is gone: try to replace it with the summary.
  const withSummary = `${system}\n\nSummary of earlier conversation:\n${summary}`;
  if (systemCost(withSummary) + currentCost > budget) return build(system, plain.firstKept, plain.used, false);
  const summarized = select(withSummary);
  return build(withSummary, summarized.firstKept, summarized.used, true);
}

export function estimateCost(usage: Usage, pricing: Pricing): number {
  const cached = usage.cachedInputTokens ?? 0;
  if (cached > usage.inputTokens) {
    throw new RangeError('cachedInputTokens cannot be larger than inputTokens (inputTokens includes cached tokens)');
  }
  const perToken = (pricePerMillion: number) => pricePerMillion / 1_000_000;
  return (
    (usage.inputTokens - cached) * perToken(pricing.input) +
    cached * perToken(pricing.cachedInput) +
    usage.outputTokens * perToken(pricing.output)
  );
}
