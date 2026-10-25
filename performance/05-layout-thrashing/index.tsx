import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { probe } from '../../shared/probe';
import { measure, mutate } from './dom';

export type Card = { id: string; title: string; body: string };

/** Scroll progress of the page, 0..1. Reads layout (scrollHeight). */
export function defaultScrollProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? window.scrollY / max : 0;
}

// ⚠️ Production code with layout performance problems. Review it, then fix it.

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
    cards.forEach((_, i) => {
      const rowStart = i - (i % columns);
      const rowEnd = Math.min(rowStart + columns, cards.length);
      let max = 0;
      for (let j = rowStart; j < rowEnd; j++) {
        max = Math.max(max, measure(contentRefs.current[j]!));
      }
      mutate(cardRefs.current[i]!, max);
    });
  });

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
}

export function ScrollProgressHeader({
  getScrollProgress = defaultScrollProgress,
}: {
  getScrollProgress?: () => number;
}) {
  probe('ScrollProgressHeader');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    window.addEventListener('scroll', () => {
      setProgress(Math.round(getScrollProgress() * 100));
    });
  }, []);

  return (
    <header role="banner" style={{ position: 'sticky', top: 0, background: 'inherit', padding: 4 }}>
      Progress: {progress}%
    </header>
  );
}
