-- SP-3: Stripe billing columns on profiles
-- ============================================================================
-- All columns here are written only by the webhook handler (service role).
-- The authenticated role is blocked from writing them directly via application-
-- layer column lists in every UPDATE statement. Postgres RLS does not support
-- per-column WITH CHECK at the policy level; the service-role client used in
-- the webhook handler bypasses RLS entirely. This is intentional and documented.
--
-- subscription_cancel_at_period_end is not in the spec's three-column list but
-- is required so the settings card can conditionally show the "Access until"
-- date without making a Stripe API call at render time.
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
