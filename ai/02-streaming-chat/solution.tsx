import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { probe } from '../../shared/probe';

export type HistoryMessage = { role: 'user' | 'assistant'; content: string };

export type ChatProps = {
  streamReply: (history: HistoryMessage[], signal: AbortSignal) => AsyncIterable<string>;
};

type Status = 'streaming' | 'done' | 'stopped' | 'error';
type ChatMessage =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; content: string; status: Status };

const FLUSH_MS = 16; // about one frame

function toHistory(messages: ChatMessage[]): HistoryMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.status === 'done' || m.status === 'stopped')
    .map((m) => ({ role: m.role, content: m.content }));
}

export function Chat({ streamReply }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  // The active stream. Refs, because they change many times per second and
  // must be readable from async code without stale closures.
  const active = useRef<{ id: string; controller: AbortController } | null>(null);
  const buffer = useRef('');
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);
  const newId = () => `m${nextId.current++}`;

  const streamRef = useRef(streamReply);
  useLayoutEffect(() => {
    streamRef.current = streamReply;
  });

  /** Moves buffered tokens into state: one render for many tokens. */
  function flush() {
    clearTimeout(flushTimer.current);
    flushTimer.current = undefined;
    const current = active.current;
    const text = buffer.current;
    buffer.current = '';
    if (!current || !text) return;
    setMessages((ms) => ms.map((m) => (m.id === current.id ? { ...m, content: m.content + text } : m)));
  }

  function setStatus(id: string, status: Status) {
    setMessages((ms) => ms.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, status } : m)));
  }

  /** Stops the active stream (if any) and keeps its partial text. */
  function stopActive() {
    const current = active.current;
    if (!current) return;
    flush();
    current.controller.abort();
    active.current = null;
    setStatus(current.id, 'stopped');
  }

  async function run(history: HistoryMessage[]) {
    const id = newId();
    const controller = new AbortController();
    active.current = { id, controller };
    setMessages((ms) => [...ms, { id, role: 'assistant', content: '', status: 'streaming' }]);

    // True only while THIS stream is still the active one.
    const isCurrent = () => !controller.signal.aborted && active.current?.id === id;
    try {
      for await (const token of streamRef.current(history, controller.signal)) {
        if (!isCurrent()) return; // late token from a stopped stream
        buffer.current += token;
        if (flushTimer.current === undefined) flushTimer.current = setTimeout(flush, FLUSH_MS);
      }
      if (!isCurrent()) return;
      flush();
      active.current = null;
      setStatus(id, 'done');
    } catch {
      if (!isCurrent()) return; // we aborted it ourselves: not an error
      flush();
      active.current = null;
      setStatus(id, 'error');
    }
  }

  function send() {
    const text = input.trim();
    if (!text) return;

    // Include the stopped partial answer (text in state + text still in the buffer).
    const current = active.current;
    const pending = buffer.current;
    const base = messages.map((m) =>
      current && m.id === current.id && m.role === 'assistant' ? { ...m, content: m.content + pending, status: 'stopped' as const } : m,
    );
    stopActive();

    const user: ChatMessage = { id: newId(), role: 'user', content: text };
    setMessages((ms) => [...ms, user]);
    setInput('');
    void run(toHistory([...base, user]));
  }

  function retry(failedId: string) {
    const index = messages.findIndex((m) => m.id === failedId);
    if (index === -1 || active.current) return;
    const history = toHistory(messages.slice(0, index));
    setMessages((ms) => ms.filter((m) => m.id !== failedId));
    void run(history);
  }

  // A stable callback for the memoized messages that always runs the latest `retry`.
  const retryRef = useRef(retry);
  useLayoutEffect(() => {
    retryRef.current = retry;
  });
  const onRetry = useCallback((id: string) => retryRef.current(id), []);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  // Unmount: abort the stream and drop the pending flush.
  useEffect(
    () => () => {
      clearTimeout(flushTimer.current);
      active.current?.controller.abort();
      active.current = null;
    },
    [],
  );

  const streaming = messages.some((m) => m.role === 'assistant' && m.status === 'streaming');

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div role="log" aria-live="polite" aria-label="Conversation" aria-busy={streaming} style={{ display: 'grid', gap: 8 }}>
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserMessage key={m.id} content={m.content} />
          ) : (
            <AssistantMessage key={m.id} id={m.id} content={m.content} status={m.status} onRetry={onRetry} />
          ),
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          aria-label="Message"
          rows={2}
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {streaming ? (
          <button type="button" onClick={stopActive}>
            Stop
          </button>
        ) : null}
        <button type="button" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}

const UserMessage = memo(function UserMessage({ content }: { content: string }) {
  return (
    <article aria-label="Your message" style={{ justifySelf: 'end', whiteSpace: 'pre-wrap' }}>
      {content}
    </article>
  );
});

// memo + stable props: finished messages don't re-render while another one streams.
const AssistantMessage = memo(function AssistantMessage({
  id,
  content,
  status,
  onRetry,
}: {
  id: string;
  content: string;
  status: Status;
  onRetry: (id: string) => void;
}) {
  probe('AssistantMessage');
  return (
    <article aria-label="Assistant message" style={{ whiteSpace: 'pre-wrap' }}>
      {/* Plain text: React escapes it. Never dangerouslySetInnerHTML with model output. */}
      <p style={{ margin: 0 }}>{content}</p>
      {status === 'stopped' ? <small>Stopped</small> : null}
      {status === 'error' ? (
        <div role="alert">
          Something went wrong{' '}
          <button type="button" onClick={() => onRetry(id)}>
            Retry
          </button>
        </div>
      ) : null}
    </article>
  );
});
