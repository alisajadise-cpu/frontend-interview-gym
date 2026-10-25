# 01 · Autocomplete / Typeahead (production-grade)

**Difficulty:** Hard · **Time:** 45–60 min · **Similar to:** GreatFrontEnd *Autocomplete* (UI + system design), Google/Meta/Airbnb onsite UI rounds

## Why companies ask this

It looks simple but tests everything a senior frontend engineer needs: debouncing, **race conditions**, request cancellation, caching, keyboard accessibility (the ARIA combobox pattern), and clean state modelling. Interviewers watch for the classic bug where a slow response for `"r"` arrives after the fast response for `"react"` and overwrites it.

## Task

Build `<Autocomplete />` in `index.tsx`.

```tsx
<Autocomplete
  label="Search frameworks"
  fetchSuggestions={(query, signal) => api.search(query, { signal })}
  onSelect={(value) => console.log(value)}
  debounceMs={300}   // optional, default 300
  minChars={1}       // optional, default 1
/>
```

## Requirements

**Fetching**
1. Fetch `debounceMs` ms after the user stops typing. Use the **trimmed** input as the query.
2. If the trimmed query is shorter than `minChars`, don't fetch and close the list.
3. When a new request starts, **abort** the previous one (`signal.aborted === true`).
4. Never show results for an old query, even if its promise resolves late.
5. Cache results per query. If the query is cached, show the cached results **immediately**: no debounce and no request.
6. On unmount, cancel the pending debounce and abort the in-flight request.

**UI states**
7. While loading, show the text `Loading…`.
8. Zero results: show `No results`. Request failed: show `Something went wrong`.
9. Highlight the matching part of each option with `<mark>`.

**Accessibility (ARIA 1.2 combobox pattern)**
10. The input has `role="combobox"`, an accessible name from `label`, `aria-autocomplete="list"`, `aria-expanded` (true while the list is shown), and `aria-controls` pointing at the listbox id.
11. The list has `role="listbox"`. Each item has `role="option"`, a unique `id`, and `aria-selected="true"` when it's the active one.
12. The input's `aria-activedescendant` points at the active option's id (focus stays in the input).

**Keyboard and mouse**
13. `ArrowDown` / `ArrowUp` move the active option and **wrap around**.
14. `Enter` selects the active option. `Escape` closes the list.
15. Clicking an option selects it.
16. Selecting: call `onSelect(value)`, put the value in the input, close the list, and **don't** start a new search for the selected value.

## What a senior answer also covers (talk through it)

- Why `onMouseDown={e => e.preventDefault()}` on options? (The input's blur would close the list before `click` fires.)
- Cache invalidation: an LRU size cap, a TTL, and prefix filtering (results for `"rea"` can be filtered locally from `"re"`).
- Server-side: rate limits, `Cache-Control`, and why to send the query in the URL rather than a POST body.
- i18n: matching with diacritics (`"é"` vs `"e"`) and RTL languages like Persian/Arabic. Look up `String.prototype.normalize('NFD')`.

## Run

```bash
npm test react/01-autocomplete
npm run test:solution react/01-autocomplete
npm run dev   # then open "react / 01-autocomplete" in the sidebar
```
