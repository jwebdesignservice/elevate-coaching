import type { Config } from "tailwindcss";

/**
 * Tailwind v4 is CSS-first: the canonical Elevate brand tokens
 * live in `app/globals.css` under `@theme inline { ... }`.
 *
 * This file is kept for:
 *   - explicit `content` globs (v4 auto-detects, but listing is documentation)
 *   - `darkMode: 'class'` intent (paired with `@custom-variant dark` in CSS)
 *   - tooling that still reads `tailwind.config.ts`
 *
 * Do not duplicate brand colors here — edit `app/globals.css` instead.
 */
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
} satisfies Config;
