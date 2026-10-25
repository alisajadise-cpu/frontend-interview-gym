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

// Module-level data outlives every component: it MUST be bounded.
const history = new Map<string, number[]>();

export function getHistory(symbol: string): readonly number[] {
  return history.get(symbol) ?? [];
}

export function resetHistory() {
  history.clear();
}

function pushHistory(symbol: string, price: number) {
  const points = history.get(symbol) ?? [];
  points.push(price);
  if (points.length > HISTORY_LIMIT) points.splice(0, points.length - HISTORY_LIMIT); // ring-buffer behaviour
  history.set(symbol, points);
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
  const [hidden, setHidden] = useState(() => document.hidden);

  // 1. Subscriptions: always return the unsubscribe function.
  useEffect(() => {
    setPrice(null);
    return feed.subscribe(symbol, (p) => {
      pushHistory(symbol, p);
      setPrice(p);
    });
  }, [feed, symbol]);

  // 2. Polling: clear the interval, abort the in-flight request, and don't poll
  //    in a background tab.
  useEffect(() => {
    if (hidden) return;
    let controller: AbortController | null = null;
    const load = () => {
      controller?.abort(); // never let two requests race
      const current = (controller = new AbortController());
      api.fetchStats(symbol, current.signal).then(
        (s) => {
          if (!current.signal.aborted) setStats(s);
        },
        () => {}, // aborted or failed: keep the last stats
      );
    };
    load();
    const id = setInterval(load, pollMs);
    return () => {
      clearInterval(id);
      controller?.abort();
    };
  }, [api, symbol, pollMs, hidden]);

  // 3. DOM listeners: a named handler so the same reference can be removed.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
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
