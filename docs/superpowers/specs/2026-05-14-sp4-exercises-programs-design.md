# SP-4: Exercises + Programmes — Design

**Project:** Elevate Coaching — premium training platform
**Sub-project:** SP-4 of 8 (Exercises + Programmes)
**Date:** 2026-05-14
**Status:** Approved, ready for implementation plan
**Owner:** Jack
**Prior art:** `2026-05-13-sp3-stripe-plan-gating-design.md`, `notes/sp3-kickoff.md`
**Brief reference:** https://docs.google.com/document/d/1XL14sUc-0epV7VBBw6B6RulmWBhzYmEx/edit (§7, §8, §11, §13)

---

## 1. Context

SP-3 shipped the full Stripe billing loop — `hasPlanAtLeast()` primitive, Checkout, Customer Portal, webhook, `/pricing` page and the settings subscription card. The `subscription_tier` column is now live and updated by Stripe events.

SP-4 is the first real content module. The original sequence had SP-4 as "Dashboard + Tasks" but the client explicitly deprioritised tasks in favour of **exercises and programmes first** — the core product value. Daily tasks move to SP-5.

SP-4 ships:
- A global **exercise library** (coach creates, users browse)
- A **programme system** with a full hierarchy: Programme → Weeks → Sessions → Exercises
- User **programme enrolment and progress tracking** (% completion, session completion, continue where you left off)
- **1RM-based weight auto-calculation** in session view
- A minimal **coach admin area** (`/admin`) for managing exercises and programmes
- **Profile gaps** from the brief that were never closed: avatar upload, phone field, name/email editing, max lifts

SP-5 takes everything built here and adds the daily task accountability layer on top of the dashboard.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|---|---|
| Q1 | SP sequence change | SP-4 = Exercises + Programmes. SP-5 = Dashboard + Daily Tasks. Client priority. |
| Q2 | Content architecture | Two tracks: Daily Tasks (SP-5) + Programme Track (SP-4). Not merged. |
| Q3 | Programme structure | Programme → Weeks → Sessions (workouts) → Exercises. Sessions layer is correct from day one; SP-7 adds drag-and-drop builder UI. |
| Q4 | % tracking | Both programme completion % (weeks done / total weeks) AND 1RM % (auto-calculate session weights from user's max lift profile). |
| Q5 | Exercise library | Global, not category-scoped. Coach creates exercises once, reuses across any programme. |
| Q6 | Plan gating | At programme level via `programs.plan_access`. Free = free-tagged programmes only. Basic+ = all non-Pro programmes. Pro = everything. |
| Q7 | Admin UI | Minimal forms for now (`/admin` routes). SP-7 replaces with polished builder. Data model is correct from day one so no schema rework in SP-7. |
| Q8 | Profile gaps | Close all brief §11 gaps in SP-4 since settings is already being touched for max lifts: avatar upload, phone, name editing, email editing (with verification). |
| Q9 | 1RM fields | 4 columns added to `profiles`: `max_lift_squat`, `max_lift_bench`, `max_lift_deadlift`, `max_lift_ohp` (all `numeric`, kg, nullable). |

---

## 3. Scope

### What SP-4 ships

1. **DB migration** — `exercises`, `programs`, `program_weeks`, `program_sessions`, `session_exercises`, `user_program_enrollments`, `user_session_completions`, `progress_logs` tables. Plus 4 max lift columns + `phone` + `avatar_url` on `profiles`.
2. **Exercise library** — `/exercises` grid with muscle group filtering and detail panel. `/exercises/[id]` detail page.
3. **Programme listing** — `/programs` with active-programme banner, enrolled/available/locked cards.
4. **Programme detail** — `/programs/[id]` with cover, description, week list and Start/Continue CTA.
5. **Week detail** — `/programs/[id]/week/[n]` with session list and completion state.
6. **Session view** — `/programs/[id]/week/[n]/session/[s]` with exercise list, auto-calculated weights from 1RM, per-exercise completion checkbox, "Mark session complete" CTA.
7. **Programme enrolment** — server action on programme detail page. Writes to `user_program_enrollments`. One active enrolment per programme per user.
8. **Session completion** — server action on session view. Writes to `user_session_completions` and `progress_logs`. Advances `last_session_id` on the enrolment.
9. **Dashboard updates** — hero card shows active programme (real data from enrolment). Programme progress metric card. Sessions done metric card.
10. **Admin index** — `/admin` — role-gated (profiles.role = 'admin'). Links to exercises and programmes.
11. **Admin exercise management** — `/admin/exercises` (table), `/admin/exercises/new`, `/admin/exercises/[id]/edit`.
12. **Admin programme management** — `/admin/programs` (table), `/admin/programs/new`, `/admin/programs/[id]/edit` (the builder: weeks → sessions → exercises with inline sets/reps/weight/rest fields).
13. **Settings — profile gaps closed** — avatar upload, phone field, name editing, email editing with re-verification. All in `/settings`.
14. **Settings — max lifts card** — 4 fields (squat/bench/deadlift/OHP in kg) with live % preview. Writes to `profiles`. Used in session view for weight calculation.
15. **Regenerated Supabase types** after migration.
16. **Tests** — Vitest unit tests for weight calculation logic, programme progress % calculation. Playwright smoke for `/programs`, `/exercises`, session completion flow.

### Explicitly out of scope

- Daily tasks — SP-5.
- Tutorial video library — SP-6. Exercise cards have a `video_url` field and a "Video — SP-6" placeholder in the UI.
- Nutrition plans — SP-8.
- Full admin user management — SP-7.
- Drag-and-drop programme builder — SP-7.
- Bulk publish / mass-upload — SP-7.
- Cover image file upload (use URL input for now; file upload infrastructure added when needed).

---

## 4. Data model

### New tables

```sql
-- Global exercise library
create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  video_url     text,                    -- SP-6 populates this
  muscle_groups text[] not null default '{}',
  tags          text[] not null default '{}',  -- 'compound','push','pull','lower','upper'
  created_at    timestamptz not null default now()
);

-- Programmes
create table public.programs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  cover_image_url text,
  category        user_category,         -- null = all categories
  plan_access     subscription_tier not null default 'free',
  status          text not null default 'draft' check (status in ('draft','active')),
  created_at      timestamptz not null default now()
);

create table public.program_weeks (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs on delete cascade,
  week_number  int not null,
  title        text not null,
  description  text,
  unique (program_id, week_number)
);

create table public.program_sessions (
  id                       uuid primary key default gen_random_uuid(),
  week_id                  uuid not null references public.program_weeks on delete cascade,
  session_number           int not null,
  title                    text not null,
  instructions             text,
  estimated_duration_mins  int,
  completion_rule          text,          -- coach note on what counts as "done"
  unique (week_id, session_number)
);

create table public.session_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.program_sessions on delete cascade,
  exercise_id  uuid not null references public.exercises on delete restrict,
  order_index  int not null default 0,
  sets         int,
  reps         text,                      -- '5' or '8–12' (text for ranges)
  weight       text,                      -- '75% 1RM' or '60kg' or 'Bodyweight'
  pct_of_1rm   int,                       -- nullable; if set, weight is auto-calc'd
  rest_seconds int,
  notes        text,
  lift_key     text,                      -- 'squat'|'bench'|'deadlift'|'ohp'|null — which 1RM to use for auto-calc
  tutorial_id  uuid                       -- bare UUID (no FK constraint); SP-6 adds the tutorials table + FK
);

-- User progress
create table public.user_program_enrollments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles on delete cascade,
  program_id          uuid not null references public.programs on delete cascade,
  enrolled_at         timestamptz not null default now(),
  current_week_number int not null default 1,
  last_session_id     uuid references public.program_sessions,
  unique (user_id, program_id)
);

create table public.user_session_completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles on delete cascade,
  session_id   uuid not null references public.program_sessions on delete cascade,
  program_id   uuid not null references public.programs on delete cascade,
  week_number  int not null,
  completed_at timestamptz not null default now(),
  unique (user_id, session_id)              -- idempotent: one completion per session
);

create table public.progress_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles on delete cascade,
  date                date not null default current_date,
  metric_type         text not null,        -- 'session_completed' | 'program_enrolled' | 'program_completed'
  value               numeric not null default 1,
  related_program_id  uuid references public.programs,
  related_session_id  uuid references public.program_sessions
);
```

### Additions to `profiles`

```sql
alter table public.profiles
  add column max_lift_squat    numeric,    -- kg, user-editable
  add column max_lift_bench    numeric,
  add column max_lift_deadlift numeric,
  add column max_lift_ohp      numeric,
  add column phone             text,       -- user-editable, brief §11
  add column avatar_url        text;       -- user-uploaded, brief §11
```

### RLS

- `exercises`, `programs`, `program_weeks`, `program_sessions`, `session_exercises` — public read (all authenticated users). Write = service role / admin only (enforced at app layer; admin middleware check).
- `user_program_enrollments`, `user_session_completions`, `progress_logs` — users read/write own rows only (`auth.uid() = user_id`).
- New `profiles` columns — user can update their own `max_lift_*`, `phone`, `avatar_url`, `name`, `email` (using the existing `profiles_update_own` policy from SP-3).

---

## 5. Weight auto-calculation

When `session_exercises.pct_of_1rm` is set and the relevant `profiles.max_lift_*` is non-null, the session view calculates the working weight. `session_exercises.lift_key` tells the system which max lift to use:

```typescript
// lib/lifts.ts
const LIFT_KEY_TO_PROFILE: Record<string, keyof MaxLifts> = {
  squat:    'max_lift_squat',
  bench:    'max_lift_bench',
  deadlift: 'max_lift_deadlift',
  ohp:      'max_lift_ohp',
};

export function calcWeight(
  pctOf1rm: number,
  liftKey: string | null,
  profile: MaxLifts,
): string {
  const col = liftKey ? LIFT_KEY_TO_PROFILE[liftKey] : null;
  const max1rm = col ? profile[col] : null;
  if (!max1rm) return `${pctOf1rm}% 1RM`;
  const kg = Math.round((pctOf1rm / 100) * max1rm * 2) / 2; // round to nearest 0.5kg
  return `${pctOf1rm}% 1RM → ${kg} kg`;
}
```

The `session_exercises.weight` field stores the coach's prescription as plain text (`"75% 1RM"`, `"60kg"`, `"Bodyweight+20kg"`) for display when `pct_of_1rm` is not set. The admin builder shows a `lift_key` dropdown (Squat / Bench / Deadlift / OHP / None) when `pct_of_1rm` is entered.

---

## 6. Programme progress calculation

```typescript
// lib/programs.ts
export function programProgressPct(
  totalSessions: number,
  completedSessions: number,
): number {
  if (totalSessions === 0) return 0;
  return Math.round((completedSessions / totalSessions) * 100);
}
```

`totalSessions` = count of `program_sessions` joined through `program_weeks` for the programme. `completedSessions` = count of `user_session_completions` for the user + programme. Both are queried server-side and passed as props.

---

## 7. Routes

### User-facing

| Route | Auth | Description |
|---|---|---|
| `GET /dashboard` | Required | Updated: hero card shows active programme. Programme % and sessions done metric cards. |
| `GET /programs` | Required | Programme grid filtered to user's category + plan. Active-programme banner at top. |
| `GET /programs/[id]` | Required | Programme detail: cover, description, week list, plan gate, Start/Continue CTA. |
| `POST /programs/[id]/enroll` | Required | Server action. Creates `user_program_enrollments` row. |
| `GET /programs/[id]/week/[n]` | Required | Week detail: session list with completion state. |
| `GET /programs/[id]/week/[n]/session/[s]` | Required | Session view: exercises, 1RM calc, completion checkbox, Mark complete CTA. |
| `POST /programs/[id]/week/[n]/session/[s]/complete` | Required | Server action. Writes `user_session_completions` + `progress_logs`, advances enrolment. |
| `GET /exercises` | Required | Exercise library: search, muscle group filter, detail panel. |
| `GET /exercises/[id]` | Required | Exercise detail: full description, muscle groups, programmes it appears in, user's 1RM. |
| `GET /settings` | Required | Updated: avatar, phone, name, email, max lifts card, category, subscription (existing). |

### Admin (role = 'admin' only)

| Route | Description |
|---|---|
| `GET /admin` | Index with links to exercises and programmes. |
| `GET /admin/exercises` | Exercise table: title, muscle groups, tag count, edit/delete. |
| `GET /admin/exercises/new` | Create exercise form. |
| `GET /admin/exercises/[id]/edit` | Edit exercise form. |
| `GET /admin/programs` | Programme table: title, category, plan access, status, week/session counts, active users. |
| `GET /admin/programs/new` | Create programme form (metadata only; weeks added in edit view). |
| `GET /admin/programs/[id]/edit` | Programme builder: metadata panel + week/session/exercise builder. |

Admin routes are protected by a middleware check: `if (profile.role !== 'admin') redirect('/dashboard')`.

---

## 8. Plan gating

Gating is enforced server-side on the programme detail and listing pages using the existing `hasPlanAtLeast()` primitive from `lib/plans.ts`:

```typescript
// On /programs/[id]
const canAccess = hasPlanAtLeast(profile.subscription_tier, program.plan_access);
if (!canAccess) {
  // Show programme overview + upgrade CTA, but block week/session access
}
```

| `program.plan_access` | Free user | Basic user | Pro user |
|---|---|---|---|
| `'free'` | ✅ Full access | ✅ | ✅ |
| `'basic'` | 🔒 Upgrade prompt | ✅ Full access | ✅ |
| `'pro'` | 🔒 Upgrade prompt | 🔒 Upgrade prompt | ✅ Full access |

---

## 9. Settings — profile gaps

All brief §11 fields are closed in SP-4 since settings is already being modified for max lifts:

| Field | Implementation |
|---|---|
| Name | Editable input. Server action updates `profiles.name`. No verification needed. |
| Email | Editable input. Server action calls Supabase `auth.updateUser({ email })` which sends a verification email. |
| Phone | New `profiles.phone` column. Editable input. No verification. |
| Avatar | New `profiles.avatar_url` column. Upload via Supabase Storage bucket `avatars`. File size limit 2MB, accept `image/jpeg,image/png,image/webp`. Store public URL. |
| Max lifts | 4 new numeric columns. Editable inputs with live `75% → X kg` preview. |

---

## 10. Dashboard updates

The existing dashboard shell (SP-1) gets two real-data updates:

**Hero card** — replaces placeholder with:
- Active programme name, week, and "Continue Programme →" CTA
- Progress bar showing programme % complete
- "Sessions done this week" stat
- If no active programme: "Start a programme →" CTA linking to `/programs`

**Metric cards** — two cards get real data:
- `Programme %` — from `user_program_enrollments` + completion count
- `Sessions done` — all-time count from `user_session_completions`

The other two metric cards (Tasks done %, Daily streak) remain as honest placeholders until SP-5.

---

## 11. Admin middleware

```typescript
// middleware.ts — add admin route protection
// /admin/* routes check profiles.role = 'admin' server-side
// Non-admin users are redirected to /dashboard
```

The `profiles.role` column already exists from SP-1 (`'user' | 'admin'`). No schema change needed. The coach sets their own role directly in Supabase Studio.

---

## 12. Acceptance criteria

Exercises:
- [ ] `/exercises` renders a grid of exercises filterable by muscle group.
- [ ] Clicking an exercise opens the detail panel with description, muscle groups, and 1RM.
- [ ] Admin can create/edit/delete exercises at `/admin/exercises`.

Programmes:
- [ ] `/programs` shows programmes matching the user's category + plan. Locked programmes show upgrade CTA.
- [ ] User can enrol in a programme. Enrolment persists across sessions.
- [ ] Session view shows exercises with sets/reps. Where `pct_of_1rm` is set and the user has a max lift, the calculated weight is shown (e.g. "75% 1RM → 97.5 kg").
- [ ] "Mark session complete" writes to `user_session_completions`. Programme % updates on dashboard.
- [ ] "Continue Programme →" on dashboard links directly to the next incomplete session.
- [ ] Admin can create/edit programmes, add weeks, sessions, and pick exercises from the library.

Settings:
- [ ] User can upload an avatar (2MB limit, JPEG/PNG/WebP).
- [ ] User can edit name and phone. Changes save immediately.
- [ ] User can edit email — Supabase sends a verification email.
- [ ] User can update max lifts. Session view reflects updated calculations immediately.

Plan gating:
- [ ] Free user cannot access `plan_access = 'basic'` programmes — upgrade prompt shown.
- [ ] Basic user can access all `plan_access ∈ ('free','basic')` programmes.
- [ ] `hasPlanAtLeast` unit tests all pass (inherited from SP-3).

Dashboard:
- [ ] Hero card shows real active programme (or start CTA if none enrolled).
- [ ] Programme % and sessions done metric cards show real data.

General:
- [ ] Lint, typecheck, format, build all green.
- [ ] Vitest: `lib/lifts.ts` calcWeight all branches. `lib/programs.ts` progressPct edge cases (0 sessions, 100%).
- [ ] Playwright: `/programs` renders cards, `/exercises` renders grid, session complete flow smoke test.

---

## 13. Implementation phases

| Phase | Work |
|---|---|
| A | DB migration (all tables + profiles columns) + types regen |
| B | `lib/lifts.ts` (weight calc) + `lib/programs.ts` (progress %) + Vitest unit tests |
| C | Admin middleware + `/admin` index |
| D | Admin exercise CRUD (`/admin/exercises`) |
| E | Admin programme builder (`/admin/programs`) |
| F | User exercise library (`/exercises`, `/exercises/[id]`) |
| G | User programme listing + detail + enrolment (`/programs`, `/programs/[id]`) |
| H | Week + session views + session completion (`/programs/[id]/week/[n]/session/[s]`) |
| I | Dashboard hero + metric cards (real data) |
| J | Settings: avatar upload, phone, name/email editing, max lifts card |
| K | Playwright smoke tests + acceptance walk-through + retro stub |

Each phase commits independently. Phase A must land first (types flow into B–K).
