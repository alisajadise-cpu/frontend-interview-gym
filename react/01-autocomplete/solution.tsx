import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export type AutocompleteProps = {
  label: string;
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<string[]>;
  onSelect: (value: string) => void;
  debounceMs?: number;
  minChars?: number;
};

type Status = 'idle' | 'loading' | 'success' | 'error';

export function Autocomplete({ label, fetchSuggestions, onSelect, debounceMs = 300, minChars = 1 }: AutocompleteProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (i: number) => `${id}-option-${i}`;

  // `input` is what the user sees. `query` is the debounced value we search for.
  // Keeping them separate means selecting an option never triggers a new search.
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const cache = useRef(new Map<string, string[]>());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Always call the latest fetcher without re-running effects when the parent
  // passes a new inline function on every render.
  const fetchRef = useRef(fetchSuggestions);
  useLayoutEffect(() => {
    fetchRef.current = fetchSuggestions;
  });

  // Clear the pending debounce on unmount.
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // Fetch whenever the debounced query changes.
  useEffect(() => {
    if (!query) return;
    const cached = cache.current.get(query);
    if (cached) {
      setResults(cached);
      setStatus('success');
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    fetchRef.current(query, controller.signal).then(
      (items) => {
        cache.current.set(query, items);
        if (controller.signal.aborted) return; // stale: a newer query owns the UI
        setResults(items);
        setStatus('success');
        setActive(-1);
      },
      () => {
        if (controller.signal.aborted) return;
        setStatus('error');
      },
    );
    // Runs when `query` changes or on unmount: cancels the in-flight request.
    return () => controller.abort();
  }, [query]);

  function handleChange(value: string) {
    setInput(value);
    setActive(-1);
    clearTimeout(debounceTimer.current);

    const q = value.trim();
    if (q.length < minChars) {
      setQuery('');
      setOpen(false);
      return;
    }
    setOpen(true);
    if (cache.current.has(q)) {
      setQuery(q); // cached: no debounce, no request
      return;
    }
    debounceTimer.current = setTimeout(() => setQuery(q), debounceMs);
  }

  function select(value: string) {
    clearTimeout(debounceTimer.current);
    setInput(value);
    setOpen(false);
    setActive(-1);
    onSelect(value);
  }

  const showList = open && query !== '' && status !== 'idle';
  const options = status === 'success' ? results : [];

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = options.length;
    switch (e.key) {
      case 'ArrowDown':
        if (!n) return;
        e.preventDefault();
        setOpen(true);
        setActive((i) => (i + 1) % n);
        break;
      case 'ArrowUp':
        if (!n) return;
        e.preventDefault();
        setOpen(true);
        setActive((i) => (i <= 0 ? n - 1 : i - 1));
        break;
      case 'Enter':
        if (showList && active >= 0 && active < n) {
          e.preventDefault();
          select(options[active]);
        }
        break;
      case 'Escape':
        if (showList) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
    }
  }

  return (
    <div className="autocomplete">
      <label htmlFor={`${id}-input`}>{label}</label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
      />
      <div role="status" aria-live="polite">
        {showList && status === 'loading' ? 'Loading…' : null}
        {showList && status === 'error' ? 'Something went wrong' : null}
        {showList && status === 'success' && options.length === 0 ? 'No results' : null}
      </div>
      {showList && options.length > 0 ? (
        <ul id={listboxId} role="listbox" aria-label={label}>
          {options.map((item, i) => (
            <li
              key={item}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(item)}
              onMouseEnter={() => setActive(i)}
              style={i === active ? { background: 'rgba(59,91,219,0.15)' } : undefined}
            >
              <Highlight text={item} query={query} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}
