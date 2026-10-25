import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const ANSWERS = [
  'Debounce waits until the calls stop, then runs once. Throttle runs at most once per interval while calls keep coming. For a search box use debounce; for a scroll handler use throttle or requestAnimationFrame.',
  'A stale closure happens when a callback captured an old value from a previous render. Fix it with the correct dependency list, a functional state update, or a ref that always holds the latest value.',
  'Stream tokens into a buffer, flush once per frame, and render the text as plain text. Abort the old stream when the user sends a new message, and ignore tokens that arrive late.',
];

async function* fakeStream(history: Mod.HistoryMessage[], signal: AbortSignal): AsyncGenerator<string> {
  const last = history[history.length - 1]?.content.toLowerCase() ?? '';
  const words = ANSWERS[history.length % ANSWERS.length].split(/(\s+)/);
  for (let i = 0; i < words.length; i++) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 15 + Math.random() * 60);
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
    if (last.includes('error') && i === 8) throw new Error('Upstream 500');
    yield words[i];
  }
}

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  return (
    <div>
      <p style={{ color: 'gray', fontSize: 13, marginTop: 0 }}>
        Fake model. Include the word "error" in a message to make the stream fail halfway. Try sending while it streams.
      </p>
      <impl.Chat streamReply={fakeStream} />
    </div>
  );
}
