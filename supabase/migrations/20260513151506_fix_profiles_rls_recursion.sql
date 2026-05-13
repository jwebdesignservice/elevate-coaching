-- SP-1 fix: profiles RLS infinite recursion (Postgres 42P17)
--
-- Background
-- ----------
-- The initial migration (20260513135817_initial_profiles.sql) defined two
-- policies whose USING / WITH CHECK clauses queried public.profiles itself:
--
--   * profiles_select_coach_all  →  using (exists (select 1 from profiles ...))
--   * profiles_update_own        →  with check ((select role from profiles ...) = role
--                                              and (select subscription_tier from profiles ...) = subscription_tier)
--
-- Selecting from profiles fires those policies, the inner select also queries
-- profiles, the policy fires again — Postgres aborts with
--   42P17: infinite recursion detected in policy for relation "profiles"
--
-- The user-facing effect is that getCurrentUser() / requireUser() returns null
-- after sign-in (the SELECT errors out) and the authed layout redirects the
-- newly-signed-in user back to /sign-in. Login appears to "not work."
--
-- Fix
-- ---
-- 1. Drop the two recursive policies.
-- 2. Add public.is_coach() — a SECURITY DEFINER helper that bypasses RLS in
--    its inner SELECT. The function owner (postgres) has BYPASSRLS, so the
--    inner read of profiles does not re-enter the calling policy.
-- 3. Recreate profiles_select_coach_all using public.is_coach() instead of
--    an inline EXISTS subquery.
-- 4. Move the role + subscription_tier immutability check from the WITH CHECK
--    clause into a BEFORE UPDATE trigger. The trigger checks current_user
--    so privileged callers (postgres for migrations, service_role for server
--    actions) can still promote a user's role / tier; end-user UPDATEs from
--    the authenticated role are blocked.
-- 5. Recreate profiles_update_own without the self-referencing subqueries.
--
-- profiles_select_own is unchanged (it does not self-reference).
-- ============================================================================

-- 1. Drop the recursive policies (idempotent — IF EXISTS guards against
--    partial application during local testing).
drop policy if exists "profiles_select_coach_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- 2. Helper: is the current auth.uid() a coach?
--
-- SECURITY DEFINER + locked search_path:
--   * definer → runs as the function owner (postgres). With BYPASSRLS on
--     postgres, the inner SELECT does not trigger profiles' policies — so
--     this function can be safely called from inside those policies without
--     creating a loop.
--   * search_path = '' → defends against schema-shadowing attacks. All
--     references inside the function body must be fully qualified.
--
-- `(select auth.uid())` (rather than bare auth.uid()) lets the planner cache
-- the auth.uid() call across rows, which Supabase recommends for policy
-- helpers used per-row.
create or replace function public.is_coach()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (
      select role = 'coach'::public.user_role
      from public.profiles
      where id = (select auth.uid())
    ),
    false
  )
$$;

-- Lock down who can call the helper. authenticated is the only role that
-- needs it (anon / public should not be probing the coach surface).
revoke all on function public.is_coach() from public;
revoke all on function public.is_coach() from anon;
grant execute on function public.is_coach() to authenticated;

-- 3. Trigger function: privilege fields are immutable from end-user contexts.
--
-- Allowed callers (current_user):
--   * postgres        → migrations, dashboard SQL editor
--   * service_role    → server actions / Stripe webhook handlers using the
--                       service-role Supabase client
--
-- Any other role (authenticated, anon) attempting to change role or
-- subscription_tier raises a check_violation. This replaces the
-- WITH-CHECK self-comparison from the original policy.
create or replace function public.profiles_block_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.subscription_tier is distinct from old.subscription_tier)
     and current_user not in ('postgres', 'service_role') then
    raise exception 'role and subscription_tier are immutable from end-user updates'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_privilege_changes_trg on public.profiles;
create trigger profiles_block_privilege_changes_trg
  before update on public.profiles
  for each row
  execute function public.profiles_block_privilege_changes();

-- 4. Recreate profiles_select_coach_all without the inline self-reference.
create policy "profiles_select_coach_all"
  on public.profiles
  for select
  using (public.is_coach());

-- 5. Recreate profiles_update_own. The role/tier immutability is now
--    enforced by the BEFORE UPDATE trigger above, so the policy only
--    has to ensure the user owns the row.
create policy "profiles_update_own"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
