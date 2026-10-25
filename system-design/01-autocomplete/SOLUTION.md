# 01 · Autocomplete — Solution

## 1. Requirements

### Functional
1. The user types. The component shows matching suggestions under the input.
2. The user picks a suggestion with mouse, touch, or keyboard (`↑` `↓` `Enter` `Esc`).
3. Consumers provide the data source: async function (server) or a static list.
4. Consumers can customize how each suggestion looks (avatar, groups, highlighted match).
5. Loading, empty, and error states are shown.
6. The consumer is told about the selection (`onSelect`).

**Out of scope for v1:** multi-select/tags, inline "ghost text" completion, voice input. The design should allow them later.

### Non-functional
- **Fast:** results feel instant. Target under 100 ms from keystroke to UI response for cached queries, and under 300–500 ms for network queries on a good connection.
- **Correct:** never show results for an old query (race conditions).
- **Network-friendly:** don't send a request on every keystroke. Reuse previous results.
- **Accessible:** WCAG 2.1 AA, ARIA 1.2 combobox pattern, screen-reader friendly.
- **Small:** the library should be a few KB gzipped. No big dependencies.
- **Works in LTR and RTL**, and with IME input (Persian, Chinese, Japanese keyboards).
- **Customizable** without forking the library.

---

## 2. Architecture

```
┌──────────────────────────── Consumer app ────────────────────────────┐
│                                                                       │
│   <Autocomplete source={searchCities} renderItem={...} onSelect={..}> │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ props
┌───────────────────────────────▼──────────────────────────────────────┐
│                       Autocomplete (UI layer)                         │
│   ┌──────────────┐   ┌──────────────────┐   ┌──────────────────────┐  │
│   │  Input view  │   │  Results popup   │   │  Live region         │  │
│   │  (combobox)  │   │  (listbox,       │   │  ("5 results")       │  │
│   │              │   │   virtualized)   │   │                      │  │
│   └──────┬───────┘   └────────▲─────────┘   └──────────▲───────────┘  │
│          │ events             │ state                  │              │
│   ┌──────▼────────────────────┴────────────────────────┴───────────┐  │
│   │              Controller: useAutocomplete() (headless)           │  │
│   │  input value · query · active index · open/closed · status      │  │
│   │  keyboard handling · debounce · selection                       │  │
│   └──────────────────────────────┬──────────────────────────────────┘  │
│                                  │ getResults(query)                   │
│   ┌──────────────────────────────▼──────────────────────────────────┐  │
│   │                  Data layer (per data source)                    │  │
│   │  in-memory LRU cache · in-flight dedupe · AbortController        │  │
│   │  prefix filtering · retries with backoff                         │  │
│   └──────────────────────────────┬──────────────────────────────────┘  │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │ HTTPS GET /search?q=...
                          ┌────────▼────────┐
                          │  CDN / edge     │  caches popular prefixes
                          └────────┬────────┘
                          ┌────────▼────────┐
                          │  Search API     │
                          └─────────────────┘
```

**Three layers, so teams can replace any one of them:**

1. **Headless controller (`useAutocomplete`)**: all behavior, no markup. It returns state plus "prop getters" (`getInputProps()`, `getItemProps(i)`). This is the pattern used by Downshift and React Aria. Teams with a custom design can use only this layer.
2. **Default UI (`<Autocomplete>`)**: built on the hook, with styles from the design system tokens. It covers 80% of consumers.
3. **Data layer**: a small client per data source with cache, dedupe and cancellation. It is separate so that the same cache can be shared between two autocompletes that use the same endpoint.

### Data flow for one keystroke

1. `input` event → controller updates `inputValue` immediately (the input must never lag).
2. If the query is cached → show cached results now (no debounce).
3. Otherwise start/restart a debounce timer (~200–300 ms; consumers can change it).
4. Timer fires → data layer: abort the previous request, check in-flight map, send request.
5. Response arrives → store in cache. If this query is still the current one, update results. Otherwise ignore it.
6. Results render. The live region announces "8 suggestions available".

### Component tree

```
<Autocomplete>
├── <label>
├── <input role="combobox">         ← focus always stays here
├── <div role="status" aria-live>   ← "Loading…", "8 results", "No results"
└── <Popover>                       ← portal, positioned under input
    └── <ul role="listbox">
        ├── <li role="presentation">Group header</li>   (optional groups)
        └── <li role="option" id=... aria-selected> {renderItem(item)} </li>
```

---

## 3. Data model

```ts
type Status = 'idle' | 'loading' | 'success' | 'error';

interface AutocompleteState<T> {
  inputValue: string;        // what the user sees in the input
  query: string;             // debounced + normalized value we searched for
  results: T[];
  status: Status;
  error?: Error;
  isOpen: boolean;
  activeIndex: number;       // -1 = none
  selectedItem: T | null;
}

// A data source is just an async function. The library adds cache/dedupe around it.
type Source<T> = (query: string, ctx: { signal: AbortSignal; limit: number }) => Promise<T[]>;

interface CacheEntry<T> {
  results: T[];
  fetchedAt: number;         // for TTL
}

// Normalized cache key: lowercase, trimmed, Unicode-normalized
// key = source.id + ':' + normalize(query)
```

**Why separate `inputValue` and `query`?** When the user selects "Tehran", we write "Tehran" into the input but must **not** start a new search for "Tehran". Keeping them separate also means the input renders on every keystroke but the search only on debounce.

**Query normalization:** `query.trim().toLowerCase().normalize('NFKC')`. For Persian/Arabic, also unify `ي`/`ی` and `ك`/`ک` (Arabic vs Persian forms of the same letters). Otherwise `"علی"` typed with an Arabic keyboard won't hit the cache for `"علي"`.

---

## 4. Interface

### Component API

```tsx
interface AutocompleteProps<T> {
  // data
  source: Source<T> | T[];                 // async function or a static list
  getItemKey: (item: T) => string;
  getItemLabel: (item: T) => string;       // used for input text, a11y name, and matching

  // behavior
  debounceMs?: number;                     // default 250
  minChars?: number;                       // default 1
  maxResults?: number;                     // default 10
  cache?: { ttlMs?: number; maxEntries?: number } | false;
  filterLocally?: (items: T[], query: string) => T[];   // prefix-filter optimization

  // controlled / uncontrolled
  value?: T | null;
  defaultValue?: T | null;
  inputValue?: string;
  onInputValueChange?: (v: string) => void;
  onSelect: (item: T) => void;

  // rendering
  renderItem?: (item: T, state: { active: boolean; query: string }) => ReactNode;
  renderEmpty?: (query: string) => ReactNode;
  renderError?: (error: Error, retry: () => void) => ReactNode;
  groupBy?: (item: T) => string;

  // a11y + i18n
  label: string;                           // required: every input needs a label
  messages?: { loading: string; noResults: string; resultsCount: (n: number) => string };
  placement?: 'bottom-start' | 'bottom-end';   // logical: flips in RTL
}

// Headless version
function useAutocomplete<T>(options: Omit<AutocompleteProps<T>, 'renderItem'>): {
  state: AutocompleteState<T>;
  getInputProps(): InputHTMLAttributes<HTMLInputElement>;
  getListboxProps(): HTMLAttributes<HTMLUListElement>;
  getItemProps(index: number): LiHTMLAttributes<HTMLLIElement>;
  getStatusProps(): HTMLAttributes<HTMLDivElement>;
  retry(): void;
  close(): void;
};
```

**Design choices to say out loud:**
- `source` as a **function**, not a URL. The library doesn't know about auth headers, GraphQL, or response shapes. Consumers adapt.
- **Controlled and uncontrolled** both work (like `<input>`). Forms libraries need controlled. Simple usage wants uncontrolled.
- **Render props** for items, so the mention picker can show avatars and the city picker can show country flags, without new props for each case.
- **Prop getters** in the headless hook merge consumer handlers with ours (`getInputProps({ onKeyDown })` calls both).

### Server API

```
GET /api/search?q=teh&limit=10&locale=fa-IR
→ 200
{
  "query": "teh",
  "results": [
    { "id": "city_112", "label": "Tehran", "subtitle": "Iran", "type": "city" }
  ]
}
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

- **GET with the query in the URL**, so CDN and browser caches work. POST bodies aren't cached.
- **Echo the query** in the response. This is a second defense against races: if `response.query !== currentQuery`, drop it.
- **Short CDN cache** for popular prefixes ("a", "ip", "tehr"). These are the most common requests and the cheapest to cache.
- No pagination: autocomplete shows the top N. A "See all results" link goes to the full search page, which paginates.

---

## 5. Optimizations (deep dive)

### 5.1 Network

| Technique | Why |
|---|---|
| **Debounce** 200–300 ms | Typing "javascript" is 10 keystrokes. Debounce turns it into 1–2 requests. |
| **AbortController** | Cancel the old request when a new one starts. Saves bandwidth and server work. |
| **Ignore stale responses** | Abort is not enough: a response may already be in the JS queue. Check `query === currentQuery` (or an incrementing request id) before setting state. |
| **In-flight dedupe** | Two components (or Strict Mode double effects) asking for the same query share one promise. |
| **LRU cache with TTL** | Backspacing from "tehr" to "teh" shows results instantly. Cap at ~50–100 entries. TTL ~5 min for search; longer for static data like cities. |
| **Prefix filtering** | If the server returned *all* matches for "te" (fewer than the limit), results for "teh" are a subset. Filter locally, no request. |
| **Prefetch on focus** | For small datasets (countries), load the whole list on focus and filter locally. |
| **Retry with backoff** | One retry on network error, then show an error with a "Retry" button. |
| **Min chars** | Don't query for 1 character if results are useless (consumer decides). |

Debounce vs throttle: debounce waits for a pause, so a fast typist sees nothing until they stop. Some products use **throttle** (e.g. every 300 ms) so results update *while* typing. You can offer both via an option.

### 5.2 Rendering performance

- The input is controlled by local state in the controller. Results are in a separate memoized subtree, so typing doesn't re-render 50 option rows.
- `renderItem` results are memoized per item key + active state.
- **Virtualize** the list if consumers allow more than ~50 items (rare for autocomplete, common for big "select" pickers).
- Highlighting the match: compute ranges once per result set, not on every render.
- Avoid layout thrashing when positioning the popup: measure the input once on open and on resize/scroll (with `requestAnimationFrame`), or use CSS anchor positioning where supported.
- Use `startTransition` for setting results if rendering is heavy. Typing stays responsive (better INP).

### 5.3 Accessibility (ARIA 1.2 combobox)

- `<input role="combobox" aria-expanded aria-controls="listbox-id" aria-autocomplete="list" aria-activedescendant="option-3">`
- `<ul role="listbox" id="listbox-id">`, `<li role="option" id="option-3" aria-selected="true">`
- **Focus stays in the input.** We move a "virtual" focus with `aria-activedescendant`, so typing keeps working.
- Keys: `↓`/`↑` move (wrap around), `Enter` selects, `Esc` closes (a second `Esc` clears), `Home`/`End` move the caret in the input (not the list), `Tab` closes and moves on (optionally selects active).
- `aria-live="polite"` region announces "Loading", "8 results", "No results". Don't announce on every keystroke. Debounce the announcement too.
- Options use `onMouseDown={e => e.preventDefault()}` so the input doesn't blur before `click`.
- Visible focus/active styles that don't rely on color alone.
- Touch: bigger hit targets (at least 44×44 px) on mobile.
- Groups: `role="group"` with `aria-labelledby` pointing at the header.

### 5.4 i18n and RTL

- Popup placement uses logical values (`bottom-start`), so it aligns to the right edge in RTL.
- Persian/Arabic: normalize letter variants and remove diacritics (harakat) for matching. Highlighting must map normalized indexes back to the original string.
- **IME composition:** while `compositionstart`…`compositionend` is active (Chinese/Japanese input, some mobile keyboards), don't search and don't treat `Enter` as "select". Check `event.isComposing`.
- Numbers and counts through `Intl.PluralRules` ("1 result" vs "2 results"; Arabic has 6 plural forms).
- `dir="auto"` on each option, so mixed English/Persian labels display correctly.

### 5.5 Security

- Highlight matches by **splitting text into React nodes**, never by building HTML strings with `<mark>` and `dangerouslySetInnerHTML`. A city named `<img onerror=...>` from the server would be XSS.
- Don't put sensitive data in the URL query if it's personal (e.g. searching your contacts). Use `Cache-Control: private`, or POST for those consumers.
- Server-side rate limiting per user/IP. The client debounce is not a security control.

### 5.6 Failure modes

| Situation | Behavior |
|---|---|
| Network error | Show "Something went wrong" + Retry. Keep the old results visible but dimmed, or hide them. |
| Slow response (> 1 s) | Show a spinner after ~150 ms (not instantly, to avoid flicker). |
| Offline (`navigator.onLine === false`) | Show cached results only, with a hint "You're offline". |
| Server returns results for an old query | Ignored (query echo + request id). |
| Consumer's `source` throws synchronously | Catch it, same as a network error. |
| Component unmounts mid-request | Abort and don't set state. |

### 5.7 Observability

- Log: queries per session, time-to-results, zero-result rate, selection position (users picking result #7 means ranking is bad), abandon rate.
- Measure INP on the input: if typing is slow, the results render is too heavy.
- Error rate per data source.

### 5.8 Testing

- Unit tests for the controller with fake timers: debounce, race conditions (resolve responses out of order), cache, abort.
- Component tests with Testing Library querying by role (`getByRole('combobox')`, `getAllByRole('option')`). This checks a11y too.
- Axe (accessibility linter) in CI. Manual screen reader tests on VoiceOver and NVDA before major releases.
- Visual regression of the default UI in LTR and RTL.

### 5.9 Library concerns

- **Versioning:** semver. Prop renames go through a deprecation warning for one major version.
- **Bundle:** tree-shakeable ESM. The headless hook has no styling deps.
- **Theming:** CSS variables from design tokens (`--ac-option-active-bg`).
- **Docs:** Storybook with examples for each consumer pattern (mentions, cities, global search).

---

## 6. Trade-offs

| Decision | Option A | Option B | Choice |
|---|---|---|---|
| Behavior/markup | Monolithic component | Headless hook + default UI | **Both layers.** More API to maintain, but teams with custom designs don't fork. |
| Data source | URL + response mapper | Async function | **Function.** Works with any transport and auth. |
| Cache location | Per component | Shared per source | **Shared per source.** Better hit rate. Needs a clear key scheme. |
| Debounce vs throttle | Fewer requests | Results while typing | **Debounce by default**, throttle as an option. |
| Focus model | Real focus moves into the list | `aria-activedescendant` | **activedescendant.** Typing never breaks. Slightly more complex. |
| Large lists | Render all | Virtualize | **Render all up to ~50**, virtualize above. Virtualization complicates a11y (set `aria-setsize`/`aria-posinset`). |

---

## 7. Follow-up questions

**"How would you add multi-select (tags)?"**
Keep the selected items in state as an array. Render them as chips before the input. `Backspace` on an empty input removes the last chip. Selected items are filtered out of results. The listbox gets `aria-multiselectable="true"`.

**"How do you handle 'ghost text' inline completion like Google?"**
Show the top suggestion's remaining characters as a styled, non-selectable overlay behind the input, or select the completed part with `setSelectionRange`. `Tab` or `→` accepts it. Be careful with screen readers: announce the suggestion through the live region.

**"Search is slow on the server (800 ms). What can the frontend do?"**
Show cached and prefix-filtered results first. Show a skeleton after 150 ms. Prefetch on focus. Ask the backend for a fast "top N prefix" endpoint with CDN caching. Consider a client-side index (e.g. FlexSearch) for small, static datasets.

**"How would you rank recent searches?"**
Store the last N selections in `localStorage` (per user, no sensitive data). Show them when the input is focused and empty. Merge them on top of server results for matching queries.

**"How do you test race conditions?"**
Use controlled (deferred) promises: start request A, then B, resolve B, then resolve A. Assert the UI shows B's results.

---

## 8. What separates a senior answer from a mid-level one

- **Mid-level:** debounce + fetch + a list, maybe a cache.
- **Senior:**
  - Separates **input value from query**, and **behavior from rendering** (headless).
  - Explains why abort alone doesn't fix races, and adds a query check.
  - Designs the **API for multiple consumers** (render props, controlled/uncontrolled, source as a function).
  - Knows the **ARIA combobox** pattern and why focus stays in the input.
  - Mentions **IME composition**, **Persian/Arabic normalization**, and **RTL placement**.
  - Uses the **CDN** for popular prefixes and explains why GET.
  - Talks about **metrics** (zero-result rate, selected position) to improve the product, not just the code.
