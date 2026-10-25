import { useMemo, useRef, useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const NAMES = ['Sara', 'Reza', 'Mina', 'Omid', 'Leila', 'Kian', 'Nazanin', 'Arash'];

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [count, setCount] = useState(2000);
  const [roomId, setRoomId] = useState('general');
  const [extra, setExtra] = useState<Mod.Message[]>([]);
  const [stats, setStats] = useState({ userRequests: 0, connects: 0 });
  const statsRef = useRef(stats);

  const bump = (key: keyof typeof stats) => {
    statsRef.current = { ...statsRef.current, [key]: statsRef.current[key] + 1 };
    queueMicrotask(() => setStats(statsRef.current));
  };

  const api = useMemo<Mod.ChatApi>(
    () => ({
      fetchUser: (id) => {
        bump('userRequests');
        return new Promise((r) => setTimeout(() => r({ id, name: NAMES[Number(id.slice(1)) % NAMES.length] }), 300));
      },
      connect: () => {
        bump('connects');
        return { close() {} };
      },
    }),
    [],
  );

  const messages = useMemo(
    () => [
      ...Array.from({ length: count }, (_, i) => ({ id: `m${i}`, authorId: `u${i % 8}`, text: `Message number ${i}` })),
      ...extra,
    ],
    [count, extra],
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
        <label>
          Messages{' '}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[100, 500, 2000, 5000].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button onClick={() => setRoomId((r) => (r === 'general' ? 'random' : 'general'))}>Switch room ({roomId})</button>
        <button onClick={() => impl.resetUserCache()}>Clear user cache</button>
        <span>
          /api/users requests: <b>{stats.userRequests}</b> · socket connects: <b>{stats.connects}</b>
        </span>
      </div>
      <impl.ChatRoom
        roomId={roomId}
        messages={messages}
        api={api}
        onSend={(text) => setExtra((e) => [...e, { id: `x${e.length}`, authorId: 'u0', text: text || '⚠️ (empty message)' }])}
      />
    </div>
  );
}
