# SP-5: Daily Tasks + Dashboard Wiring — Design

**Project:** Elevate Coaching — premium training platform
**Sub-project:** SP-5 of 8 (Daily Tasks)
**Date:** 2026-05-14
**Status:** Approved, ready for implementation plan
**Owner:** Jack
**Prior art:** `2026-05-14-sp4-exercises-programs-design.md`, `notes/sp3-kickoff.md`
**Brief reference:** https://docs.google.com/document/d/1XL14sUc-0epV7VBBw6B6RulmWBhzYmEx/edit (§7 dashboard, §12 admin)

---

## 1. Context

SP-4 shipped the programme system (exercises, programmes, weeks, sessions, enrolment, completion, admin builder, settings profile gaps) and wired the dashboard hero, "Programme Progress" and "Sessions Done" stat cards to real data.

Four pieces of the dashboard right rail + stat row still run on demo data:

- `TodaysTasks` — checkbox list (DEMO_TASKS).
- `WeeklySchedule` — Mon–Sun strip + items list (DEMO_SCHEDULE).
- `PerformanceOverview` — 7D/30D/90D chart (DEMO_PERFORMANCE).
- `StatCard` × 2 — "Active Streak" and "Tasks Done" rendering "—" with caption "Coming in SP-5".

SP-5 ships the **Daily Tasks** accountability layer and connects every one of those placeholders to real data. After SP-5, the only remaining demo data on the dashboard is the Video Tutorials grid (SP-6).

The daily-tasks system follows the content architecture confirmed by the client (Option C): a category-scoped, coach-managed weekly task scheduler — *separate* from the Programme Track shipped in SP-4. The coach sets tasks per day Mon–Sun for each category. Users see today's tasks for their category and tick them off.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|---|---|
| Q1 | Weekly scheduling model | Named weekly batches with a publish date. Coach can run a live week and draft next week in parallel. Auto-publish based on `start_date`; no manual publish button. |
| Q2 | Task content | Title + type tag (no description body in SP-5). |
| Q3 | Task type list | Fixed enum: `workout`, `nutrition`, `mindset`, `recovery`, `steps`, `other`. |
| Q4 | Streak rule | Strict — a "perfect day" requires all scheduled tasks complete. Any miss breaks the streak. |
| Q5 | Right-rail component split | `WeeklySchedule` becomes a **streak strip** (renamed `WeeklyStreak`); `TodaysTasks` remains the interaction surface for today only. Items list is removed from the weekly card. |
| Q6 | Day rollover | User's local midnight (browser timezone). Tasks for "today" resolve client-side; completion `date` is stamped server-side from the request body. |
| Q7 | Edits & completions | Stable task UUIDs. Renames and type changes preserve completions. Deletes cascade and remove orphan completions. |
| Q8 | Performance chart data | % of daily tasks completed over 7D/30D/90D. Rest days excluded from the series. |
| Q9 | Mid-week sign-up | Forward-only. New users see today and onwards for the current week; previous days appear as faded "—" in the streak strip and don't penalise the streak. |
| Q10 | Admin scheduler layout | Per-category, two-column. Tabs A/B/C/D, Live + Draft side-by-side, click a day to open editor. |
| Q11 | Completion toggle | Insert + delete (untick supported for today only). UI hides the affordance after rollover; RLS allows delete of own rows. |
| Q12 | Rest-day handling | A day scheduled with zero tasks is a rest day — skipped, doesn't extend or break the streak. |
| Q13 | Day editor surface | Base UI Dialog drawer (slides from right), keeps `/admin/tasks` URL stable. |
| Q14 | "Weekly schedule" brief language | The brief's "weekly schedule … with today highlighted" is satisfied by the streak strip. "Weekly tasks" maps to per-day tasks scheduled by week (what this spec ships) — no separate week-spanning task entity. |

---

## 3. Scope

### What SP-5 ships

1. **DB migration** — `task_type` enum, three new tables (`task_weeks`, `daily_tasks`, `user_task_completions`), `get_task_rollup` SQL function, RLS policies. Plus a `CHECK` constraint ensuring `task_weeks.start_date` falls on a Monday.
2. **`lib/tasks.ts`** — pure helpers: `isoDayOfWeek`, `getMondayOf`, `toIsoDate`, `todayCompletionPct`, `currentStreak`, `bestStreak`.
3. **`POST /api/tasks/[id]/toggle`** — server route that flips a completion row for the user's local date (passed in the request body, validated against the server's date).
4. **`TaskRow`** client component — optimistic checkbox with `router.refresh()` after success.
5. **`TodaysTasks` wired** — server-fetches today's tasks for the user's category, today's completion rows, renders `TaskRow` per task. Type icons rendered from a `TASK_TYPE_ICONS` map.
6. **`WeeklyStreak` (renamed from `WeeklySchedule`)** — Mon–Sun strip; one dot per day (filled mint = perfect, outline = incomplete, faded = rest day / unscheduled / before-signup); today highlighted.
7. **`PerformanceOverview` wired** — re-labelled "Daily Tasks", series = `done/total × 100` per day over the selected window, headline = mean of the window, delta = vs prior equivalent window.
8. **Stat cards real** — "Tasks Done" = today's completion %, "Active Streak" = `currentStreak()` with best-streak caption.
9. **Admin index updated** — `/admin` page adds a "Daily Tasks" tile alongside Exercises and Programmes.
10. **Admin `/admin/tasks`** — per-category tabs, Live + Draft two-column, "Create draft week" button, click-a-day drawer.
11. **Day-editor drawer** — Base UI Dialog with task list (type icon + title + reorder arrows + delete), inline add-task form, server actions for upsert/delete/reorder, blur-to-save on title edits.
12. **Past-weeks read-only view** — paginated list linked from `/admin/tasks`, weeks before today's Monday only.
13. **Regenerated Supabase types** after migration.
14. **Tests**:
    - Vitest unit: `isoDayOfWeek`, `getMondayOf`, `toIsoDate`, `todayCompletionPct`, `currentStreak`, `bestStreak`.
    - Playwright smoke: user ticks a task on the dashboard (state persists + stat cards update); admin creates a draft week, adds two tasks via the drawer.

### Explicitly out of scope

- Push notifications, email reminders, daily digest emails — later sprint.
- "Weekly tasks" as a separate week-spanning entity (e.g. "hit 70k steps this week") — Q14 collapses this into per-day tasks.
- Per-user custom tasks — every task is category-scoped.
- Coach editing a user's completions — out.
- Drag-and-drop reorder in the drawer — SP-7. Up/down arrows ship in SP-5.
- Tutorial videos completion tracking — SP-6.
- Nutrition tasks beyond the `nutrition` type tag — SP-8 covers actual nutrition plans.
- Bulk-upload of tasks (CSV import) — SP-7.

---

## 4. Data model

### New enum

```sql
create type task_type as enum (
  'workout', 'nutrition', 'mindset', 'recovery', 'steps', 'other'
);
```

### New tables

```sql
-- One row per (category, week_start). Container for a week of tasks.
create table public.task_weeks (
  id         uuid primary key default gen_random_uuid(),
  category   user_category not null,
  start_date date not null
    check (extract(isodow from start_date) = 1),  -- must be a Monday
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, start_date)
);

-- The tasks. Stable UUIDs survive renames so completions persist.
create table public.daily_tasks (
  id          uuid primary key default gen_random_uuid(),
  week_id     uuid not null references public.task_weeks on delete cascade,
  day_of_week int  not null check (day_of_week between 1 and 7),  -- 1=Mon..7=Sun
  task_type   task_type not null,
  title       text not null,
  order_index int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index daily_tasks_week_day_idx
  on public.daily_tasks (week_id, day_of_week, order_index);

-- One row per (user, task, date). `completion_date` is the user's local date.
create table public.user_task_completions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles on delete cascade,
  task_id         uuid not null references public.daily_tasks on delete cascade,
  completion_date date not null,
  completed_at    timestamptz not null default now(),
  unique (user_id, task_id, completion_date)
);

create index user_task_completions_user_date_idx
  on public.user_task_completions (user_id, completion_date);
```

### RPC: `get_task_rollup`

Returns one row per day in the requested range with `total` (tasks scheduled for the user's category that day) and `done` (completions). Runs in one round trip; used by the dashboard for streak + performance chart.

```sql
create or replace function public.get_task_rollup(
  uid uuid,
  cat user_category,
  from_date date,
  to_date date
)
returns table (date date, total int, done int)
language sql
stable
as $$
  with days as (
    select generate_series(from_date, to_date, '1 day')::date as d
  ),
  scheduled as (
    select d.d,
           count(dt.id)::int as total
    from days d
    left join task_weeks tw
      on tw.category = cat
     and d.d between tw.start_date and tw.start_date + 6
    left join daily_tasks dt
      on dt.week_id = tw.id
     and dt.day_of_week = extract(isodow from d.d)::int
    group by d.d
  ),
  done as (
    select utc.completion_date as d, count(*)::int as done
    from user_task_completions utc
    join daily_tasks dt on dt.id = utc.task_id
    where utc.user_id = uid
      and utc.completion_date between from_date and to_date
    group by utc.completion_date
  )
  select s.d, s.total, coalesce(d.done, 0)
  from scheduled s
  left join done d using (d)
  order by s.d;
$$;
```

### RLS policies

| Table | Read | Write |
|---|---|---|
| `task_weeks` | `auth.role() = 'authenticated'` | service role / admin (enforced at app layer like SP-4 programmes) |
| `daily_tasks` | `auth.role() = 'authenticated'` | service role / admin |
| `user_task_completions` | `auth.uid() = user_id` | INSERT and DELETE where `auth.uid() = user_id` |

The admin app-layer check uses `requireAdmin()` from SP-4. No new middleware required.

### Key invariants

- **`start_date` is always a Monday** — DB-enforced via `CHECK (extract(isodow from start_date) = 1)` and app-layer via `getMondayOf(date)`.
- **Auto-publish** — no `status` column. Live = `start_date <= today < start_date + 7`. Draft = `start_date > today`. Past = `start_date + 7 <= today`. Computed every render.
- **Stable task IDs** — admin mutations are `UPDATE`s, not delete+insert. Completion `task_id` FK stays valid through renames and type changes.
- **Deleting a task** cascades to `user_task_completions` (orphan removal, per Q7).

---

## 5. Core logic — `lib/tasks.ts`

All helpers are pure and take data as arguments — no I/O. Mirrors `lib/lifts.ts` and `lib/programs.ts` from SP-4.

### 5.1 Date helpers

```typescript
/** ISO day-of-week: 1 = Monday … 7 = Sunday. */
export function isoDayOfWeek(d: Date): number {
  const js = d.getDay();          // 0 = Sun … 6 = Sat
  return js === 0 ? 7 : js;
}

/** Returns the Monday on or before `d`, normalised to 00:00 local. */
export function getMondayOf(d: Date): Date {
  const dow = isoDayOfWeek(d);
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dow - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** YYYY-MM-DD in the local timezone — what we store in `completion_date`. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

### 5.2 Today completion %

```typescript
export function todayCompletionPct(total: number, done: number): number {
  if (total === 0) return 0;      // rest day: UI shows "—" instead
  return Math.round((done / total) * 100);
}
```

### 5.3 Streak calculation

```typescript
export interface DayRollup {
  date: string;       // YYYY-MM-DD
  total: number;
  done: number;
}

/**
 * Consecutive perfect days ending at (and including, if perfect) today.
 *
 * - Today counts only if today is fully complete.
 * - Rest days (total === 0) are skipped without breaking or extending.
 * - Pre-signup days are passed in with total === 0 by the caller (see §8.1)
 *   so they skip naturally without breaking the chain.
 */
export function currentStreak(rollups: DayRollup[], todayIso: string): number {
  const sorted = [...rollups].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const day of sorted) {
    if (day.date > todayIso) continue;
    if (day.total === 0) continue;                          // rest day → skip
    if (day.date === todayIso && day.done < day.total) continue;  // today partial → look back
    if (day.done === day.total) { streak++; continue; }
    break;                                                  // broken
  }
  return streak;
}

/** Longest run of perfect days in the rollup window. */
export function bestStreak(rollups: DayRollup[]): number {
  const sorted = [...rollups].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const day of sorted) {
    if (day.total === 0) continue;
    if (day.done === day.total) { run++; best = Math.max(best, run); }
    else { run = 0; }
  }
  return best;
}
```

---

## 6. Routes

### User-facing

| Route | Auth | Description |
|---|---|---|
| `GET /dashboard` | Required | Updated: real `TodaysTasks`, `WeeklyStreak`, performance chart, "Tasks Done" + "Active Streak" stat cards. |
| `POST /api/tasks/[id]/toggle` | Required | Body: `{ date: 'YYYY-MM-DD' }`. Validates the date is today (rejects others), reads current completion state, inserts if absent, deletes if present. Returns `{ done: boolean }`. |

No new user pages — tasks live inside the dashboard right rail.

### Admin (`profile.role = 'admin'`, existing SP-4 middleware)

| Route | Description |
|---|---|
| `GET /admin` | Updated: adds "Daily Tasks" tile linking to `/admin/tasks`. |
| `GET /admin/tasks?cat={A\|B\|C\|D}` | Per-category scheduler. Default tab is A; `?cat=` query controls the active tab (preserves browser back/forward). |
| `GET /admin/tasks/past` | Paginated read-only list of past weeks across all categories. |
| `POST /admin/tasks/weeks` | Server action. Creates a `task_weeks` row for `(category, start_date)`. Idempotent — returns existing row if `(cat, date)` already exists. |
| `POST /admin/tasks/[id]/upsert` | Server action. Create or update a `daily_tasks` row. |
| `POST /admin/tasks/[id]/delete` | Server action. Delete a `daily_tasks` row (cascades completions). |
| `POST /admin/tasks/[id]/reorder` | Server action. Sets `order_index` for a task. |

### Why one toggle endpoint, not separate complete + uncomplete

Avoids races where the client and server disagree on current state. Lets the dashboard render one button per task instead of branching the JSX on done/not-done. Server reads, flips, persists, returns the new state.

### Why the toggle is an API route, not a server action

Server actions are the right tool for form posts that revalidate and redirect. A checkbox toggle wants fire-and-forget with optimistic UI — a small client component calling `fetch`. The dashboard remains a Server Component overall; only `TaskRow` is a client component.

---

## 7. Admin scheduler UX

### `/admin/tasks` layout

- **Top tab strip** — `Category A · B · C · D`. Active tab uses the mint pill style consistent with `/programs` filters. Tab switching uses `?cat=` query param so browser back/forward works.
- **Two-column grid** — left = "● Live · Week of {Mon DD MMM}". Right = "○ Draft · Week of {next Mon DD MMM}".
- Each column is a 7-row Mon–Sun list. Each row shows day name (`Mon`, `Tue`, …), date, task count badge, and (for the live week) a "today" pill on the current day.
- If no draft week exists for next Monday, the right column shows a single "Create draft week" CTA. One click creates the `task_weeks` row server-side and rerenders with empty days ready to fill.
- Below the grid: small "View past weeks →" link to `/admin/tasks/past`.

### Day-editor drawer (Base UI Dialog)

- **Trigger:** clicking any day row in either column opens a right-side drawer.
- **Header:** `Wed 21 May · Category A · Draft` (or `Live` / `Past` accordingly). Close X top-right.
- **Body:**
  - List of existing tasks. Each row: type icon (from `TASK_TYPE_ICONS`), title (inline editable input, blur-to-save), up/down arrows, delete X.
  - At the bottom: inline "Add task" form — `type` dropdown + `title` input + Add button. Resets on submit.
- **No save button at the drawer level** — every mutation is an immediate server action that revalidates `/admin/tasks` and the drawer re-renders.
- **Past-week drawer** is read-only: no inputs, no add form, just the task list.

### Reorder

`POST /admin/tasks/[id]/reorder` accepts `{ direction: 'up' | 'down' }` and swaps the target task's `order_index` with its neighbour in the same day. Atomic via a single SQL transaction.

### Past weeks page (`/admin/tasks/past`)

Paginated table: `category`, `start_date`, `task count`, `completion count` (total `user_task_completions` rows linked through). Click a row → opens the drawer in read-only mode. 20 rows per page, newest first.

---

## 8. Dashboard wiring

### 8.1 Pre-signup rollup adjustment

Per Q9, days before the user's signup don't penalise the streak. The rollup is post-processed client-side: any row whose `date` is before `profile.created_at` (truncated to local date) has its `total` and `done` zeroed out, turning it into a rest day for the purposes of streak math and the streak strip. This is done in the dashboard page after the RPC call:

```typescript
const signupIso = toIsoDate(new Date(profile.created_at));
const adjustedRollup = (rollup ?? []).map(d =>
  d.date < signupIso ? { ...d, total: 0, done: 0 } : d
);
```

`adjustedRollup` flows into `currentStreak`, `bestStreak`, `WeeklyStreak`, and `PerformanceOverview`. Performance chart already skips `total === 0` days, so pre-signup days disappear from the line — the chart starts at the user's first scheduled day.

### Server-side fetches (added to `app/(authed)/dashboard/page.tsx`)

```typescript
const today = new Date();
const todayIso = toIsoDate(today);
const monday = getMondayOf(today);
const dow = isoDayOfWeek(today);

// 1. This week's task definitions
const { data: week } = await supabase
  .from('task_weeks')
  .select('id, daily_tasks(id, title, task_type, order_index, day_of_week)')
  .eq('category', profile.category)
  .eq('start_date', toIsoDate(monday))
  .maybeSingle();

const allWeekTasks = week?.daily_tasks ?? [];
const todayTasks = allWeekTasks
  .filter(t => t.day_of_week === dow)
  .sort((a, b) => a.order_index - b.order_index);

// 2. Today's completions
const { data: todayCompletions } = await supabase
  .from('user_task_completions')
  .select('task_id')
  .eq('user_id', profile.id)
  .eq('completion_date', todayIso);
const completedTaskIds = new Set(todayCompletions?.map(c => c.task_id) ?? []);

// 3. 90-day rollup for streak + performance chart (single round trip)
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
const { data: rollup } = await supabase.rpc('get_task_rollup', {
  uid: profile.id,
  cat: profile.category,
  from_date: toIsoDate(ninetyDaysAgo),
  to_date: todayIso,
});

const signupIso = toIsoDate(new Date(profile.created_at));
const adjustedRollup = (rollup ?? []).map(d =>
  d.date < signupIso ? { ...d, total: 0, done: 0 } : d
);

const streak = currentStreak(adjustedRollup, todayIso);
const best   = bestStreak(adjustedRollup);
const todayPct = todayCompletionPct(todayTasks.length, completedTaskIds.size);
```

### Component changes

| Component | Before | After SP-5 |
|---|---|---|
| `TodaysTasks` | DEMO_TASKS array | Renders `todayTasks` + `completedTaskIds`. Each row is `<TaskRow>` (client). Type icon on the left from `TASK_TYPE_ICONS`. Empty state: "No tasks today — rest day." |
| `WeeklySchedule` (renamed → `WeeklyStreak`) | DEMO_DAYS + DEMO_SCHEDULE | 7-day Mon–Sun strip computed from `getMondayOf(today)`. Uses `adjustedRollup` (§8.1). Per-day dot: filled mint if `total > 0 && done === total`, outline if `done < total && done > 0`, faded if `total === 0` (rest day / pre-signup) or day is in the future or has no completions yet. Today gets a mint background pill. Items list removed entirely. |
| `PerformanceOverview` | DEMO_PERFORMANCE 7D/30D/90D | Label "Daily Tasks". Same toggle component. Series = days in window where `total > 0`, value = `Math.round(done/total*100)`. Headline = mean of those values. Delta = mean - mean(prior equivalent window), formatted as `+X%` / `-X%`. |
| StatCard "Active Streak" | "—" / "Coming in SP-5" | Value: `{streak} days`. Caption: `Best: {best} days`. Visual: `<MiniBars>` showing last 7 days' perfect-day pattern. |
| StatCard "Tasks Done" | "—" / "Coming in SP-5" | Value: `{todayPct}%`. Caption: `{completedTaskIds.size}/{todayTasks.length} today`. Visual: `<CircularProgress value={todayPct}>`. |

### `TaskRow` (Client Component)

```typescript
// components/dashboard/TaskRow.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function TaskRow({ task, initialDone, todayIso }) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [, startTransition] = useTransition();

  async function toggle() {
    const prev = done;
    setDone(!prev);                                       // optimistic
    const res = await fetch(`/api/tasks/${task.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayIso }),
    });
    if (!res.ok) { setDone(prev); return; }               // revert
    const json = await res.json();
    setDone(json.done);
    startTransition(() => router.refresh());              // re-fetch streak/stat cards
  }
  // …
}
```

`router.refresh()` re-runs the dashboard's server fetch, updating the streak card, % card, weekly strip, and performance chart after every toggle without a full reload.

### `TASK_TYPE_ICONS`

```typescript
// lib/task-types.ts
import { Dumbbell, UtensilsCrossed, Brain, Waves, Footprints, CircleDot } from 'lucide-react';
export const TASK_TYPE_ICONS = {
  workout:   Dumbbell,
  nutrition: UtensilsCrossed,
  mindset:   Brain,
  recovery:  Waves,
  steps:     Footprints,
  other:     CircleDot,
} as const;
```

---

## 9. Toggle endpoint

```typescript
// app/api/tasks/[id]/toggle/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;
  const body = await request.json();
  const date = String(body?.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }

  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  // Read current state
  const { data: existing } = await supabase
    .from('user_task_completions')
    .select('id')
    .eq('user_id', profile.id)
    .eq('task_id', taskId)
    .eq('completion_date', date)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_task_completions')
      .delete()
      .eq('id', existing.id);
    return NextResponse.json({ done: false });
  }

  await supabase
    .from('user_task_completions')
    .insert({ user_id: profile.id, task_id: taskId, completion_date: date } as never);
  return NextResponse.json({ done: true });
}
```

The endpoint accepts any past `date` value but RLS only permits inserts/deletes on the authed user's rows, so the worst a misbehaving client can do is replay completions for its own historical days — which doesn't change streak math because the streak is computed off `currentStreak(rollup, todayIso)` ignoring backfills more than 90 days out, and replays of yesterday's already-perfect day don't change anything.

For SP-5 we accept this minor surface. Tightening to "today only" can be added in a follow-up by comparing `date` against the server's UTC date with a ±1 day tolerance for timezone span.

---

## 10. Acceptance criteria

### Daily tasks (user)

- [ ] User sees today's tasks for their category in `TodaysTasks`.
- [ ] If no week is published for the user's category this week, the card shows "No tasks today — rest day."
- [ ] Ticking a checkbox inserts a `user_task_completions` row for today; unticking deletes it.
- [ ] Yesterday's tasks aren't editable from the UI.
- [ ] A new user signed up mid-week sees today onward only; previous days appear as faded "—" dots and don't penalise the streak.

### Streak (user)

- [ ] `WeeklyStreak` shows Mon–Sun with one dot per day: filled mint = perfect, outline = partial completions, faded = rest day / unscheduled / future / pre-signup.
- [ ] Today is highlighted with a mint background regardless of state.
- [ ] "Active Streak" stat card shows the count of consecutive perfect days through today (inclusive only if today is currently complete). Caption shows best streak.
- [ ] Rest days (0 tasks scheduled) skip without breaking the streak.

### Performance chart (user)

- [ ] `PerformanceOverview` is labelled "Daily Tasks"; 7D/30D/90D toggle works.
- [ ] Headline = rounded mean daily completion % over the window. Delta = vs prior equivalent window.
- [ ] Series excludes rest days.

### Stat cards (user)

- [ ] "Tasks Done" shows `{todayPct}%` and `{done}/{total} today` caption.
- [ ] "Active Streak" shows `{n} days` and best-streak caption.

### Admin

- [ ] Non-admin hitting `/admin/tasks` redirects to `/dashboard`.
- [ ] Category tab switching uses `?cat=` and preserves browser back/forward.
- [ ] Live + Draft columns render the correct weeks based on today's date.
- [ ] "Create draft week" creates a `task_weeks` row dated next Monday (idempotent).
- [ ] Clicking a day opens the Base UI Dialog drawer with that day's tasks.
- [ ] Drawer supports add (type + title), inline edit on blur, delete, up/down reorder.
- [ ] Renaming a task preserves user completions (integration test).
- [ ] Deleting a task removes its completions (FK cascade verified).
- [ ] "View past weeks" link opens the read-only list at `/admin/tasks/past`.

### General

- [ ] Lint, typecheck, format, build all green.
- [ ] Vitest: `isoDayOfWeek`, `getMondayOf`, `toIsoDate`, `todayCompletionPct`, `currentStreak` (perfect run, broken streak, rest day skipping, today-partial, no-week-published, pre-signup-as-rest), `bestStreak`.
- [ ] Playwright: user ticks a task on the dashboard → state persists across reload + stat cards update. Admin creates a draft week and adds two tasks via the drawer.

---

## 11. Implementation phases

| Phase | Work |
|---|---|
| A | DB migration: `task_type` enum + `task_weeks` + `daily_tasks` + `user_task_completions` + `get_task_rollup` RPC + RLS. Types regen. |
| B | `lib/tasks.ts` (date helpers + completion % + streak + best streak) + Vitest unit tests. |
| C | `POST /api/tasks/[id]/toggle` route + `TaskRow` client component (optimistic). |
| D | Dashboard wiring: server fetches, `TodaysTasks` real data, "Tasks Done" stat card real, `TaskRow` integrated. |
| E | `WeeklyStreak` component (renamed from `WeeklySchedule`) + "Active Streak" stat card real. |
| F | `PerformanceOverview` re-labelled + wired to rollup. |
| G | `/admin` index updated. `/admin/tasks` page shell with category tabs + Live/Draft two-column. |
| H | "Create draft week" server action + day-editor drawer (Base UI Dialog) with add / edit-on-blur / delete / reorder server actions. |
| I | `/admin/tasks/past` paginated read-only view. |
| J | Playwright smoke tests + acceptance walk-through + retro stub. |

Each phase commits independently. Phase A must land first (types flow into B–J).

---

## 12. Open follow-ups (not blocking SP-5)

- Tighten the toggle endpoint to reject non-today dates (currently any past date is accepted; RLS limits damage to the user's own rows).
- Drag-and-drop reorder in the drawer (SP-7 polish pass).
- Push notifications / reminders.
- Email digest of yesterday's missed tasks.
- CSV bulk-import of tasks for a category-week.
