# SP-3 Stripe + Plan Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Stripe billing (Checkout, Customer Portal, webhook) into Elevate Coaching — public `/pricing` page, settings subscription card, and `hasPlanAtLeast` gating primitive ready for SP-4+.

**Architecture:** Server-redirect Checkout (no client-side Stripe JS; secret key never leaves the server); a webhook handler that is the **sole** writer of `subscription_tier` and billing columns (via service-role client, bypassing RLS); `lib/plans.ts` as the single source of truth for plan hierarchy.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres + RLS, Stripe Node SDK (server-only), Vitest (unit), Playwright (e2e smoke).

---

## Pre-flight (verify before Task 1)

- [ ] `stripe` npm package not yet installed — Task 5 installs it.
- [ ] `.env.local` has `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BASIC_PRICE_ID`, `STRIPE_PRO_PRICE_ID` set with real test-mode values.
- [ ] Supabase CLI available (`npx supabase --version` works).

---

## File Map

### New files

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260514000000_sp3_stripe_columns.sql` | Adds Stripe billing + cancel columns to `profiles`; tightens RLS |
| `lib/plans.ts` | `PLAN_TIERS`, `PlanTier`, `hasPlanAtLeast()` |
| `lib/stripe.ts` | Stripe singleton, `PRICE_IDS`, `tierFromPriceId()` |
| `app/api/stripe/checkout/route.ts` | POST — creates Checkout session, returns `{ url }` |
| `app/api/stripe/portal/route.ts` | POST — creates Customer Portal session, returns `{ url }` |
| `app/api/stripe/webhook/route.ts` | POST — verifies Stripe sig, syncs subscription state to DB |
| `app/(public)/pricing/page.tsx` | Server component — reads user session + tier, passes to cards |
| `app/(public)/pricing/pricing-cards.tsx` | `'use client'` — plan cards with CTA logic |
| `app/(authed)/settings/subscription-card.tsx` | `'use client'` — tier badge, period-end date, portal/upgrade CTA |
| `tests/lib/plans.test.ts` | Vitest — all `hasPlanAtLeast` branches |
| `tests/app/stripe-webhook.test.ts` | Vitest — mocked Stripe event → expected DB call |
| `tests/e2e/pricing.spec.ts` | Playwright smoke — `/pricing` renders both plan cards |

### Modified files

| File | Change |
|------|--------|
| `lib/env.ts` | Add 4 Stripe vars to Zod schema |
| `lib/supabase/database.types.ts` | Regenerated — do not hand-edit |
| `app/(authed)/settings/page.tsx` | Replace billing placeholder card with `<SubscriptionCard>` |
| `app/(public)/page.tsx` | Add "Pricing" link to landing nav |

### Not modified

| File | Why untouched |
|------|---------------|
| `middleware.ts` | Matcher already excludes `api/` — webhook is already outside auth middleware |

---

## Key patterns

```typescript
// Server client (RLS-scoped, cookie-based)
import { createSupabaseServerClient } from '@/lib/supabase/server';
const supabase = await createSupabaseServerClient();

// Admin client (bypasses RLS — webhook + customer creation only)
import { createSupabaseAdminClient } from '@/lib/supabase/server';
const supabase = createSupabaseAdminClient(); // sync, no await

// Supabase write cast (upstream types write builders as `never`)
await supabase.from('profiles').update({ stripe_customer_id: id } as never).eq('id', uid);
```

---

## Task 1 (Phase A): Database migration

**Files:**
- Create: `supabase/migrations/20260514000000_sp3_stripe_columns.sql`

> **Note:** `subscription_cancel_at_period_end` is added beyond the spec's three listed columns. It is required for the settings card to conditionally show "Access until {date}" — without it there is no way to distinguish a cancelling subscription from an active one at render time.

- [ ] **Step 1: Create the migration file**

```sql
-- SP-3: Stripe billing columns on profiles
-- ============================================================================
-- All columns here are written only by the webhook handler (service role).
-- The authenticated role is blocked from writing them directly via application-
-- layer column lists in every UPDATE statement. Postgres RLS does not support
-- per-column WITH CHECK at the policy level; the service-role client used in
-- the webhook handler bypasses RLS entirely. This is intentional and documented.
--
-- subscription_cancel_at_period_end is not in the spec's migration but is
-- required so the settings card can conditionally show the "Access until" date
-- without making a Stripe API call at render time.
-- ============================================================================

alter table public.profiles
  add column stripe_customer_id                 text unique,
  add column stripe_subscription_id             text unique,
  add column subscription_period_end            timestamptz,
  add column subscription_cancel_at_period_end  boolean not null default false;

comment on column public.profiles.stripe_customer_id is
  'Stripe customer ID (cus_…). Created on first Checkout attempt. NULL for free users who have never initiated payment.';

comment on column public.profiles.stripe_subscription_id is
  'Active Stripe subscription ID (sub_…). NULL when tier = ''free''.';

comment on column public.profiles.subscription_period_end is
  'Current billing period end (UTC). Synced from Stripe. Shown as "Access until {date}" when subscription_cancel_at_period_end is true.';

comment on column public.profiles.subscription_cancel_at_period_end is
  'True when the subscription is set to cancel at period end (user cancelled but retains access until subscription_period_end). Controls the "Access until" label in the settings card.';

create index profiles_stripe_customer_idx on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- ============================================================================
-- RLS: replace the unrestricted update policy from SP-1 with one that
-- intentionally documents that column-level restriction is application-enforced,
-- not policy-enforced. Service-role writes bypass this entirely.
-- ============================================================================

drop policy if exists "profiles_update_own" on public.profiles;

-- Users may update display-level columns (name). Billing columns, tier,
-- role, and timestamps are application-enforced as service-role-only.
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

- [ ] **Step 2: Push migration to Supabase**

```powershell
cd "C:\Users\Jack\Desktop\AI Website\htdocs\Websites\elevate-coaching"
npx supabase db push --project-ref zptxhbblbcaliwezltzp
```

Expected output: migration applied without errors. If you see "already applied", the migration timestamp collided — rename the file to a later timestamp and retry.

- [ ] **Step 3: Commit migration**

```powershell
git add supabase/migrations/20260514000000_sp3_stripe_columns.sql
git commit -m "feat(sp3): add Stripe billing columns to profiles + tighten RLS"
```

---

## Task 2 (Phase A): env.ts additions

**Files:**
- Modify: `lib/env.ts`

- [ ] **Step 1: Add the 4 Stripe vars to the Zod schema**

Open `lib/env.ts`. The `schema` object currently ends with `NODE_ENV`. Add the Stripe block immediately before the closing `});`:

```typescript
  // Stripe (server-only — no publishable key needed for server-redirect Checkout)
  STRIPE_SECRET_KEY:      z.string().min(1),
  STRIPE_WEBHOOK_SECRET:  z.string().min(1),
  STRIPE_BASIC_PRICE_ID:  z.string().min(1),
  STRIPE_PRO_PRICE_ID:    z.string().min(1),
```

The full updated schema becomes:

```typescript
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:       z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY:  z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:      z.string().min(1),

  NEXT_PUBLIC_SENTRY_DSN:         z.string().url().optional(),

  NEXT_PUBLIC_COACH_WHATSAPP:     z.string().min(1),
  NEXT_PUBLIC_COACH_CALENDLY:     z.string().url(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Stripe (server-only — no publishable key needed for server-redirect Checkout)
  STRIPE_SECRET_KEY:      z.string().min(1),
  STRIPE_WEBHOOK_SECRET:  z.string().min(1),
  STRIPE_BASIC_PRICE_ID:  z.string().min(1),
  STRIPE_PRO_PRICE_ID:    z.string().min(1),
});
```

- [ ] **Step 2: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors. If you see "unknown property" errors on `env.*` for the new Stripe vars, the types regen in Task 3 will fix them — come back and recheck after Task 3.

- [ ] **Step 3: Commit**

```powershell
git add lib/env.ts
git commit -m "feat(sp3): add Stripe env vars to Zod schema"
```

---

## Task 3 (Phase A): Regenerate Supabase types

**Files:**
- Modify: `lib/supabase/database.types.ts` (generated — do not hand-edit)

- [ ] **Step 1: Regenerate types**

```powershell
npx supabase gen types typescript --project-id zptxhbblbcaliwezltzp | Out-File -FilePath lib\supabase\database.types.ts -Encoding utf8
```

- [ ] **Step 2: Verify the new columns appear in the generated file**

Open `lib/supabase/database.types.ts` and search for `stripe_customer_id`. Confirm you see all four new columns:
- `stripe_customer_id: string | null`
- `stripe_subscription_id: string | null`
- `subscription_period_end: string | null`
- `subscription_cancel_at_period_end: boolean`

- [ ] **Step 3: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```powershell
git add lib/supabase/database.types.ts
git commit -m "chore(sp3): regenerate Supabase types after stripe-columns migration"
```

---

## Task 4 (Phase B): Plans primitive — TDD

**Files:**
- Create: `tests/lib/plans.test.ts`
- Create: `lib/plans.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/plans.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hasPlanAtLeast, PLAN_TIERS } from '@/lib/plans';

describe('PLAN_TIERS', () => {
  it('contains free, basic, pro in ascending order', () => {
    expect(PLAN_TIERS).toEqual(['free', 'basic', 'pro']);
  });
});

describe('hasPlanAtLeast', () => {
  // Same-tier checks
  it('free >= free → true', () => expect(hasPlanAtLeast('free', 'free')).toBe(true));
  it('basic >= basic → true', () => expect(hasPlanAtLeast('basic', 'basic')).toBe(true));
  it('pro >= pro → true', () => expect(hasPlanAtLeast('pro', 'pro')).toBe(true));

  // Upward checks
  it('basic >= free → true', () => expect(hasPlanAtLeast('basic', 'free')).toBe(true));
  it('pro >= free → true', () => expect(hasPlanAtLeast('pro', 'free')).toBe(true));
  it('pro >= basic → true', () => expect(hasPlanAtLeast('pro', 'basic')).toBe(true));

  // Downward checks (must fail)
  it('free >= basic → false', () => expect(hasPlanAtLeast('free', 'basic')).toBe(false));
  it('free >= pro → false', () => expect(hasPlanAtLeast('free', 'pro')).toBe(false));
  it('basic >= pro → false', () => expect(hasPlanAtLeast('basic', 'pro')).toBe(false));

  // null / undefined treated as 'free' (safe default — never accidentally grants access)
  it('null >= free → true (null treated as free)', () =>
    expect(hasPlanAtLeast(null, 'free')).toBe(true));
  it('null >= basic → false (null treated as free)', () =>
    expect(hasPlanAtLeast(null, 'basic')).toBe(false));
  it('undefined >= free → true (undefined treated as free)', () =>
    expect(hasPlanAtLeast(undefined, 'free')).toBe(true));
  it('undefined >= basic → false (undefined treated as free)', () =>
    expect(hasPlanAtLeast(undefined, 'basic')).toBe(false));
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
npx vitest run tests/lib/plans.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/plans'".

- [ ] **Step 3: Implement lib/plans.ts**

Create `lib/plans.ts`:

```typescript
export const PLAN_TIERS = ['free', 'basic', 'pro'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

const PLAN_RANK: Record<PlanTier, number> = { free: 0, basic: 1, pro: 2 };

/**
 * Returns true when the user's current tier meets or exceeds the required tier.
 * Treats null / undefined as 'free' — the safe default that never accidentally
 * grants access to a gated feature.
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

- [ ] **Step 4: Run to confirm tests pass**

```powershell
npx vitest run tests/lib/plans.test.ts
```

Expected: all 14 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/plans.ts tests/lib/plans.test.ts
git commit -m "feat(sp3): add hasPlanAtLeast primitive + unit tests"
```

---

## Task 5 (Phase C): Install Stripe + lib/stripe.ts

**Files:**
- Create: `lib/stripe.ts`

- [ ] **Step 1: Install the stripe package**

```powershell
npm install stripe
```

Expected: `stripe` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Create lib/stripe.ts**

```typescript
import Stripe from 'stripe';
import { env } from '@/lib/env';
import type { PlanTier } from '@/lib/plans';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
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
 * Returns 'free' for unknown price IDs — safe default, never accidentally grants access.
 */
export function tierFromPriceId(priceId: string): PlanTier {
  return PRICE_TO_TIER[priceId] ?? 'free';
}
```

> **TypeScript note:** If `'2024-11-20.acacia'` causes a TS error because the installed stripe package ships a newer `LatestApiVersion`, change the cast to `as unknown as Stripe.LatestApiVersion` or remove the `apiVersion` line entirely (Stripe defaults to the installed SDK's pinned version).

- [ ] **Step 3: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```powershell
git add lib/stripe.ts package.json package-lock.json
git commit -m "feat(sp3): add Stripe singleton + PRICE_IDS + tierFromPriceId"
```

---

## Task 6 (Phase D): Write failing webhook unit test

**Files:**
- Create: `tests/app/stripe-webhook.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Stripe from 'stripe';

// vi.hoisted ensures these mock fns are available inside vi.mock() factories,
// which are hoisted before module imports by Vitest.
const mocks = vi.hoisted(() => ({
  constructEvent:        vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  tierFromPriceId:       vi.fn(),
  updateEq:              vi.fn(),
  updateChain:           vi.fn(),
  fromFn:                vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks:      { constructEvent: mocks.constructEvent },
    subscriptions: { retrieve: mocks.subscriptionsRetrieve },
  },
  tierFromPriceId: mocks.tierFromPriceId,
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(() => ({
    from: mocks.fromFn,
  })),
}));

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY:      'sk_test_mock',
    STRIPE_WEBHOOK_SECRET:  'whsec_test_mock',
    STRIPE_BASIC_PRICE_ID:  'price_basic_mock',
    STRIPE_PRO_PRICE_ID:    'price_pro_mock',
    NEXT_PUBLIC_SUPABASE_URL:      'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon_mock',
    SUPABASE_SERVICE_ROLE_KEY:     'service_role_mock',
    NEXT_PUBLIC_COACH_WHATSAPP:    '+1234567890',
    NEXT_PUBLIC_COACH_CALENDLY:    'https://calendly.com/test',
    NODE_ENV: 'test',
  },
}));

function makeRequest(body: string, sig = 'valid-sig') {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': sig },
    body,
  });
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.updateEq.mockResolvedValue({ error: null });
    mocks.updateChain.mockReturnValue({ eq: mocks.updateEq });
    mocks.fromFn.mockReturnValue({ update: mocks.updateChain });
    mocks.tierFromPriceId.mockReturnValue('basic');
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns 400 when Stripe signature verification fails', async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}', 'bad-sig'));
    expect(res.status).toBe(400);
  });

  it('checkout.session.completed — writes customer id, subscription id, tier, period end', async () => {
    const mockSubscription = {
      id: 'sub_123',
      items: { data: [{ price: { id: 'price_basic_mock' } }] },
      current_period_end: 1800000000,
      cancel_at_period_end: false,
      status: 'active',
    } as unknown as Stripe.Subscription;

    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata:     { supabase_user_id: 'user-abc-123' },
          customer:     'cus_mock_123',
          subscription: 'sub_123',
        } as unknown as Stripe.Checkout.Session,
      },
    } as Stripe.Event;

    mocks.constructEvent.mockReturnValue(mockEvent);
    mocks.subscriptionsRetrieve.mockResolvedValue(mockSubscription);
    mocks.tierFromPriceId.mockReturnValue('basic');

    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}'));

    expect(res.status).toBe(200);
    expect(mocks.updateChain).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id:               'cus_mock_123',
        stripe_subscription_id:           'sub_123',
        subscription_tier:                'basic',
        subscription_cancel_at_period_end: false,
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'user-abc-123');
  });

  it('customer.subscription.updated (active) — re-syncs tier and period end', async () => {
    const mockEvent = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id:                   'sub_123',
          customer:             'cus_mock_123',
          status:               'active',
          items:                { data: [{ price: { id: 'price_pro_mock' } }] },
          current_period_end:   1800000000,
          cancel_at_period_end: false,
        } as unknown as Stripe.Subscription,
      },
    } as Stripe.Event;

    mocks.constructEvent.mockReturnValue(mockEvent);
    mocks.tierFromPriceId.mockReturnValue('pro');

    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}'));

    expect(res.status).toBe(200);
    expect(mocks.updateChain).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier:                'pro',
        stripe_subscription_id:           'sub_123',
        subscription_cancel_at_period_end: false,
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_mock_123');
  });

  it('customer.subscription.deleted — downgrades to free and clears billing columns', async () => {
    const mockEvent = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id:       'sub_123',
          customer: 'cus_mock_123',
        } as unknown as Stripe.Subscription,
      },
    } as Stripe.Event;

    mocks.constructEvent.mockReturnValue(mockEvent);

    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}'));

    expect(res.status).toBe(200);
    expect(mocks.updateChain).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier:                'free',
        stripe_subscription_id:           null,
        subscription_period_end:          null,
        subscription_cancel_at_period_end: false,
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_mock_123');
  });

  it('unrecognised event type — returns 200 and makes no DB calls', async () => {
    const mockEvent = {
      type: 'payment_intent.created',
      data: { object: {} },
    } as Stripe.Event;

    mocks.constructEvent.mockReturnValue(mockEvent);

    const { POST } = await import('@/app/api/stripe/webhook/route');
    const res = await POST(makeRequest('{}'));

    expect(res.status).toBe(200);
    expect(mocks.updateChain).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```powershell
npx vitest run tests/app/stripe-webhook.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/stripe/webhook/route'".

---

## Task 7 (Phase D): API routes

**Files:**
- Create: `app/api/stripe/checkout/route.ts`
- Create: `app/api/stripe/portal/route.ts`
- Create: `app/api/stripe/webhook/route.ts`

> **Middleware note:** `middleware.ts` already excludes `api/` from its matcher, so the webhook route is already outside auth middleware. No changes to `middleware.ts` are needed.

- [ ] **Step 1: Create the checkout route**

Create `app/api/stripe/checkout/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { stripe, PRICE_IDS } from '@/lib/stripe';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { priceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validPriceIds = Object.values(PRICE_IDS);
  if (!body.priceId || !validPriceIds.includes(body.priceId)) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
  }

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single();
  const profile = profileRaw as { stripe_customer_id: string | null; email: string } | null;

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  let stripeCustomerId = profile.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      metadata: { supabase_user_id: user.id },
    });
    stripeCustomerId = customer.id;
    const admin = createSupabaseAdminClient();
    await admin
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId } as never)
      .eq('id', user.id);
  }

  const origin = new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: body.priceId, quantity: 1 }],
    success_url: `${origin}/settings?plan=upgraded`,
    cancel_url:  `${origin}/pricing`,
    metadata: { supabase_user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Create the portal route**

Create `app/api/stripe/portal/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();
  const profile = profileRaw as { stripe_customer_id: string | null } | null;

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer:   profile.stripe_customer_id,
    return_url: `${origin}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 3: Create the webhook route**

Create `app/api/stripe/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, tierFromPriceId } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig ?? '', env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const supabaseUserId = session.metadata?.supabase_user_id;
      const subscriptionId = session.subscription as string | null;

      if (!supabaseUserId || !subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id ?? '';
      const tier = tierFromPriceId(priceId);

      await supabase
        .from('profiles')
        .update({
          stripe_customer_id:               session.customer as string,
          stripe_subscription_id:           subscriptionId,
          subscription_tier:                tier,
          subscription_period_end:          new Date(subscription.current_period_end * 1000).toISOString(),
          subscription_cancel_at_period_end: subscription.cancel_at_period_end,
        } as never)
        .eq('id', supabaseUserId);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id ?? '';
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

      if (sub.status === 'canceled' || sub.status === 'unpaid') {
        await supabase
          .from('profiles')
          .update({
            subscription_tier:                'free',
            stripe_subscription_id:           null,
            subscription_period_end:          null,
            subscription_cancel_at_period_end: false,
          } as never)
          .eq('stripe_customer_id', sub.customer as string);
      } else if (sub.status === 'past_due') {
        // Grace period — do not change tier; only update period end + cancel flag
        await supabase
          .from('profiles')
          .update({
            subscription_period_end:          periodEnd,
            subscription_cancel_at_period_end: sub.cancel_at_period_end,
          } as never)
          .eq('stripe_customer_id', sub.customer as string);
      } else {
        await supabase
          .from('profiles')
          .update({
            subscription_tier:                tierFromPriceId(priceId),
            stripe_subscription_id:           sub.id,
            subscription_period_end:          periodEnd,
            subscription_cancel_at_period_end: sub.cancel_at_period_end,
          } as never)
          .eq('stripe_customer_id', sub.customer as string);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from('profiles')
        .update({
          subscription_tier:                'free',
          stripe_subscription_id:           null,
          subscription_period_end:          null,
          subscription_cancel_at_period_end: false,
        } as never)
        .eq('stripe_customer_id', sub.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Run webhook unit tests**

```powershell
npx vitest run tests/app/stripe-webhook.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run all Vitest tests**

```powershell
npx vitest run
```

Expected: all tests pass (plans + webhook + existing suites).

- [ ] **Step 6: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit Phase D**

```powershell
git add app/api/stripe/ tests/app/stripe-webhook.test.ts
git commit -m "feat(sp3): add Stripe checkout, portal, webhook API routes + webhook unit tests"
```

---

## Task 8 (Phase E): /pricing public page

**Files:**
- Create: `app/(public)/pricing/page.tsx`
- Create: `app/(public)/pricing/pricing-cards.tsx`

- [ ] **Step 1: Create the client cards component**

Create `app/(public)/pricing/pricing-cards.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { PlanTier } from '@/lib/plans';

interface Plan {
  key: 'basic' | 'pro';
  name: string;
  price: string;
  priceId: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: 'basic',
    name: 'Basic',
    price: '£150',
    priceId: '',
    features: [
      'Full access to workout programmes',
      'Daily task assignments',
      'Tutorial library',
      'WhatsApp coach access',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '£300',
    priceId: '',
    features: [
      'Everything in Basic',
      'Priority coach response',
      'Advanced performance tracking',
      'Monthly strategy call',
    ],
  },
];

interface Props {
  tier: PlanTier | null;
  basicPriceId: string;
  proPriceId: string;
}

export function PricingCards({ tier, basicPriceId, proPriceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'basic' | 'pro' | null>(null);

  const plans: Plan[] = [
    { ...PLANS[0]!, priceId: basicPriceId },
    { ...PLANS[1]!, priceId: proPriceId },
  ];

  async function handleCheckout(plan: Plan) {
    setLoading(plan.key);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: plan.priceId }),
      });
      if (!res.ok) throw new Error('Checkout failed');
      const { url } = (await res.json()) as { url: string };
      router.push(url);
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
      {plans.map((plan) => {
        const isCurrent = tier === plan.key;
        const isProOnBasicCard = tier === 'pro' && plan.key === 'basic';

        let cta: React.ReactNode;

        if (!tier) {
          // Logged out
          cta = (
            <Link
              href={`/sign-up?plan=${plan.key}`}
              className={cn(
                buttonVariants(),
                'bg-accent text-accent-fg hover:bg-accent/90 w-full',
              )}
            >
              Get started
            </Link>
          );
        } else if (isCurrent) {
          cta = (
            <button
              disabled
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full cursor-not-allowed opacity-60')}
            >
              Current plan
            </button>
          );
        } else if (isProOnBasicCard) {
          cta = (
            <Link
              href="/settings"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
            >
              Downgrade via portal
            </Link>
          );
        } else {
          cta = (
            <button
              onClick={() => handleCheckout(plan)}
              disabled={loading !== null}
              className={cn(
                buttonVariants(),
                'bg-accent text-accent-fg hover:bg-accent/90 w-full',
              )}
            >
              {loading === plan.key ? 'Redirecting…' : `Upgrade to ${plan.name}`}
            </button>
          );
        }

        return (
          <div
            key={plan.key}
            className={cn(
              'bg-surface border-border rounded-card flex flex-col border p-8',
              isCurrent && 'border-accent',
            )}
          >
            <div className="mb-2 text-sm font-semibold tracking-widest uppercase text-accent">
              {plan.name}
            </div>
            <div className="mb-1 text-4xl font-bold text-text">
              {plan.price}
              <span className="text-text-muted ml-1 text-base font-normal">/ month</span>
            </div>
            <ul className="mb-8 mt-6 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="mt-0.5 text-accent">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            {cta}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create the server page**

Create `app/(public)/pricing/page.tsx`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PRICE_IDS } from '@/lib/stripe';
import type { PlanTier } from '@/lib/plans';
import { PricingCards } from './pricing-cards';

export const metadata = {
  title: 'Pricing · Elevate Coaching',
};

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier: PlanTier | null = null;
  if (user) {
    const { data: profileRaw } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();
    const profile = profileRaw as { subscription_tier: PlanTier } | null;
    tier = profile?.subscription_tier ?? 'free';
  }

  return (
    <main className="min-h-screen px-6 pb-20 pt-16">
      <div className="text-center">
        <div className="mb-3 text-xs font-semibold tracking-[0.3em] uppercase text-accent">
          Pricing
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-text">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-text-muted">
          Choose the plan that fits your training goals. Upgrade or cancel anytime.
        </p>
      </div>

      <PricingCards
        tier={tier}
        basicPriceId={PRICE_IDS.basic}
        proPriceId={PRICE_IDS.pro}
      />
    </main>
  );
}
```

- [ ] **Step 3: Start the dev server and verify**

```powershell
npm run dev
```

Open `http://localhost:3000/pricing`. Confirm:
- Two plan cards render side by side (Basic £150/mo, Pro £300/mo)
- Feature lists show 4 bullets each
- Logged-out state shows "Get started" links

- [ ] **Step 4: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```powershell
git add "app/(public)/pricing/"
git commit -m "feat(sp3): add /pricing public page with plan cards and CTA logic"
```

---

## Task 9 (Phase F): Settings subscription card

**Files:**
- Create: `app/(authed)/settings/subscription-card.tsx`
- Modify: `app/(authed)/settings/page.tsx`

- [ ] **Step 1: Create the subscription card component**

Create `app/(authed)/settings/subscription-card.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { PlanTier } from '@/lib/plans';

const TIER_LABEL: Record<PlanTier, string> = {
  free:  'Free',
  basic: 'Basic',
  pro:   'Pro',
};

interface Props {
  tier: PlanTier;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function SubscriptionCard({ tier, periodEnd, cancelAtPeriodEnd }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (!res.ok) throw new Error('Portal error');
      const { url } = (await res.json()) as { url: string };
      router.push(url);
    } catch {
      setLoading(false);
    }
  }

  const showAccessUntil = cancelAtPeriodEnd && periodEnd !== null;
  const accessUntilFormatted = periodEnd
    ? new Date(periodEnd).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="bg-surface border-border p-6">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-text">Subscription</h2>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            'rounded-pill inline-flex items-center px-2.5 py-1 text-xs font-semibold',
            tier === 'free'  && 'bg-surface-hover text-text-muted',
            tier === 'basic' && 'bg-accent/15 text-accent',
            tier === 'pro'   && 'bg-accent text-accent-fg',
          )}
        >
          {TIER_LABEL[tier]}
        </span>
        <span className="text-sm text-text">{TIER_LABEL[tier]} Plan</span>
      </div>

      {showAccessUntil && (
        <p className="mt-3 text-sm text-text-muted">
          Access until <span className="font-medium text-text">{accessUntilFormatted}</span>
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {(tier === 'free' || tier === 'basic') && (
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ size: 'sm' }),
              'bg-accent text-accent-fg hover:bg-accent/90',
            )}
          >
            Upgrade →
          </Link>
        )}
        {(tier === 'basic' || tier === 'pro') && (
          <button
            onClick={openPortal}
            disabled={loading}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              loading && 'opacity-60 cursor-not-allowed',
            )}
          >
            {loading ? 'Redirecting…' : 'Manage subscription →'}
          </button>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Update the settings page**

In `app/(authed)/settings/page.tsx`:

Add the import at the top of the file (after the existing imports):

```typescript
import { SubscriptionCard } from './subscription-card';
import type { PlanTier } from '@/lib/plans';
```

Find and replace the billing placeholder card (lines 163–168):

```tsx
          <Card className="bg-surface border-border p-6">
            <h2 className="text-text mb-4 text-xl font-semibold tracking-tight">Billing</h2>
            <p className="text-text-muted text-sm">
              Stripe checkout, plan upgrades, and downgrades land in SP-3.
            </p>
          </Card>
```

Replace with:

```tsx
          <SubscriptionCard
            tier={(profile.subscription_tier as PlanTier) ?? 'free'}
            periodEnd={profile.subscription_period_end ?? null}
            cancelAtPeriodEnd={profile.subscription_cancel_at_period_end ?? false}
          />
```

- [ ] **Step 3: Verify in the browser**

With the dev server running, open `http://localhost:3000/settings`. Confirm:
- The "Billing" placeholder is gone
- A "Subscription" card renders with the correct tier badge
- "Upgrade →" link appears for free tier users
- No "Manage subscription" button for free tier (no billing account)

- [ ] **Step 4: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors. If `profile.subscription_cancel_at_period_end` shows a type error, the types regen from Task 3 may not have included the column — re-run Task 3 Step 1 and recommit.

- [ ] **Step 5: Commit**

```powershell
git add "app/(authed)/settings/subscription-card.tsx" "app/(authed)/settings/page.tsx"
git commit -m "feat(sp3): add subscription card to settings page"
```

---

## Task 10 (Phase G): Landing nav Pricing link

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Add the Pricing link to the header nav**

In `app/(public)/page.tsx`, find the `<nav>` block:

```tsx
        <nav className="flex items-center gap-4">
          <Link href="/sign-in" className="text-text-muted hover:text-text text-sm">
            Sign in
          </Link>
```

Add the Pricing link immediately before the "Sign in" link:

```tsx
        <nav className="flex items-center gap-4">
          <Link href="/pricing" className="text-text-muted hover:text-text text-sm">
            Pricing
          </Link>
          <Link href="/sign-in" className="text-text-muted hover:text-text text-sm">
            Sign in
          </Link>
```

- [ ] **Step 2: Verify in the browser**

Open `http://localhost:3000`. Confirm the "Pricing" link appears in the header between the logo and "Sign in". Click it — should navigate to `/pricing`.

- [ ] **Step 3: Commit**

```powershell
git add "app/(public)/page.tsx"
git commit -m "feat(sp3): add Pricing link to landing nav"
```

---

## Task 11 (Phase H): Playwright smoke test + final checks

**Files:**
- Create: `tests/e2e/pricing.spec.ts`

- [ ] **Step 1: Create the Playwright smoke test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('SP-3 /pricing smoke', () => {
  test('renders both plan cards with correct prices', async ({ page }) => {
    await page.goto('/pricing');

    // Both card headings visible
    await expect(page.getByText('Basic')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();

    // Prices
    await expect(page.getByText('£150')).toBeVisible();
    await expect(page.getByText('£300')).toBeVisible();

    // Logged-out CTA buttons (two "Get started" links)
    const getStartedLinks = page.getByRole('link', { name: 'Get started' });
    await expect(getStartedLinks).toHaveCount(2);
  });

  test('"Pricing" link appears in the landing nav', async ({ page }) => {
    await page.goto('/');
    const pricingLink = page.getByRole('link', { name: 'Pricing' });
    await expect(pricingLink).toBeVisible();
    await pricingLink.click();
    await expect(page).toHaveURL(/\/pricing/);
  });
});
```

- [ ] **Step 2: Run the Playwright smoke test**

```powershell
npx playwright test tests/e2e/pricing.spec.ts
```

Expected: both tests PASS. If the dev server isn't running, Playwright starts it automatically (configured in `playwright.config.ts`).

- [ ] **Step 3: Run the full Vitest suite**

```powershell
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Lint**

```powershell
npx next lint
```

Expected: 0 errors (warnings acceptable).

- [ ] **Step 5: Type-check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Build**

```powershell
npm run build
```

Expected: build succeeds with no errors. If Stripe env vars are missing at build time, the `isBuildPhase` guard in `lib/env.ts` should prevent a hard throw — verify this if the build fails.

- [ ] **Step 7: Commit Phase H**

```powershell
git add tests/e2e/pricing.spec.ts
git commit -m "test(sp3): add Playwright smoke test for /pricing page"
```

---

## Self-review: spec coverage check

| Spec requirement | Task that covers it |
|---|---|
| DB migration — stripe columns + RLS tighten | Task 1 |
| `lib/plans.ts` + `hasPlanAtLeast` | Task 4 |
| `lib/stripe.ts` singleton + `tierFromPriceId` | Task 5 |
| `STRIPE_*` env vars in `env.ts` | Task 2 |
| `POST /api/stripe/checkout` | Task 7 |
| `POST /api/stripe/portal` | Task 7 |
| `POST /api/stripe/webhook` (all 3 events) | Task 7 |
| Webhook excluded from auth middleware | Already excluded — noted in Task 7 |
| `/pricing` public page — two cards, CTA states | Task 8 |
| Settings subscription card — tier badge, period end, portal CTA | Task 9 |
| Landing nav "Pricing" link | Task 10 |
| Types regen | Task 3 |
| Vitest: `hasPlanAtLeast` all branches | Task 4 |
| Vitest: webhook handler (mocked events) | Tasks 6–7 |
| Playwright: `/pricing` renders both cards | Task 11 |
| Lint / typecheck / build green | Task 11 |

All 17 acceptance criteria from spec §13 are covered by the tasks above.
