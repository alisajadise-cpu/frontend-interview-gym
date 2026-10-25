import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { probe } from '../../shared/probe';
import { measure, mutate } from './dom';

export type Card = { id: string; title: string; body: string };

/** Scroll progress of the page, 0..1. Reads layout (scrollHeight). */
export function defaultScrollProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? window.scrollY / max : 0;
}

/** Cards in the same row get the height of the tallest card in that row. */
export function EqualHeightGrid({
  cards,
  columns = 3,
  highlightedId,
}: {
  cards: Card[];
  columns?: number;
  highlightedId?: string;
}) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    // Phase 1: ALL reads. Only the first read can trigger a layout; the rest
    // reuse it because nothing has been written yet.
    const heights = cards.map((_, i) => measure(contentRefs.current[i]!));

    const rowMax: number[] = [];
    heights.forEach((h, i) => {
      const row = Math.floor(i / columns);
      rowMax[row] = Math.max(rowMax[row] ?? 0, h);
    });

    // Phase 2: ALL writes. The browser does one layout later, before paint.
    cards.forEach((_, i) => mutate(cardRefs.current[i]!, rowMax[Math.floor(i / columns)]));
    // Only when the content or the layout inputs change, not on every render.
    // (In the real app also re-run from a ResizeObserver when widths change.)
  }, [cards, columns]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8, alignItems: 'start' }}>
      {cards.map((card, i) => (
        <div
          key={card.id}
          ref={(el: HTMLDivElement | null) => {
            cardRefs.current[i] = el;
          }}
          style={{
            border: card.id === highlightedId ? '2px solid #3b5bdb' : '1px solid #ccc',
            borderRadius: 8,
            padding: 8,
          }}
        >
          <div
            ref={(el: HTMLDivElement | null) => {
              contentRefs.current[i] = el;
            }}
          >
            <strong>{card.title}</strong>
            <p style={{ margin: '4px 0 0' }}>{card.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
  // CSS-only alternative that needs no JS at all: `display: grid` rows already
  // stretch items to the tallest one (align-items: stretch is the default).
}

export function ScrollProgressHeader({
  getScrollProgress = defaultScrollProgress,
}: {
  getScrollProgress?: () => number;
}) {
  probe('ScrollProgressHeader');
  const [progress, setProgress] = useState(0);

  // Latest function without re-subscribing when the parent passes a new one.
  const getRef = useRef(getScrollProgress);
  useLayoutEffect(() => {
    getRef.current = getScrollProgress;
  });

  useEffect(() => {
    let frame = 0;
    // Scroll can fire many times per frame. Read layout and set state at most
    // once per frame, right before the browser paints.
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setProgress(Math.round(getRef.current() * 100));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header role="banner" style={{ position: 'sticky', top: 0, background: 'inherit', padding: 4 }}>
      Progress: {progress}%
    </header>
  );
}
