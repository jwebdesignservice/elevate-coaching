/**
 * Training categories — the four coach-managed content lanes.
 *
 * Each user picks one of these at onboarding (see `app/onboarding/`). The
 * choice is stored on `profiles.category` and gates which content the user
 * sees in later sprints (programmes in SP-5, nutrition in SP-8, etc.).
 *
 * Source of truth for the codes is the `public.user_category` Postgres enum
 * defined in the SP-2 migration. The literal union below MUST stay in lock-
 * step with that enum — typing comes from `database.types.ts`, but constants
 * for iteration and display info live here.
 */

import type { Database } from './supabase/database.types';

export type Category = Database['public']['Enums']['user_category'];

/**
 * Ordered list of category codes. Order is meaningful — it controls how the
 * onboarding picker renders (Beginner → Fat Loss → Strength → Advanced reads
 * as a soft progression and matches the order in the brief).
 */
export const CATEGORIES = ['A', 'B', 'C', 'D'] as const satisfies readonly Category[];

/**
 * Display info for each category. Keep the copy short — the onboarding card
 * has to be scannable, and the same `name` appears on the dashboard eyebrow
 * and the settings page.
 *
 * - `code`        — the enum value, also used as the radio's form value.
 * - `name`        — the human label shown everywhere (settings, dashboard,
 *                   onboarding headline).
 * - `tagline`     — one-line hook for the onboarding card hero. Imperative.
 * - `description` — body copy for the onboarding card and settings expand.
 */
export const CATEGORY_INFO: Record<
  Category,
  { code: Category; name: string; tagline: string; description: string }
> = {
  A: {
    code: 'A',
    name: 'Beginner',
    tagline: 'Build your base.',
    description:
      'New to structured training or returning after a break. Focus on technique, consistency, and a sustainable weekly routine.',
  },
  B: {
    code: 'B',
    name: 'Fat Loss',
    tagline: 'Lean down, stay strong.',
    description:
      'Body composition, conditioning, and habits. Programmes balance resistance work with calorie-aware conditioning.',
  },
  C: {
    code: 'C',
    name: 'Strength',
    tagline: 'Get bigger and stronger.',
    description:
      'Progressive overload, muscle growth, max-strength work. For users with a solid training base.',
  },
  D: {
    code: 'D',
    name: 'Advanced',
    tagline: 'Train like an athlete.',
    description:
      'High volume, advanced technique, recovery and performance tracking. For 2+ years of consistent training.',
  },
};

/** Type guard — narrows `unknown` to `Category`. Use to validate form input. */
export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Convenience: pull the display `name` for a category code, or a sensible
 * fallback if the input is missing or invalid. Use this anywhere the caller
 * might hold a nullable category (e.g., a user fresh out of sign-up but
 * before onboarding).
 */
export function categoryName(code: Category | null | undefined): string {
  if (!code) return 'No category yet';
  return CATEGORY_INFO[code].name;
}
