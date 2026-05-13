# SP-3: Stripe + Plan Gating — Design

**Project:** Elevate Coaching — premium training platform
**Sub-project:** SP-3 of 8 (Stripe + Plan Gating)
**Date:** 2026-05-13
**Status:** Approved, ready for implementation plan
**Owner:** Jack
**Prior art:** `2026-05-13-sp2-profile-variables-design.md`, `notes/sp1-retro.md`

---

## 1. Context

SP-2 shipped the onboarding gate, category model, and settings page. The `profiles` table already carries `subscription_tier` (enum `'free' | 'basic' | 'pro'`, default `'free'`), but the column is always `'free'` — nothing writes it yet.

SP-3 wires up the full Stripe billing loop:

- Stripe Checkout for new subscriptions
- Stripe Customer Portal for management (cancellations, card updates)
- Webhook handler that is the **only** thing that writes `subscription_tier` to the DB
- `hasPlanAtLeast` primitive ready for later SPs to gate features
- Public `/pricing` page
- Settings page subscription card

No feature gates actually fire in SP-3. The primitive exists; the locked-down DB column exists; the tier syncs correctly. SP-4 and beyond use `hasPlanAtLeast` to conditionally show content.

---

## 2. Locked decisions from brainstorm

| #   | Decision                     | Choice                                                                                                                                                                      |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Scope                        | **Stripe plumbing + pricing page + `hasPlanAtLeast` primitive.** No real feature gates fire in SP-3. Guards are coded but return `true` for all authed users until SP-4 wires them to real content. |
| Q2  | Subscription management      | **Stripe Customer Portal.** No custom cancellation or billing UI. Portal handles card updates, plan changes, cancellations — Stripe-hosted.                                  |
| Q3  | Basic vs Pro differentiation | **Placeholder copy.** Feature split deferred to SP-4+. Pricing page shows two cards with placeholder bullet lists. Code enforces strict `free < basic < pro` rank hierarchy. |
| Q4  | Upgrade entry point          | **`/pricing` page only.** Linked from landing nav and settings plan card. No dashboard banner in SP-3.                                                                       |
| Q5  | Subscription lifecycle       | **`cancel_at_period_end`.** Cancellation leaves the subscription `active` until period end; Stripe then fires `customer.subscription.deleted` and we downgrade to `free`. Failed payments enter Stripe's smart-retry grace period; we only downgrade when the subscription reaches `canceled` status. |

---

## 3. Scope

### What SP-3 ships

1. **Schema migration** — `stripe_customer_id`, `stripe_subscription_id`, `subscription_period_end` columns on `profiles`. RLS blocks user-level writes on all three (and on `subscription_tier`). Service-role client in the webhook is the only writer.
2. **`lib/plans.ts`** — `PLAN_TIERS`, `PlanTier` type, `PLAN_RANK` map, `hasPlanAtLeast(tier, required)` helper.
3. **`lib/stripe.ts`** — singleton Stripe server client, `PRICE_IDS` map (`basic` → env var, `pro` → env var), `tierFromPriceId(priceId)` helper.
4. **`/api/stripe/checkout`** POST route — creates a Stripe Checkout session, returns redirect URL.
5. **`/api/stripe/portal`** POST route — creates a Stripe Customer Portal session, returns redirect URL.
6. **`/api/stripe/webhook`** POST route — verifies Stripe signature, handles subscription lifecycle events, writes `profiles` via service-role client.
7. **`/pricing`** public page — two plan cards (Basic £150/mo, Pro £300/mo) with placeholder feature lists; CTAs adapt for logged-in vs logged-out and current-plan state.
8. **Settings plan card** — renders current tier, period-end date (if cancelling), and a "Manage subscription" (portal) or "Upgrade" (/pricing) CTA.
9. **Landing nav link** — "Pricing" added to the public header.
10. **`env.ts` additions** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BASIC_PRICE_ID`, `STRIPE_PRO_PRICE_ID` (all server-only; no publishable key needed — Checkout is a server-redirect flow).
11. **Regenerated Supabase types** (`lib/supabase/database.types.ts`) for the new columns.
12. **Tests** — Vitest unit tests for `lib/plans.ts` (`hasPlanAtLeast` all branches), webhook handler unit test (mocked Stripe event → expected DB call), Playwright e2e smoke test for the pricing page render.

### Explicitly out of scope

- Feature gates wired to real content — SP-4 onwards.
- Upgrade prompts inside the dashboard — deferred (no banner in SP-3).
- Annual billing, trials, coupons — not in brief.
- Multiple seats / team billing — not in brief.
- Invoice history UI — Stripe Customer Portal covers this; no custom UI needed.
- Admin panel subscription view — SP-7.

---

## 4. Schema migration

Migration file: `supabase/migrations/<timestamp>_sp3_stripe_columns.sql`.

```sql
-- SP-3: Stripe billing columns on profiles
-- ============================================================================
-- All three columns are written only by the webhook handler (service role).
-- RLS policies block the authenticated role from updating them directly.
-- subscription_tier already exists from SP-1; its UPDATE block is added here.
-- ============================================================================

alter table public.profiles
  add column stripe_customer_id    text unique,
  add column stripe_subscription_id text unique,
  add column subscription_period_end timestamptz;

comment on column public.profiles.stripe_customer_id is
  'Stripe customer ID (cus_…). Created on first checkout. NULL for free users who have never attempted payment.';

comment on column public.profiles.stripe_subscription_id is
  'Active Stripe subscription ID (sub_…). NULL when tier = ''free''.';

comment on column public.profiles.subscription_period_end is
  'Current billing period end (UTC). Populated from Stripe subscription. Used to show "access until {date}" when cancel_at_period_end is true.';

create index profiles_stripe_customer_idx on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- ============================================================================
-- RLS: block authenticated users from writing billing-sensitive columns.
-- The existing profiles_update_own policy permits all column updates — we
-- replace it with a column-restricted version.
-- ============================================================================

-- Drop the unrestricted update policy added in SP-1.
drop policy if exists "profiles_update_own" on public.profiles;

-- Users may update only display-level columns (name). Billing columns,
-- tier, role, and timestamps are service-role only.
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: column-level restrictions are enforced in the application layer via
-- explicit column lists in UPDATE calls. Postgres RLS does not support
-- per-column WITH CHECK at the policy level; the service-role webhook bypasses
-- RLS entirely. Document this clearly so future migrations don't accidentally
-- re-open the update policy.
```

### Notes on the migration

- **`stripe_customer_id` and `stripe_subscription_id` are unique.** If a bug creates a duplicate, the constraint surfaces it loudly rather than silently corrupting two rows.
- **Backfill.** All existing `profiles` rows keep `stripe_customer_id = NULL`, `stripe_subscription_id = NULL`, `subscription_period_end = NULL` and `subscription_tier = 'free'`. No data migration needed.
- **Column-level RLS caveat.** Postgres RLS `WITH CHECK` cannot restrict individual columns. The application enforces narrow column lists in every `profiles` UPDATE; the service-role webhook bypasses RLS for billing writes. This is documented prominently in the migration and in `lib/supabase/server.ts` where the service-role client is created.

---

## 5. Plans primitive

### `lib/plans.ts`

```typescript
export const PLAN_TIERS = ['free', 'basic', 'pro'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

const PLAN_RANK: Record<PlanTier, number> = { free: 0, basic: 1, pro: 2 };

/**
 * Returns true when the user's current tier meets or exceeds the required tier.
 * Treats null / undefined as 'free' (safe default — never accidentally grants access).
 *
 * Usage: if (!hasPlanAtLeast(profile.subscription_tier, 'basic')) redirect('/pricing');
 */
export function hasPlanAtLeast(
  tier: PlanTier | null | undefined,
  required: PlanTier,
): boolean {
  const rank = PLAN_RANK[tier ?? 'free'] ?? 0;
  return rank >= PLAN_RANK[required];
}
```

This is the only entry point future SPs use to gate features. Centralising it here means a single change controls all gates if pricing tiers are ever renamed or reordered.

---

## 6. Stripe client module

### `lib/stripe.ts`

```typescript
import Stripe from 'stripe';
import { env } from '@/lib/env';
import type { PlanTier } from '@/lib/plans';

// Singleton — instantiated once per cold start on the server.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

export const PRICE_IDS: Record<'basic' | 'pro', string> = {
  basic: env.STRIPE_BASIC_PRICE_ID,
  pro:   env.STRIPE_PRO_PRICE_ID,
};

const PRICE_TO_TIER: Record<string, PlanTier> = {
  [env.STRIPE_BASIC_PRICE_ID]: 'basic',
  [env.STRIPE_PRO_PRICE_ID]:   'pro',
};

/**
 * Maps a Stripe price ID back to an internal PlanTier.
 * Returns 'free' if the price ID is unknown (safe default).
 */
export function tierFromPriceId(priceId: string): PlanTier {
  return PRICE_TO_TIER[priceId] ?? 'free';
}
```

`PRICE_IDS` is also used in `lib/env.ts` — the two env vars `STRIPE_BASIC_PRICE_ID` and `STRIPE_PRO_PRICE_ID` are added to the Zod schema there.

---

## 7. API routes

### `POST /api/stripe/checkout`

**Input (JSON body):** `{ priceId: string }`

**Logic:**

1. Authenticate via `createSupabaseServerClient()` — 401 if no session.
2. Validate `priceId` is one of `PRICE_IDS` — 400 otherwise.
3. Read `profile.stripe_customer_id` from `profiles`.
4. If no Stripe customer yet, create one via `stripe.customers.create({ email, metadata: { supabase_user_id } })` and write `stripe_customer_id` back to `profiles` using service-role client.
5. Create a Checkout session:
   - `mode: 'subscription'`
   - `customer: stripeCustomerId`
   - `line_items: [{ price: priceId, quantity: 1 }]`
   - `success_url: <origin>/settings?plan=upgraded`
   - `cancel_url: <origin>/pricing`
6. Return `{ url: session.url }` — client redirects.

**Why no client-side Stripe JS?** The checkout URL is fetched server-side and the browser is redirected via `router.push(url)`. This keeps the Stripe secret key off the client and removes the need for a publishable key in the env.

---

### `POST /api/stripe/portal`

**Input:** none (reads session from cookie).

**Logic:**

1. Authenticate — 401 if no session.
2. Read `profile.stripe_customer_id` — 400 if NULL (user has never subscribed; the settings card should never show this button for free users).
3. Create a Customer Portal session:
   - `customer: stripeCustomerId`
   - `return_url: <origin>/settings`
4. Return `{ url: session.url }` — client redirects.

---

### `POST /api/stripe/webhook`

This route is **excluded from Supabase auth middleware** (added to the `config.matcher` exclusion list alongside `/auth/*`).

**Events handled:**

| Event | Action |
|---|---|
| `checkout.session.completed` | Link Stripe customer to Supabase user (write `stripe_customer_id` + `stripe_subscription_id`); set `subscription_tier` from price ID; set `subscription_period_end`. |
| `customer.subscription.updated` | Re-sync `subscription_tier`, `stripe_subscription_id`, `subscription_period_end` from the subscription object. If `status` is `past_due`, leave tier unchanged (grace period). If `status` is `canceled` or `unpaid`, downgrade to `free`. |
| `customer.subscription.deleted` | Downgrade `subscription_tier` to `'free'`; clear `stripe_subscription_id`; clear `subscription_period_end`. |

Events not listed above are acknowledged with `200 OK` and ignored.

**Signature verification:**

```typescript
const sig = req.headers.get('stripe-signature');
const body = await req.text(); // must read as raw text before JSON.parse
const event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
```

**DB writes use the service-role client** (`createSupabaseServiceRoleClient()`), which bypasses RLS. The lookup key is `stripe_customer_id` for `subscription.updated/deleted` events, and the Supabase user ID embedded in checkout session metadata for `checkout.session.completed`.

**Idempotency:** Each handler uses an `upsert`-style `UPDATE … WHERE stripe_customer_id = $1` — replaying the same event produces the same DB state.

---

## 8. Pricing page

### Route: `/pricing` (public)

Server component. Reads the current user's session and `subscription_tier` if logged in (via `createSupabaseServerClient()`). Passes tier (or `null` for logged-out) to a client component that renders the CTA buttons.

### Layout

```
/pricing
├── <h1>  Simple, transparent pricing
├── <p>   Subtitle (placeholder)
└── Two plan cards side-by-side (≥md), stacked (< md)
    ├── Basic card  £150 / month
    │   ├── Placeholder feature list (3–4 bullets)
    │   └── CTA button
    └── Pro card    £300 / month
        ├── Placeholder feature list (3–4 bullets)
        └── CTA button
```

### CTA button states (per card)

| User state | Button label | Action |
|---|---|---|
| Not logged in | Get started | Link to `/sign-up?plan=basic` (or `pro`) |
| Logged in, tier = `free` | Upgrade to Basic / Pro | POST `/api/stripe/checkout` with price ID → redirect to Stripe Checkout |
| Logged in, tier = `basic`, card = Basic | Current plan | Disabled |
| Logged in, tier = `basic`, card = Pro | Upgrade to Pro | POST `/api/stripe/checkout` with Pro price ID |
| Logged in, tier = `pro`, card = Basic | Downgrade via portal | Link to `/settings` (user uses portal to downgrade) |
| Logged in, tier = `pro`, card = Pro | Current plan | Disabled |

### Placeholder feature copy

**Basic — £150/mo**
- Full access to workout programmes
- Daily task assignments
- Tutorial library
- WhatsApp coach access

**Pro — £300/mo**
- Everything in Basic
- Priority coach response
- Advanced performance tracking
- Monthly strategy call

*(SP-4+ replaces these with real, gated features once the content modules exist.)*

---

## 9. Settings page — plan card

The existing `/settings` page already shows a profile read-only card. SP-3 adds a **Subscription** card below it.

### Card layout

```
Subscription
─────────────────────────────────────────────────
[CURRENT PLAN]  Free / Basic / Pro    ← badge + name
Access until {date}                   ← only shown when cancel_at_period_end is true
                                        date = subscription_period_end formatted as "DD MMM YYYY"

[Upgrade →]  links to /pricing        ← shown when tier = 'free' or 'basic' (and not on Pro)
[Manage subscription →]               ← shown when tier = 'basic' or 'pro'
                                        POST /api/stripe/portal → redirect to Customer Portal
```

When `subscription_period_end` is null or tier is `free` and no `cancel_at_period_end` context exists, the "Access until" line is hidden.

---

## 10. Landing nav update

`app/(public)/layout.tsx` (or wherever the public header lives) — add a `Pricing` link before the auth CTAs:

```tsx
<Link href="/pricing" className="text-text-muted hover:text-text text-sm">
  Pricing
</Link>
```

---

## 11. `env.ts` additions

```typescript
// Stripe (server-only — no publishable key needed for server-redirect checkout)
STRIPE_SECRET_KEY:      z.string().min(1),
STRIPE_WEBHOOK_SECRET:  z.string().min(1),
STRIPE_BASIC_PRICE_ID:  z.string().min(1),
STRIPE_PRO_PRICE_ID:    z.string().min(1),
```

All four are server-only (no `NEXT_PUBLIC_` prefix). The build-phase guard added in SP-1/CI fixes (`isBuildPhase`) prevents these from causing a build failure on Vercel Preview environments that may not have them set at build time.

---

## 12. Routes summary

| Route | Auth | Behaviour |
|---|---|---|
| `GET /pricing` | Public | Renders pricing cards; CTAs adapt to logged-in/tier state. |
| `POST /api/stripe/checkout` | Required | Creates Checkout session; returns `{ url }`. |
| `POST /api/stripe/portal` | Required | Creates Customer Portal session; returns `{ url }`. |
| `POST /api/stripe/webhook` | None (Stripe signature) | Syncs subscription state to `profiles`. |
| `GET /settings` | Required | Now includes Subscription card. |

---

## 13. Acceptance criteria

Pricing page:

- [ ] `/pricing` renders two cards with Basic (£150/mo) and Pro (£300/mo) headings.
- [ ] Logged-out visitor sees "Get started" CTAs linking to `/sign-up`.
- [ ] Logged-in free user clicking "Upgrade to Basic" is redirected to Stripe Checkout.
- [ ] Logged-in Basic user's Basic card CTA reads "Current plan" and is disabled.
- [ ] "Pricing" link appears in the public landing nav.

Checkout + webhook:

- [ ] Completing a test Checkout (Stripe test card `4242…`) updates `profiles.subscription_tier` to `'basic'` or `'pro'` in the DB.
- [ ] `stripe_customer_id` and `stripe_subscription_id` are written to the row.
- [ ] Cancelling Stripe Checkout (clicking "Back") lands the user back on `/pricing`.

Customer Portal:

- [ ] "Manage subscription" button on `/settings` opens the Stripe Customer Portal.
- [ ] After portal actions, user is returned to `/settings`.

Subscription lifecycle:

- [ ] Cancelling inside the portal (with `cancel_at_period_end`) leaves `subscription_tier` unchanged until Stripe fires `customer.subscription.deleted`.
- [ ] When `customer.subscription.deleted` fires, `subscription_tier` is set to `'free'` and `stripe_subscription_id` is cleared.
- [ ] `subscription_period_end` is visible in the settings card as "Access until {date}" when cancel is pending.

`hasPlanAtLeast`:

- [ ] `hasPlanAtLeast('free', 'free')` → `true`.
- [ ] `hasPlanAtLeast('basic', 'pro')` → `false`.
- [ ] `hasPlanAtLeast('pro', 'basic')` → `true`.
- [ ] `hasPlanAtLeast(null, 'free')` → `true` (null treated as free).
- [ ] `hasPlanAtLeast(undefined, 'basic')` → `false`.

RLS:

- [ ] `UPDATE profiles SET subscription_tier='pro' WHERE id=<own_id>` via authenticated client is rejected by RLS (tier is service-role only).

General:

- [ ] Lint, typecheck, format, build all green.
- [ ] Vitest: `lib/plans.ts` all branches pass.
- [ ] Playwright: `/pricing` page renders both plan cards (smoke test).

---

## 14. Risks and mitigations

- **Webhook delivery order is not guaranteed.** A `checkout.session.completed` event may arrive after a `customer.subscription.updated` event if Stripe re-delivers. Mitigation: webhook handlers are idempotent (`UPDATE … WHERE stripe_customer_id = $1`) — replay is safe, and the subscription's `status` field is the ground truth, not arrival order.
- **Stripe customer created before Supabase row exists.** If the Supabase `profiles` row is missing when `checkout.session.completed` fires, the customer-ID lookup fails. Mitigation: embed the Supabase `user_id` in `checkout.session.metadata` at session creation time so the webhook can `UPDATE profiles WHERE id = <user_id>` even if `stripe_customer_id` was never written first.
- **Column-level RLS is not enforced at the DB policy level.** As noted in §4, Postgres RLS cannot restrict individual columns in a `WITH CHECK`. Mitigation: all application `UPDATE` statements on `profiles` list explicit column names; service-role client is only instantiated in the webhook handler; this is documented in comments in both the migration and the server client helper.
- **Duplicate Stripe customers.** If a user hits Checkout twice before the first `checkout.session.completed` fires, two Stripe customers could be created for the same email. Mitigation: `stripe_customer_id` is `UNIQUE` in the DB — the second write fails with a constraint error rather than silently corrupting the row. The checkout route reads `stripe_customer_id` before creating a new customer, so the race window is narrow (only if two checkout requests fire concurrently before the first one writes back).
- **Test vs live Stripe keys in the same environment.** Mitigation: `STRIPE_SECRET_KEY` starts with `sk_test_` in all non-production environments; the webhook secret differs between test and live. Vercel environment variable scoping (`Preview` vs `Production`) enforces separation.

---

## 15. Implementation phasing (preview)

The full implementation plan lives in a follow-on doc. Suggested phases:

- **Phase A — Schema + env:** migration for Stripe columns, `env.ts` additions, types regen.
- **Phase B — Plans primitive:** `lib/plans.ts` + Vitest unit tests.
- **Phase C — Stripe client:** `lib/stripe.ts`, install `stripe` npm package.
- **Phase D — API routes:** `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook` (with mock-based unit tests for webhook handler).
- **Phase E — Pricing page:** public `/pricing` route with plan cards and CTA logic.
- **Phase F — Settings plan card:** tier display, period-end date, portal/upgrade CTA.
- **Phase G — Landing nav:** add Pricing link to public header.
- **Phase H — Tidy:** Playwright smoke test for `/pricing`, acceptance walk-through, retro stub.

Each phase commits independently. Phase A must merge first (types regen flows into B–H).
