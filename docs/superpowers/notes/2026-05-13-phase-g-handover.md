# Phase G Handover — Resume Here

**Date:** 2026-05-13
**Repo:** `C:\Users\Jack\Desktop\AI Website\htdocs\Websites\elevate-coaching\`
**Branch:** `main`
**HEAD:** `47ddde0` (Phase F complete + RLS-recursion login fix shipped)
**Remote:** in sync with `origin/main`
**Live:** https://elevate-coaching-two.vercel.app (Vercel auto-deploys on push to main)
**Supabase project ref:** `zptxhbblbcaliwezltzp` — https://supabase.com/dashboard/project/zptxhbblbcaliwezltzp
**Vercel project ID:** `prj_NiuYxKRy7ufnzCpeSKwL5PQ6BS5Z` (team `jack-wilsons-projects-79c1513c`)

## Status

| Phase | Tasks                   | Status                                              |
| ----- | ----------------------- | --------------------------------------------------- |
| A–D   | 1–26                    | ✅ done                                             |
| E     | (eliminated)            | Supabase trigger replaces Clerk webhook             |
| F     | 27–33                   | ✅ done last session                                |
| **G** | **34–41**               | **❌ not started — read this file before starting** |
| H     | (renumbered, see below) | not started                                         |
| I     | (renumbered, see below) | not started                                         |

Last session also shipped a critical Phase C follow-up fix:

- `supabase/migrations/20260513151506_fix_profiles_rls_recursion.sql`
- `supabase/migrations/20260513151644_grant_is_coach_anon_execute.sql`

Without these, login was silently broken (Postgres 42P17 in `getCurrentUser()` after sign-in). Both applied via `supabase db push --linked`; verified end-to-end against live Supabase. **Do not revert.**

## Vercel + Supabase state (do NOT re-do this)

- Old Vercel project `prj_DdUCvr55XOcLxSTnhp5mY14FfGd4` was deleted last session per user request.
- New project `prj_NiuYxKRy7ufnzCpeSKwL5PQ6BS5Z` was created, **GitHub repo auto-connected**, 5 production env vars migrated. Live alias: `elevate-coaching-two.vercel.app`.
- **Preview env vars are NOT set** — CLI v53 has a quirk where its own suggested `vercel env add NAME preview --value <v> --yes` form errors with `git_branch_required`. Production deploys are fine. PR previews will crash at runtime until you set them via the Vercel dashboard (Settings → Environment Variables → Preview).
- The local `.vercel/project.json` is correct; don't run `vercel link` again.

## ⚠ Phase G plan is OUT OF SYNC with Supabase pivot — read this carefully

The plan file (`docs/superpowers/plans/2026-05-13-sp1-platform-spine.md`) Tasks 34–41 were written before the Clerk→Supabase pivot. **Most Phase G tasks reference schema, libraries, or APIs that no longer exist or have moved.** Pasting plan code verbatim will not work.

### Schema deltas (CRITICAL)

The plan assumes the `users` / `profiles` table has these columns:

- `category` (enum or text)
- `goals` (text array)
- `plan` (subscription tier)

**Reality:** the live `profiles` table has only `{ id, email, name, role, subscription_tier, created_at, updated_at }`. Per the Phase F handover doc:

> No `category`, no `goals`, no `plan` columns yet — those land in SP-2/SP-3.

This means **Task 35 (onboarding flow), the category/goals widgets in Task 36 (dashboard), and the category/goals sections in Task 37 (settings) cannot be built as written** without first running a schema migration to add those columns.

**This is the single biggest scope decision for the next session.** Two paths:

**Path A — Cut to true SP-1 vertical slice (recommended):**

- Drop Task 35 entirely (defer onboarding to SP-2 when category/goals land).
- Trim Task 36 to: dashboard with TopBar, empty StatCards, "no program yet" HeroCard, RightRail with "Coach Support" / "Quick Tips" placeholders. No category badge, no goals chips.
- Trim Task 37 to: settings with Profile (name/email/tier/role), Billing placeholder, Quick Preferences card, Coach Support card. No category card, no goal-focus card.
- Net SP-1 = the _spine_ (auth + brand + layout + landing + minimal dashboard + minimal settings). Onboarding is the first SP-2 task.

**Path B — Expand SP-1 to include onboarding (more work):**

- Write a schema migration adding `category` and `goals` columns to `profiles` (+ regenerate types).
- Build `lib/categories.ts` and `lib/goals.ts` from scratch (the plan imports them but doesn't define them — they appear to have been deleted at some point or never created).
- Build Task 35 onboarding flow, but rewrite the server action (plan uses `withRls` from `@/lib/db` — that file doesn't exist; the pivot replaced it with Supabase clients in `lib/supabase/`).
- Build full Task 36 + 37 with category/goals widgets.

**Recommend Path A.** Ask the user before assuming.

### File-level deltas — per task

#### Task 34 — Landing page (`app/(public)/page.tsx`)

Plan code is fine _except_ `<Button asChild>` (Phase F finding: this repo uses Base UI, not Radix). Replace with `<Button nativeButton={false} render={<Link href="..." />}>` — exact pattern is in [app/page.tsx](app/page.tsx) (which Task 34 replaces) and is used throughout Phase F components.

Also: the plan uses `<Button asChild size="lg">` — Base UI's Button does accept `size`, confirm via [components/ui/button.tsx](components/ui/button.tsx) (`'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'`).

Plan step says `git rm app/page.tsx` after moving — that's correct; the current `app/page.tsx` is a Phase D placeholder and Next.js's `(public)` route group will surface `app/(public)/page.tsx` at `/`.

**Decision needed for Task 34:** the plan's hero copy is generic. Confirm whether to use it verbatim or refine (eyebrow text, headline, sub, CTA labels) — see plan lines 2645–2664.

#### Task 35 — Onboarding flow

**Path A: skip entirely.**

**Path B caveats:**

- `withRls` import doesn't exist — replace with `createSupabaseServerClient()` from `lib/supabase/server.ts`. RLS is enforced automatically by Supabase based on the JWT in the cookie.
- `requireUser()` returns `{ user, profile }` — destructure `profile.id`, not `userId`/`role`.
- `getCurrentUser()` in the page returns `null | { user, profile }` — guard with `if (!user)` not `if (user.category)`.
- `CATEGORIES`, `CATEGORY_INFO`, `GOALS`, `GOAL_LABEL` from `@/lib/categories` and `@/lib/goals` — **these files do not exist** and the plan never specifies them. Need to invent (or pull from the design spec). Suggested shape:
  ```ts
  // lib/categories.ts
  export const CATEGORIES = ['A', 'B', 'C', 'D'] as const;
  export type Category = (typeof CATEGORIES)[number];
  export const CATEGORY_INFO: Record<
    Category,
    { name: string; description: string; idealFor: string }
  > = {
    /* ... */
  };
  // lib/goals.ts
  export const GOALS = ['build_muscle', 'lose_fat' /* ... */] as const;
  export type Goal = (typeof GOALS)[number];
  export const GOAL_LABEL: Record<Goal, string> = {
    /* ... */
  };
  ```

#### Task 36 — Dashboard rebuild (`app/(authed)/dashboard/page.tsx`)

The Phase D placeholder is currently at this exact path; Task 36 **overwrites** it. The Phase F Sidebar already wraps it via `app/(authed)/layout.tsx`.

Plan-vs-reality deltas:

- `user.plan` → `profile.subscription_tier`.
- `user.category`, `user.goals` → don't exist (Path A: drop those sections; Path B: add them after the schema migration).
- `TopBar` prop `userPlan` → was renamed to `userTier` in Phase F (Task 31). Also pass the new `userName={profile.name}` prop (Phase F added it for avatar initial).
- Mojibake emojis in plan (`ðŸ‘‹`, `ðŸ“ˆ`, `ðŸ’ª`, `ðŸ”¥`, `ðŸŽ¯`) — substitute lucide-react (`PartyPopper`/`Hand`, `TrendingUp`, `Dumbbell`, `Flame`, `Target`).
- `StatCard` takes `icon: ReactNode`, not a string — pass `<TrendingUp className="h-4 w-4" />` not `"📈"`.
- `HeroCard` primary CTA — plan passes `{ label: 'Learn more', href: '/settings' }`. Phase F's HeroCard already renders the Play icon next to the label; keep the label as-is.
- The HeroCard CTA href `/settings` requires Task 37 to exist (or accept the redirect-loop gracefully).

#### Task 37 — Settings page (`app/(authed)/settings/page.tsx`)

**Major rewrites required.**

- Plan imports `currentUser` from `@clerk/nextjs/server` — **Clerk is GONE**. Replace with `requireUser()` from `@/lib/auth`. Use `profile.name` (already in profile shape) and `profile.email`. The plan's `firstName`/`lastName` split doesn't apply — we only have a single `name` field.
- Same `user.plan` → `profile.subscription_tier`.
- Same drop category / goals sections under Path A.
- Plan emoji `📅` → `<Calendar className="h-4 w-4" />`.

#### Task 38 — e2e signup-flow Playwright test

- Plan test mentions "Clerk dev instance" and "Clerk test mode" — **replace with Supabase**. Playwright is already a dep (Phase A commit `0aee610`). Confirm `playwright.config.ts` exists — if not, scaffold one (`npx playwright init` was likely run, but verify).
- Test 1 ("lands on landing page") — needs the landing page heading text from whatever Task 34 actually ships. Match exactly.
- Test 2 ("protected routes redirect") — already proven to work in Phase F's smoke test (curl `/dashboard` returned 307 → `/sign-in`). Should pass.
- Test 3 ("sign-up renders form") — the existing sign-up page is at [app/(auth)/sign-up/page.tsx](<app/(auth)/sign-up/page.tsx>); confirm test selector matches what it actually renders (it's a custom shadcn form, NOT a Clerk-hosted iframe).

#### Tasks 39–41 — CI + push + deploy

**Mostly already done or pre-empted.**

- **Task 39 (GitHub Actions CI):** plan-supplied workflow uses Clerk env vars (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`). Replace with Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus `NEXT_PUBLIC_COACH_WHATSAPP` and `NEXT_PUBLIC_COACH_CALENDLY` from `env.ts`). Use stub values for CI typecheck/build. Also: `npm run lint` script is `eslint`, `npm test` is `vitest run`, there's no `npm run typecheck` or `npm run format:check` yet — either add those scripts to `package.json` or call the binaries directly (`npx tsc --noEmit`, `npx prettier --check .`).
- **Task 40 (push to GitHub):** ✅ already done. Repo is `jwebdesignservice/elevate-coaching`, `main` branch, in sync.
- **Task 41 (Vercel deploy):** ✅ already done. Live at `elevate-coaching-two.vercel.app`. The plan's Step 2 ("update Clerk webhook URL") is N/A — there is no Clerk webhook anymore. Supabase trigger handles user creation.

So Phase G effectively reduces to: Task 34 + (Path A: trimmed 36 + trimmed 37 + adapted 38 + adapted 39) OR (Path B: schema migration + categories/goals libs + 35 + full 36 + full 37 + adapted 38 + adapted 39).

## Suggested workflow for next session

1. **Confirm Path A vs Path B with the user** before writing any code.
2. If Path A: 4 tasks, mostly mechanical paste + Phase F's adaptation patterns. Estimate 1 hour.
3. If Path B: schema migration + 2 new lib files + 4 tasks with full data wiring. Estimate 2–3 hours.
4. Use the same per-task verification as Phase F: `npx tsc --noEmit` (ignore the pre-existing `tests/lib/env.test.ts` 2 errors), `npx prettier --write <file>` (or `--check`), `npx eslint <file>`.
5. End-to-end smoke after Task 36: sign up at the live URL, reach `/dashboard`, confirm Sidebar + new dashboard content render.

## Phase F-era patterns that carry forward (do not re-discover)

1. **Button** is Base UI, not Radix. No `asChild`. Use `nativeButton={false} render={<Link/>}` or `render={<a/>}`. See existing usage in [app/page.tsx](app/page.tsx) and Phase F components.
2. **DropdownMenuItem** also uses Base UI's `render` prop — see Phase F's TopBar.
3. **Brand tokens** live in `app/globals.css` `@theme inline`. Both `text-accent-fg` and `text-accent-foreground` exist and are aliases of `#003d2b`. Use whichever the plan/spec specifies; either works.
4. **lucide-react** is installed; use it for every icon. Plan has mojibake'd emoji glyphs that must be substituted.
5. **The plan file itself has mojibake** in many places — render `â—¦`, `â–¶`, `ðŸ’¬`, etc. — never paste these bytes; substitute with lucide icons.
6. **Pre-existing TSC errors** in `tests/lib/env.test.ts` (`@/lib/env?reset`, `@/lib/env?fresh`) — Vitest runs them fine at runtime; ignore for now. One-line `*.d.ts` could fix them — not in scope.
7. **Next.js 16:** the `middleware.ts` file convention is deprecated; Next 16 wants `proxy.ts`. Build warns but works. Migration is whole-repo and out of Phase G scope — flag, defer.

## Files the next session should read first

1. **This file** — what you're reading now.
2. **`docs/superpowers/notes/2026-05-13-supabase-pivot.md`** — ADR; explains why Clerk and Neon are gone and what replaced them.
3. **`docs/superpowers/notes/2026-05-13-phase-f-handover.md`** — Phase F's adaptation patterns. The Button + DropdownMenu + lucide + Tailwind-v4 findings all apply unchanged to Phase G.
4. **Plan slice `docs/superpowers/plans/2026-05-13-sp1-platform-spine.md` lines 2607–3168** — the actual Phase G task text. **Treat it as a draft, not gospel.** Use `Read` with `offset: 2607, limit: 562`.
5. **`lib/auth.ts`, `lib/supabase/server.ts`, `lib/supabase/database.types.ts`** — confirm profile shape and helper signatures haven't changed since Phase F.

## Resume command

```
continue Phase G from docs/superpowers/notes/2026-05-13-phase-g-handover.md
```

**First message in the new session** should also include: "Choose Path A or Path B (see handover § scope deltas) before writing any code."
