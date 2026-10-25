import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { probe } from '../../shared/probe';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };
export type HistoryItem = { role: 'user' | 'assistant'; content: string };

export type Transport = {
  /** Yields raw network chunks of NDJSON: one `{"delta":"..."}` object per line. */
  stream(history: HistoryItem[], options?: { signal?: AbortSignal }): AsyncIterable<string>;
  /** Calls listener with true/false when the connection goes online/offline. Returns unsubscribe. */
  subscribeStatus(listener: (online: boolean) => void): () => void;
};

const FLUSH_MS = 16;

/** Unique ids: Date.now() collides for messages created in the same millisecond. */
let idCounter = 0;
const newId = () => `msg-${++idCounter}`;

export function useChatStream(transport: Transport) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  // Subscribe once per transport, not after every render.
  useEffect(() => transport.subscribeStatus(setOnline), [transport]);

  const active = useRef<{ id: string; controller: AbortController } | null>(null);
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Latest messages for building history inside a stable callback.
  const messagesRef = useRef(messages);
  useLayoutEffect(() => {
    messagesRef.current = messages;
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const current = active.current;
    const text = buffer.current;
    buffer.current = '';
    if (!current || !text) return;
    // Functional update: never overwrite messages added since this stream started.
    setMessages((ms) => ms.map((m) => (m.id === current.id ? { ...m, content: m.content + text } : m)));
  }, []);

  const stop = useCallback(() => {
    if (!active.current) return;
    flush();
    active.current.controller.abort();
    active.current = null;
    setIsStreaming(false);
  }, [flush]);

  // Unmount: abort the request and drop the pending flush.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      active.current?.controller.abort();
      active.current = null;
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      stop(); // one stream at a time: a new message cancels the old reply
      setError(null);

      const user: ChatMessage = { id: newId(), role: 'user', content: text };
      const assistant: ChatMessage = { id: newId(), role: 'assistant', content: '' };
      const history = [...messagesRef.current, user].map(({ role, content }) => ({ role, content }));
      setMessages((ms) => [...ms, user, assistant]);
      setIsStreaming(true);

      const controller = new AbortController();
      active.current = { id: assistant.id, controller };
      const isCurrent = () => !controller.signal.aborted && active.current?.id === assistant.id;

      let pending = ''; // partial NDJSON line carried over to the next chunk
      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const data = JSON.parse(line) as { delta?: unknown }; // a complete bad line is a real protocol error
        if (typeof data.delta !== 'string') return;
        buffer.current += data.delta;
        if (timer.current === undefined) timer.current = setTimeout(flush, FLUSH_MS);
      };

      try {
        for await (const chunk of transport.stream(history, { signal: controller.signal })) {
          if (!isCurrent()) return;
          pending += chunk;
          const lines = pending.split('\n');
          pending = lines.pop()!; // last piece may be incomplete: keep it
          lines.forEach(handleLine);
        }
        if (!isCurrent()) return;
        handleLine(pending); // stream ended: the rest must be a complete line
        flush();
      } catch (err) {
        if (!isCurrent()) return; // aborted by us: not an error
        flush();
        console.error('Chat stream failed', err); // report to your error tracker
        setError('Something went wrong');
      } finally {
        if (active.current?.id === assistant.id) {
          active.current = null;
          setIsStreaming(false);
        }
      }
    },
    [transport, flush, stop],
  );

  const removeMessage = useCallback((id: string) => {
    setMessages((ms) => ms.filter((m) => m.id !== id));
  }, []);

  return { messages, isStreaming, error, online, sendMessage, removeMessage, stop };
}

export function ChatPanel({ transport }: { transport: Transport }) {
  const { messages, isStreaming, error, online, sendMessage, removeMessage } = useChatStream(transport);
  const [text, setText] = useState('');

  return (
    <div>
      {!online && <p role="status">Offline</p>}
      <ul aria-label="Messages" aria-busy={isStreaming}>
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} onRemove={removeMessage} />
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(text);
          setText('');
        }}
      >
        <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

const MessageItem = memo(function MessageItem({
  message,
  onRemove,
}: {
  message: ChatMessage;
  onRemove: (id: string) => void;
}) {
  probe('MessageItem');
  const [helpful, setHelpful] = useState(false);
  return (
    <li aria-label={`${message.role} message`}>
      <span>{message.content}</span>{' '}
      <button aria-pressed={helpful} onClick={() => setHelpful((h) => !h)}>
        Helpful
      </button>{' '}
      <button onClick={() => onRemove(message.id)}>Remove</button>
    </li>
  );
});
