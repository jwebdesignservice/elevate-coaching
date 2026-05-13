# SP-2: Profile + Category Onboarding — Design

**Project:** Elevate Coaching — premium training platform
**Sub-project:** SP-2 of 8 (Profile + Variables)
**Date:** 2026-05-13
**Status:** Approved, ready for implementation plan
**Owner:** Jack
**Prior art:** `2026-05-13-sp1-platform-spine-design.md`, `notes/sp1-retro.md`

---

## 1. Context

SP-1 shipped the platform spine: Next.js 16, Supabase auth, the `profiles` table (`id, email, name, role, subscription_tier, timestamps`), the branded dashboard / settings / landing shell, RLS policies, and CI. The dashboard currently renders static demo data and there is no onboarding gate.

SP-2 adds the **first piece of real product data**: the user's training category. The coach manages content per category (A/B/C/D); without a category set, the dashboard has nothing meaningful to show and SP-4 onwards has nothing to filter on. SP-2 also adds the change-request flow that was scoped into SP-1 by schema only — the table exists in spec, never made it into the shipped migration, and lands here in full.

The SP-1 retro flagged the category and goal taxonomies as the single highest-risk decision for SP-2 — speculative product semantics cascade into onboarding, dashboard widgets, settings, and the eventual programs filter. This document locks those semantics before the migration is written.

---

## 2. Locked decisions from brainstorm

| #   | Decision                 | Choice                                                                                                                                                            |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Category names           | **A = Beginner, B = Fat Loss, C = Strength, D = Advanced.** Verbatim from brief.                                                                                  |
| Q2  | Goals as a separate axis | **Dropped.** The brief commits to four things; those are the categories. There is no second multi-select goals axis. This overrides SP-1 §2 Q8.                   |
| Q3  | Goals column on profiles | **Not added.** No `goals text[]` column, no `lib/goals.ts`, no goals picker in onboarding.                                                                        |
| Q4  | Schema additions         | **`category` only.** No `avatar_url`, `date_of_birth`, or `country` — the brief does not commit to them. Add later if/when the brief does.                        |
| Q5  | Category column type     | **Postgres enum `user_category` (`'A' \| 'B' \| 'C' \| 'D'`), nullable.** Enum gives DB-level integrity; nullable until onboarded.                                |
| Q6  | Category change flow     | **Self-request, coach-approves.** User picks at signup; later changes go through `category_change_requests` (pending → approved/denied) per SP-1 spec §90.        |
| Q7  | Onboarding gate          | **Server-side redirect.** Authed layout reads `profile.category`; if NULL → redirect to `/onboarding`. `/onboarding` redirects to `/dashboard` once category set. |
| Q8  | Onboarding shape         | **One screen, four cards.** Single pick, server action writes the row, redirect to `/dashboard`.                                                                  |

### Why Q2 (no goals axis) overrides SP-1 §2 Q8

The SP-1 brainstorm captured "two separate axes: category gates access, goals influence recommendations only," and the SP-1 plan's Task 17 invented a six-item goals list (`muscle_gain, fat_loss, strength, performance, mobility, discipline`). On re-read with the actual brief in hand, the goals list duplicated category semantics (`fat_loss`, `strength` appearing as both) and added no product capability — recommendations don't exist yet, won't exist in SP-2, and the four categories already say what the user wants. We drop the axis rather than ship a column we'd be ignoring.

If a real recommendations engine appears later (SP-7 admin or beyond), a goals column can be added then with the actual use case in hand.

---

## 3. Scope

### What SP-2 ships

1. **`lib/categories.ts`** — the canonical taxonomy module (constants + types + display info).
2. **Schema migration** — `user_category` enum, `profiles.category` column (nullable), index, plus the `category_change_requests` table with RLS.
3. **Regenerated Supabase types** (`lib/supabase/database.types.ts`) so the new column is typed everywhere.
4. **Onboarding route** at `/onboarding` — four-card picker, server action, post-submit redirect to `/dashboard`.
5. **Onboarding gate** — authed layout server-side redirect when `profile.category IS NULL`. `/onboarding` itself redirects to `/dashboard` when category is already set (prevents re-onboarding loops).
6. **Settings page upgrade** — render category badge + name + description; "Request change" button opens an inline form that posts to a server action and inserts a `category_change_requests` row.
7. **Dashboard category badge** — replace the demo "CURRENT PROGRAM" eyebrow with the user's real category name; ProgramHero copy still uses demo data (SP-5 owns the real programme fetch).
8. **Mobile sidebar drawer** — the SP-1 acceptance doc flagged this as a known limitation; SP-2 adds the hamburger + off-canvas pattern at `<768px` since onboarding/settings will be hit on mobile.
9. **Tests** — Vitest unit test for `lib/categories.ts` exports, Vitest integration test for the onboarding server action (writes category, errors on invalid value), Playwright e2e for the sign-up → onboarding → dashboard happy path.

### Explicitly out of scope

- Stripe / `subscription_tier` writes — SP-3.
- Real programmes / tasks / metrics on the dashboard — SP-4 / SP-5.
- Admin UI for approving change requests — SP-7. (The table accepts inserts via the user's own row; approval is a SQL `UPDATE` from the coach's row via RLS for now.)
- `avatar_url`, `date_of_birth`, `country`, `goals` — not in brief.
- Editing name / email — these already exist on `profiles` from SP-1 but the editing UI is deferred. Settings stays read-only for those fields in SP-2.

---

## 4. Taxonomy

### `lib/categories.ts`

```typescript
export const CATEGORIES = ['A', 'B', 'C', 'D'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_INFO: Record<
  Category,
  { code: Category; name: string; tagline: string; description: string }
> = {
  A: {
    code: 'A',
    name: 'Beginner',
    tagline: 'Build your base.',
    description:
      'New to structured training or returning after a break. Focus on technique, consistency, and a sustainable weekly routine.',
  },
  B: {
    code: 'B',
    name: 'Fat Loss',
    tagline: 'Lean down, stay strong.',
    description:
      'Body composition, conditioning, and habits. Programmes balance resistance work with calorie-aware conditioning.',
  },
  C: {
    code: 'C',
    name: 'Strength',
    tagline: 'Get bigger and stronger.',
    description:
      'Progressive overload, muscle growth, max-strength work. For users with a solid training base.',
  },
  D: {
    code: 'D',
    name: 'Advanced',
    tagline: 'Train like an athlete.',
    description:
      'High volume, advanced technique, recovery and performance tracking. For 2+ years of consistent training.',
  },
};

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}
```

Descriptions are intentionally short and unambiguous so a first-time user can self-select in under 30 seconds. `tagline` is for the onboarding card hero line; `name` is for the settings badge and dashboard eyebrow; `description` is for the onboarding card body and the settings "what this means" expand.

---

## 5. Schema migration

Migration file: `supabase/migrations/<timestamp>_sp2_category.sql`. Single transaction, idempotent where useful, in line with the SP-1 migration's style.

```sql
-- SP-2: add category to profiles + category change requests
-- ============================================================================
-- 1. category enum
-- ============================================================================
create type public.user_category as enum ('A', 'B', 'C', 'D');

comment on type public.user_category is
  'Training category. A=Beginner, B=Fat Loss, C=Strength, D=Advanced. Coach-managed content lanes.';

-- ============================================================================
-- 2. profiles.category
-- ============================================================================
alter table public.profiles
  add column category public.user_category;

comment on column public.profiles.category is
  'NULL until the user completes onboarding. Coach assigns content per category.';

create index profiles_category_idx on public.profiles (category);

-- ============================================================================
-- 3. category_change_requests
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

  constraint ccr_different_category check (current_category is distinct from requested_category)
);

comment on table public.category_change_requests is
  'User-initiated requests to change training category. Coach reviews and resolves.';

create index ccr_status_pending_idx on public.category_change_requests (status) where status = 'pending';
create index ccr_user_id_idx on public.category_change_requests (user_id);

-- ============================================================================
-- 4. RLS — category_change_requests
-- ============================================================================
alter table public.category_change_requests enable row level security;

-- Users can SELECT their own requests.
create policy "ccr_select_own"
  on public.category_change_requests
  for select
  using (auth.uid() = user_id);

-- Users can INSERT their own requests. WITH CHECK enforces user_id matches
-- the session, and that current_category matches the profile row (no spoofing).
create policy "ccr_insert_own"
  on public.category_change_requests
  for insert
  with check (
    auth.uid() = user_id
    and current_category = (select category from public.profiles where id = auth.uid())
  );

-- Coaches can SELECT all requests.
create policy "ccr_select_coach_all"
  on public.category_change_requests
  for select
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'coach'
    )
  );

-- Coaches can UPDATE (approve / deny) any request. The server action that
-- approves a request must also UPDATE the target profile's category in the
-- same transaction.
create policy "ccr_update_coach"
  on public.category_change_requests
  for update
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'coach'
    )
  );

grant select, insert on public.category_change_requests to authenticated;
grant update on public.category_change_requests to authenticated;
```

### Notes on the migration

- **Enum ALTERs are non-transactional.** Adding a fifth category later requires `ALTER TYPE ... ADD VALUE` — supported but cannot run inside a transaction. Documented in the migration's leading comment so the next sprint isn't caught out.
- **Backfill.** Existing `profiles` rows get `category = NULL`. Onboarding gate redirects them on next visit; no data migration needed.
- **Type regeneration.** `npx supabase gen types typescript --linked > lib/supabase/database.types.ts` ships in the same commit. The implementation plan verifies that `Database['public']['Tables']['profiles']['Row']['category']` resolves to `'A' | 'B' | 'C' | 'D' | null`.

---

## 6. Onboarding flow

### Route: `/onboarding`

Server component layout:

- Auth: existing `getCurrentUser()` helper. If no session → redirect `/sign-in`.
- If `profile.category` is non-null → redirect `/dashboard` (prevents re-onboarding loop).
- Otherwise render the picker.

Picker layout:

- Centred page, `bg-background`, no sidebar / topbar (this is a flow, not the authed shell).
- `<h1>` "Pick your training category" + subtitle "You can change this any time from settings." (uses design-system tokens — `text-3xl font-bold tracking-tight`, `text-sm text-text-muted`).
- 2×2 grid of category cards at `≥md`, single column at `<md`. Each card is a Base UI radio.
- Card content (per `CATEGORY_INFO`):
  - Eyebrow: `Category {code}` — small mint tracked-uppercase.
  - Headline: `name` — `text-2xl font-semibold`.
  - Tagline: `tagline` — `text-sm text-text-muted`.
  - Description: `description` — `text-sm text-text-muted leading-relaxed`.
- Submit button: mint accent CTA, disabled until a card is selected.

### Server action

`app/onboarding/_actions.ts`:

```typescript
'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/categories';

const schema = z.object({ category: z.enum(CATEGORIES) });

export async function setCategoryAction(formData: FormData) {
  const parsed = schema.safeParse({ category: formData.get('category') });
  if (!parsed.success) {
    return { ok: false, error: 'Please pick a category.' };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { error } = await supabase
    .from('profiles')
    .update({ category: parsed.data.category })
    .eq('id', user.id)
    .is('category', null); // guard: only allow first-time set

  if (error) {
    return { ok: false, error: 'Could not save. Please try again.' };
  }

  redirect('/dashboard');
}
```

RLS on `profiles_update_own` already restricts to `auth.uid() = id`. The `.is('category', null)` filter means a successful update can only land when category was previously NULL — the action is idempotent and safe against double-submit.

### Onboarding gate (authed layout)

`app/(authed)/layout.tsx` already reads the profile for the TopBar avatar. Add:

```typescript
if (!profile.category) {
  redirect('/onboarding');
}
```

Placed after the existing `if (!user) redirect('/sign-in')` and after the profile fetch.

---

## 7. Settings page changes

Existing `/settings` page renders Profile (name/email/tier/role) read-only. SP-2 adds:

### Category card

```
[CATEGORY {code}]                      ← eyebrow
{name}                                 ← text-xl font-semibold
{description}                          ← text-sm text-text-muted
[Request change]                       ← outline accent button
```

### Change-request form (inline disclosure)

Clicking "Request change" expands a Base UI `Collapsible` containing:

- A radio list of the **other three** categories (current is excluded).
- A `textarea` for reason (optional, ≤500 chars).
- Submit + Cancel buttons.

Server action `requestCategoryChangeAction(formData)`:

- Validates with zod (`requested_category` in `CATEGORIES` and ≠ current; reason ≤500).
- Reads current category from profile.
- Inserts into `category_change_requests` with `status='pending'`.
- Returns `{ ok: true, message: 'Request sent.' }` — does **not** redirect.

After submission the form collapses and a `text-accent text-sm` confirmation line renders below the card: `"Change request submitted. We'll be in touch."`

### Pending-request banner

If the user already has a pending request, the change-request button is replaced by a status line:

```
Requested change to {requested_name} on {date}. Awaiting coach approval.
```

This prevents duplicate submissions and gives clear feedback. Server reads from `category_change_requests` filtered by user_id + status='pending', ordered desc, limit 1.

---

## 8. Dashboard category badge

Replace the demo `CURRENT PROGRAM` eyebrow on the dashboard with the user's real category. ProgramHero copy itself remains demo data (SP-5 wires real programmes).

Path: `app/(authed)/dashboard/page.tsx` — eyebrow span becomes:

```tsx
<span className="text-accent text-[11px] font-semibold uppercase tracking-[0.25em]">
  Category {profile.category} · {CATEGORY_INFO[profile.category!].name}
</span>
```

The `!` is sound because the authed layout redirects when category is NULL.

---

## 9. Mobile sidebar drawer

Per SP-1 acceptance doc — `Sidebar` is currently fixed at 220px on every viewport. SP-2 adds:

- A hamburger button in the TopBar visible at `<md` only.
- Sidebar component takes a `mobileOpen: boolean` + `onClose: () => void` prop in addition to current props.
- At `<md`: Sidebar renders inside a Base UI `Dialog` (drawer primitive) as an off-canvas panel, hidden by default, slide-in from the left when opened. Backdrop dims the page. ESC + backdrop-click close.
- At `≥md`: Sidebar renders inline as today; the hamburger is hidden.
- TopBar title shifts left to fill the space at `<md`.

This is the only visual change in SP-2 outside the onboarding/settings work.

---

## 10. Routes summary

| Route                             | Auth     | Behaviour                                                                                  |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `/onboarding`                     | required | Renders picker if `category IS NULL`; redirects to `/dashboard` otherwise.                 |
| `/dashboard`                      | required | Redirects to `/onboarding` if `category IS NULL`; otherwise renders shell + real category. |
| `/settings`                       | required | Renders profile + category card + change-request form. Read-only for everything else.      |
| (server action) onboarding submit | required | `.is('category', null)` guard; redirects to `/dashboard` on success.                       |
| (server action) request change    | required | Inserts pending row; returns confirmation, no redirect.                                    |

No new public routes.

---

## 11. Acceptance criteria

A new signed-up user:

- [ ] Lands on `/onboarding` immediately after their first sign-in.
- [ ] Sees four cards (A/B/C/D) with the names and descriptions from `CATEGORY_INFO`.
- [ ] Cannot submit without picking a card (the CTA is disabled).
- [ ] On submit, lands on `/dashboard` and sees their category in the eyebrow.
- [ ] Direct-navigating back to `/onboarding` redirects them to `/dashboard`.
- [ ] On `/settings`, sees the category card with the same code + name + description.
- [ ] Can click "Request change", pick a different category, submit, and see the confirmation line.
- [ ] After submitting a request, the button is replaced with the pending-status line.
- [ ] Cannot insert a `category_change_requests` row where `current_category` is spoofed (RLS rejects).
- [ ] On mobile (<768px), the sidebar opens via a hamburger and closes via backdrop / ESC.

A coach user (role='coach'):

- [ ] Can `select * from category_change_requests` and see all pending rows (SP-7 builds the UI; the SQL probe is enough for SP-2).
- [ ] Can `update category_change_requests set status='approved'` and the policy permits it.

Tests:

- [ ] Vitest unit test for `lib/categories.ts` — `CATEGORIES`, `CATEGORY_INFO` shape, `isCategory()` true/false branches.
- [ ] Vitest integration test for `setCategoryAction` — happy path writes the column, invalid input returns error, second call (category already set) does not overwrite.
- [ ] Playwright e2e: sign up → email-verify (or use Supabase admin to confirm) → land on `/onboarding` → pick "Beginner" → reach `/dashboard` → eyebrow shows `Category A · Beginner`.
- [ ] Lint, typecheck, format, build all green.

---

## 12. Risks and mitigations

- **Enum migrations are expensive to alter later.** If a fifth category is added, it's `ALTER TYPE ... ADD VALUE` — supported but cannot run inside a transaction. Mitigation: documented in the migration's leading comment so the next sprint isn't caught out.
- **The `.is('category', null)` guard depends on RLS + an explicit filter.** If RLS were ever relaxed and the filter dropped, a returning user could re-onboard. Mitigation: comment the filter prominently; the integration test asserts the second-call no-op.
- **Coach approval is SQL-only in SP-2.** Intentional (the UI lives in SP-7) but means we ship a feature the user can submit into without seeing resolution in-app. Mitigation: the pending-status banner makes the state visible; the coach can resolve via Supabase Studio for now. The approval flow in SP-2 is **two manual SQL statements**: `UPDATE category_change_requests SET status='approved', resolved_at=now(), resolved_by=<coach_id> WHERE id=…` followed by `UPDATE profiles SET category=<requested> WHERE id=<user_id>`. SP-7 will wrap both in a single server action. Documented in §3 out-of-scope.
- **Spec-vs-plan drift, redux.** SP-1 retro flagged plan files going stale fast against the architecture. Mitigation: write the implementation plan _after_ the migration lands, not before. The plan references real column names, not speculative ones.

---

## 13. Implementation phasing (preview)

The full implementation plan lives in a follow-on doc. Suggested phases:

- **Phase A — Schema:** migration + types regen + RLS verification SQL.
- **Phase B — Taxonomy module:** `lib/categories.ts` + unit tests.
- **Phase C — Onboarding:** route + server action + gate in authed layout + e2e.
- **Phase D — Settings:** category card + change-request form + pending banner.
- **Phase E — Dashboard category badge:** one-line change + assert in e2e.
- **Phase F — Mobile drawer:** sidebar refactor + responsive Playwright check.
- **Phase G — Tidy:** acceptance walk-through, retro stub.

Each phase commits independently. Phase A must merge first so types regen flows into B–F.
