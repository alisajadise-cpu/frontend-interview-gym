# Perf 03 · One context to rule them all

**Difficulty:** Medium–Hard · **Time:** 25–35 min · **Format:** code review + fix

## The bug report

> The dashboard has a clock in the header. Since we added it, the whole page stutters every second, on low-end Android phones especially. The React Profiler shows 200+ components rendering every second, but only the clock changes.

`index.tsx` has one `AppProvider` that holds the user, the theme and the current time in **one context**. About 200 `ThemedButton`s read only the theme.

## Your task

1. **Review first.** Why do all the buttons render every second? How would you show it in React DevTools?
2. **Fix it** in `index.tsx` until `npm test performance/03` passes.
3. Compare with `ANSWERS.md` and `solution.tsx`.

## Rules

- Keep the public API the same: `AppProvider`, `useTheme`, `useUser`, `useNow`, `ThemedButton`, `Clock`, `UserBadge`, `Dashboard`. Hook return shapes stay the same.
- Keep the `probe(...)` calls.
- No external state library. Plain React only.

## What the tests check

- The clock still ticks every second and shows the right time.
- Clock ticks render **0** buttons and **0** user badges.
- Toggling the theme renders each button exactly once, and not the clock or the badge.
- Renaming the user renders only the badge.
- The interval is cleared on unmount.

## Try it in the browser

`npm run dev` → **performance / 03-context-rerenders**. Watch the render counters. Turn on React DevTools "Highlight updates when components render".
