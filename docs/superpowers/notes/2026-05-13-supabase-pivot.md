# Supabase Pivot — Architecture Decision Record

**Date:** 2026-05-13
**Status:** Accepted, in progress
**Decision-maker:** Jack (project owner)
**Triggers:** Mid-Phase B execution, before any auth code was written

## Decision

Replace **Clerk + Neon** (original SP-1 spec) with **Supabase** (Postgres + Auth + Storage + Edge Functions) for the Elevate Coaching training platform.

## Context

- The original SP-1 spec & plan (committed `730a6e9`, `a7886f2`, `637eb34`) used Clerk for auth and Neon for Postgres, with a custom Clerk webhook handler for user lifecycle sync.
- Mid-execution, the question arose: isn't this just Supabase with extra steps? Yes.
- Project profile: solo developer, small-scale paid product (400–1000 users, £150–£300/mo subs), Supabase MCP already configured in the dev environment, no enterprise auth requirements.

## What changes

### Removed

- `@clerk/nextjs` package (was installed Task 2; uninstalled in this pivot)
- `svix` package (was installed Task 2 for Clerk webhook signature verification; uninstalled)
- Phase E entirely (Tasks 24–26: Clerk webhook handler + idempotency + integration tests). Supabase database trigger on `auth.users INSERT` replaces this with a single SQL function.
- Plan Tasks 9, 10 (separate Neon + Clerk provisioning).
- env vars: `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`.

### Added

- `@supabase/ssr@^0.5` (server-side rendering helpers, cookie-based session)
- `@supabase/supabase-js@^2.45` (JS client SDK)
- env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- New Supabase project (created out-of-org from MCP; managed manually for now)

### Modified

- `lib/env.ts` — Supabase vars replace Clerk/DB vars
- `.env.example` — same
- `tests/lib/env.test.ts` — same
- Phase D plan: replace Clerk middleware/provider with `@supabase/ssr` cookie-based middleware + server/browser client factories
- Phase C plan: schema uses `auth.users` (Supabase-managed) as FK target; RLS uses `auth.uid()` directly (no Clerk-JWT-to-PG-session-var bridging)
- Phase F-G: `useUser()` becomes Supabase's `supabase.auth.getUser()` (server-side) or `useUser()` from `@supabase/auth-helpers-react` (client-side)

### Unchanged

- Phase A entire foundation (Tasks 1–8) — Next.js, TS, Tailwind 4, shadcn v4, brand tokens, Inter, Sentry config, Prettier
- Brand tokens / dark theme / visual design
- All shadcn primitives
- Vercel project (`prj_DdUCvr55XOcLxSTnhp5mY14FfGd4`) — still the hosting target
- GitHub repo (`jwebdesignservice/elevate-coaching`) — still the source
- Phases F, G, H, I plan tasks (component build, pages, deploy, verification) — semantically identical

## Trade-offs accepted

|                      | We accept                                                                                                                 | Because                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth UX polish**   | Slightly less polished default than Clerk's drop-in components                                                            | Building custom sign-in/up with shadcn + Supabase Auth gets us 90% there; the remaining gap doesn't justify a second dashboard + double webhook surface |
| **Provider lock-in** | Tighter coupling to one vendor (auth + db + storage in one)                                                               | Less likely to swap a $25/mo SaaS than to migrate a 1000-row Postgres                                                                                   |
| **MCP access**       | The new Supabase project is not in the MCP-accessible org, so we manage it via dashboard + CLI rather than MCP automation | One-time setup friction; ongoing dev unaffected                                                                                                         |

## Supabase project details

- **Project ref:** `zptxhbblbcaliwezltzp`
- **Dashboard:** https://supabase.com/dashboard/project/zptxhbblbcaliwezltzp
- **Region:** TBD (user created, region not confirmed here)
- **Plan:** Free tier (new org for this purpose)
- **MCP access:** None (different org from the MCP-bound account)

## Migration path within the live plan

The committed plan (`docs/superpowers/plans/2026-05-13-sp1-platform-spine.md`) still describes Clerk + Neon. **This document supersedes those sections** for:

- Task 6 (env validation — already rewritten)
- Task 9 (Neon project) — N/A, replaced by Supabase project creation (already done by user)
- Task 10 (Clerk project) — N/A, ditto
- Tasks 22–23 (Clerk middleware + provider) — use `@supabase/ssr` instead
- Tasks 24–26 (Clerk webhook) — DELETE; replaced by `auth.users` INSERT trigger
- Task 12 (Vercel env vars) — push Supabase vars instead of Clerk vars

The original plan file is preserved as-is to maintain the git story; this delta file is the source of truth for Supabase-related decisions going forward.

## Open questions

- [ ] Should we use Supabase's hosted email auth or add a social provider? (TBD — start with email magic link, add Google later)
- [ ] Storage bucket policy for progress photos / video thumbnails (Phase F-G)
- [ ] Edge Functions vs Next.js API routes for any backend that doesn't fit RSC (likely use Next.js routes; only Edge Functions for DB-trigger-attached logic)
