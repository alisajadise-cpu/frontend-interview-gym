# Review · The hard chat-room question (reading version)

**Difficulty:** Hard · **Time:** 25 min · **Format:** reading-only. The hands-on version with tests is [`performance/01-chat-room`](../01-chat-room/README.md).

**Context:** a room can have 5,000+ messages. The parent appends new messages from the server. Users report that typing feels laggy, the network tab is "full of requests", and memory keeps growing in long sessions.

```jsx
const cache = new Map();

function useUser(id) {
  const [user, setUser] = useState(cache.get(id));

  useEffect(() => {
    if (cache.has(id)) return;
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(u => {
        cache.set(id, u);
        setUser(u);
      });
  }, [id]);

  return user;
}

export function ChatRoom({ roomId, messages, onSend }) {
  const [draft, setDraft] = useState('');
  const [visible, setVisible] = useState([]);
  const listRef = useRef(null);
  const options = { roomId, reconnect: true };

  useEffect(() => {
    setVisible(messages.filter(m => !m.deleted));
  }, [messages]);

  useEffect(() => {
    const socket = connect(options);
    return () => socket.close();
  }, [options]);

  useLayoutEffect(() => {
    listRef.current.scrollTop = listRef.current.scrollHeight;
  });

  const Message = ({ msg }) => {
    const author = useUser(msg.authorId);
    return <li>{author?.name}: {msg.text}</li>;
  };

  const handleSend = useCallback(() => {
    onSend(draft);
    setDraft('');
  }, []);

  return (
    <div>
      <ul ref={listRef} style={{ height: 600, overflow: 'auto' }}>
        {visible.map(m => <Message key={m.id} msg={m} />)}
      </ul>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

## Your task

1. List every issue: what's wrong, and what the user would actually notice (lag, extra requests, memory growth, or a wrong result). There are **at least 10**.
2. Rank them. Which 3 would you fix first, and why?
3. Write a fixed `useUser`: one request per author even with 300 concurrent callers, correct when `id` changes, no race, bounded memory.

## Interviewer follow-ups

- How would you *prove* each issue exists before fixing it? Name the tool and what you'd look for.
- 300 messages on screen come from the same 5 authors. How many requests does this code make, and how many should it make?
- Would you use React Query here, or keep a custom hook? Defend your choice.
- What is a forced synchronous layout, and where does this code cause one?

<details>
<summary><strong>Short answer key</strong></summary>

1. `Message` is defined **inside** `ChatRoom`, so it's a new component type every render. Every keystroke unmounts and remounts all rows, and every `useUser` effect runs again. **Biggest issue.**
2. `handleSend` has a stale closure (`[]` deps). **Every send posts an empty string.** A correctness bug, worse than lag.
3. `draft` lives in `ChatRoom`, so every keystroke re-renders the whole list. Move the textarea into its own component.
4. The `options` object is new every render → the socket reconnects on **every keystroke**. Create it inside the effect, and depend on `[roomId]`.
5. `useLayoutEffect` with no deps reads `scrollHeight` → a forced synchronous layout of the whole list on every keystroke. Run it only when a new message arrives, and only if the user is near the bottom.
6. `visible` is derived state copied with an effect → two renders and a stale frame. Use `useMemo`.
7. The cache stores results, not **promises** → 300 rows = up to 300 requests before the first one returns. Cache the in-flight promise.
8. `useState(cache.get(id))` is only read on mount → the wrong author after `id` changes (hidden today by #1).
9. No ignore flag or abort → a late response overwrites the newer one, and setState after unmount.
10. The module-level cache has no limit → memory grows forever, and it's shared between logged-in users. Use an LRU/TTL, and clear it on logout.
11. No virtualization for 5,000+ rows.
12. No `r.ok` check or error state.

**Fix first:** #1 (remount storm), #2 (data loss), #3 + #11 (what the user feels as lag), then #4 (server load).

Full ranked table, tools, and the fixed code: [`performance/01-chat-room/ANSWERS.md`](../01-chat-room/ANSWERS.md) and [`solution.tsx`](../01-chat-room/solution.tsx).

</details>
