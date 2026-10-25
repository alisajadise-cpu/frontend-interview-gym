# Review · Six quick code-review snippets

**Format:** reading-only. Set a timer for **10–15 minutes per snippet**. Write down every issue with its fix, *then* open the answers.

For each issue, a senior answer says:
1. **What** is wrong
2. **Why** it hurts: re-renders, network, memory, bundle size, layout, or correctness
3. **How** to fix it
4. **How to measure it:** React Profiler, Performance panel, Network panel, Memory panel, Lighthouse, or a bundle analyzer

The measurement part is what separates senior answers from mid-level ones.

---

## 1. Product list (5 issues)

```jsx
function ProductList({ products, onSelect }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('price');

  const visible = products
    .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a[sortBy] - b[sortBy]);

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {visible.map((p, i) => (
        <ProductCard
          key={i}
          product={p}
          style={{ margin: 8 }}
          onClick={() => onSelect(p.id)}
        />
      ))}
    </div>
  );
}

const ProductCard = React.memo(function ProductCard({ product, style, onClick }) {
  return <div style={style} onClick={onClick}>{product.name}</div>;
});
```

<details>
<summary><strong>Answers</strong></summary>

1. **`key={i}`:** after filtering or sorting, React matches cards by position, so any card state or DOM (focus, inputs, animations) moves to the wrong product. Use `key={p.id}`.
2. **`memo` is defeated:** `style={{ margin: 8 }}` and `onClick={() => …}` are new on every render, so every card re-renders. Hoist the style (or use a class), pass `onSelect` + `id` (or `useCallback`). Prove it with the Profiler: "props changed: style, onClick".
3. **Filter + sort on every render:** wrap in `useMemo([products, query, sortBy])`. Also hoist `query.toLowerCase()` out of the loop (one allocation instead of N).
4. **Sort after filter** is right (sorting fewer items), but `.sort` here is on the *new* array from `filter`, so it's safe. Say this: interviewers check whether you know `sort` mutates. If the filter were removed, `products.sort` would mutate props.
5. **No deferral or virtualization:** for large lists, use `useDeferredValue(query)` to keep typing responsive, and virtualize the list.
6. (Bonus) `a[sortBy] - b[sortBy]` breaks for string fields like `name`. Use `localeCompare` or `Intl.Collator`.

</details>

---

## 2. Search with API (4 issues)

```jsx
function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({ category: 'all' });

  useEffect(() => {
    fetch(`/api/search?q=${query}&cat=${filters.category}`)
      .then(r => r.json())
      .then(data => setResults(data));
  }, [query, JSON.stringify(filters)]);

  return (
    <>
      <input onChange={e => setQuery(e.target.value)} />
      <Results items={results} />
    </>
  );
}
```

<details>
<summary><strong>Answers</strong></summary>

1. **Race condition:** responses can arrive out of order, so results for `"re"` can overwrite results for `"react"`. Fix: an `AbortController` in the effect cleanup, or an `ignore` flag.
2. **No debounce:** one request per keystroke. Debounce the query (300 ms) or use `useDeferredValue` + a cache.
3. **No URL encoding:** `q=${query}` breaks on `&`, `#`, spaces and non-ASCII text (Persian/Arabic). Use `URLSearchParams` or `encodeURIComponent`. (`&cat=x` in the query is also a parameter-injection bug.)
4. **`JSON.stringify(filters)` in the deps:** it works, but it's a smell that hides an unstable object. Depend on `filters.category` (a primitive).
5. (Bonus) No `r.ok` check, no loading or error state, and an empty query still fetches. Uncontrolled `<input>` while the state exists: make it controlled or drop the state.

</details>

---

## 3. App-wide context (3 issues)

```jsx
const AppContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <AppContext.Provider value={{ user, setUser, theme, setTheme, now }}>
      {children}
    </AppContext.Provider>
  );
}

// Used in ~200 components, most only need `theme`
function Button(props) {
  const { theme } = useContext(AppContext);
  return <button className={theme} {...props} />;
}
```

<details>
<summary><strong>Answers</strong></summary>

1. **High-frequency value in a shared context:** `now` changes every second → all ~200 consumers re-render every second, even though they only read `theme`. Destructuring doesn't help: React has no context selectors.
2. **A new `value` object every render:** any provider render re-renders every consumer. Use `useMemo` for the value.
3. **One context for unrelated concerns:** split into `ThemeContext`, `UserContext`, and a clock (local state in the `<Clock>` component, or an external store with `useSyncExternalStore`).

Hands-on version with tests: [`performance/03-context-rerenders`](../03-context-rerenders/README.md).

</details>

---

## 4. Big table (5 issues)

```jsx
function OrdersTable({ orders }) {   // orders.length ≈ 10,000
  const [selected, setSelected] = useState([]);

  const total = orders.reduce((sum, o) => sum + expensiveTax(o), 0);

  return (
    <table>
      <tbody>
        {orders.map(o => (
          <Row
            key={o.id}
            order={o}
            isSelected={selected.includes(o.id)}
            onToggle={() =>
              setSelected(s => s.includes(o.id) ? s.filter(x => x !== o.id) : [...s, o.id])
            }
          />
        ))}
      </tbody>
      <tfoot><tr><td>{total}</td></tr></tfoot>
    </table>
  );
}

function Row({ order, isSelected, onToggle }) {
  useEffect(() => {
    const onResize = () => console.log(window.innerWidth);
    window.addEventListener('resize', onResize);
  }, []);
  return <tr onClick={onToggle}><td>{order.id}</td><td>{isSelected ? '✓' : ''}</td></tr>;
}
```

<details>
<summary><strong>Answers</strong></summary>

1. **O(n²):** `selected.includes` inside `orders.map`. Use a `Set`.
2. **`total` is recomputed on every selection change:** 10,000 × `expensiveTax` per click. `useMemo([orders])`.
3. **A new `onToggle` closure per row + `Row` isn't memoized:** every click re-renders 10,000 rows. `memo(Row)` + one stable `useCallback((id) => …)`.
4. **Listener leak:** 10,000 `resize` listeners with no cleanup, and more piling up on every mount. One listener at the table level (or `matchMedia`/CSS), always with cleanup.
5. **No virtualization** for 10,000 rows.
6. (Bonus) A clickable `<tr>` is not keyboard-accessible. Use a real checkbox with a label.

Hands-on version with tests: [`performance/04-orders-table`](../04-orders-table/README.md).

</details>

---

## 5. Vanilla JS and the DOM (4 issues)

```js
const items = document.querySelectorAll('.card');

window.addEventListener('scroll', () => {
  items.forEach(el => {
    const h = el.offsetHeight;
    el.style.height = (h + 1) + 'px';
  });
  document.getElementById('progress').style.width =
    (window.scrollY / document.body.scrollHeight) * 100 + '%';
});

function dedupe(users) {
  const result = [];
  for (const u of users) {
    if (!result.find(r => r.id === u.id)) result.push(u);
  }
  return result;
}
```

<details>
<summary><strong>Answers</strong></summary>

1. **Layout thrashing:** read (`offsetHeight`) → write (`style.height`) → read… inside the loop forces one synchronous layout per card. Batch all reads, then all writes.
2. **Heavy work on every scroll event:** scroll can fire many times per frame. Throttle with `requestAnimationFrame`. For the progress bar, use the CSS `animation-timeline: scroll()`, which needs no JS at all.
3. **Reading `document.body.scrollHeight` on every scroll** is another forced layout after the writes above.
4. **`dedupe` is O(n²)** (`find` inside the loop). Use a `Set` of seen ids or a `Map` keyed by id: O(n).
5. (Bonus) `getElementById` on every event: cache the element. `querySelectorAll` runs once, so cards added later are never handled.

Hands-on version with tests: [`performance/05-layout-thrashing`](../05-layout-thrashing/README.md).

</details>

---

## 6. Senior-level: Next.js page (4 issues)

```jsx
'use client';
import moment from 'moment';
import _ from 'lodash';
import { Chart } from 'heavy-chart-lib';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <Spinner />;

  return (
    <div>
      <h1>{moment(data.date).format('LL')}</h1>
      <img src={data.hero} />
      <p>{_.capitalize(data.title)}</p>
      <Chart points={data.points} />   {/* below the fold */}
    </div>
  );
}
```

<details>
<summary><strong>Answers</strong></summary>

1. **Whole page is a client component + client-side fetch:** a waterfall (HTML → JS → hydrate → fetch → render) and no server-rendered content. Make it an async Server Component that fetches on the server; keep `'use client'` for interactive leaves only.
2. **Bundle size:** `moment` and the whole `lodash` for one helper each. Use `Intl.DateTimeFormat` / `date-fns` and `lodash/capitalize` or a one-line helper.
3. **`<img>` without dimensions or priority:** CLS, and a late LCP. Use `next/image` with `width`/`height`, `priority` and `sizes`.
4. **The heavy chart below the fold is loaded eagerly:** `next/dynamic(() => import(...), { ssr: false })` + load it when it becomes visible (IntersectionObserver), with a fixed-height skeleton to avoid CLS.

Longer version: [`nextjs-dashboard.md`](./nextjs-dashboard.md).

</details>
