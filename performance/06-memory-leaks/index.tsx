import { useEffect, useState } from 'react';
import { probe } from '../../shared/probe';

export type PriceFeed = {
  /** Calls `listener` for every new price. Returns an unsubscribe function. */
  subscribe(symbol: string, listener: (price: number) => void): () => void;
};
export type Stats = { high: number; low: number };
export type TickerApi = { fetchStats(symbol: string, signal: AbortSignal): Promise<Stats> };

/** Max price points kept per symbol (used by the sparkline). */
export const HISTORY_LIMIT = 100;

// ⚠️ Production code that leaks memory. Review it, then fix it.

const history: Record<string, number[]> = {};

export function getHistory(symbol: string): readonly number[] {
  return history[symbol] ?? [];
}

/** Used by the tests. Keep this export. */
export function resetHistory() {
  for (const key of Object.keys(history)) delete history[key];
}

export function LiveTicker({
  symbol,
  feed,
  api,
  pollMs = 5000,
}: {
  symbol: string;
  feed: PriceFeed;
  api: TickerApi;
  pollMs?: number;
}) {
  probe('LiveTicker');
  const [price, setPrice] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [hidden, setHidden] = useState(document.hidden);

  useEffect(() => {
    feed.subscribe(symbol, (p) => {
      (history[symbol] ??= []).push(p);
      setPrice(p);
    });
  }, [symbol]);

  useEffect(() => {
    const load = () => {
      const controller = new AbortController();
      api.fetchStats(symbol, controller.signal).then(setStats);
    };
    load();
    setInterval(load, pollMs);
  }, [symbol]);

  useEffect(() => {
    document.addEventListener('visibilitychange', () => setHidden(document.hidden));
  }, []);

  return (
    <section aria-label={`${symbol} ticker`}>
      <h3 style={{ margin: 0 }}>{symbol}</h3>
      <p>Price: {price === null ? '—' : price.toFixed(2)}</p>
      <p>{stats ? `High: ${stats.high} · Low: ${stats.low}` : 'Loading stats…'}</p>
      {hidden ? <p>Paused</p> : null}
      <Sparkline points={getHistory(symbol)} />
    </section>
  );
}

function Sparkline({ points }: { points: readonly number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * 200},${40 - ((p - min) / (max - min || 1)) * 40}`)
    .join(' ');
  return (
    <svg width={200} height={40} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" />
    </svg>
  );
}
