# 01 · Design an Autocomplete Component

**Difficulty:** Medium–Hard · **Time:** 45 min

## The prompt (as the interviewer says it)

> "Design an autocomplete component, like the Google search box. Several teams in our company will use it: global search, a city picker in the checkout form, and a user mention picker in comments. Design the component and how it gets its data."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| Who uses it? One product or a shared library? | A shared library. Different teams, different data sources. |
| Where do results come from? Server, local list, or both? | Mostly server. Some consumers have a small local list (e.g. 200 countries). |
| What kinds of results? Text only, or rich (images, groups)? | Rich: consumers want custom rendering (avatar + name, grouped results). |
| How large is the result set per query? | Up to ~10–20 shown, server returns at most 50. |
| Devices and network? | Desktop and mobile web. Users on slow 3G exist. |
| Do we need offline? | No, but it must behave well on flaky networks. |
| Accessibility? | Must meet WCAG 2.1 AA. Full keyboard support. |
| i18n? | Yes. English, Persian (RTL), Arabic. |
| Multi-select (tags)? | Out of scope for v1. Mention how you'd extend it. |
| What happens on select? | Consumer decides: navigate, fill a field, insert a mention. |

## What the interviewer is looking for

- A clean, **flexible component API** (controlled vs uncontrolled, custom rendering, headless option).
- Correct async behavior: **debounce, request cancellation, race conditions, caching**.
- The **ARIA combobox** pattern and keyboard handling.
- Performance: avoid re-rendering on every keystroke, virtualize long result lists, cache.
- Thinking about consumers: theming, extensibility, versioning.

## Suggested time split

- Requirements: 5 min
- Architecture (component + data layer): 10 min
- Data model + component API: 10 min
- Optimizations (network, cache, a11y, perf, i18n): 15 min
- Wrap-up: 5 min
