# 06 · Design System — Solution

## 1. Requirements

### Functional
1. **Design tokens:** color, typography, spacing, radius, shadow, motion, z-index, breakpoints. One source of truth for web and native.
2. **Components:** foundations (Button, Input, Checkbox, Select, Dialog, Tooltip, Tabs, Toast, Table, DatePicker…) and layout primitives (Stack, Grid, Box).
3. **Theming:** 2 brands × light/dark, switchable at runtime, also per subtree (a dark sidebar in a light app).
4. **RTL** support with no extra work for product teams.
5. **Documentation** with live examples, usage guidelines, and a11y notes.
6. A way for product teams to **contribute** and to **extend** components without forking.

### Non-functional
- **Accessible by default:** WCAG 2.1 AA for every component, keyboard and screen reader support.
- **Performance:** tree-shakeable, small per-component cost, no runtime CSS-in-JS cost on the critical path, works with SSR and React Server Components.
- **Stable API:** semver, clear deprecations, codemods for breaking changes.
- **Consistent with Figma:** tokens and component names match the design library.
- **Adoption:** easy to install, easy to migrate to, measurable usage.

---

## 2. Architecture

### Layers

```
┌───────────────────────────────────────────────────────────────────────┐
│ Layer 4: Patterns / recipes   (product-level: FilterBar, PageHeader,  │
│                                EmptyState, FormLayout)                 │
├───────────────────────────────────────────────────────────────────────┤
│ Layer 3: Styled components    (@acme/react: Button, Dialog, Select)   │
│                                tokens + styles + behavior              │
├───────────────────────────────────────────────────────────────────────┤
│ Layer 2: Headless behavior    (@acme/headless: useDialog, useListbox, │
│                                focus trap, roving tabindex, ARIA)      │
├───────────────────────────────────────────────────────────────────────┤
│ Layer 1: Design tokens        (@acme/tokens: JSON source →            │
│                                CSS variables, TS constants, iOS,      │
│                                Android, Figma variables)               │
└───────────────────────────────────────────────────────────────────────┘
```

- **Teams use layer 3 by default.** Teams with special needs can use layer 2 (behavior + a11y) with their own markup, so they don't rebuild accessibility.
- Layer 2 can be built on a proven library (React Aria, Radix primitives) instead of from scratch. Building a correct combobox, date picker, or focus trap takes months. Say this trade-off out loud.

### Packages (monorepo)

```
packages/
  tokens/        JSON tokens + build (Style Dictionary-like) → css, ts, ios, android
  headless/      hooks and unstyled primitives
  react/         styled components (depends on tokens + headless)
  icons/         SVG icons as tree-shakeable React components, RTL-mirroring flag
  css/           plain CSS + class names for non-React apps (Angular, server pages)
  eslint-plugin/ rules: no hard-coded colors, prefer DS components, a11y lint
  codemods/      jscodeshift transforms for breaking changes
apps/
  docs/          documentation site (Storybook or custom)
  playground/    test app for SSR/RSC and RTL
```

The **CSS package** matters for the Angular and server-rendered apps: the visual layer is plain CSS classes + variables, so non-React apps get the same look (behavior they rebuild or use web components later).

### Token pipeline

```
Figma variables ──export/sync──► tokens/*.json (git, reviewed in PRs)
                                        │ build
            ┌───────────────┬───────────┼──────────────┬──────────────┐
            ▼               ▼           ▼              ▼              ▼
     tokens.css       tokens.ts    ios/*.swift   android/*.xml   Figma (sync back)
  (CSS variables)   (typed names)
```

---

## 3. Data model: tokens

**Three tiers of tokens:**

```jsonc
// 1. Primitive (raw values) — never used directly in components
{ "color": { "blue": { "500": "#3B5BDB", "600": "#364FC7" }, "gray": { "50": "#F8F9FA", "900": "#212529" } } }

// 2. Semantic (meaning) — what components use; differs per theme
{ "color": {
    "bg":      { "default": "{color.gray.50}",  "inverse": "{color.gray.900}" },
    "text":    { "default": "{color.gray.900}", "muted": "{color.gray.600}" },
    "action":  { "primary": { "bg": "{color.blue.500}", "bg-hover": "{color.blue.600}", "fg": "#FFFFFF" } },
    "border":  { "focus": "{color.blue.500}" },
    "feedback":{ "danger": "{color.red.600}" } } }

// 3. Component (optional, for fine control)
{ "button": { "primary": { "bg": "{color.action.primary.bg}" }, "radius": "{radius.md}" } }
```

Output CSS:

```css
:root,
[data-theme='brand-a-light'] {
  --color-bg-default: #f8f9fa;
  --color-action-primary-bg: #3b5bdb;
  --space-2: 8px;
  --radius-md: 8px;
}
[data-theme='brand-a-dark'] {
  --color-bg-default: #141417;
  --color-action-primary-bg: #8ea2ff;
}
```

```ts
// Typed access for TS (autocomplete, no typos)
export const tokens = {
  color: { bg: { default: 'var(--color-bg-default)' } },
  space: { 2: 'var(--space-2)' },
} as const;
```

**Why CSS variables for theming?** Theme switching is just changing an attribute. No React re-render, no JS runtime cost, works in SSR (no flash if the theme attribute is set on the server, or by a tiny inline script before paint for "system" preference), and works in non-React apps. Nested themes work by putting `data-theme` on any element.

---

## 4. Interface: component API design

### Principles

1. **Composition over configuration** for complex components. Configuration (`<Select options={[...]}/>`) is easy but hits a wall the first time a team needs icons, groups, or custom rows. Composition (`<Select><Select.Option/></Select>`) scales.
2. **Controlled and uncontrolled:** `value`/`onChange` and `defaultValue`, like native inputs.
3. **Extend native props:** a `Button` accepts all `<button>` attributes (`type`, `aria-*`, `data-*`), forwards `ref`, and merges `className`/`style`.
4. **Polymorphism:** a Button that renders as a link. Use `asChild` (Radix pattern: merge props into the single child) rather than `as="a"` with complex generic types.
5. **Escape hatches:** `className`, slot props (`slotProps={{ trigger: {...} }}`), and the headless hooks. Without escape hatches, teams fork.
6. **Consistent naming:** `variant`, `size`, `tone`, `isDisabled`/`disabled` (pick one), `onOpenChange`. Write it in a guidelines doc.
7. **Accessible by construction:** required props for a11y (e.g. `IconButton` requires `aria-label`; TypeScript enforces it).

### Example: Button

```tsx
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;          // shows spinner, keeps width, sets aria-busy, blocks clicks
  startIcon?: ReactNode;      // "start/end", not "left/right" → correct in RTL
  endIcon?: ReactNode;
  asChild?: boolean;          // <Button asChild><a href="/x">Go</a></Button>
  ref?: React.Ref<HTMLButtonElement>;
};
```

### Example: Dialog (compound components)

```tsx
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger asChild><Button>Delete</Button></Dialog.Trigger>
  <Dialog.Content size="sm" initialFocus="cancel">
    <Dialog.Title>Delete project?</Dialog.Title>
    <Dialog.Description>This can't be undone.</Dialog.Description>
    <Dialog.Footer>
      <Dialog.Close asChild><Button id="cancel" variant="secondary">Cancel</Button></Dialog.Close>
      <Button variant="danger" onClick={onDelete}>Delete</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

The Dialog handles: portal, `role="dialog"` + `aria-modal`, `aria-labelledby`/`aria-describedby` wiring, focus trap, initial focus, restoring focus to the trigger, `Esc` to close, scroll lock, `inert` on the rest of the page, stacking of nested dialogs, and animations that respect `prefers-reduced-motion`.

---

## 5. Deep dives

### 5.1 Styling approach

| Approach | SSR/RSC | Runtime cost | Theming | Notes |
|---|---|---|---|---|
| Runtime CSS-in-JS (styled-components, Emotion) | Needs extra setup; not usable in RSC server components | Styles computed at runtime → slower INP/hydration | Easy | Falling out of favor for libraries |
| **Zero-runtime CSS-in-JS** (vanilla-extract, Panda, StyleX) | Good | None (static CSS at build time) | Via CSS variables | Typed styles; build plugin needed |
| **CSS Modules / plain CSS + variables** | Good | None | Via CSS variables | Simple, works everywhere, including non-React apps |
| Utility CSS (Tailwind) for the library | Good | None | Via variables in config | Great inside apps; harder to ship as a library to apps with different setups |

**Choice:** plain CSS (CSS Modules or a zero-runtime tool) with **CSS variables from tokens**, compiled to static CSS. It works with SSR and RSC, it has no runtime cost, and the same CSS serves the Angular app. Use **CSS cascade layers** (`@layer ds-reset, ds-components, app`) so app styles can override library styles predictably without `!important` wars.

### 5.2 Accessibility built in

- Every component has a documented **keyboard map** and ARIA pattern (from the WAI-ARIA Authoring Practices).
- Focus styles via `:focus-visible` with a token color, at least 3:1 contrast.
- Color tokens are tested for **contrast** in every theme at build time (fail the build if `text.default` on `bg.default` is below 4.5:1).
- Components announce async changes (Toast uses `role="status"`/`aria-live`).
- Motion tokens and `prefers-reduced-motion` handled in the library, not by each team.
- Testing: automated axe checks in component tests and Storybook, keyboard interaction tests, and **manual screen reader testing** (VoiceOver + Safari, NVDA + Chrome/Firefox) for each new component. Automated tools catch only ~30–40% of issues.

### 5.3 RTL

- Use **logical CSS properties** everywhere: `padding-inline-start`, `margin-inline-end`, `inset-inline-start`, `border-start-start-radius`, `text-align: start`. Then RTL works automatically when `dir="rtl"` is set.
- Lint rule: ban `left`/`right`/`margin-left` etc. in the library CSS.
- Icons: a `mirrorInRtl` flag for directional icons (arrows, chevrons, "reply"), applied with `:dir(rtl)` or `[dir="rtl"] &` → `transform: scaleX(-1)`. Don't mirror logos, checkmarks, media play buttons, or clocks.
- Components with direction logic (Slider, Carousel, Tabs keyboard arrows, Popover placement) read the direction from a `DirectionProvider` or `getComputedStyle(el).direction`, and swap Left/Right arrow keys.
- Typography tokens per script: Persian/Arabic fonts (e.g. Vazirmatn), and slightly larger line-height for Arabic script.
- Visual regression tests run in **both LTR and RTL**.

### 5.4 Performance

- **ESM, tree-shakeable**, `sideEffects: ["*.css"]` in package.json, one entry per component (`@acme/react/button`) or good tree shaking from the root.
- No big dependencies in core components (e.g. the DatePicker uses `Intl`, not a 70 KB date library).
- Heavy components (DataTable, RichText, DatePicker) are separate entry points so apps load them only when needed.
- **RSC compatibility:** components that use state/effects are marked `'use client'`. Pure presentational ones (Text, Stack, Card) stay server-compatible.
- Bundle size budgets per component in CI (size-limit). Report changes in PRs.

### 5.5 Versioning and distribution

- Publish to a private npm registry. **Semver**, with changesets for changelogs.
- **One version for the whole library** (simpler for consumers) or independent package versions. Choose one; one version is easier for 15 teams.
- **Breaking change process:**
  1. Add the new API and deprecate the old one (runtime `console.warn` in dev, `@deprecated` JSDoc so editors strike it through).
  2. Ship a **codemod** (`npx @acme/codemods v5-button-variant`).
  3. Remove in the next major. Majors at most 1–2 per year.
- Support the latest major + the previous one with security/critical fixes.
- **Peer dependencies** for React, so apps don't get two Reacts.
- Track adoption: a script scans all repos for imports and versions (what's used, what's outdated, which custom components could be replaced).

### 5.6 Documentation

- A docs site with: live examples, props tables generated from TypeScript, **do/don't** usage guidance, accessibility notes (keyboard map, ARIA), content guidelines (button labels, error messages), and links to the Figma component.
- Storybook for every state (default, hover, disabled, loading, error, RTL, dark). Stories double as test cases.
- "Migration guides" for each major version.

### 5.7 Testing strategy

| Test type | Tool | What |
|---|---|---|
| Unit / interaction | Vitest/Jest + Testing Library | Keyboard behavior, controlled/uncontrolled, events |
| Accessibility | axe in tests, Storybook a11y addon | ARIA errors, contrast, labels |
| Visual regression | Chromatic / Playwright screenshots | Every story × themes × LTR/RTL |
| Cross-browser | Playwright (Chromium, Firefox, WebKit) | Focus, portals, popover positioning |
| SSR/RSC | Playground app build in CI | No hydration mismatches, no `window` at import time |
| Types | `tsd`/type tests | Public API types don't break unexpectedly |

### 5.8 Governance and contribution

- **Core team owns** foundations and API standards. **Product teams contribute** through an RFC process: propose → design review (designer + DS engineer) → build with the core team's review.
- Component maturity labels: *experimental* → *beta* → *stable*. Experimental components may change without a major version.
- Office hours, a Slack channel, and a public roadmap.
- "Contribution first": if a team needs a variant, they add it to the library instead of a local fork.

### 5.9 Measuring success

- Adoption: % of UI built with DS components (import scanning), number of local "Button" clones going down.
- Consistency: number of hard-coded colors (lint), visual audits.
- Quality: a11y issues found in products, bugs per component.
- Speed: time to build a new screen, designer–developer handoff time.
- Performance: bundle size per app, CWV of apps after migration.

### 5.10 Security

- Components never render raw HTML from props (no `dangerouslySetInnerHTML` inside the library), except a clearly named `SafeHtml` that requires sanitized input (Trusted Types friendly).
- Link components handle `target="_blank"` with `rel="noopener noreferrer"` by default.
- Supply chain: lock dependencies, audit, signed releases, minimal dependencies.

---

## 6. Trade-offs

| Topic | Options | Choice |
|---|---|---|
| Behavior | Build from scratch / proven headless lib | **Proven headless (React Aria/Radix)** behind our own API. Less control, much less a11y risk. |
| Styling | Runtime CSS-in-JS / static CSS + variables | **Static CSS + variables.** SSR/RSC friendly, zero runtime. |
| API style | Configuration / composition | **Composition** for complex components, simple props for simple ones. |
| Versioning | Independent packages / single version | **Single version**: simpler for consumers. |
| Frameworks | React only / web components | **React + plain CSS package.** Web components later if more non-React apps appear (they have SSR and form-integration costs). |
| Strictness | Locked-down / escape hatches | **Escape hatches** (className, slots, headless). Locked-down systems get forked. |

---

## 7. Follow-up questions

**"A team says the Select is too limited and builds their own. What do you do?"**
Find out the need. Usually it's a missing feature (search, multi-select, custom rows). Add it to the roadmap or let them contribute it. Meanwhile point them to the headless `useListbox` so their custom version is still accessible.

**"How do you avoid the theme flashing on load (dark mode)?"**
Set `data-theme` on `<html>` on the server from a cookie, or with a tiny blocking inline script in `<head>` that reads `localStorage`/`prefers-color-scheme` before first paint. Use `color-scheme` CSS property so native controls match.

**"How would you roll out a new brand color across 6 products?"**
Change the semantic token value in one place. Release a minor version. Products update the package. Visual regression shows every changed screen before merge. No code changes in products if they used semantic tokens.

**"How do you handle form components with form libraries (React Hook Form, Formik)?"**
Components forward refs to the real input and support both controlled and uncontrolled usage, so `register()` works. Provide `Field` wrappers that wire `label`, `description`, and `error` with `aria-describedby` and `aria-invalid`.

**"Why not just use MUI/Chakra?"**
Valid option for speed. Costs: their design language, their bundle, styling approach (runtime CSS-in-JS in some versions), and less control over a11y details and brand. A middle path is a thin branded layer on top of a headless library.

---

## 8. What separates a senior answer from a mid-level one

- **Mid-level:** "A shared npm package of React components with a theme object and Storybook."
- **Senior:**
  - **Layers** (tokens → headless → styled → patterns) so teams can go one level down instead of forking.
  - **Three tiers of tokens** and a pipeline to CSS variables, TS, native, and Figma.
  - **Theming with CSS variables**, no runtime cost, SSR without flash, nested themes.
  - **API principles**: composition, controlled/uncontrolled, `asChild`, escape hatches, TS-enforced a11y props.
  - **Accessibility as a feature of the system**, with contrast checks in the build and manual screen reader testing.
  - **RTL via logical properties** and icon mirroring rules.
  - **Versioning with deprecations and codemods**, governance, and **adoption metrics**.
