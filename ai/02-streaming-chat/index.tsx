export type HistoryMessage = { role: 'user' | 'assistant'; content: string };

export type ChatProps = {
  streamReply: (history: HistoryMessage[], signal: AbortSignal) => AsyncIterable<string>;
};

export function Chat(props: ChatProps) {
  // TODO: implement. See README.md for the full spec.
  // Remember: the assistant message component must call probe('AssistantMessage') from '../../shared/probe'.
  return <div>TODO: implement Chat</div>;
}
