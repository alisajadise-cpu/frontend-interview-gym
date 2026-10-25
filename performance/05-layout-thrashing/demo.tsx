import { useMemo, useState } from 'react';
import { getDomLog, resetDomLog } from './dom';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const WORDS = 'layout paint composite reflow style frame budget pixel scroll observer batch read write'.split(' ');

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [seed, setSeed] = useState(1);
  const [highlighted, setHighlighted] = useState<string | undefined>();
  const [log, setLog] = useState('');
  const cards = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: `c${i}`,
        title: `Card ${i + 1}`,
        body: Array.from({ length: 4 + ((i * 7 + seed * 13) % 30) }, (_, j) => WORDS[(i + j + seed) % WORDS.length]).join(' '),
      })),
    [seed],
  );
  const showLog = () => {
    const l = getDomLog();
    setLog(`${l.length} ops: ${l.slice(0, 24).map((x) => (x === 'read' ? 'R' : 'W')).join('')}${l.length > 24 ? '…' : ''}`);
    resetDomLog();
  };
  return (
    <div>
      <impl.ScrollProgressHeader />
      <p style={{ fontSize: 13 }}>
        <button onClick={() => setSeed((s) => s + 1)}>New content</button>{' '}
        <button onClick={() => setHighlighted(`c${Math.floor(Math.random() * 60)}`)}>Highlight random card</button>{' '}
        <button onClick={showLog}>Show read/write log</button> {log}
      </p>
      <p style={{ fontSize: 13, color: 'gray' }}>
        Record in the Performance panel while clicking "New content": look for purple Layout blocks marked "Forced reflow".
        Scroll the page to see the header.
      </p>
      <impl.EqualHeightGrid cards={cards} columns={3} highlightedId={highlighted} />
    </div>
  );
}
