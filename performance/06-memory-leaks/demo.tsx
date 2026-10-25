import { useMemo, useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA'];

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [tab, setTab] = useState<'ticker' | 'other'>('ticker');
  const [symbol, setSymbol] = useState('AAPL');
  const [mounts, setMounts] = useState(0);
  const [, force] = useState(0);
  const stats = useMemo(() => ({ subscribers: 0, requests: 0 }), []);

  const feed = useMemo<Mod.PriceFeed>(
    () => ({
      subscribe(sym, listener) {
        stats.subscribers++;
        let price = 100 + sym.length * 10;
        const id = setInterval(() => listener((price += (Math.random() - 0.5) * 2)), 200);
        return () => {
          stats.subscribers--;
          clearInterval(id);
        };
      },
    }),
    [stats],
  );
  const api = useMemo<Mod.TickerApi>(
    () => ({
      fetchStats: (sym, signal) =>
        new Promise((resolve, reject) => {
          stats.requests++;
          const t = setTimeout(() => resolve({ high: 120 + sym.length, low: 90 }), 800);
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    }),
    [stats],
  );

  return (
    <div>
      <p style={{ fontSize: 13, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => { setTab(tab === 'ticker' ? 'other' : 'ticker'); setMounts((m) => m + 1); }}>
          Switch tab ({tab})
        </button>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {SYMBOLS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => force((x) => x + 1)}>Refresh counters</button>
        <span>
          Tab switches: {mounts} · live feed subscribers: <b>{stats.subscribers}</b> · stats requests: <b>{stats.requests}</b> ·
          history points: <b>{impl.getHistory(symbol).length}</b>
        </span>
      </p>
      <p style={{ fontSize: 13, color: 'gray' }}>
        Switch tabs 10 times, then refresh the counters. With the buggy code, subscribers keep growing even while the ticker is hidden.
      </p>
      {tab === 'ticker' ? <impl.LiveTicker symbol={symbol} feed={feed} api={api} /> : <p>Another tab.</p>}
    </div>
  );
}
