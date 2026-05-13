-- SP-1 initial migration: profiles table + RLS + auth.users sync trigger
-- This is the minimal schema for the vertical slice. Content/category/subscription
-- tables for the full product land in later sub-projects (SP-2 onward).

-- =============================================================================
-- 1. Enums
-- =============================================================================

create type public.user_role as enum ('user', 'coach');
create type public.subscription_tier as enum ('free', 'basic', 'pro');

-- =============================================================================
-- 2. profiles table — joins to auth.users 1:1
-- =============================================================================
-- Pattern: auth.users is Supabase-managed (email, password_hash, etc.).
-- public.profiles holds our app-specific fields. Joined on id.
-- We DO NOT store password / email-verification state here — Supabase does.

create table public.profiles (
  id                  uuid                  primary key references auth.users(id) on delete cascade,
  email               text                  not null,
  name                text,
  role                public.user_role      not null default 'user',
  subscription_tier   public.subscription_tier not null default 'free',
  created_at          timestamptz           not null default now(),
  updated_at          timestamptz           not null default now()
);

comment on table public.profiles is 'App-level user profile (1:1 with auth.users). Created automatically by handle_new_user trigger.';
comment on column public.profiles.role is 'user = paying customer; coach = the trainer admin. Set to coach manually for now.';
comment on column public.profiles.subscription_tier is 'free | basic (£150/mo) | pro (£300/mo). Default free; promoted by Stripe webhook in later sub-project.';

-- Index for the most common query: get profile by id (already PK)
-- Index for coach views that LIST users
create index profiles_role_idx on public.profiles (role);

-- =============================================================================
-- 3. updated_at trigger — auto-bumps timestamp on UPDATE
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- 4. handle_new_user trigger — creates profile row when auth.users inserts
-- =============================================================================
-- Replaces the original-plan's Clerk webhook handler. When Supabase Auth
-- creates a new auth.users row (after email verification / signup), this
-- trigger automatically populates the matching public.profiles row.
--
-- security definer + locked search_path:
--   - definer: runs with the privileges of the function owner (postgres),
--     not the caller; necessary because auth.users insert is not done by
--     the future authenticated user.
--   - search_path = '': protects against schema-spoof attacks where a
--     malicious schema could shadow public functions.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =============================================================================
-- 5. Row Level Security
-- =============================================================================
-- Default: deny all. Then add explicit policies for allowed cases.

alter table public.profiles enable row level security;

-- Policy: a signed-in user can SELECT their own profile.
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Policy: a signed-in user can UPDATE their own profile (name only — role
-- and subscription_tier are gated by server-side mutations).
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent self-promotion: row's role and tier must not change here.
    -- (Coach + tier transitions happen via service_role from server actions
    -- after Stripe events.)
    and (select role from public.profiles where id = auth.uid()) = role
    and (select subscription_tier from public.profiles where id = auth.uid()) = subscription_tier
  );

-- Policy: a user whose role = coach can SELECT ANY profile.
-- Implemented via an EXISTS subquery rather than joining auth.jwt() because
-- the coach role lives in our profiles table, not the JWT.
create policy "profiles_select_coach_all"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'coach'
    )
  );

-- No INSERT policy: profiles are created by the SECURITY DEFINER trigger,
-- bypassing RLS. Direct client-side inserts are blocked.
-- No DELETE policy: deletes happen via auth.users cascade (account closure).

-- =============================================================================
-- 6. Grants
-- =============================================================================
-- Supabase auto-grants USAGE on public schema to authenticated + anon roles.
-- We need SELECT and UPDATE on profiles for authenticated:

grant select, update on public.profiles to authenticated;
-- No grants to anon — RLS would block anyway, but explicit deny is safer.
