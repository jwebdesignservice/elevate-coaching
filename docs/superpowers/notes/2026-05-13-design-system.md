# Elevate Coaching — Design System Notes

**Date:** 2026-05-13
**Scope:** Visual language for the authenticated app surface (dashboard,
settings, future feature pages). Lock these patterns in so future
sprints (SP-2 through SP-6) inherit the same look automatically when
they consume the shared components.

## 1. Foundation tokens

All tokens live in `app/globals.css` `@theme inline { … }`. Tailwind 4
generates utility classes from them automatically.

### Color

| Token                   | Hex / value              | Use                                              |
| ----------------------- | ------------------------ | ------------------------------------------------ |
| `--color-background`    | `#0a0b0b`                | Page background (near-black, not pure black)     |
| `--color-surface`       | `#15181a`                | Card / sidebar / topbar bg                       |
| `--color-surface-hover` | `#1b1f22`                | Hovered surface, icon panels, toggle bg          |
| `--color-accent`        | `#2de3a8`                | Brand mint — CTAs, active states, charts         |
| `--color-accent-fg`     | `#003d2b`                | Foreground on accent fills (text on mint button) |
| `--color-text`          | `#ffffff`                | Primary text                                     |
| `--color-text-muted`    | `#9ca3af`                | Body copy, labels                                |
| `--color-text-dim`      | `#6b7280`                | Captions, helper text, disabled                  |
| `--color-border`        | `rgba(255,255,255,0.06)` | Hairline dividers + card outlines                |

Borders are intentionally near-invisible at rest — they exist mainly to
delineate cards on the dark background. Hover states bump them to
`white/10` for subtle reveal.

### Type

| Token            | Stack                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--font-sans`    | `var(--font-inter), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `--font-heading` | Same stack — heading and body share Inter, weight + tracking carry the hierarchy.                                     |
| `--font-mono`    | `var(--font-geist-mono), ui-monospace, SFMono-Regular, ...`                                                           |

**Inter is loaded once via `next/font/google` in `app/layout.tsx`** and
exposed as `--font-inter` on `<html>`. Do **not** redeclare the font
elsewhere. **Never reference `var(--font-sans)` inside the
`--font-sans` declaration itself** — that's a circular custom-property
reference and the entire font stack silently falls back to the browser
default serif. This bit us in commit `7fcbd8e`; see
`2026-05-13-phase-g-handover.md` for the post-mortem.

### Type scale (in actual use)

| Class                                                   | Where                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `text-3xl font-bold tracking-tight`                     | TopBar page title, ProgramHero / settings profile name                 |
| `text-4xl font-bold tracking-tight`                     | ProgramHero headline, PerformanceOverview big stat                     |
| `text-3xl font-bold tracking-tight`                     | StatCard value                                                         |
| `text-xl font-semibold tracking-tight`                  | Section heading (e.g. "Video Tutorials")                               |
| `font-semibold tracking-tight`                          | Rail-card title (Today's Tasks, Weekly Schedule, Performance Overview) |
| `text-sm`                                               | Body copy, list items                                                  |
| `text-xs`                                               | Captions, helper text, schedule times                                  |
| `text-[11px] font-semibold tracking-[0.25em] uppercase` | Eyebrow labels (e.g. "CURRENT PROGRAM")                                |
| `text-[10px] tracking-[0.4em]`                          | Logo "COACHING" wordmark                                               |

### Radii

| Token                       | Value             | Use                                                    |
| --------------------------- | ----------------- | ------------------------------------------------------ |
| `--radius-card`             | `14px`            | Cards, nav rows, gradient panels — the dominant radius |
| `--radius-pill`             | `9999px`          | Progress bars, day pill, count badges                  |
| `rounded-md` / `rounded-lg` | tailwind defaults | Buttons, small icon panels, period toggles             |

## 2. Component patterns

### Cards

```tsx
<Card className="bg-surface border-border p-5">…</Card>
```

Rail cards: `p-5`. Body cards: `p-6`. Hero-tier cards: `p-8` to `p-10`
with a gradient (`from-surface via-surface to-surface-hover`) and an
ambient mint halo (`bg-accent/15 blur-3xl`) anchored top-right.

### Eyebrow + headline + meta (hero pattern)

```
[eyebrow]                ← text-[11px] font-semibold tracking-[0.25em] uppercase text-accent
[headline]               ← text-4xl font-bold tracking-tight text-text
[meta with · separators] ← text-sm leading-relaxed text-text-muted
```

### Progress bars

Bar height **1.5px** (`h-1.5`) for hero progress, **2px** (`h-2`) for
inline progress. Track is `bg-surface-hover`, fill is `bg-accent`, both
pill-rounded. For hero, anchor the percentage label to the **right
edge of the filled portion** (positioned via `left: ${pct}%` +
`translateX(-100%)`).

### StatCard layout

```
[icon] Label
———————————
Value
caption                          [chart visual]
```

Icon: `h-7 w-7` rounded-md panel, mint icon h-3.5 w-3.5.
Value: `text-3xl font-bold tracking-tight`.
Caption tone: mint (`text-accent`) for positive deltas, dim
(`text-text-dim`) for neutral subtitles.
Visual slot: Sparkline / CircularProgress / MiniBars from
`@/components/charts/*`.

### Chart primitives

All in `components/charts/`. Pure inline SVG, no runtime deps:

- **Sparkline**: line graph for trend slots. `area` prop adds a
  gradient fill underneath (use for the PerformanceOverview hero).
- **CircularProgress**: donut. Pass `value` (0–100), optional `label`
  to render centered inside.
- **MiniBars**: vertical bars for streaks / activity counts.

Stroke / fill color is hard-coded to `#2DE3A8` so the charts render the
same regardless of the consumer's text color.

### Day strip (Weekly Schedule)

7-column grid; active day cell gets `bg-accent text-accent-fg`. Letter
above (`text-[10px] font-semibold`), date below (`text-sm font-semibold`).
Hover on inactive: `hover:bg-white/[0.04]`.

### Period toggle (Performance Overview)

Wrap in `bg-surface-hover rounded-md p-0.5`. Inactive pills: text-muted.
Active pill: `bg-accent text-accent-fg rounded`. Compact (`text-[11px]
font-medium`, `px-2 py-0.5`).

### Sidebar nav row

```tsx
const baseRow =
  'group/nav relative flex items-center gap-3 rounded-card px-3 py-2.5 text-sm transition-all duration-200';
```

- **Active**: `text-text font-semibold bg-gradient-to-r from-accent/15 via-accent/5 to-transparent` + a 3px left mint bar pinned via absolute positioning + mint icon.
- **Idle real route**: `text-text-muted hover:text-text hover:bg-white/[0.03]`.
- **Coming soon**: `text-text-muted/70 cursor-not-allowed select-none` — same visual weight as a real route, just dimmer; no separate "SOON" tag (mockup doesn't use them, so we don't either).

### TopBar

- Title: `text-3xl font-bold tracking-tight`. Wave emoji or other
  inline glyph is part of the title string (e.g. `"Welcome back, Alex 👋"`).
- Subtitle: `text-sm text-text-muted mt-1.5`.
- Search: pill-rounded input, `bg-surface` with leading magnifier
  icon, disabled until SP-2.
- Upgrade Now: **outline** style (`text-accent border-accent/40`),
  zap icon with `fill-current`. Solid mint only when used as a
  primary action elsewhere.
- User menu: avatar + name + chevron, all clickable as a single pill.

## 3. Hover & motion

Subtle, never theatrical. Defaults that should stay consistent:

| Pattern                          | Implementation                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Card lift on hover               | `transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:shadow-lg hover:shadow-black/20`       |
| Video thumbnail reveal play icon | Wrap in `group/video`. Icon container gets `opacity-0 group-hover/video:opacity-100 transition-opacity duration-200`.  |
| Video thumbnail zoom             | Placeholder lucide icon: `transition-all duration-300 group-hover/video:scale-110`. The card itself also lifts.        |
| Stat-card chart scale            | Wrap visual in `transition-transform duration-300 group-hover/stat:scale-105`.                                         |
| Mint CTA button glow             | `hover:shadow-lg hover:shadow-accent/20 transition-all`.                                                               |
| Outline button → mint border     | `hover:border-accent hover:bg-accent/10 transition-colors` (vs. the default `hover:border-accent/40`).                 |
| Progress bar animate-in          | `transition-[width] duration-700 ease-out` on the fill. Donut: `transition-[stroke-dashoffset] duration-500 ease-out`. |

**Don't** add hover effects to text links unless they're actions. Don't
add to disabled controls. Don't add to background gradients or halos.

## 4. Demo vs. real data

The dashboard ships with static demo data inline at the top of
`app/(authed)/dashboard/page.tsx` under a clearly-marked
`DEMO DATA` block. Each block has a comment pointing to the sprint that
owns the real fetch. When SP-4 / SP-5 / SP-6 land, **delete the demo
constants — don't rewrite the components**. Component APIs were
designed so the same props work for real data.

## 5. Adding a new dashboard widget

1. Build it under `components/dashboard/<Name>.tsx`.
2. Use `<Card className="bg-surface border-border p-5">` as the
   container.
3. Header: `flex items-center justify-between mb-4`, title is
   `font-semibold tracking-tight`.
4. If interactive (toggles, period selectors), add `'use client'` and
   keep state local until the data sprint wires real fetches.
5. Charts from `@/components/charts/*` — don't roll a new SVG in-line.
6. If you add a new color or radius, register it in `globals.css`
   `@theme inline { … }` first — never hard-code hex outside chart
   components.
