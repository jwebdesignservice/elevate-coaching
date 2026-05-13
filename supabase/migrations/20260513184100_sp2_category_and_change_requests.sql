-- SP-2: training category + category change requests
-- ============================================================================
-- Adds the first piece of real product data to profiles. Each user picks one
-- of four coach-managed training categories during onboarding; subsequent
-- changes go through the category_change_requests review flow.
--
-- A note on enum ALTERs:
--   Adding a fifth category later requires `ALTER TYPE public.user_category
--   ADD VALUE 'E'` which CANNOT run inside a transaction. Supabase's standard
--   migration runner wraps each file in a transaction, so adding a new value
--   needs its own migration file with no other DDL in it, OR a manual run.
--
-- A note on RLS recursion:
--   SP-1's 20260513151506_fix_profiles_rls_recursion.sql introduced
--   public.is_coach() because policies that selected from profiles inside
--   profiles' own policies triggered Postgres 42P17. The change-request
--   table's coach-gated policies below reuse is_coach() for the same reason
--   plus consistency.
-- ============================================================================

-- ============================================================================
-- 1. Category enum
-- ============================================================================

create type public.user_category as enum ('A', 'B', 'C', 'D');

comment on type public.user_category is
  'Training category. A=Beginner, B=Fat Loss, C=Strength, D=Advanced. '
  'Coach-managed content lanes; each user belongs to exactly one. NULL on '
  'public.profiles.category means the user has not yet completed onboarding.';

-- ============================================================================
-- 2. profiles.category column
-- ============================================================================

alter table public.profiles
  add column category public.user_category;

comment on column public.profiles.category is
  'NULL until the user completes onboarding (see /onboarding). Set once via '
  'the setCategoryAction server action; later changes go through the '
  'category_change_requests review flow, not direct UPDATEs.';

-- Partial index — most reads filter on a known category, but the onboarding
-- gate also reads NULL. Full index keeps both branches cheap.
create index profiles_category_idx on public.profiles (category);

-- ============================================================================
-- 3. Change request status enum + table
-- ============================================================================

create type public.change_request_status as enum ('pending', 'approved', 'denied');

create table public.category_change_requests (
  id                  uuid                          primary key default gen_random_uuid(),
  user_id             uuid                          not null references public.profiles(id) on delete cascade,
  current_category    public.user_category,
  requested_category  public.user_category          not null,
  reason              text,
  status              public.change_request_status  not null default 'pending',
  created_at          timestamptz                   not null default now(),
  resolved_at         timestamptz,
  resolved_by         uuid                          references public.profiles(id),

  -- Asking to swap to the same category makes no sense; reject at the DB.
  -- `is distinct from` correctly handles NULL current_category (a user with
  -- no category yet shouldn't be requesting changes — they should be in
  -- onboarding — but the constraint stays well-defined regardless).
  constraint ccr_different_category check (current_category is distinct from requested_category),

  -- Resolved rows must record when. Pending rows must not.
  constraint ccr_resolved_at_consistent check (
    (status = 'pending' and resolved_at is null and resolved_by is null)
    or (status in ('approved', 'denied') and resolved_at is not null)
  )
);

comment on table public.category_change_requests is
  'User-initiated requests to change training category. Coach reviews and '
  'sets status to approved or denied. In SP-2, approval is a manual two-step '
  'SQL flow (update the request, then update the profile). SP-7 wraps both '
  'in a single coach server action.';

comment on column public.category_change_requests.current_category is
  'Snapshot of the user''s category at the time of the request. Verified by '
  'the WITH CHECK clause on insert to prevent spoofing.';

create index ccr_status_pending_idx on public.category_change_requests (status)
  where status = 'pending';
create index ccr_user_id_idx on public.category_change_requests (user_id);

-- ============================================================================
-- 4. RLS on category_change_requests
-- ============================================================================

alter table public.category_change_requests enable row level security;

-- Users can SELECT their own requests.
create policy "ccr_select_own"
  on public.category_change_requests
  for select
  using ((select auth.uid()) = user_id);

-- Coaches can SELECT all requests (for the admin UI in SP-7; for SP-2,
-- coach access is via Supabase Studio).
create policy "ccr_select_coach_all"
  on public.category_change_requests
  for select
  using (public.is_coach());

-- Users can INSERT requests for themselves. WITH CHECK enforces:
--   * user_id matches the session (no requesting on someone else's behalf)
--   * current_category snapshot matches the profile row (no spoofing the
--     "from" category to bias the coach's review)
-- We can safely read profiles.category here because the inner query is
-- against the row owned by the same auth.uid() — RLS on profiles permits it
-- via profiles_select_own, and the read does not re-enter this policy.
create policy "ccr_insert_own"
  on public.category_change_requests
  for insert
  with check (
    (select auth.uid()) = user_id
    and current_category is not distinct from (
      select category from public.profiles where id = (select auth.uid())
    )
  );

-- Coaches can UPDATE (approve / deny). The matching update to profiles.category
-- on approval is a separate statement; in SP-2 the coach issues both manually
-- (see table comment). SP-7's server action wraps both in a transaction.
create policy "ccr_update_coach"
  on public.category_change_requests
  for update
  using (public.is_coach())
  with check (public.is_coach());

-- No DELETE policy — pending requests can sit forever, resolved requests are
-- audit trail. Cascade-delete on user removal handles GDPR.

grant select, insert on public.category_change_requests to authenticated;
grant update on public.category_change_requests to authenticated;
