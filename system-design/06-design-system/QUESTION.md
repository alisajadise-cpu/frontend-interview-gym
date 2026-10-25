# 06 · Design a Company-wide Design System / Component Library

**Difficulty:** Hard · **Time:** 45–60 min

## The prompt (as the interviewer says it)

> "Our company has 15 frontend teams and 6 products. Every team builds its own buttons, modals and date pickers, and they all look and behave a bit differently. Design a design system and component library that all teams can use."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| Which frameworks do teams use? | Mostly React. One legacy Angular app and some server-rendered pages. |
| Rendering: SSR, RSC, client-only? | Mixed. Next.js apps with SSR/RSC, and client-only SPAs. |
| Do products have different brands? | Two brands, plus light/dark mode. |
| Languages? | English, Persian, Arabic (RTL is required). |
| Accessibility target? | WCAG 2.1 AA, required by law in some markets. |
| Is there a design team with Figma? | Yes. Designers maintain a Figma library. |
| Who builds it? | A small core team (4–5 engineers + 2 designers). Product teams contribute. |
| How do teams get updates today? | They copy code. No versioning. |
| Mobile apps? | Native apps exist. Sharing tokens (colors, spacing) with them would be nice. |

## What the interviewer is looking for

- **Layers:** design tokens → primitives/headless behavior → styled components → patterns.
- **Component API design**: composition vs configuration, controlled/uncontrolled, polymorphism (`as`/`asChild`), ref forwarding, escape hatches.
- **Theming** with tokens and CSS variables (multi-brand, dark mode) without runtime cost.
- **Styling approach** that works with SSR/RSC.
- **Accessibility** built in, and **RTL**.
- **Versioning, distribution, migration** (semver, codemods, deprecations), and governance/contribution.
- **Docs and testing** (Storybook, visual regression, a11y tests).
- Adoption and measuring success.

## Suggested time split

- Requirements: 5–7 min
- Architecture (layers, packages, tokens pipeline): 10–12 min
- Component API design (with one example, e.g. Select or Dialog): 10 min
- Theming, a11y, RTL, styling: 10 min
- Versioning, distribution, testing, governance: 8 min
- Wrap-up: 3 min
