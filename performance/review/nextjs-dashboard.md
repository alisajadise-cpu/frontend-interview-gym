# Review · Next.js dashboard page

**Difficulty:** Hard · **Time:** 15–20 min · **Format:** reading-only code review (no tests)

You join a team, and this page has the worst Lighthouse score in the app: **LCP 4.8 s, CLS 0.31, 1.2 MB of JavaScript**. Review it like a senior engineer. Find **at least 10 issues**, rank them by impact on Core Web Vitals, and say how you'd measure each one.

```tsx
// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import moment from 'moment';
import _ from 'lodash';
import { Chart } from 'heavy-chart-lib';
import { Inter } from '@/styles/fonts'; // a CSS @font-face pointing at /fonts/inter.woff2
import catalog from '@/data/catalog.json'; // 2.4 MB of products

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <Spinner />;

  return (
    <div className={Inter.className}>
      <img src={data.heroUrl} />
      <h1>{_.capitalize(data.title)}</h1>
      <p>Updated {moment(data.updatedAt).fromNow()}</p>
      <ProductPicker products={catalog} />
      <section style={{ marginTop: 1200 }}>
        <Chart points={data.points} />
      </section>
    </div>
  );
}
```

Try it yourself before opening the answers.

<details>
<summary><strong>Answers</strong></summary>

| # | Issue | Impact | How to measure |
|---|---|---|---|
| 1 | `'use client'` on the **whole page** | Every import ships to the browser and hydrates. Nothing renders on the server except the spinner | Bundle analyzer (`@next/bundle-analyzer`). View source: the HTML has no content. |
| 2 | Data fetched in `useEffect` on the client | Waterfall: HTML → JS download → hydrate → *then* fetch → render. LCP waits for all of it | Lighthouse LCP breakdown. Performance panel: the fetch starts after hydration. |
| 3 | `import catalog from '…/catalog.json'` (2.4 MB) in a client component | 2.4 MB parsed on the main thread and also serialized into the RSC payload. Huge TBT/INP | Bundle analyzer. Coverage tab. |
| 4 | `<img>` with no `width`/`height` | **CLS**: content jumps when the image loads. No lazy loading, no responsive sizes, no modern formats | Lighthouse CLS + "Image elements do not have explicit width and height". Performance panel → Layout Shift track. |
| 5 | The hero image (likely the LCP element) has no priority hint | The browser discovers it late (only after the client fetch!) | LCP element in the Performance panel. "LCP request discovery" insight. |
| 6 | `moment` (~70 KB min+gz with locales) | Bundle size for one `fromNow()` | Bundle analyzer. |
| 7 | `import _ from 'lodash'` (the whole library, CJS, not tree-shakable) | ~70 KB for one `capitalize` | Bundle analyzer. |
| 8 | `heavy-chart-lib` imported eagerly for a chart **below the fold** | Blocks the initial bundle for something the user may never scroll to | Coverage tab: unused bytes on first load. |
| 9 | Self-hosted font via plain `@font-face` with no `font-display` / preload / size-adjust | FOIT/FOUT and layout shift when the font swaps | Lighthouse "Ensure text remains visible during webfont load". CLS from font swap. |
| 10 | `any` for the API data, no error state | A failed fetch = an infinite spinner | Code review. Throttle/offline in DevTools. |
| 11 | Full-page spinner instead of streaming | The user sees nothing useful until everything is ready | Filmstrip. |

**The fixed shape**

```tsx
// app/dashboard/page.tsx — a Server Component (no 'use client')
import Image from 'next/image';
import { Suspense } from 'react';
import { formatDistanceToNow } from 'date-fns'; // or Intl.RelativeTimeFormat
import capitalize from 'lodash/capitalize';   // or a 1-line helper
import { getDashboard } from '@/lib/api';
import ProductPicker from './ProductPicker';   // 'use client', fetches/searches on demand
import LazyChart from './LazyChart';           // 'use client', next/dynamic + IntersectionObserver

export default async function Dashboard() {
  const data = await getDashboard(); // on the server, close to the DB
  return (
    <div>
      <Image src={data.heroUrl} alt={data.heroAlt} width={1200} height={600} priority sizes="100vw" />
      <h1>{capitalize(data.title)}</h1>
      <p>Updated {formatDistanceToNow(new Date(data.updatedAt))} ago</p>
      <ProductPicker />                     {/* searches the catalog via an API, never ships 2.4 MB */}
      <Suspense fallback={<ChartSkeleton height={400} />}>
        <LazyChart points={data.points} /> {/* dynamic(() => import('heavy-chart-lib'), { ssr: false }) */}
      </Suspense>
    </div>
  );
}
// app/layout.tsx: const inter = Inter({ subsets: ['latin'], display: 'swap' }) from 'next/font/google'
```

**Senior talking points**

- **The client boundary:** push `'use client'` down to the *leaves* that need interactivity. Everything above stays on the server and ships 0 KB of JS.
- **Props crossing the boundary are serialized.** Passing a 2.4 MB array to a client component puts it in the HTML/RSC payload. Pass ids or fetch on demand.
- **`next/font`** self-hosts, preloads, and adds `size-adjust` fallback metrics, so the font swap causes no layout shift.
- **`next/image`** gives width/height (no CLS), `srcset`, AVIF/WebP, lazy loading by default, and `priority` for the LCP image.
- **Measure in the field:** `useReportWebVitals` in Next.js, or the `web-vitals` library → analytics. Lab scores (Lighthouse) and field data (CrUX) often disagree.

</details>
