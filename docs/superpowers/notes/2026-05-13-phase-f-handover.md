# Phase F Handover — Resume Here

**Date:** 2026-05-13
**Repo:** `C:\Users\Jack\Desktop\AI Website\htdocs\Websites\elevate-coaching\`
**Branch:** `main`
**HEAD:** `c798c9f` (Task 27 ✅ done, not yet pushed)
**Remote:** ahead of `origin/main` by 1 commit
**Live:** https://elevate-coaching-git-main-jack-wilsons-projects-79c1513c.vercel.app

## Why this file exists

The previous session loaded the full spec + plan + multiple file reads into context, then dispatched a 3-subagent pipeline (implementer + spec review + code review) for Task 27. That works but burns tokens fast. This file lets the next session resume by reading **one document** instead of reloading 44k+ tokens of plan/spec.

## Status

| Phase | Tasks        | Status                                                  |
| ----- | ------------ | ------------------------------------------------------- |
| A–D   | 1–26         | ✅ done (commits up to `aa15f4e`)                       |
| E     | (eliminated) | Supabase trigger replaces Clerk webhook — see pivot doc |
| **F** | **27–33**    | **1/7 done**                                            |
| G     | 34–41        | not started                                             |
| H–I   | 42+          | not started                                             |

**Task 27** (Logo) committed at `c798c9f`, reviewed (spec + code quality both passed). Note: minor SVG `id="elevate-grad"` collision risk if multiple Logos render on one page — flagged for later, not a blocker.

## Remaining Phase F tasks (6 tasks)

All canonical task text lives in `docs/superpowers/plans/2026-05-13-sp1-platform-spine.md` lines 2200–2605.

- **Task 28** — `components/branded/StatCard.tsx` (mechanical paste, plan lines ~2252)
- **Task 29** — `components/branded/HeroCard.tsx` (mechanical paste, ~2297)
- **Task 30** — `components/layout/Sidebar.tsx` (mechanical paste with one fix, ~2363)
- **Task 31** — `components/layout/TopBar.tsx` (needs **Clerk → Supabase** adaptation, ~2444)
- **Task 32** — `components/layout/RightRail.tsx` (mechanical paste, ~2510)
- **Task 33** — `app/(authed)/layout.tsx` + middleware edit + move dashboard page (needs **Clerk → Supabase** adaptation, ~2544)

## Plan vs. reality deltas (CRITICAL — the plan was written pre-Supabase pivot)

The pivot is documented in `docs/superpowers/notes/2026-05-13-supabase-pivot.md`. The implementer must apply these adaptations when copying code from the plan:

### Profile shape

```ts
// What lib/auth.ts actually returns:
{ user: SupabaseUser, profile: {
  id: string,
  email: string,
  name: string | null,         // ← not full_name
  role: 'user' | 'coach',      // ← not 'user' | 'admin'
  subscription_tier: 'free' | 'basic' | 'pro',  // ← not "plan"
  created_at: string,
  updated_at: string,
}}
```

**No `category`, no `goals`, no `plan` columns yet** — those land in SP-2/SP-3. Phase F does not touch them; if the plan code references them, drop it.

### Task 31 (TopBar) adaptation

Plan shows:

```ts
import { UserButton } from '@clerk/nextjs';
// …
<UserButton afterSignOutUrl="/" />
```

Replace with a custom `Avatar` + `DropdownMenu` containing:

- A `Link href="/settings"` "Settings" item
- A `<form action="/sign-out" method="post">` "Sign out" item (POST endpoint already exists at `app/(auth)/sign-out/route.ts` — verified)

Plan's `userPlan` prop should become `userTier: 'free' | 'basic' | 'pro'` — caller passes `profile.subscription_tier`. Rename internally; the upgrade-CTA condition becomes `userTier !== 'pro'`.

### Task 33 (authed layout) adaptation

Plan shows `getCurrentUser()` (which can return `null`) — use `requireUser()` instead (redirects to `/sign-in`). Destructure `{ profile }`.

Plan's middleware patch uses Clerk. Our middleware (`middleware.ts`) is already Supabase-based. Just add ONE line — set `x-pathname` header on `supabaseResponse` before returning it (and on the redirect responses too, for completeness):

```ts
supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname);
```

**Also:** Task 33 must move the existing `app/dashboard/page.tsx` → `app/(authed)/dashboard/page.tsx` so the new layout actually wraps it. Use `git mv`. The current `app/dashboard/page.tsx` is the Phase D placeholder.

### Mojibake in the plan

The plan file (committed earlier) contains corrupted UTF-8 in emoji glyphs across Tasks 30–36 — they render as `âŒ‚`, `âš™`, `ðŸ’¬`, `âš¡`, `ðŸ””`, `â–¶`, `👋`, etc. **Do not paste those bytes.** Substitute lucide-react icons (already a dep) — clean and consistent:

| Plan glyph (broken)  | Intent        | Replacement                                    |
| -------------------- | ------------- | ---------------------------------------------- |
| `âŒ‚` (Sidebar nav)  | Dashboard     | `<LayoutDashboard className="h-4 w-4" />`      |
| `âš™` (Sidebar nav)  | Settings      | `<Settings className="h-4 w-4" />`             |
| `ðŸ’¬` (Sidebar)     | Message Coach | `<MessageCircle className="h-4 w-4" />`        |
| `âš¡` (TopBar)       | Upgrade Now   | `<Zap className="h-4 w-4" />`                  |
| `ðŸ””` (TopBar)      | Notifications | `<Bell className="h-5 w-5 text-text-muted" />` |
| `â–¶` (HeroCard CTA) | Play          | `<Play className="h-4 w-4" />`                 |

For dashboard page emojis like 👋, 📈, 💪, 🔥, 🎯 (Task 36, Phase G — not now), prefer lucide too, but that's later.

### Tailwind v4 reminder

Brand tokens live in `app/globals.css` `@theme inline { … }`, NOT `tailwind.config.ts`. The classes the plan uses (`bg-surface`, `bg-surface-hover`, `bg-accent`, `text-text`, `text-text-muted`, `text-text-dim`, `border-border`, `rounded-card`, `rounded-pill`, `accent-fg`) are already wired and tested in Phase D. Use them as-is.

## Suggested cheaper workflow for next session

The previous session ran the full superpowers subagent-driven-development pipeline (implementer + spec reviewer + code-quality reviewer) per task. For Phase F that is overkill — most tasks are paste-only with no architectural judgment. Cheaper approach:

1. **Bundle tasks 28, 29, 32 into one implementer dispatch** ("paste these three files, four commits — `feat(SP-1): add StatCard branded component`, etc."). Each task creates exactly one file with code given verbatim in the plan — no judgment needed. Tests not required (plan does not specify them).
2. **Task 30** (Sidebar) — one dispatch. Single file, one commit. Has the mojibake-icon substitution as the only judgment call.
3. **Tasks 31 and 33 keep dual review** — these have real Clerk→Supabase adaptation and merit spec + code-quality review.
4. **Run the controller on Sonnet, not Opus.** Mechanical orchestration doesn't need Opus.
5. **Self-review by the implementer** replaces a separate spec-review subagent for tasks 28–30, 32. The plan code is fully written; the implementer just needs to confirm it pasted correctly and built clean.

If you want to keep the full discipline, that's fine too — but expect ~2× the token cost.

## Verification per task

After each task, the implementer should run (from the repo root):

```powershell
npx tsc --noEmit          # type check
npx prettier --check <changed files>
npx eslint <changed files>
```

End-to-end smoke (after Task 33 only): `npm run dev`, sign in, confirm `/dashboard` renders with sidebar.

## After Phase F

Mark Phase F complete in your TodoWrite. The next chunk is Phase G (Tasks 34–41 — landing page, onboarding flow, dashboard placeholder, settings page). That phase needs `lib/categories.ts` and `lib/goals.ts` helpers (Task 35 will create them).

## Files the next session should read first

1. **This file** — what you're reading now.
2. **`docs/superpowers/notes/2026-05-13-supabase-pivot.md`** — already-loaded context on what changed from the plan.
3. **`docs/superpowers/plans/2026-05-13-sp1-platform-spine.md` lines 2200–2605** — the actual Phase F task text. Use `Read` with `offset: 2200, limit: 410` to grab just this slice.
4. Skim `lib/auth.ts`, `lib/env.ts`, `middleware.ts`, `app/globals.css` if you need a refresher on what's already wired — but the deltas above should be enough.

## Resume command

```
continue Phase F from docs/superpowers/notes/2026-05-13-phase-f-handover.md
```
