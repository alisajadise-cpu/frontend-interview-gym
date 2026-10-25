# 04 · Design an E-commerce Product Listing + Product Detail Page

**Difficulty:** Hard · **Time:** 45–60 min

## The prompt (as the interviewer says it)

> "Design the frontend for an online marketplace, for example a store that sells art, prints, and home decor. Focus on two pages: the product listing page with search and filters, and the product detail page with a gallery and 'Add to cart'. These pages bring most of our traffic from Google, and conversion is everything."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| How many products? | ~2 million. ~50,000 change price or stock daily. |
| Where does traffic come from? | ~60% Google search and shared links, mostly mobile. |
| Filters? | Category, price range, artist/brand, size, color, in stock, sort. Facet counts shown. |
| Personalization? | Light: "recently viewed", recommendations. The main content is the same for everyone. |
| Cart? | Logged-in and guest carts. Cart merges on login. |
| Inventory/prices: how fresh? | Price and stock must be correct at "Add to cart" and checkout. A few minutes of delay on the listing is OK. |
| Internationalization? | Several countries and currencies. Persian (RTL) and English. |
| Devices/network? | Mostly mobile, many on slow networks. |
| Checkout? | Out of scope (separate flow). |

## What the interviewer is looking for

- **Rendering strategy** per page (SSR vs SSG vs ISR vs streaming) with reasons tied to SEO and freshness.
- **Filters and sort in the URL**, canonical URLs, crawlable pagination.
- **Core Web Vitals**: LCP image, CLS from images and banners, INP on filters.
- **Image optimization** (very important for an art store).
- **Caching layers** (CDN, ISR, client cache) and how fresh prices/stock stay correct.
- **Cart** design: optimistic add, guest vs logged-in, merge.
- Structured data, accessibility, RTL, currencies.

## Suggested time split

- Requirements: 5–7 min
- Architecture + rendering strategy: 12 min
- Data model + API: 10 min
- Optimizations (SEO, CWV, images, caching, cart): 15–20 min
- Wrap-up: 3 min
