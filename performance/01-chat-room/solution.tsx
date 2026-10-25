import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { probe, useMountProbe } from '../../shared/probe';

export type Message = { id: string; authorId: string; text: string; deleted?: boolean };
export type User = { id: string; name: string };
export type ChatApi = {
  fetchUser: (id: string) => Promise<User>;
  connect: (options: { roomId: string; reconnect: boolean }) => { close(): void };
};

// ---------------------------------------------------------------------------
// User cache: stores PROMISES (dedupes concurrent requests) and is bounded (LRU).
// In a real app this is React Query / SWR / Relay. Here it is hand-written.
// ---------------------------------------------------------------------------
type Entry =
  | { status: 'pending'; promise: Promise<User> }
  | { status: 'success'; promise: Promise<User>; user: User }
  | { status: 'error'; promise: Promise<User>; error: unknown };

const MAX_USERS = 500;
const cache = new Map<string, Entry>();

export function resetUserCache() {
  cache.clear();
}

function touch(id: string, entry: Entry) {
  cache.delete(id); // Map keeps insertion order: re-inserting = most recently used
  cache.set(id, entry);
  if (cache.size > MAX_USERS) cache.delete(cache.keys().next().value!);
}

function loadUser(api: ChatApi, id: string): Entry {
  const existing = cache.get(id);
  if (existing && existing.status !== 'error') {
    touch(id, existing);
    return existing;
  }
  const promise = api.fetchUser(id);
  const entry: Entry = { status: 'pending', promise };
  touch(id, entry);
  promise.then(
    (user) => {
      if (cache.get(id) === entry) touch(id, { status: 'success', promise, user });
    },
    (error) => {
      if (cache.get(id) === entry) cache.set(id, { status: 'error', promise, error }); // retry on next request
    },
  );
  return entry;
}

function useUser(api: ChatApi, id: string): User | undefined {
  // `result` remembers which id it belongs to, so we never show user A for id B.
  const [result, setResult] = useState<{ id: string; user: User } | null>(null);

  useEffect(() => {
    const entry = loadUser(api, id);
    if (entry.status === 'success') return;
    let ignore = false;
    entry.promise.then(
      (user) => {
        if (!ignore) setResult({ id, user });
      },
      () => {},
    );
    return () => {
      ignore = true; // id changed or unmounted: drop the stale response
    };
  }, [api, id]);

  const cached = cache.get(id);
  if (cached?.status === 'success') return cached.user;
  return result?.id === id ? result.user : undefined;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

// Defined at module level: a stable component type, so React keeps the instances.
const MessageRow = memo(function MessageRow({ msg, api }: { msg: Message; api: ChatApi }) {
  probe('Message');
  useMountProbe('Message');
  const author = useUser(api, msg.authorId);
  return (
    <li>
      <strong>{author?.name ?? '…'}</strong>: {msg.text}
    </li>
  );
});

const MessageList = memo(function MessageList({ messages, api }: { messages: Message[]; api: ChatApi }) {
  // Derived data: computed during render, not copied into state with an effect.
  const visible = useMemo(() => messages.filter((m) => !m.deleted), [messages]);
  const listRef = useRef<HTMLUListElement>(null);
  const lastId = visible.length ? visible[visible.length - 1].id : null;

  // Only when a new message arrives (not on every render), and only if the user
  // is already near the bottom, so we don't yank them away from history.
  const wasNearBottom = useRef(true);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && wasNearBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  return (
    <ul
      ref={listRef}
      aria-label="Messages"
      style={{ height: 400, overflow: 'auto' }}
      onScroll={(e) => {
        const el = e.currentTarget;
        wasNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      {visible.map((m) => (
        <MessageRow key={m.id} msg={m} api={api} />
      ))}
    </ul>
  );
  // For 2,000+ messages add virtualization (react-window / TanStack Virtual) here.
});

// Draft state lives here, so typing re-renders only the composer.
function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [draft, setDraft] = useState('');
  function send() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }
  return (
    <>
      <textarea aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={send}>Send</button>
    </>
  );
}

export function ChatRoom({
  roomId,
  messages,
  onSend,
  api,
}: {
  roomId: string;
  messages: Message[];
  onSend: (text: string) => void;
  api: ChatApi;
}) {
  // Primitive deps: reconnect only when the room actually changes.
  useEffect(() => {
    const socket = api.connect({ roomId, reconnect: true });
    return () => socket.close();
  }, [api, roomId]);

  return (
    <div>
      <MessageList messages={messages} api={api} />
      <Composer onSend={onSend} />
    </div>
  );
}
