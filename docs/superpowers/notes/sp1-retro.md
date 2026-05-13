# SP-1 Retrospective

**Shipped:** 2026-05-13
**Tag:** `sp1-complete`
**Live:** https://elevate-coaching-two.vercel.app
**Final HEAD:** see `git show sp1-complete`

## What shipped

The "platform spine" — every plumbing piece needed for SP-2 onwards to
land features without revisiting the foundations:

- Next.js 16 + Tailwind 4 + Base UI + lucide-react, all wired to the
  Elevate brand tokens in `app/globals.css` `@theme inline`.
- Supabase auth (email + password) replacing the originally-spec'd
  Clerk. Cookie-based session via `@supabase/ssr`, JWT refresh on
  every request through middleware, RLS-scoped client for normal
  reads, service-role admin client for trigger-driven flows.
- Profiles table with `handle_new_user` trigger replacing the
  originally-planned Clerk webhook.
- Visual surface: branded Logo, Sidebar with active-state gradient
  treatment, TopBar with avatar/upgrade/search, ProgramHero,
  StatCard with chart slot, VideoTutorialCard, plus the rail widgets
  (TodaysTasks, WeeklySchedule, PerformanceOverview) using inline
  SVG chart primitives (Sparkline, CircularProgress, MiniBars).
- Landing page + dashboard + settings + sign-in + sign-up + sign-out.
- GitHub Actions CI: lint · typecheck · format · vitest · build ·
  Playwright e2e on every push to main and every PR.
- Design-system reference doc capturing tokens, type scale, hover
  rules, and the `--font-sans` self-reference trap so future sprints
  don't repeat that mistake.

## What worked

- **Path A scope cut early.** Recognizing that Tasks 35–37's
  category/goals dependencies had no schema and no spec'd taxonomy
  saved hours that would have been wasted on speculative product
  decisions.
- **Demo data in the dashboard.** Letting the page render its full
  visual treatment with static placeholder constants gave us mockup
  parity without blocking on SP-4/5/6 data plumbing. Component APIs
  were designed for the eventual real data — when SP-4 lands the swap
  is "delete demo constants, wire fetches."
- **Migrating mid-execution.** The Clerk→Neon → Supabase pivot
  happened during Phase B; cutting it cleanly via the ADR
  (`2026-05-13-supabase-pivot.md`) and the handover notes meant
  Phases F + G could execute against the new architecture without
  rewriting the plan file.
- **Handover docs at every phase boundary.** Phase F → Phase G handover
  was instrumental — the next session loaded one file and skipped
  reloading 44k+ tokens of plan/spec.
- **Verifying the live CSS, not just the local build.** The font bug
  (commit `7fcbd8e`) was caught by fetching the production CSS file
  with curl and grepping for the self-referential `var()`. Wouldn't
  have shown up in `next build` output.

## What surprised us

- **The `--font-sans` self-reference bug** silently rendered the entire
  authenticated app in a serif fallback for two commits. Inter loaded
  fine, the variable was just invalid. Bigger/heavier display
  typography in the polish pass made it more visible, not less —
  caught only after Jack flagged "fonts look terrible." Lesson: when
  someone says fonts look wrong, check the _resolved_ font on body,
  not whether the font file loaded.
- **Plan-versus-reality drift.** The original SP-1 plan was written
  pre-pivot. Tasks 35, 36, 37 all referenced `withRls()`, `users.plan`,
  `user.category`, `user.goals`, `clerk/nextjs/server` — none of which
  existed. The handover doc's per-task delta tables were essential.
  Future plans should be re-scanned for stale references before each
  phase execution.
- **`x-pathname` header forwarding.** The pattern of "set on response
  headers so server components can read it" is wrong — server
  components read _request_ headers via `next/headers`. Needs to be
  forwarded through `NextResponse.next({ request: { headers } })`.
  Caught only when the user noticed Dashboard didn't light up
  (commit `461abc9`).
- **Vercel CLI v53 quirk** preventing preview env var sync via the
  CLI's own suggested form. Logged in the Phase G handover; preview
  envs remain set via the dashboard manually.

## What to change for SP-2

- **Brainstorm `lib/categories.ts` + `lib/goals.ts` taxonomies before
  writing the migration.** These define product behaviour that
  cascades through onboarding, dashboard widgets, settings, and
  potentially programs filtering. Don't invent on the fly mid-task.
- **Decide schema shape up front:** at minimum `category` (text, ref
  to a domain set), `goals` (text[]), `avatar_url` (text), maybe
  `date_of_birth` and `country` for personalization. Worth a 15-min
  brainstorm before the first migration.
- **Add a mobile-first sidebar pass.** The current sidebar is fixed at
  220px and visible on every viewport. SP-2 should add a hamburger +
  off-canvas drawer at <768px. Currently logged in
  `sp1-acceptance.md` as a known limitation.
- **Get a real athlete photo / video thumbnail asset pipeline in
  place.** The current ProgramHero uses an abstract SVG silhouette and
  VideoTutorialCards use lucide-on-gradient placeholders. They look
  intentional, but won't survive a serious design review.

## Spec accuracy

The plan file (`docs/superpowers/plans/2026-05-13-sp1-platform-spine.md`)
was 80% accurate but consistently lagged the architecture:

- Tasks 35–37 written for Clerk + Neon — actual implementation
  required full rewrite, not paste-with-adaptation.
- Phase I Task 46 (Clerk JWT) → N/A.
- Phase I Task 43 acceptance criteria → 5 of 14 items N/A or deferred.

Recommendation for SP-2 plan: write it AFTER the schema migration,
not before. Plan tasks that reference column names will be stable;
plan tasks that reference SDK shapes drift fast.

## Open follow-ups

These don't block SP-2 but are worth scheduling:

1. **Dead dep:** `@neondatabase/serverless` is still in `package.json`
   (pre-pivot). Remove in a 1-line PR.
2. **Next.js 16 `middleware.ts` → `proxy.ts` migration.** Build warns;
   works for now.
3. **Vercel preview env vars** still not set; PR preview deploys will
   crash at runtime. Set in dashboard.
4. **Pre-existing Vitest test type errors** in `tests/lib/env.test.ts`
   were patched by `tests/types/vite-query-imports.d.ts` — verify
   this is the right approach or replace with vitest-specific
   `vite/client` types.
5. **Mobile sidebar drawer** (see above).
