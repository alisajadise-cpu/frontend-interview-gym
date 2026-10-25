# 04 · E-commerce PLP + PDP — Solution

PLP = Product Listing Page (search, category, filters). PDP = Product Detail Page.

## 1. Requirements

### Functional
**PLP**
1. Browse a category or search results as a grid of product cards (image, title, artist, price, badge).
2. Filter by facets (price range, artist, size, color, in stock) with counts. Sort (relevance, price, newest).
3. Paginate (or "Load more").
4. Shareable: the URL fully describes the current view.

**PDP**
5. Image gallery with zoom. Variant selection (size, frame). Price and stock per variant.
6. Description, specs, artist info, reviews summary, recommendations.
7. Add to cart. Mini cart updates.

**Cart (shared)**
8. Guest cart and user cart, merged on login. Visible count in the header.

**Out of scope:** checkout, payments, seller tools.

### Non-functional
- **SEO first:** crawlable HTML with content, structured data, canonical URLs, fast pages (vitals are a ranking signal).
- **Core Web Vitals** at the 75th percentile on mobile: LCP < 2.5 s, INP < 200 ms, CLS < 0.1.
- **Freshness:** listing data can be a few minutes old. Price/stock must be verified at add-to-cart.
- **Scale:** millions of pages, traffic spikes (sales campaigns, holidays). CDN must take most of the load.
- **i18n:** currencies, locales, RTL.
- **Accessibility:** WCAG 2.1 AA.

---

## 2. Architecture

```
  Browser ──────────────► CDN / Edge (HTML cache by URL+locale, images, static JS/CSS)
     │  ▲                    │ miss / revalidate
     │  │                    ▼
     │  │          ┌──────────────────────────┐
     │  │          │ Web server (Next.js-like)│  SSR / ISR / RSC streaming
     │  │          │  BFF: aggregates APIs    │
     │  │          └──┬────────┬────────┬─────┘
     │  │             │        │        │
     │  │      Catalog/Search  Pricing/  Reviews · Recos
     │  │      service         Inventory
     │  │
     │  └─ HTML (streamed) + small JS for interactive islands
     │
     └──► Client-side APIs (after load): cart, price/stock check, personalization, analytics
```

### Rendering strategy (the key decision)

| Page / part | Strategy | Why |
|---|---|---|
| Category PLP (`/c/prints?color=blue`) | **SSR at the edge with CDN cache** (`s-maxage=300, stale-while-revalidate=600`), or ISR for the top categories | Many filter combinations, so pre-building all is impossible. Short cache is fine for listings. |
| Search PLP (`/search?q=...`) | **SSR**, short CDN cache for popular queries, `noindex` for most search pages | Infinite query space. Don't let Google index millions of thin search pages. |
| PDP (`/p/starry-night-print-123`) | **ISR / static with on-demand revalidation** | 2M pages: build on first request, cache at the CDN, revalidate when the product changes (webhook from the catalog → purge/revalidate). |
| Price + stock on PDP | Rendered into HTML from the cached version **and** re-checked on the client after load (and always at add-to-cart) | Keep HTML cacheable while protecting correctness. |
| Personal parts (cart count, "recently viewed", recommendations for you) | **Client-side** after load, or a streamed Suspense boundary not cached | Never put personal data in a shared CDN cache. |
| Reviews, recommendations | **Streamed** (Suspense) or lazy-loaded when scrolled near | Not needed for LCP. Keep the first HTML small. |

With **React Server Components**, the product grid, description and specs are server components (zero client JS). Only the filter panel, gallery, variant picker, and add-to-cart button are client components ("islands").

### Component tree (PDP)

```
<ProductPage>                      (server)
├── <Breadcrumbs/>                 (server, structured data)
├── <Gallery/>                     (client: swipe, zoom)   ← LCP image is the first slide
├── <ProductInfo>                  (server: title, artist, rating summary)
│   ├── <PriceAndStock/>           (client: revalidates price/stock)
│   ├── <VariantPicker/>           (client)
│   └── <AddToCartButton/>         (client)
├── <Description/> <Specs/>        (server)
├── <Suspense><Reviews/></Suspense>          (streamed)
└── <LazyOnVisible><Recommendations/></LazyOnVisible>  (client, below the fold)
```

---

## 3. Data model

```ts
interface Money {
  amount: number;          // in minor units (cents, rials) — never floats for money
  currency: 'USD' | 'EUR' | 'IRR';
}

interface ProductCard {    // PLP: small payload
  id: string;
  slug: string;
  title: string;
  artistName: string;
  image: ImageRef;
  price: Money;
  compareAtPrice?: Money;  // for "on sale"
  badges: Array<'new' | 'sale' | 'limited'>;
  inStock: boolean;
}

interface ImageRef {
  src: string;             // CDN path; sizes requested with params
  width: number;
  height: number;          // aspect ratio → no CLS
  alt: string;
  placeholder?: string;    // tiny blurred base64 or dominant color
}

interface Product {        // PDP
  id: string;
  slug: string;
  title: string;
  description: string;     // sanitized HTML/markdown from CMS
  artist: { id: string; name: string; slug: string };
  images: ImageRef[];
  options: Array<{ name: 'size' | 'frame'; values: string[] }>;
  variants: Variant[];
  ratings: { average: number; count: number };
  breadcrumbs: Array<{ name: string; url: string }>;
  updatedAt: string;
}

interface Variant {
  id: string;
  sku: string;
  options: Record<string, string>;   // { size: '50x70', frame: 'black' }
  price: Money;
  stock: 'in_stock' | 'low' | 'out_of_stock';
}

interface ListingQuery {   // = URL state
  category?: string;
  q?: string;
  filters: Record<string, string[]>;   // { color: ['blue'], artist: ['monet'] }
  price?: { min?: number; max?: number };
  sort: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  page: number;
}

interface ListingResult {
  items: ProductCard[];
  total: number;
  facets: Array<{ key: string; label: string; type: 'checkbox' | 'range';
                  values: Array<{ value: string; label: string; count: number }> }>;
  page: number;
  pageSize: number;
}

interface Cart {
  id: string;
  lines: Array<{ lineId: string; variantId: string; quantity: number; unitPrice: Money; title: string; image: ImageRef }>;
  subtotal: Money;
  version: number;          // optimistic concurrency between tabs/devices
}
```

**State locations:**
- Listing query → **URL** (the single source of truth).
- Listing results / product → server-rendered, then client cache (React Query) for client-side navigation.
- Cart → server (cart id in an `HttpOnly` cookie for guests), mirrored in a client store for the header.
- UI state (gallery index, filter drawer open) → local.

---

## 4. Interface (API)

```
GET /api/listing?category=prints&color=blue&color=green&price_min=50&sort=price_asc&page=2
→ ListingResult
Cache-Control: public, s-maxage=300, stale-while-revalidate=600

GET /api/products/:slug            → Product        (CDN cached, purged on change)
GET /api/products/:id/availability?variantIds=v1,v2
→ { "v1": { "price": Money, "stock": "low" } }      Cache-Control: no-store (or max-age=30)

GET  /api/cart                      → Cart
POST /api/cart/lines                { variantId, quantity }    Idempotency-Key: ...
→ 200 Cart | 409 { error: "out_of_stock" | "price_changed", cart: Cart }
PATCH  /api/cart/lines/:lineId      { quantity }
DELETE /api/cart/lines/:lineId
POST /api/cart/merge                (after login: guest cart + user cart)
```

**Pagination on the PLP:** **page numbers (offset)** here, unlike a feed. Reasons: users want to jump around and share "page 3", search engines need crawlable `<a href="?page=3">` links, and the data isn't a live stream. Offset has a cost in deep pages, so cap at e.g. page 100 ("refine your filters").

You can still offer "Load more" for UX, but each loaded page should update the URL (`?page=3`) and real links must exist in the HTML for crawlers.

---

## 5. Optimizations

### 5.1 URL as state (filters and sort)

- Every filter change updates the URL with `history.replaceState`/`pushState` (router). Back/forward works. Links are shareable.
- **Canonical form:** sort parameter keys and values (`color=blue&color=green` always in the same order), drop defaults. Otherwise the same page has many URLs and the CDN cache hit rate falls.
- **SEO rules:**
  - Index category pages and a **small allow-list** of valuable filter combinations ("blue prints"). These get clean paths (`/c/prints/blue`).
  - Other filter combinations: `<link rel="canonical">` to the base category and/or `noindex`. Prevents "crawl traps" with millions of combinations.
  - Sort and page parameters don't create new indexable pages (page 2+ can be indexable with a self canonical; don't canonical every page to page 1).
- **Filter UX:** on desktop, apply immediately (with debounce for price sliders). On mobile, a drawer with "Show 243 results", applied at once.
- While new results load: keep old results visible but dimmed (`useTransition`), don't show a blank grid. Abort the previous request when filters change quickly.

### 5.2 Core Web Vitals

**LCP (usually the hero/first product image):**
- The LCP image is in the **server HTML** (not inserted by JS), with `fetchpriority="high"`, **not** lazy-loaded, correct `srcset`/`sizes`.
- `<link rel="preconnect">` to the image CDN. Early hints (103) where supported.
- Small critical CSS inline. Fonts: `font-display: swap`, preload one font file, subset Persian/Latin.
- Fast TTFB from CDN-cached HTML (ISR/edge cache). Streaming so the head and above-the-fold arrive first.

**CLS:**
- Every image has `width`/`height` or `aspect-ratio`. Product cards have a fixed image ratio.
- Promo banners and "free shipping" bars reserve space, or are rendered on the server.
- Prices that update on the client keep the same box size (no "loading" text that's shorter).
- Fonts: fallback font with matching metrics (`size-adjust`) to avoid reflow when the web font loads.

**INP:**
- Filter clicks: update the checkbox state immediately, and move the heavy grid update into a transition.
- Big hydration costs hurt INP on mobile: ship less JS (server components), hydrate below-the-fold islands lazily.
- Third-party scripts (analytics, chat widgets, A/B tools) are often the biggest INP and TBT cost. Load them after interaction or idle, or move them off the main thread (Partytown-style), and audit them regularly.

### 5.3 Images (critical for an art store)

- An **image CDN** that resizes, crops, and converts on the fly: `https://img.cdn/…/starry.jpg?w=640&fmt=auto`. `fmt=auto` → AVIF/WebP based on `Accept` header.
- `srcset` with 4–6 widths, and an accurate `sizes` (e.g. `(min-width: 1024px) 25vw, 50vw` for a 4/2 column grid). A wrong `sizes` makes phones download desktop images.
- PLP thumbnails: small, lazy below the fold. Only the first row is eager.
- PDP gallery: first image eager and high priority. Others lazy. Zoom loads a high-resolution version **on demand** (or tiles for very large art, like a map viewer).
- Placeholders: dominant color or tiny blur, to look fast.
- **Color accuracy matters for art:** keep the color profile (convert to sRGB on the server, keep wide-gamut P3 for supporting displays via `<picture>` if needed).

### 5.4 Caching layers and freshness

| Layer | What | TTL / invalidation |
|---|---|---|
| CDN HTML | PLP, PDP pages per URL + locale + currency | PLP 5 min SWR. PDP until purge (catalog webhook → revalidate the path) |
| CDN images | All product images | 1 year, immutable (versioned URLs) |
| Static JS/CSS | Hashed filenames | 1 year, immutable |
| Client cache | Listing/product JSON for client navigation | stale-while-revalidate, staleTime ~1 min |
| Availability API | Price/stock | no-store or a few seconds |

- **Vary carefully:** HTML varies by locale and currency, so put them in the **URL path** (`/fa/…`, `/en-us/…`) instead of cookies. This keeps the CDN key simple. Never vary on the session cookie for cached pages.
- **Correctness:** the server checks price and stock again in `POST /cart/lines`. If the price changed, return `409 price_changed` with the new cart and show a clear message. The cached page may be stale; the cart may not be wrong.

### 5.5 Client-side navigation and prefetching

- Router prefetches PDP data/HTML when a product card **enters the viewport or is hovered** (only on fast connections, respect `saveData`).
- PLP → PDP: show the card's image immediately as a placeholder for the PDP gallery (we already have it), so the transition feels instant.
- Back from PDP to PLP: restore the scroll position and results from cache (no new request, no spinner).

### 5.6 Cart

- "Add to cart": **optimistic** update of the header count + mini-cart, request with an idempotency key, disable double submit briefly.
- On `409` (out of stock / price changed): roll back, explain, and offer alternatives.
- **Guest cart:** cart id in an `HttpOnly` cookie, stored on the server (not only in `localStorage`, so it survives devices only after login, but at least survives the session and is trustworthy).
- **Login merge:** `POST /cart/merge`. Rules: sum quantities for the same variant, cap by stock, keep the newest price.
- **Multiple tabs:** `BroadcastChannel` or `storage` event to sync the cart count. `version` field to detect conflicting edits.
- The cart icon count is personal, so it's loaded client-side (or from a non-cached edge function). It's never in the cached HTML.

### 5.7 SEO details

- Semantic HTML: `<h1>` product title, real `<a href>` links for products, categories and pagination.
- **Structured data (JSON-LD):** `Product` with `offers` (price, currency, availability), `AggregateRating`, `BreadcrumbList`. Keep it consistent with the visible price.
- Meta title and description per page, Open Graph/Twitter images for sharing.
- `hreflang` links between locales. XML sitemaps for products and categories (split into files of up to 50,000 URLs).
- Out-of-stock products: keep the page (it has ranking), show alternatives. Removed products: `404`/`410`, or a `301` to a close replacement.

### 5.8 Accessibility

- Filter panel: real checkboxes inside `<fieldset>` with `<legend>`. Price range: two labelled number inputs, plus a slider (a slider alone is hard to use).
- After applying filters, announce "243 results" via `aria-live`. Move focus sensibly on mobile drawer close.
- Product cards: one link per card (the title), not nested links. The whole card can be clickable with a CSS stretched link.
- Gallery: buttons with labels ("Next image"), keyboard support, alt text for every image (artwork description, not "image1.jpg").
- Variant picker: radio group semantics. Out-of-stock variants are disabled with an explanation, not just greyed out.
- Prices: screen readers should hear "Was 120 dollars, now 90 dollars", not "~~120~~ 90".

### 5.9 i18n, RTL and money

- Locale in the URL path. `<html lang="fa" dir="rtl">`.
- Logical CSS properties. The gallery swipe direction and arrow icons flip in RTL.
- Money: store as integer minor units. Format with `Intl.NumberFormat(locale, { style: 'currency', currency })`. IRR/Toman display is a business decision (many Iranian shops show Toman, which is not an ISO currency, so format it yourself with a label).
- Persian digits via the `fa-IR` locale. Search should accept both Persian and Latin digits in queries.

### 5.10 Security

- Product descriptions from a CMS/sellers: sanitize HTML on the server (allow-list), CSP on the client.
- Never trust client prices: the server calculates everything at add-to-cart and checkout.
- CSRF protection on cart mutations (SameSite cookies + token).
- Rate limit search and availability endpoints (scraping bots).

### 5.11 Observability and experiments

- RUM per **page type** (PLP vs PDP) and device: LCP element, INP, CLS sources.
- Business metrics: PLP → PDP click-through, add-to-cart rate, filter usage, zero-result searches.
- A/B testing via **server-side** flags (no flicker, cache key includes the variant bucket only for tested pages).
- Performance budgets in CI: JS per route (e.g. < 150 KB gzipped), Lighthouse CI on key templates.

---

## 6. Trade-offs

| Topic | Options | Choice |
|---|---|---|
| PDP rendering | SSR every request / SSG all / ISR | **ISR + on-demand revalidation**: CDN speed, fresh enough, no 2M-page builds. |
| PLP rendering | CSR / SSR | **SSR + short CDN cache**: SEO and fast first paint. |
| Price freshness | Always SSR fresh / cached + client check | **Cached HTML + client revalidation + server check at cart**. |
| Pagination | Infinite scroll / pages | **Pages with real links** (SEO, sharing), "Load more" as UX on top. |
| Filters | Local state / URL | **URL**: shareable, back button, SSR. Need canonicalization. |
| Interactivity | Full SPA hydration / islands (RSC) | **Islands**: much less JS on mobile. Requires a modern framework. |
| Personalization | In HTML / client-side | **Client-side or uncached stream**, so HTML stays cacheable. |

---

## 7. Follow-up questions

**"A big sale starts at 9:00. Prices must change at exactly 9:00 for everyone."**
Prices in cached HTML are a problem. Options: schedule revalidation/purge for 9:00 for affected pages, make the client price component always fetch availability (short TTL), and the server enforces the price at the cart. Pre-warm the CDN right after the purge.

**"How do you handle 1,000 filter values (e.g. artists)?"**
Show the top 10 by count, plus "Show more" with a search box inside the facet. Load the full list on demand.

**"LCP is 4 s on mobile. How do you debug it?"**
Check field data (CrUX/RUM) to see which element is LCP, then a lab trace: is it TTFB (CDN miss, slow server), resource load delay (image discovered late, e.g. lazy or CSS background), resource load time (too large, wrong `sizes`), or render delay (blocked by JS/fonts)? Fix the biggest part.

**"How would you build 'recently viewed'?"**
Store product ids in `localStorage` (no personal data in cached HTML). Render client-side from the cached product cards API. Sync to the server for logged-in users so it works across devices.

**"Should the PLP be a SPA after the first load?"**
Yes, client-side navigation between filters/pages is faster (only JSON). But every state must also be server-renderable from its URL, so refresh and crawlers get the same page.

---

## 8. What separates a senior answer from a mid-level one

- **Mid-level:** "Use Next.js SSR, lazy-load images, put the cart in Redux."
- **Senior:**
  - Chooses the rendering strategy **per page and per part of a page**, tied to SEO, freshness and cost.
  - Puts **filters in the URL** and talks about **canonicalization, crawl traps, and CDN cache keys**.
  - Separates **cached public content from personal data** (never cache the cart in HTML).
  - Knows **price correctness is enforced on the server** even when the page is cached.
  - Breaks down LCP (TTFB / load delay / load time / render delay) and fixes the LCP image specifically.
  - **Image CDN, srcset/sizes, AVIF**, and color accuracy for art.
  - Mentions **third-party scripts** as a main INP risk.
  - Structured data, `hreflang`, sitemaps, and handling out-of-stock pages for SEO.
