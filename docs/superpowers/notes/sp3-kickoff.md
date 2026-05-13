# SP-3 Kickoff

**Task:** Implement SP-3 — Stripe + Plan Gating for the Elevate Coaching platform.
**Spec:** `docs/superpowers/specs/2026-05-13-sp3-stripe-plan-gating-design.md` — read this first. All decisions are locked; do not re-brainstorm.
**Branch:** create `sp3-stripe-plan-gating` from `main` (SP-2 should be merged before starting).

---

## Project snapshot

- **Stack:** Next.js 16 App Router, TypeScript, Tailwind 4, Base UI, Supabase (auth + DB), Vercel
- **Project root:** `C:\Users\Jack\Desktop\AI Website\htdocs\Websites\elevate-coaching`
- **Supabase project ref:** `zptxhbblbcaliwezltzp`
- **Test env vars** to set in `.env.local` before running (Jack provides values):
  - `STRIPE_SECRET_KEY` (starts `sk_test_…`)
  - `STRIPE_WEBHOOK_SECRET` (starts `whsec_…`)
  - `STRIPE_BASIC_PRICE_ID` (starts `price_…`)
  - `STRIPE_PRO_PRICE_ID` (starts `price_…`)

---

## What SP-3 ships (summary — spec §3 has full detail)

1. DB migration — `stripe_customer_id`, `stripe_subscription_id`, `subscription_period_end` on `profiles`; tightened RLS (billing columns are service-role only)
2. `lib/plans.ts` — `hasPlanAtLeast(tier, required)` primitive
3. `lib/stripe.ts` — singleton Stripe client, `PRICE_IDS`, `tierFromPriceId()`
4. `POST /api/stripe/checkout` — server-redirect Checkout (no client-side Stripe JS)
5. `POST /api/stripe/portal` — Customer Portal session
6. `POST /api/stripe/webhook` — syncs `subscription_tier` to DB; excluded from auth middleware
7. `/pricing` public page — two cards (Basic £150/mo, Pro £300/mo), CTA adapts to auth + tier state
8. Settings subscription card — tier badge, "Access until" date, portal/upgrade CTA
9. Landing nav — add "Pricing" link
10. `env.ts` additions — 4 new Stripe vars (server-only)
11. Types regen after migration
12. Tests — Vitest for `lib/plans.ts` + webhook handler; Playwright smoke for `/pricing`

---

## Implementation phases (from spec §15)

| Phase | Work |
|---|---|
| A | Migration + `env.ts` additions + types regen |
| B | `lib/plans.ts` + Vitest unit tests |
| C | `lib/stripe.ts` + install `stripe` npm package |
| D | API routes: checkout, portal, webhook |
| E | `/pricing` public page |
| F | Settings subscription card |
| G | Landing nav Pricing link |
| H | Playwright smoke test + acceptance check + retro stub |

Commit each phase independently. Phase A must land first.

---

## Key codebase patterns (do not deviate)

### Supabase server client
```typescript
// Standard server client (uses authed user's session via cookies)
import { createSupabaseServerClient } from '@/lib/supabase/server';
const supabase = await createSupabaseServerClient();

// Service-role client (bypasses RLS — webhook only)
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
const supabase = createSupabaseServiceRoleClient();
```
Check `lib/supabase/server.ts` — service-role client may need to be added if not present.

### Supabase TypeScript write-cast pattern
The project's `@supabase/postgrest-js` types `.update()` / `.insert()` as `never`. Use:
```typescript
// Writes
await supabase.from('profiles').update({ stripe_customer_id: cid } as never).eq('id', uid);

// Reads
const { data: raw } = await supabase.from('profiles').select('subscription_tier').eq('id', uid).single();
const profile = raw as { subscription_tier: 'free' | 'basic' | 'pro' };
```

### Server actions use `'use server'` + `redirect()` from `next/navigation`
See `app/onboarding/_actions.ts` for the established pattern.

### API routes return JSON; client does `router.push(url)` for Stripe redirects
No client-side Stripe.js / `loadStripe()` needed — Checkout is a server-generated URL.

### Middleware exclusions
Add `/api/stripe/webhook` to the matcher exclusion list in `middleware.ts` alongside `/auth/`:
```
'/((?!_next/static|_next/image|favicon.ico|auth/|api/stripe/webhook|api/|.*\\.(?:svg|...)$).*)'
```
Actually check the current matcher — `api/` may already be excluded. Webhook must not have auth middleware intercepting it.

### Env validation
`lib/env.ts` uses Zod with a build-phase guard (`NEXT_PHASE === 'phase-production-build'`).
Add the 4 new Stripe vars to the schema there.

---

## Existing files to know

| File | Purpose |
|---|---|
| `lib/env.ts` | Zod env schema — add Stripe vars here |
| `lib/supabase/server.ts` | Supabase client factory |
| `lib/supabase/database.types.ts` | Generated types — regen after migration |
| `supabase/migrations/` | Migration history — add SP-3 file here |
| `app/(authed)/settings/page.tsx` | Settings page — add subscription card |
| `app/(public)/page.tsx` | Landing page — add Pricing nav link |
| `middleware.ts` | Auth middleware — add webhook to exclusion list |
| `app/(auth)/sign-in/page.tsx` | Sign-in page (reference for auth page pattern) |

---

## Pre-flight checklist (before writing any code)

- [ ] SP-2 PR merged to `main`
- [ ] SP-2 migration applied to live Supabase project (`supabase db push`)
- [ ] `stripe` npm package installed (`npm install stripe`)
- [ ] Stripe products + prices created in Stripe Dashboard (test mode); price IDs in hand
- [ ] `.env.local` has all 4 Stripe vars set

---

## Starting instructions for the new session

1. Read this file + `docs/superpowers/specs/2026-05-13-sp3-stripe-plan-gating-design.md` (the full spec)
2. Invoke the `writing-plans` skill to produce the implementation plan
3. Implement phase by phase, committing after each
4. Do not deviate from the locked decisions in the spec
