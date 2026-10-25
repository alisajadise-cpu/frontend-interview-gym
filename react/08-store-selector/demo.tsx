import { useMemo, useRef } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

type State = { count: number; name: string; clicks: number; increment: () => void; setName: (n: string) => void };

function useRenderCount() {
  const n = useRef(0);
  n.current++;
  return n.current;
}

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const store = useMemo(
    () =>
      impl.createStore<State>((set, get) => ({
        count: 0,
        name: 'Ali',
        clicks: 0,
        increment: () => set({ count: get().count + 1 }),
        setName: (name) => set({ name }),
      })),
    [impl],
  );

  function CountView() {
    const renders = useRenderCount();
    const count = impl.useStore(store, (s) => s.count);
    return <p>count: {count} <small>(renders: {renders})</small></p>;
  }
  function NameView() {
    const renders = useRenderCount();
    const name = impl.useStore(store, (s) => s.name);
    return <p>name: {name} <small>(renders: {renders})</small></p>;
  }
  function SummaryView() {
    const renders = useRenderCount();
    const s = impl.useStore(store, (st) => ({ count: st.count, name: st.name }), impl.shallow);
    return <p>summary: {s.name} / {s.count} <small>(renders: {renders})</small></p>;
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => store.getState().increment()}>Increment count</button>
        <input aria-label="Name" defaultValue="Ali" onChange={(e) => store.getState().setName(e.target.value)} />
        <button onClick={() => store.setState((s) => ({ clicks: s.clicks + 1 }))}>Change unrelated field</button>
      </div>
      <CountView />
      <NameView />
      <SummaryView />
      <p style={{ color: 'gray', fontSize: 13 }}>Watch the render counts: each view only re-renders when its own slice changes.</p>
    </div>
  );
}
