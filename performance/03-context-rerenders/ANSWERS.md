# Perf 03 · Answers

## Issues, ranked by impact

| # | Issue | What the user notices | How to prove it |
|---|---|---|---|
| 1 | Fast-changing data (`now`, every 1s) lives in the **same context** as slow data (theme, user) | Every consumer of the context re-renders every second, including 200 buttons that only need the theme. Jank every second on slow devices | React DevTools Profiler: a commit every second containing all `ThemedButton`s. "Why did this render?" → *Context changed*. |
| 2 | The context `value` is a **new object literal on every render** | Even without the clock, *any* `AppProvider` re-render (a parent render, a user update) re-renders every consumer | Profiler shows consumers rendering when nothing they use changed. |
| 3 | `toggleTheme` is a new function on every render | Part of #2. Also breaks `memo`/`useEffect` deps in consumers that receive it | Code review. `react-hooks/exhaustive-deps` warnings downstream. |
| 4 | Selecting a slice from context doesn't help | `const { theme } = useApp()` *looks* like it subscribes to the theme only. It doesn't: React has no context selectors, so a context change re-renders every `useContext` consumer | Explain it. This is the most common misconception in this area. |

## The fix (see `solution.tsx`)

1. **Split contexts by how often they change:** `ThemeContext`, `UserContext`, `NowContext`.
2. **Memoize each value:** `useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])` with `toggleTheme` from `useCallback`.
3. **Isolate the ticking state** in a small `NowProvider`. When it ticks, React re-renders `NowProvider` and the `NowContext` consumers. The `children` element is the same as before, so React skips that subtree. This is the **"children as props" optimization**.
4. Keep the hook API identical (`useTheme`, `useUser`, `useNow`), so no consumer code changes.

### Alternatives worth mentioning

- **External store + `useSyncExternalStore`:** a module-level clock store with `subscribe`/`getSnapshot`, which starts the interval on the first subscriber and stops it after the last one. Components subscribe directly with no Provider re-render at all. This is how Zustand, Redux and Jotai avoid the context problem.
- **Selector libraries:** `use-context-selector`, or Zustand's `useStore(selector)`, re-render only when the selected slice changes.
- **Don't put a clock in global state at all.** Only `<Clock />` needs the time, so it can own its own interval.
- **React Compiler** (React 19+) auto-memoizes values and callbacks, which fixes #2 and #3. It does **not** fix #1, which is a data-architecture problem.

## Senior talking points

- **Rule of thumb:** context is for *dependency injection* and **low-frequency** values (theme, locale, current user, feature flags). High-frequency values (mouse position, time, scroll, form fields) go in local state or an external store.
- **How to find this in a big app:** Profiler → record 3 seconds of idle time → if anything renders while the user does nothing, look for timers in providers. The "Ranked" chart shows the cost.
- **Cost model:** 200 cheap buttons × 1/s is fine on a MacBook, and 30–50 ms of main-thread time per second on a mid-range Android phone. Always test with 4×–6× CPU throttling.
