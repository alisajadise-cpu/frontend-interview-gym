import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { probe, useMountProbe } from '../../shared/probe';

export type Message = { id: string; authorId: string; text: string; deleted?: boolean };
export type User = { id: string; name: string };
export type ChatApi = {
  fetchUser: (id: string) => Promise<User>;
  connect: (options: { roomId: string; reconnect: boolean }) => { close(): void };
};

// ⚠️ Production code with performance and correctness problems. Review it, then fix it.

const cache = new Map<string, User>();

/** Used by the tests to start each test with an empty cache. Keep this export. */
export function resetUserCache() {
  cache.clear();
}

function useUser(api: ChatApi, id: string) {
  const [user, setUser] = useState(cache.get(id));

  useEffect(() => {
    if (cache.has(id)) return;
    api.fetchUser(id).then((u) => {
      cache.set(id, u);
      setUser(u);
    });
  }, [id]);

  return user;
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
  const [draft, setDraft] = useState('');
  const [visible, setVisible] = useState<Message[]>([]);
  const listRef = useRef<HTMLUListElement>(null);
  const options = { roomId, reconnect: true };

  useEffect(() => {
    setVisible(messages.filter((m) => !m.deleted));
  }, [messages]);

  useEffect(() => {
    const socket = api.connect(options);
    return () => socket.close();
  }, [options]);

  useLayoutEffect(() => {
    listRef.current!.scrollTop = listRef.current!.scrollHeight;
  });

  const MessageRow = ({ msg }: { msg: Message }) => {
    probe('Message');
    useMountProbe('Message');
    const author = useUser(api, msg.authorId);
    return (
      <li>
        <strong>{author?.name ?? '…'}</strong>: {msg.text}
      </li>
    );
  };

  const handleSend = useCallback(() => {
    onSend(draft);
    setDraft('');
  }, []);

  return (
    <div>
      <ul ref={listRef} aria-label="Messages" style={{ height: 400, overflow: 'auto' }}>
        {visible.map((m) => (
          <MessageRow key={m.id} msg={m} />
        ))}
      </ul>
      <textarea aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
