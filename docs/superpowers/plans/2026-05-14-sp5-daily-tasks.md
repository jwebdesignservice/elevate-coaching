# SP-5: Daily Tasks + Dashboard Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Daily Tasks accountability layer and wire every remaining dashboard placeholder (TodaysTasks, WeeklySchedule→WeeklyStreak, PerformanceOverview, Active Streak + Tasks Done stat cards) to real data, plus an admin scheduler at `/admin/tasks` for coaches to manage Mon–Sun tasks per category.

**Architecture:** Three new Postgres tables (`task_weeks`, `daily_tasks`, `user_task_completions`) with a `get_task_rollup` RPC for the dashboard. Pure helpers in `lib/tasks.ts` for streak/percent math. Server Component dashboard does one rollup RPC call + two cheap fetches; checkbox toggles use a small client component hitting an API route with optimistic state + `router.refresh()`. Admin scheduler is `/admin/tasks` with category tabs, two-column Live + Draft, Base UI Dialog drawer for the per-day editor.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind 4 · Base UI · Supabase (Postgres + Auth + RLS) · Vitest · Playwright. Patterns inherited from SP-4: `requireCoach()` gates admin routes; admin writes use `createSupabaseAdminClient()` (service role); writes cast `as never` to bypass `@supabase/postgrest-js` typing it as `never`.

**Spec:** `docs/superpowers/specs/2026-05-14-sp5-daily-tasks-design.md` — locked decisions and acceptance criteria.

**Branch:** `sp5-daily-tasks` (already created from `main`, contains the spec commit).

---

## File Structure

### New files

```
supabase/migrations/
  20260515000000_sp5_daily_tasks.sql        # Tables + enum + RPC + RLS

lib/
  tasks.ts                                  # Pure date/streak/% helpers
  task-types.ts                             # TASK_TYPE_ICONS map (lucide icons)

components/dashboard/
  TaskRow.tsx                               # Client component — optimistic checkbox
  WeeklyStreak.tsx                          # Replaces WeeklySchedule entirely

components/ui/
  dialog.tsx                                # Base UI Dialog wrapper (Card-styled drawer)

app/api/tasks/[id]/toggle/
  route.ts                                  # POST — flip user_task_completions row

app/(authed)/admin/tasks/
  page.tsx                                  # Per-category tabs + Live/Draft columns
  actions.ts                                # Server actions: weeks/tasks CRUD + reorder
  day-drawer.tsx                            # Client component — Base UI Dialog drawer
  past/
    page.tsx                                # Read-only list of past weeks

tests/lib/
  tasks.test.ts                             # Vitest for lib/tasks.ts

tests/e2e/
  sp5-daily-tasks.spec.ts                   # Playwright smoke
```

### Modified files

```
components/dashboard/WeeklySchedule.tsx     # Delete (replaced by WeeklyStreak.tsx)
app/(authed)/dashboard/page.tsx             # Remove demo data; fetch real task data
app/(authed)/admin/page.tsx                 # Add "Daily Tasks" tile
lib/supabase/database.types.ts              # Regen after migration
.gitignore                                  # Already updated for .superpowers/
```

---

## Phase A — DB Migration

### Task A1: Write the migration file

**Files:**
- Create: `supabase/migrations/20260515000000_sp5_daily_tasks.sql`

- [ ] **Step 1: Write the migration**

```sql
-- SP-5: Daily Tasks accountability layer.
-- Three tables (task_weeks, daily_tasks, user_task_completions), one enum,
-- one RPC, and RLS. Admin writes go through service role from server actions
-- gated by requireCoach() — there is no coach-row write policy on the shared
-- tables (mirrors SP-4 exercises/programs).

create type task_type as enum (
  'workout', 'nutrition', 'mindset', 'recovery', 'steps', 'other'
);

-- Container for a week of tasks for a single category.
create table public.task_weeks (
  id         uuid primary key default gen_random_uuid(),
  category   user_category not null,
  start_date date not null
    check (extract(isodow from start_date) = 1),  -- must be a Monday
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, start_date)
);

-- The actual tasks. Stable UUIDs survive renames so completions persist.
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

-- RLS
alter table public.task_weeks enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.user_task_completions enable row level security;

create policy "authenticated_read_task_weeks" on public.task_weeks
  for select to authenticated using (true);

create policy "authenticated_read_daily_tasks" on public.daily_tasks
  for select to authenticated using (true);

create policy "own_task_completions" on public.user_task_completions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Single round-trip rollup of (total, done) per day for a user + category window.
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

grant execute on function public.get_task_rollup(uuid, user_category, date, date) to authenticated;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` (or `npx supabase migration up` if using local stack)
Expected: Migration `20260515000000_sp5_daily_tasks.sql` applies cleanly with no errors. Verify with `\d task_weeks` in psql or via Studio.

- [ ] **Step 3: Regenerate Supabase types**

Run: `npx supabase gen types typescript --project-id zptxhbblbcaliwezltzp --schema public > lib/supabase/database.types.ts`
Expected: `lib/supabase/database.types.ts` now contains `task_weeks`, `daily_tasks`, `user_task_completions`, and the `get_task_rollup` function signature. The `task_type` enum appears under `Database['public']['Enums']`.

- [ ] **Step 4: Verify build still typechecks**

Run: `npm run typecheck`
Expected: PASS — no type errors. (The new types are unused so far; they shouldn't conflict.)

- [ ] **Step 5: Commit Phase A**

```bash
git add supabase/migrations/20260515000000_sp5_daily_tasks.sql lib/supabase/database.types.ts
git commit -m "feat(SP-5-A): daily_tasks migration + types regen

- task_type enum (workout/nutrition/mindset/recovery/steps/other)
- task_weeks (category + Monday-only start_date)
- daily_tasks (stable UUIDs, day_of_week 1-7, order_index)
- user_task_completions (own-row RLS)
- get_task_rollup RPC for single-round-trip dashboard data

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase B — `lib/tasks.ts` + Vitest

### Task B1: Write failing tests for date helpers

**Files:**
- Test: `tests/lib/tasks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/tasks.test.ts
import { describe, it, expect } from 'vitest';
import {
  isoDayOfWeek,
  getMondayOf,
  toIsoDate,
  todayCompletionPct,
  currentStreak,
  bestStreak,
} from '@/lib/tasks';

describe('isoDayOfWeek', () => {
  it('Monday is 1', () => {
    expect(isoDayOfWeek(new Date(2026, 4, 18))).toBe(1); // Mon 18 May 2026
  });
  it('Sunday is 7', () => {
    expect(isoDayOfWeek(new Date(2026, 4, 24))).toBe(7); // Sun 24 May 2026
  });
  it('Wednesday is 3', () => {
    expect(isoDayOfWeek(new Date(2026, 4, 20))).toBe(3); // Wed 20 May 2026
  });
});

describe('getMondayOf', () => {
  it('returns the same day when passed a Monday', () => {
    const monday = new Date(2026, 4, 18, 14, 30); // Mon 18 May 14:30
    const result = getMondayOf(monday);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(18);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('returns previous Monday when passed a Wednesday', () => {
    const wed = new Date(2026, 4, 20, 9, 0); // Wed 20 May
    const result = getMondayOf(wed);
    expect(result.getDate()).toBe(18); // → Mon 18 May
  });

  it('returns previous Monday when passed a Sunday', () => {
    const sun = new Date(2026, 4, 24, 23, 59); // Sun 24 May
    const result = getMondayOf(sun);
    expect(result.getDate()).toBe(18); // → Mon 18 May
  });
});

describe('toIsoDate', () => {
  it('formats as YYYY-MM-DD in local time', () => {
    expect(toIsoDate(new Date(2026, 4, 18))).toBe('2026-05-18');
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tasks`
Expected: FAIL — "Cannot find module '@/lib/tasks'".

### Task B2: Implement date helpers

**Files:**
- Create: `lib/tasks.ts`

- [ ] **Step 1: Implement the date helpers**

```typescript
// lib/tasks.ts

/** ISO day-of-week: 1 = Monday … 7 = Sunday. */
export function isoDayOfWeek(d: Date): number {
  const js = d.getDay(); // 0 = Sun … 6 = Sat
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

/** YYYY-MM-DD in the local timezone — used as `completion_date`. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayCompletionPct(total: number, done: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export interface DayRollup {
  date: string;
  total: number;
  done: number;
}

/** Stub — implemented in B4. */
export function currentStreak(_rollups: DayRollup[], _todayIso: string): number {
  return 0;
}

/** Stub — implemented in B4. */
export function bestStreak(_rollups: DayRollup[]): number {
  return 0;
}
```

- [ ] **Step 2: Run date-helper tests**

Run: `npm test -- tasks`
Expected: PASS for `isoDayOfWeek`, `getMondayOf`, `toIsoDate`. `currentStreak`/`bestStreak` tests don't exist yet.

### Task B3: Write failing tests for `todayCompletionPct`

- [ ] **Step 1: Append tests**

```typescript
// append to tests/lib/tasks.test.ts
describe('todayCompletionPct', () => {
  it('returns 0 when total is 0 (rest day)', () => {
    expect(todayCompletionPct(0, 0)).toBe(0);
  });
  it('returns 0 when no tasks done', () => {
    expect(todayCompletionPct(6, 0)).toBe(0);
  });
  it('returns 100 when all tasks done', () => {
    expect(todayCompletionPct(6, 6)).toBe(100);
  });
  it('rounds to nearest integer', () => {
    expect(todayCompletionPct(3, 1)).toBe(33);
    expect(todayCompletionPct(3, 2)).toBe(67);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tasks`
Expected: PASS for all `todayCompletionPct` cases (already implemented in B2).

### Task B4: Write failing streak tests

- [ ] **Step 1: Append streak tests**

```typescript
// append to tests/lib/tasks.test.ts
describe('currentStreak', () => {
  const today = '2026-05-20'; // Wed

  it('returns 0 when rollup is empty', () => {
    expect(currentStreak([], today)).toBe(0);
  });

  it('counts a single perfect day (yesterday) as 1 if today is partial', () => {
    expect(currentStreak(
      [
        { date: '2026-05-19', total: 4, done: 4 }, // Tue perfect
        { date: '2026-05-20', total: 5, done: 2 }, // today partial
      ],
      today,
    )).toBe(1);
  });

  it('counts today inclusively when today is perfect', () => {
    expect(currentStreak(
      [
        { date: '2026-05-19', total: 4, done: 4 },
        { date: '2026-05-20', total: 5, done: 5 },
      ],
      today,
    )).toBe(2);
  });

  it('breaks at the first non-perfect, non-rest day', () => {
    expect(currentStreak(
      [
        { date: '2026-05-17', total: 3, done: 3 },
        { date: '2026-05-18', total: 4, done: 2 }, // breaks here
        { date: '2026-05-19', total: 4, done: 4 },
        { date: '2026-05-20', total: 5, done: 5 },
      ],
      today,
    )).toBe(2);
  });

  it('skips rest days (total === 0) without breaking the streak', () => {
    expect(currentStreak(
      [
        { date: '2026-05-17', total: 3, done: 3 }, // Sun perfect
        { date: '2026-05-18', total: 0, done: 0 }, // Mon rest
        { date: '2026-05-19', total: 4, done: 4 }, // Tue perfect
        { date: '2026-05-20', total: 5, done: 5 }, // Wed perfect
      ],
      today,
    )).toBe(3);
  });

  it('handles future days in the rollup (ignored)', () => {
    expect(currentStreak(
      [
        { date: '2026-05-19', total: 4, done: 4 },
        { date: '2026-05-20', total: 5, done: 5 },
        { date: '2026-05-21', total: 5, done: 0 }, // tomorrow
      ],
      today,
    )).toBe(2);
  });

  it('treats pre-signup days (total === 0 via adjustedRollup) as rest', () => {
    expect(currentStreak(
      [
        { date: '2026-05-18', total: 0, done: 0 }, // pre-signup
        { date: '2026-05-19', total: 4, done: 4 }, // first day post-signup
        { date: '2026-05-20', total: 5, done: 5 },
      ],
      today,
    )).toBe(2);
  });
});

describe('bestStreak', () => {
  it('returns 0 for empty rollup', () => {
    expect(bestStreak([])).toBe(0);
  });

  it('returns 0 when no day is perfect', () => {
    expect(bestStreak([
      { date: '2026-05-18', total: 4, done: 2 },
      { date: '2026-05-19', total: 4, done: 3 },
    ])).toBe(0);
  });

  it('finds the longest run', () => {
    expect(bestStreak([
      { date: '2026-05-15', total: 3, done: 3 },
      { date: '2026-05-16', total: 3, done: 3 },
      { date: '2026-05-17', total: 3, done: 1 }, // breaks
      { date: '2026-05-18', total: 3, done: 3 },
      { date: '2026-05-19', total: 3, done: 3 },
      { date: '2026-05-20', total: 3, done: 3 }, // longest = 3
    ])).toBe(3);
  });

  it('skips rest days when extending the run', () => {
    expect(bestStreak([
      { date: '2026-05-15', total: 3, done: 3 },
      { date: '2026-05-16', total: 0, done: 0 }, // rest
      { date: '2026-05-17', total: 3, done: 3 },
    ])).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tasks`
Expected: FAIL — stubs return 0 for everything.

### Task B5: Implement `currentStreak` and `bestStreak`

**Files:**
- Modify: `lib/tasks.ts`

- [ ] **Step 1: Replace the stubs with real implementations**

```typescript
// lib/tasks.ts — replace currentStreak and bestStreak

/**
 * Consecutive perfect days ending at (and including, if perfect) today.
 *
 * - Today counts only if today is fully complete.
 * - Rest days (total === 0) are skipped without breaking or extending.
 * - Pre-signup days are passed in with total === 0 by the caller
 *   (see dashboard §8.1) so they skip naturally without breaking the chain.
 */
export function currentStreak(rollups: DayRollup[], todayIso: string): number {
  const sorted = [...rollups].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const day of sorted) {
    if (day.date > todayIso) continue;
    if (day.total === 0) continue;
    if (day.date === todayIso && day.done < day.total) continue;
    if (day.done === day.total) {
      streak++;
      continue;
    }
    break;
  }
  return streak;
}

/** Longest run of perfect days in the rollup window. Rest days don't break. */
export function bestStreak(rollups: DayRollup[]): number {
  const sorted = [...rollups].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const day of sorted) {
    if (day.total === 0) continue;
    if (day.done === day.total) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tasks`
Expected: PASS — all streak tests now pass.

- [ ] **Step 3: Run lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit Phase B**

```bash
git add lib/tasks.ts tests/lib/tasks.test.ts
git commit -m "feat(SP-5-B): lib/tasks.ts — date helpers, completion %, streak math

- isoDayOfWeek, getMondayOf, toIsoDate (local-timezone date)
- todayCompletionPct (rounded, rest-day-safe)
- currentStreak (rest days skip, today-partial-but-yesterday-perfect counts)
- bestStreak (longest run, rest days don't break)
- Full Vitest coverage including pre-signup-as-rest case

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase C — Toggle API Route + `TaskRow` Client Component

### Task C1: Write the toggle route

**Files:**
- Create: `app/api/tasks/[id]/toggle/route.ts`

- [ ] **Step 1: Implement the route**

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const date = (body as { date?: unknown })?.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }

  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from('user_task_completions')
    .select('id')
    .eq('user_id', profile.id)
    .eq('task_id', taskId)
    .eq('completion_date', date)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('user_task_completions')
      .delete()
      .eq('id', (existing as { id: string }).id);
    if (error) return NextResponse.json({ error: 'failed to delete' }, { status: 500 });
    return NextResponse.json({ done: false });
  }

  const { error } = await supabase
    .from('user_task_completions')
    .insert({ user_id: profile.id, task_id: taskId, completion_date: date } as never);
  if (error) return NextResponse.json({ error: 'failed to insert' }, { status: 500 });
  return NextResponse.json({ done: true });
}
```

- [ ] **Step 2: Smoke the route locally**

Run: `npm run dev` then in another terminal: `curl -X POST http://localhost:3000/api/tasks/00000000-0000-0000-0000-000000000000/toggle -H "Content-Type: application/json" -d '{"date":"2026-05-20"}'`
Expected: `{"error":"failed to insert"}` with 500 (because the task_id is fake and the user isn't authenticated). The important thing is the route registers and returns JSON, not a 404.

### Task C2: Add the task-type icons map

**Files:**
- Create: `lib/task-types.ts`

- [ ] **Step 1: Create the map**

```typescript
// lib/task-types.ts
import { Brain, CircleDot, Dumbbell, Footprints, UtensilsCrossed, Waves } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';

export type TaskType = Database['public']['Enums']['task_type'];

export const TASK_TYPE_ICONS: Record<TaskType, React.ComponentType<{ className?: string }>> = {
  workout: Dumbbell,
  nutrition: UtensilsCrossed,
  mindset: Brain,
  recovery: Waves,
  steps: Footprints,
  other: CircleDot,
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  workout: 'Workout',
  nutrition: 'Nutrition',
  mindset: 'Mindset',
  recovery: 'Recovery',
  steps: 'Steps',
  other: 'Other',
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If `task_type` is missing from the generated types, A3 wasn't completed — go back.)

### Task C3: Build the `TaskRow` client component

**Files:**
- Create: `components/dashboard/TaskRow.tsx`

- [ ] **Step 1: Implement the component**

```typescript
// components/dashboard/TaskRow.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { TASK_TYPE_ICONS, type TaskType } from '@/lib/task-types';

interface TaskRowProps {
  task: { id: string; title: string; task_type: TaskType };
  initialDone: boolean;
  todayIso: string;
}

export function TaskRow({ task, initialDone, todayIso }: TaskRowProps) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const TypeIcon = TASK_TYPE_ICONS[task.task_type];

  async function toggle() {
    if (busy) return;
    const prev = done;
    setDone(!prev);
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayIso }),
      });
      if (!res.ok) {
        setDone(prev);
        return;
      }
      const json = (await res.json()) as { done: boolean };
      setDone(json.done);
      startTransition(() => router.refresh());
    } catch {
      setDone(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={done}
        aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}
        className="shrink-0"
      >
        {done ? (
          <span className="bg-accent text-accent-fg flex h-5 w-5 items-center justify-center rounded-full">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : (
          <span className="border-text-dim/50 block h-5 w-5 rounded-full border" />
        )}
      </button>
      <TypeIcon className="text-text-muted h-3.5 w-3.5 shrink-0" />
      <span
        className={`text-sm ${done ? 'text-text-muted decoration-text-dim/60 line-through' : 'text-text'}`}
      >
        {task.title}
      </span>
    </li>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit Phase C**

```bash
git add app/api/tasks/[id]/toggle/route.ts lib/task-types.ts components/dashboard/TaskRow.tsx
git commit -m "feat(SP-5-C): toggle API route + TaskRow optimistic client component

- POST /api/tasks/[id]/toggle reads, flips, persists completion
- Body { date: 'YYYY-MM-DD' } validated; auth via requireUser; RLS scopes to user
- TaskRow optimistic state with router.refresh() after success
- TASK_TYPE_ICONS map for the six fixed types

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase D — Dashboard Wiring: `TodaysTasks` + Tasks Done

### Task D1: Refactor `TodaysTasks` to accept real data

**Files:**
- Modify: `components/dashboard/TodaysTasks.tsx`

- [ ] **Step 1: Replace the file with the new shape**

```typescript
// components/dashboard/TodaysTasks.tsx
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { TaskRow } from './TaskRow';
import type { TaskType } from '@/lib/task-types';

export interface DashboardTaskItem {
  id: string;
  title: string;
  task_type: TaskType;
}

interface TodaysTasksProps {
  tasks: DashboardTaskItem[];
  completedTaskIds: Set<string>;
  todayIso: string;
}

/**
 * Today's Tasks rail card.
 *
 * Renders one TaskRow per scheduled task. The row owns optimistic state and
 * triggers a router.refresh() after toggling, which re-runs the dashboard's
 * server fetch so the streak strip and stat cards stay in sync.
 */
export function TodaysTasks({ tasks, completedTaskIds, todayIso }: TodaysTasksProps): ReactNode {
  const done = tasks.filter((t) => completedTaskIds.has(t.id)).length;
  const total = tasks.length;

  return (
    <Card className="bg-surface border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-text font-semibold tracking-tight">Today&apos;s Tasks</h3>
        {total > 0 && (
          <span className="text-text-muted rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium">
            {done}/{total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-text-muted text-sm">No tasks today — rest day.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              initialDone={completedTaskIds.has(task.id)}
              todayIso={todayIso}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — the dashboard page still passes the old shape. That's intentional — D2 fixes it.

### Task D2: Wire the dashboard server fetch

**Files:**
- Modify: `app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Update imports + fetch logic + remove demo tasks**

Replace the imports block and the `DEMO_TASKS` constant + the `TodaysTasks` prop wiring. The minimum diff:

```typescript
// app/(authed)/dashboard/page.tsx — top of file
import { Activity, Bookmark, Brain, Dumbbell, Flame, HeartPulse, LineChart, TrendingUp, UtensilsCrossed, Waves, Zap } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CATEGORY_INFO, type Category } from '@/lib/categories';
import { programProgressPct } from '@/lib/programs';
import {
  currentStreak,
  bestStreak,
  getMondayOf,
  isoDayOfWeek,
  todayCompletionPct,
  toIsoDate,
  type DayRollup,
} from '@/lib/tasks';
import type { TaskType } from '@/lib/task-types';
import { CircularProgress } from '@/components/charts/CircularProgress';
import { MiniBars } from '@/components/charts/MiniBars';
import { TopBar } from '@/components/layout/TopBar';
import { RightRail } from '@/components/layout/RightRail';
import { ProgramHero } from '@/components/branded/ProgramHero';
import { StatCard } from '@/components/branded/StatCard';
import { VideoTutorialCard } from '@/components/branded/VideoTutorialCard';
import { TodaysTasks, type DashboardTaskItem } from '@/components/dashboard/TodaysTasks';
import { WeeklySchedule, type ScheduleItem } from '@/components/dashboard/WeeklySchedule';
import { PerformanceOverview } from '@/components/dashboard/PerformanceOverview';
```

Delete `const DEMO_TASKS: TaskItem[] = [...]` entirely.

Inside `DashboardPage()`, after the existing `enrolmentRes` / `totalSessionsDone` fetches, add the task fetches:

```typescript
// SP-5 — today's tasks for the user's category
const today = new Date();
const todayIso = toIsoDate(today);
const monday = getMondayOf(today);
const dow = isoDayOfWeek(today);
const mondayIso = toIsoDate(monday);

const userCategory = profile.category as Category;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
const weekRes = await (sb
  .from('task_weeks')
  .select('id, daily_tasks(id, title, task_type, order_index, day_of_week)')
  .eq('category', userCategory)
  .eq('start_date', mondayIso)
  .maybeSingle() as Promise<{
    data: {
      id: string;
      daily_tasks: { id: string; title: string; task_type: TaskType; order_index: number; day_of_week: number }[];
    } | null;
    error: unknown;
  }>);

const todayTasks: DashboardTaskItem[] = (weekRes.data?.daily_tasks ?? [])
  .filter((t) => t.day_of_week === dow)
  .sort((a, b) => a.order_index - b.order_index)
  .map(({ id, title, task_type }) => ({ id, title, task_type }));

const { data: todayCompletionsRaw } = await supabase
  .from('user_task_completions')
  .select('task_id')
  .eq('user_id', profile.id)
  .eq('completion_date', todayIso);
const completedTaskIds = new Set((todayCompletionsRaw ?? []).map((c: { task_id: string }) => c.task_id));
const todayPct = todayCompletionPct(todayTasks.length, completedTaskIds.size);
```

Then replace the `<TodaysTasks tasks={DEMO_TASKS} />` line with:

```typescript
<TodaysTasks tasks={todayTasks} completedTaskIds={completedTaskIds} todayIso={todayIso} />
```

And replace the "Tasks Done" `StatCard` block:

```typescript
<StatCard
  icon={<Bookmark className="h-3.5 w-3.5" />}
  label="Tasks Done"
  value={todayTasks.length === 0 ? '—' : `${todayPct}%`}
  caption={todayTasks.length === 0 ? 'Rest day' : `${completedTaskIds.size}/${todayTasks.length} today`}
  captionTone={completedTaskIds.size === todayTasks.length && todayTasks.length > 0 ? 'accent' : 'muted'}
  visual={<CircularProgress value={todayPct} size={48} strokeWidth={4} label={todayTasks.length === 0 ? '—' : `${todayPct}%`} />}
/>
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (`WeeklySchedule` still uses demo data; that's phase E.)

- [ ] **Step 3: Visual smoke**

Run: `npm run dev` and open `/dashboard`.
Expected: TodaysTasks card shows either "No tasks today — rest day." (if no week is published) or a list of real tasks with empty checkboxes. Clicking a checkbox flips its state and persists across reload.

- [ ] **Step 4: Commit Phase D**

```bash
git add app/(authed)/dashboard/page.tsx components/dashboard/TodaysTasks.tsx
git commit -m "feat(SP-5-D): wire TodaysTasks + 'Tasks Done' stat card to real data

- Dashboard fetches today's tasks for user's category + completion state
- TodaysTasks renders TaskRow per task with optimistic state
- 'Tasks Done' stat card shows todayPct (or '—' / 'Rest day' when no tasks)
- DEMO_TASKS removed

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase E — `WeeklyStreak` + Active Streak Card

### Task E1: Build `WeeklyStreak`

**Files:**
- Create: `components/dashboard/WeeklyStreak.tsx`

- [ ] **Step 1: Implement the component**

```typescript
// components/dashboard/WeeklyStreak.tsx
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import type { DayRollup } from '@/lib/tasks';

interface WeeklyStreakProps {
  weekStartIso: string;
  todayIso: string;
  rollup: DayRollup[];
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * 7-day Mon–Sun strip with one dot per day. The "items" list that used to
 * live in WeeklySchedule has been removed entirely (SP-5 spec §8).
 *
 * Per-day dot:
 *   - filled mint           = perfect day (total > 0 && done === total)
 *   - outline mint          = partial (done > 0 && done < total)
 *   - faded outline         = rest day, pre-signup, future, or no completions yet
 */
export function WeeklyStreak({ weekStartIso, todayIso, rollup }: WeeklyStreakProps): ReactNode {
  const byDate = new Map(rollup.map((d) => [d.date, d]));
  const start = new Date(weekStartIso + 'T00:00:00');

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = byDate.get(iso) ?? { date: iso, total: 0, done: 0 };
    const isToday = iso === todayIso;
    const isFuture = iso > todayIso;
    const isPerfect = day.total > 0 && day.done === day.total;
    const isPartial = day.total > 0 && day.done > 0 && day.done < day.total;
    return {
      letter: DAY_LETTERS[i],
      date: d.getDate(),
      isToday,
      isFuture,
      isPerfect,
      isPartial,
    };
  });

  return (
    <Card className="bg-surface border-border p-5">
      <h3 className="text-text mb-4 font-semibold tracking-tight">This Week</h3>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-2 rounded-md py-2 ${
              d.isToday ? 'bg-accent text-accent-fg' : 'text-text-muted'
            }`}
          >
            <span className="text-[10px] font-semibold tracking-wide">{d.letter}</span>
            <span className="text-sm font-semibold">{d.date}</span>
            <span
              aria-hidden
              className={
                d.isPerfect
                  ? 'bg-accent h-2 w-2 rounded-full'
                  : d.isPartial
                    ? 'border-accent h-2 w-2 rounded-full border'
                    : 'border-text-dim/40 h-2 w-2 rounded-full border'
              }
              style={d.isToday && d.isPerfect ? { backgroundColor: 'rgba(255,255,255,0.95)' } : undefined}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Delete `WeeklySchedule.tsx`**

```bash
rm components/dashboard/WeeklySchedule.tsx
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — dashboard still imports `WeeklySchedule`. Fixed in E2.

### Task E2: Wire `WeeklyStreak` + Active Streak into the dashboard

**Files:**
- Modify: `app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Replace the WeeklySchedule import and demo data**

In the imports, replace:

```typescript
import { WeeklySchedule, type ScheduleItem } from '@/components/dashboard/WeeklySchedule';
```

with:

```typescript
import { WeeklyStreak } from '@/components/dashboard/WeeklyStreak';
```

Delete `const DEMO_DAYS = ...` and `const DEMO_SCHEDULE: ScheduleItem[] = ...`.

- [ ] **Step 2: Add the rollup fetch + adjustedRollup post-processing**

After the existing task fetches in `DashboardPage()`, add:

```typescript
// 90-day rollup for streak + performance chart
const ninetyDaysAgo = new Date(today);
ninetyDaysAgo.setDate(today.getDate() - 90);
const fromIso = toIsoDate(ninetyDaysAgo);

const { data: rollupRaw } = await sb.rpc('get_task_rollup', {
  uid: profile.id,
  cat: userCategory,
  from_date: fromIso,
  to_date: todayIso,
});

const signupIso = toIsoDate(new Date(profile.created_at as string));
const adjustedRollup: DayRollup[] = ((rollupRaw ?? []) as { date: string; total: number; done: number }[])
  .map((d) => (d.date < signupIso ? { ...d, total: 0, done: 0 } : d));

const streak = currentStreak(adjustedRollup, todayIso);
const best = bestStreak(adjustedRollup);
```

- [ ] **Step 3: Replace the JSX**

Replace the `<WeeklySchedule ... />` element in the right rail with:

```typescript
<WeeklyStreak weekStartIso={mondayIso} todayIso={todayIso} rollup={adjustedRollup} />
```

Replace the "Active Streak" `StatCard`:

```typescript
<StatCard
  icon={<Flame className="h-3.5 w-3.5" />}
  label="Active Streak"
  value={streak === 0 ? '—' : `${streak}`}
  caption={best > 0 ? `Best: ${best} days` : 'Start your streak today'}
  captionTone={streak >= 3 ? 'accent' : 'muted'}
  visual={<MiniBars data={adjustedRollup.slice(-7).map((d) => (d.total > 0 && d.done === d.total ? 1 : 0))} />}
/>
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Visual smoke**

Run: `npm run dev` and open `/dashboard`.
Expected: Right rail shows the 7-day strip with today highlighted and one dot per day. Active Streak card shows `—` or a streak count. After completing today's tasks, the today dot fills and the streak number updates.

- [ ] **Step 6: Commit Phase E**

```bash
git add components/dashboard/WeeklyStreak.tsx app/(authed)/dashboard/page.tsx
git rm components/dashboard/WeeklySchedule.tsx
git commit -m "feat(SP-5-E): WeeklyStreak strip + Active Streak card real data

- New WeeklyStreak component replaces WeeklySchedule (items list removed)
- Mon–Sun strip; per-day dot reflects perfect / partial / rest+future state
- Dashboard fetches 90-day rollup via get_task_rollup RPC
- adjustedRollup zeros out pre-signup days (Q9 forward-only)
- Active Streak card shows currentStreak + bestStreak caption

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase F — `PerformanceOverview` Wiring

### Task F1: Inspect the existing `PerformanceOverview` component

**Files:**
- Read: `components/dashboard/PerformanceOverview.tsx`

- [ ] **Step 1: Read the file to confirm its props shape**

Run: `cat components/dashboard/PerformanceOverview.tsx`
Expected: A component that takes `metricLabel: string`, `series: Record<'7D'|'30D'|'90D', { value: string; delta: string; data: number[] }>`, and `defaultPeriod`. Confirm the prop names — adjust the wiring below if names differ.

### Task F2: Compute task-completion series for the dashboard

**Files:**
- Modify: `app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Add a helper to compute period series**

Inline this in the dashboard page above the JSX return (or extract to `lib/tasks.ts` if you prefer — but YAGNI says inline is fine since it's only used here):

```typescript
function periodAverages(rollup: DayRollup[], todayIso: string) {
  const sorted = [...rollup].sort((a, b) => a.date.localeCompare(b.date));
  const idxOfToday = sorted.findIndex((d) => d.date === todayIso);
  const slice = (n: number) => {
    if (idxOfToday < 0) return [] as DayRollup[];
    const start = Math.max(0, idxOfToday - n + 1);
    return sorted.slice(start, idxOfToday + 1);
  };
  const meanPct = (days: DayRollup[]) => {
    const valid = days.filter((d) => d.total > 0);
    if (valid.length === 0) return 0;
    return Math.round(
      valid.reduce((sum, d) => sum + (d.done / d.total) * 100, 0) / valid.length,
    );
  };
  const seriesData = (days: DayRollup[]) =>
    days.filter((d) => d.total > 0).map((d) => Math.round((d.done / d.total) * 100));

  function build(n: number) {
    const cur = slice(n);
    const start = Math.max(0, idxOfToday - 2 * n + 1);
    const end = Math.max(0, idxOfToday - n + 1);
    const prev = sorted.slice(start, end).filter((d) => d.total > 0);
    const curMean = meanPct(cur);
    const prevMean = prev.length > 0
      ? Math.round(prev.reduce((s, d) => s + (d.done / d.total) * 100, 0) / prev.length)
      : 0;
    const delta = curMean - prevMean;
    const sign = delta > 0 ? '+' : '';
    return {
      value: `${curMean}%`,
      delta: prev.length > 0 ? `${sign}${delta}% vs prior ${n} days` : 'No prior data',
      data: seriesData(cur),
    };
  }
  return { '7D': build(7), '30D': build(30), '90D': build(90) };
}
```

- [ ] **Step 2: Compute the series and pass to the component**

In `DashboardPage()`, after `const best = bestStreak(adjustedRollup);` add:

```typescript
const dailyTasksSeries = periodAverages(adjustedRollup, todayIso);
```

Replace the `<PerformanceOverview metricLabel="Strength Score" series={DEMO_PERFORMANCE} ... />` with:

```typescript
<PerformanceOverview
  metricLabel="Daily Tasks"
  series={dailyTasksSeries}
  defaultPeriod="30D"
/>
```

Delete `const DEMO_PERFORMANCE = ...`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If the prop names of `PerformanceOverview` differ from F1's expectations, adjust to match.

- [ ] **Step 4: Visual smoke**

Open `/dashboard`.
Expected: PerformanceOverview now labelled "Daily Tasks", showing a percentage value, a delta string, and a sparkline. Toggling 7D/30D/90D swaps the value/delta/series.

- [ ] **Step 5: Commit Phase F**

```bash
git add app/(authed)/dashboard/page.tsx
git commit -m "feat(SP-5-F): PerformanceOverview wired to daily task completion %

- Re-labelled 'Daily Tasks'
- 7D/30D/90D series computed from adjustedRollup
- Rest days excluded from the mean and series line
- Delta vs prior equivalent window; falls back to 'No prior data'
- DEMO_PERFORMANCE removed

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase G — `/admin/tasks` Shell

### Task G1: Add the "Daily Tasks" admin tile

**Files:**
- Modify: `app/(authed)/admin/page.tsx`

- [ ] **Step 1: Add the tile**

In the `tiles` array, add a third entry:

```typescript
import { CalendarDays, Dumbbell, LayoutList } from 'lucide-react';
// ...
const tiles = [
  { href: '/admin/exercises', Icon: Dumbbell, title: 'Exercises', description: 'Create and manage the global exercise library.' },
  { href: '/admin/programs', Icon: LayoutList, title: 'Programmes', description: 'Build and publish training programmes.' },
  { href: '/admin/tasks', Icon: CalendarDays, title: 'Daily Tasks', description: 'Schedule weekly task batches per category.' },
];
```

- [ ] **Step 2: Smoke**

Open `/admin`. Expected: three tiles render in a grid; clicking "Daily Tasks" 404s for now (G2 will fix).

### Task G2: Build the `/admin/tasks` page shell

**Files:**
- Create: `app/(authed)/admin/tasks/page.tsx`

- [ ] **Step 1: Implement the page**

```typescript
// app/(authed)/admin/tasks/page.tsx
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { CATEGORY_INFO, type Category } from '@/lib/categories';
import { getMondayOf, toIsoDate } from '@/lib/tasks';
import { createDraftWeekAction } from './actions';
import { DayDrawer } from './day-drawer';
import type { TaskType } from '@/lib/task-types';

export const metadata = { title: 'Daily Tasks · Admin · Elevate Coaching' };

const CATEGORIES: Category[] = ['A', 'B', 'C', 'D'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface WeekShape {
  id: string;
  category: Category;
  start_date: string;
  daily_tasks: { id: string; day_of_week: number; task_type: TaskType; title: string; order_index: number }[];
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; day?: string; col?: string }>;
}) {
  const { profile } = await requireCoach();
  const params = await searchParams;
  const activeCat: Category = (CATEGORIES.includes(params.cat as Category) ? (params.cat as Category) : 'A');

  const today = new Date();
  const todayIso = toIsoDate(today);
  const thisMonday = getMondayOf(today);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  const thisMondayIso = toIsoDate(thisMonday);
  const nextMondayIso = toIsoDate(nextMonday);

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: weeksRaw } = await sb
    .from('task_weeks')
    .select('id, category, start_date, daily_tasks(id, day_of_week, task_type, title, order_index)')
    .eq('category', activeCat)
    .in('start_date', [thisMondayIso, nextMondayIso]);
  const weeks = (weeksRaw ?? []) as WeekShape[];

  const liveWeek = weeks.find((w) => w.start_date === thisMondayIso) ?? null;
  const draftWeek = weeks.find((w) => w.start_date === nextMondayIso) ?? null;

  // Drawer open state from URL: ?day=Mon&col=live (or draft)
  const drawerDay = params.day ? DAY_NAMES.indexOf(params.day as (typeof DAY_NAMES)[number]) + 1 : 0;
  const drawerCol = params.col === 'draft' ? 'draft' : 'live';
  const drawerWeek = drawerCol === 'draft' ? draftWeek : liveWeek;
  const drawerOpen = drawerDay > 0 && !!drawerWeek;
  const drawerTasks = drawerOpen
    ? (drawerWeek!.daily_tasks
        .filter((t) => t.day_of_week === drawerDay)
        .sort((a, b) => a.order_index - b.order_index))
    : [];

  return (
    <>
      <TopBar title="Daily Tasks" subtitle={`Scheduler for category ${activeCat}`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Category tabs */}
        <div className="mb-6 flex gap-2">
          {CATEGORIES.map((c) => {
            const active = c === activeCat;
            return (
              <Link
                key={c}
                href={`/admin/tasks?cat=${c}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-accent text-accent-fg' : 'bg-surface text-text-muted border-border border hover:text-text'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                Category {c} · {CATEGORY_INFO[c].name}
              </Link>
            );
          })}
        </div>

        {/* Live + Draft columns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LIVE */}
          <Card className="bg-surface border-border p-5">
            <h2 className="text-text mb-4 font-semibold">
              <span className="text-accent">●</span> Live · Week of {formatMonDay(thisMondayIso)}
            </h2>
            {liveWeek ? (
              <DayList
                weekTasks={liveWeek.daily_tasks}
                activeCat={activeCat}
                col="live"
                todayDow={isoDayOfWeekFromIso(todayIso)}
              />
            ) : (
              <p className="text-text-muted text-sm">No live week — create one for next Monday in the draft column.</p>
            )}
          </Card>

          {/* DRAFT */}
          <Card className="bg-surface border-border p-5">
            <h2 className="text-text mb-4 font-semibold">
              <span className="text-amber-400">○</span> Draft · Week of {formatMonDay(nextMondayIso)}
            </h2>
            {draftWeek ? (
              <DayList
                weekTasks={draftWeek.daily_tasks}
                activeCat={activeCat}
                col="draft"
                todayDow={null}
              />
            ) : (
              <form action={createDraftWeekAction}>
                <input type="hidden" name="category" value={activeCat} />
                <input type="hidden" name="start_date" value={nextMondayIso} />
                <button
                  type="submit"
                  className="bg-accent text-accent-fg hover:bg-accent/80 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" /> Create draft week
                </button>
              </form>
            )}
          </Card>
        </div>

        <div className="mt-6">
          <Link href="/admin/tasks/past" className="text-text-muted hover:text-text text-sm">
            View past weeks →
          </Link>
        </div>

        {drawerOpen && drawerWeek && (
          <DayDrawer
            weekId={drawerWeek.id}
            dayOfWeek={drawerDay}
            dayLabel={`${DAY_NAMES[drawerDay - 1]} · ${formatMonDay(addDays(drawerWeek.start_date, drawerDay - 1))} · Category ${activeCat}`}
            tasks={drawerTasks}
            readOnly={false}
            closeHref={`/admin/tasks?cat=${activeCat}`}
          />
        )}
      </div>
    </>
  );
}

function formatMonDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoDayOfWeekFromIso(iso: string): number {
  const d = new Date(iso + 'T00:00:00');
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

interface DayListProps {
  weekTasks: WeekShape['daily_tasks'];
  activeCat: Category;
  col: 'live' | 'draft';
  todayDow: number | null;
}

function DayList({ weekTasks, activeCat, col, todayDow }: DayListProps) {
  return (
    <ul className="space-y-1">
      {DAY_NAMES.map((name, i) => {
        const dow = i + 1;
        const count = weekTasks.filter((t) => t.day_of_week === dow).length;
        const isToday = todayDow === dow;
        return (
          <li key={name}>
            <Link
              href={`/admin/tasks?cat=${activeCat}&col=${col}&day=${name}`}
              className="hover:bg-white/[0.04] flex items-center justify-between rounded-md px-3 py-2 text-sm"
            >
              <span className="text-text flex items-center gap-2">
                {name}
                {isToday && <span className="bg-accent text-accent-fg rounded-full px-1.5 text-[10px] font-semibold">today</span>}
              </span>
              <span className="text-text-muted text-xs">{count} task{count === 1 ? '' : 's'}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `./actions` and `./day-drawer` don't exist yet. Phase H fixes this. Defer the smoke until then.

### Task G3: Commit phase G shell

The page references actions and a drawer that don't exist yet — we won't commit this until Phase H builds them. Skip the commit for now and move on.

---

## Phase H — Server Actions + Day Drawer

### Task H1: Add a `dialog.tsx` UI primitive (Base UI wrapper)

**Files:**
- Create: `components/ui/dialog.tsx`

- [ ] **Step 1: Write the wrapper**

```typescript
// components/ui/dialog.tsx
'use client';

import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;

export function DialogContent({
  className,
  children,
  onCloseHref,
}: {
  className?: string;
  children: React.ReactNode;
  onCloseHref?: string;
}) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
      <BaseDialog.Popup
        className={cn(
          'border-border bg-surface fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l p-6 shadow-xl data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full transition-transform',
          className,
        )}
      >
        {children}
        {onCloseHref ? (
          <a
            href={onCloseHref}
            className="text-text-muted hover:text-text absolute top-4 right-4"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </a>
        ) : (
          <BaseDialog.Close className="text-text-muted hover:text-text absolute top-4 right-4" aria-label="Close">
            <X className="h-5 w-5" />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;
```

> **Note:** `@base-ui/react` is already a dependency (see `package.json`). If the `Dialog` export path differs in the installed version, run `npx tsc --noEmit` and check the suggestion from TypeScript, or `cat node_modules/@base-ui/react/package.json` to confirm subpath exports.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (component is unused so far but exports are valid).

### Task H2: Write the server actions

**Files:**
- Create: `app/(authed)/admin/tasks/actions.ts`

- [ ] **Step 1: Implement the actions**

```typescript
// app/(authed)/admin/tasks/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const createWeekSchema = z.object({
  category: z.enum(['A', 'B', 'C', 'D']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createDraftWeekAction(formData: FormData): Promise<void> {
  await requireCoach();
  const parsed = createWeekSchema.safeParse({
    category: formData.get('category'),
    start_date: formData.get('start_date'),
  });
  if (!parsed.success) return;

  const admin = createSupabaseAdminClient();
  // Idempotent: rely on the unique (category, start_date) constraint.
  await admin
    .from('task_weeks')
    .upsert(
      { category: parsed.data.category, start_date: parsed.data.start_date } as never,
      { onConflict: 'category,start_date' } as never,
    );

  revalidatePath('/admin/tasks');
  redirect(`/admin/tasks?cat=${parsed.data.category}`);
}

const upsertTaskSchema = z.object({
  task_id: z.string().uuid().optional(),
  week_id: z.string().uuid(),
  day_of_week: z.coerce.number().int().min(1).max(7),
  task_type: z.enum(['workout', 'nutrition', 'mindset', 'recovery', 'steps', 'other']),
  title: z.string().trim().min(1),
});

export async function upsertTaskAction(formData: FormData): Promise<void> {
  await requireCoach();
  const parsed = upsertTaskSchema.safeParse({
    task_id: formData.get('task_id') || undefined,
    week_id: formData.get('week_id'),
    day_of_week: formData.get('day_of_week'),
    task_type: formData.get('task_type'),
    title: formData.get('title'),
  });
  if (!parsed.success) return;

  const admin = createSupabaseAdminClient();

  if (parsed.data.task_id) {
    // Update — preserves stable ID so completions survive.
    await admin
      .from('daily_tasks')
      .update({
        task_type: parsed.data.task_type,
        title: parsed.data.title,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', parsed.data.task_id);
  } else {
    // Compute next order_index for the (week, day) bucket.
    const { count } = await admin
      .from('daily_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('week_id', parsed.data.week_id)
      .eq('day_of_week', parsed.data.day_of_week);
    await admin
      .from('daily_tasks')
      .insert({
        week_id: parsed.data.week_id,
        day_of_week: parsed.data.day_of_week,
        task_type: parsed.data.task_type,
        title: parsed.data.title,
        order_index: count ?? 0,
      } as never);
  }

  revalidatePath('/admin/tasks');
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  await requireCoach();
  const id = formData.get('task_id');
  if (typeof id !== 'string') return;
  const admin = createSupabaseAdminClient();
  await admin.from('daily_tasks').delete().eq('id', id);
  revalidatePath('/admin/tasks');
}

export async function reorderTaskAction(formData: FormData): Promise<void> {
  await requireCoach();
  const id = formData.get('task_id');
  const direction = formData.get('direction');
  if (typeof id !== 'string' || (direction !== 'up' && direction !== 'down')) return;

  const admin = createSupabaseAdminClient();
  const { data: targetRaw } = await admin
    .from('daily_tasks')
    .select('id, week_id, day_of_week, order_index')
    .eq('id', id)
    .single();
  if (!targetRaw) return;
  const target = targetRaw as { id: string; week_id: string; day_of_week: number; order_index: number };

  // Find neighbour in the same (week, day) bucket.
  const base = admin
    .from('daily_tasks')
    .select('id, order_index')
    .eq('week_id', target.week_id)
    .eq('day_of_week', target.day_of_week);

  const { data: neighbourRaw } = await (direction === 'up'
    ? base.lt('order_index', target.order_index).order('order_index', { ascending: false }).limit(1).maybeSingle()
    : base.gt('order_index', target.order_index).order('order_index', { ascending: true }).limit(1).maybeSingle());

  const neighbour = neighbourRaw as { id: string; order_index: number } | null;
  if (!neighbour) return; // already at edge

  // Swap order_index. Two sequential updates — SP-5 accepts this race window;
  // admin-only and very low contention.
  await admin.from('daily_tasks').update({ order_index: neighbour.order_index } as never).eq('id', target.id);
  await admin.from('daily_tasks').update({ order_index: target.order_index } as never).eq('id', neighbour.id);

  revalidatePath('/admin/tasks');
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS for `actions.ts`; the page still imports the missing `day-drawer.tsx`.

### Task H3: Build the `DayDrawer` client component

**Files:**
- Create: `app/(authed)/admin/tasks/day-drawer.tsx`

- [ ] **Step 1: Implement the drawer**

```typescript
// app/(authed)/admin/tasks/day-drawer.tsx
'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TASK_TYPE_ICONS, TASK_TYPE_LABELS, type TaskType } from '@/lib/task-types';
import { upsertTaskAction, deleteTaskAction, reorderTaskAction } from './actions';

interface DrawerTask {
  id: string;
  title: string;
  task_type: TaskType;
  order_index: number;
}

interface DayDrawerProps {
  weekId: string;
  dayOfWeek: number;
  dayLabel: string;
  tasks: DrawerTask[];
  readOnly: boolean;
  closeHref: string;
}

const TASK_TYPES: TaskType[] = ['workout', 'nutrition', 'mindset', 'recovery', 'steps', 'other'];

export function DayDrawer({ weekId, dayOfWeek, dayLabel, tasks, readOnly, closeHref }: DayDrawerProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) window.location.href = closeHref; }}>
      <DialogContent onCloseHref={closeHref}>
        <DialogTitle className="text-text mb-4 text-lg font-semibold">{dayLabel}</DialogTitle>

        <ul className="space-y-2">
          {tasks.length === 0 && <li className="text-text-muted text-sm">No tasks scheduled yet.</li>}
          {tasks.map((task, idx) => {
            const TypeIcon = TASK_TYPE_ICONS[task.task_type];
            return (
              <li key={task.id} className="border-border bg-background flex items-center gap-2 rounded-md border p-2">
                <TypeIcon className="text-text-muted h-4 w-4 shrink-0" />
                {readOnly ? (
                  <span className="text-text flex-1 text-sm">{task.title}</span>
                ) : (
                  <form action={upsertTaskAction} className="flex-1">
                    <input type="hidden" name="task_id" value={task.id} />
                    <input type="hidden" name="week_id" value={weekId} />
                    <input type="hidden" name="day_of_week" value={dayOfWeek} />
                    <input type="hidden" name="task_type" value={task.task_type} />
                    <input
                      name="title"
                      defaultValue={task.title}
                      onBlur={(e) => {
                        if (e.currentTarget.value !== task.title) e.currentTarget.form?.requestSubmit();
                      }}
                      className="text-text w-full bg-transparent text-sm outline-none"
                    />
                  </form>
                )}
                {!readOnly && (
                  <>
                    {idx > 0 && (
                      <form action={reorderTaskAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit" aria-label="Move up" className="text-text-muted hover:text-text">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    )}
                    {idx < tasks.length - 1 && (
                      <form action={reorderTaskAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button type="submit" aria-label="Move down" className="text-text-muted hover:text-text">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    )}
                    <form action={deleteTaskAction}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <button type="submit" aria-label="Delete task" className="text-text-muted hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {!readOnly && (
          <form action={upsertTaskAction} className="border-border mt-6 flex items-end gap-2 border-t pt-4">
            <input type="hidden" name="week_id" value={weekId} />
            <input type="hidden" name="day_of_week" value={dayOfWeek} />
            <div className="flex-1">
              <label className="text-text-muted mb-1 block text-xs">Type</label>
              <select
                name="task_type"
                defaultValue="workout"
                className="border-border bg-surface text-text w-full rounded-md border px-2 py-1.5 text-sm"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex-[2]">
              <label className="text-text-muted mb-1 block text-xs">Title</label>
              <input
                name="title"
                required
                placeholder="e.g. 10,000 steps"
                className="border-border bg-surface text-text w-full rounded-md border px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-accent text-accent-fg hover:bg-accent/80 rounded-md px-3 py-1.5 text-sm font-medium"
            >
              Add
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Visual smoke**

Run: `npm run dev`, sign in as a coach, open `/admin/tasks`.
Expected: Category tabs render; "Create draft week" button visible; clicking it creates the row and the column populates with empty days; clicking a day opens the drawer. Add a task with type=workout, title="Test." → row appears. Blur-edit the title → updates. Delete → removes. Up/down arrows reorder when multiple tasks exist.

- [ ] **Step 4: Verify rename-preserves-completion (manual integration check)**

In Studio: insert a `user_task_completions` row for a freshly created task with today's date. Rename that task via the drawer. Re-query `user_task_completions` — the row still references the same `task_id` and `completion_date`.

- [ ] **Step 5: Commit Phase G + H together**

```bash
git add app/\(authed\)/admin/page.tsx app/\(authed\)/admin/tasks/ components/ui/dialog.tsx
git commit -m "feat(SP-5-G/H): admin task scheduler + day drawer

- /admin tile for Daily Tasks
- /admin/tasks per-category tabs, Live + Draft columns
- Drawer (Base UI Dialog) for per-day task editing
- Server actions: createDraftWeek, upsertTask, deleteTask, reorderTask
- Blur-to-save on title edits; up/down arrow reorder
- Stable task IDs preserved through updates; deletes cascade to completions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase I — Past Weeks Read-Only View

### Task I1: Build `/admin/tasks/past`

**Files:**
- Create: `app/(authed)/admin/tasks/past/page.tsx`

- [ ] **Step 1: Implement the page**

```typescript
// app/(authed)/admin/tasks/past/page.tsx
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { getMondayOf, toIsoDate } from '@/lib/tasks';

export const metadata = { title: 'Past Weeks · Daily Tasks · Admin' };

const PAGE_SIZE = 20;

interface PastWeekRow {
  id: string;
  category: 'A' | 'B' | 'C' | 'D';
  start_date: string;
  daily_tasks: { count: number }[];
}

export default async function AdminTasksPastPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { profile } = await requireCoach();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const thisMondayIso = toIsoDate(getMondayOf(new Date()));

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: weeksRaw } = await sb
    .from('task_weeks')
    .select('id, category, start_date, daily_tasks(count)')
    .lt('start_date', thisMondayIso)
    .order('start_date', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  const weeks = (weeksRaw ?? []) as PastWeekRow[];

  return (
    <>
      <TopBar title="Past Weeks" subtitle="Read-only — completions are settled" userTier={profile.subscription_tier} userName={profile.name} />
      <div className="p-4 sm:p-6 lg:p-8">
        <Link href="/admin/tasks" className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" /> Back to scheduler
        </Link>

        <Card className="bg-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-text-muted px-4 py-3 text-left font-medium">Category</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Week of</th>
                <th className="text-text-muted px-4 py-3 text-right font-medium">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {weeks.length === 0 && (
                <tr><td colSpan={3} className="text-text-muted px-4 py-8 text-center">No past weeks yet.</td></tr>
              )}
              {weeks.map((w) => (
                <tr key={w.id} className="border-border border-b last:border-0">
                  <td className="text-text px-4 py-3 font-medium">Category {w.category}</td>
                  <td className="text-text-muted px-4 py-3">{new Date(w.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="text-text-muted px-4 py-3 text-right">{w.daily_tasks?.[0]?.count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? (
            <Link href={`/admin/tasks/past?page=${page - 1}`} className="text-text-muted hover:text-text">← Newer</Link>
          ) : <span />}
          {weeks.length === PAGE_SIZE ? (
            <Link href={`/admin/tasks/past?page=${page + 1}`} className="text-text-muted hover:text-text">Older →</Link>
          ) : <span />}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Smoke**

Open `/admin/tasks/past`.
Expected: A table renders. If no past weeks exist (likely on a fresh DB), the empty state message appears.

- [ ] **Step 3: Commit Phase I**

```bash
git add app/\(authed\)/admin/tasks/past/
git commit -m "feat(SP-5-I): admin past weeks read-only paginated view

- /admin/tasks/past lists weeks with start_date < this Monday
- Category, Week-of, task count columns
- 20 per page, newer/older nav
- Read-only — no editing surface, completions are settled

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase J — Playwright Smoke + Acceptance Walk-Through

### Task J1: Write the Playwright smoke spec

**Files:**
- Create: `tests/e2e/sp5-daily-tasks.spec.ts`

- [ ] **Step 1: Implement the spec**

```typescript
// tests/e2e/sp5-daily-tasks.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SP-5 /admin/tasks redirect', () => {
  test('unauthenticated /admin/tasks redirects to sign-in', async ({ page }) => {
    await page.goto('/admin/tasks');
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe('SP-5 /admin/tasks/past redirect', () => {
  test('unauthenticated /admin/tasks/past redirects to sign-in', async ({ page }) => {
    await page.goto('/admin/tasks/past');
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe('SP-5 toggle API', () => {
  test('rejects malformed body', async ({ request }) => {
    const res = await request.post('/api/tasks/00000000-0000-0000-0000-000000000000/toggle', {
      data: { date: 'not-a-date' },
    });
    expect([400, 401]).toContain(res.status());
  });
});
```

> **Note:** Authenticated flows (tick a real task, create a draft week through the UI, add a task in the drawer) need test fixtures with seeded auth — these are out of scope for SP-5 smoke. The unauth redirects + API-shape assertions match the SP-4 smoke style (`tests/e2e/sp4-exercises-programs.spec.ts`).

- [ ] **Step 2: Run the smoke spec**

Run: `npx playwright install --with-deps chromium` (first run only), then `npm run test:e2e -- sp5`
Expected: PASS.

### Task J2: Run the full acceptance walk-through manually

- [ ] **Step 1: Promote yourself to coach**

In Supabase Studio: `update profiles set role = 'coach' where id = <your user id>;`

- [ ] **Step 2: Walk every acceptance bullet from spec §10**

For each checkbox in `docs/superpowers/specs/2026-05-14-sp5-daily-tasks-design.md` §10, verify in the running app. Tick items in the spec file as you go.

Expected outcomes:
- Empty state ("No tasks today — rest day.") when no week is published.
- Creating a draft week, adding two tasks via the drawer, then waiting until that week is "live" (or temporarily testing by inserting a week with `start_date = today's Monday` directly in Studio) shows them in `TodaysTasks`.
- Ticking flips state; reload preserves; Active Streak / Tasks Done update.
- Renaming a task in the drawer doesn't clear its completion.
- Deleting a task removes its completion (verify in Studio).

- [ ] **Step 3: Run the full test suite + build**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`
Expected: All green.

### Task J3: Write the retro stub

**Files:**
- Create: `docs/superpowers/retros/2026-05-14-sp5-retro.md`

- [ ] **Step 1: Drop in the stub**

```markdown
# SP-5 Retro — Daily Tasks + Dashboard Wiring

**Branch:** `sp5-daily-tasks`
**Merged:** YYYY-MM-DD
**Spec:** `docs/superpowers/specs/2026-05-14-sp5-daily-tasks-design.md`
**Plan:** `docs/superpowers/plans/2026-05-14-sp5-daily-tasks.md`

## What shipped
- _Fill in after completion: Were all spec §10 acceptance criteria met? Any deferred?_

## What went well
- _Fill in after completion._

## What was harder than expected
- _Fill in after completion._

## Surprises
- _Fill in after completion._

## Follow-ups for SP-6 / later
- _Fill in after completion. Anything from spec §12 still open?_
```

- [ ] **Step 2: Commit Phase J**

```bash
git add tests/e2e/sp5-daily-tasks.spec.ts docs/superpowers/retros/2026-05-14-sp5-retro.md
git commit -m "test(SP-5-J): Playwright smoke + retro stub

- /admin/tasks + /admin/tasks/past unauthenticated redirects
- /api/tasks/[id]/toggle malformed-body rejection
- Retro stub at docs/superpowers/retros/2026-05-14-sp5-retro.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Step 1: Run all green**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`
Expected: All commands pass.

- [ ] **Step 2: Push branch + open PR**

```bash
git push -u origin sp5-daily-tasks
gh pr create --title "SP-5: Daily Tasks + Dashboard Wiring" \
  --body "Implements the SP-5 spec at docs/superpowers/specs/2026-05-14-sp5-daily-tasks-design.md. All §10 acceptance criteria verified. Plan: docs/superpowers/plans/2026-05-14-sp5-daily-tasks.md."
```

- [ ] **Step 3: Fill in the retro**

Open `docs/superpowers/retros/2026-05-14-sp5-retro.md` and replace the stub bullets with real notes from the implementation.

---

## Self-Review Summary

This plan covers every acceptance criterion in spec §10:

- **Daily tasks (user):** TodaysTasks wiring (D2), rest-day empty state (D1), toggle (C1+C3), mid-week-signup forward-only via adjustedRollup (E2).
- **Streak (user):** WeeklyStreak component (E1), currentStreak (B4–B5), Active Streak card (E2), rest-day skip (B4 test + B5 impl).
- **Performance chart (user):** Re-label + series (F2), rest days excluded (F2's `valid.filter(d => d.total > 0)`).
- **Stat cards (user):** Tasks Done (D2), Active Streak (E2).
- **Admin:** Coach gate via `requireCoach()` (G2, H2 actions), category tabs + Live/Draft (G2), Create draft week (H2), drawer add/edit/delete/reorder (H2 + H3), rename-preserves-completion (H2 uses UPDATE not delete-insert; cascade verified in J2), past weeks (I1).
- **General:** Vitest (B1–B5), Playwright (J1), build/typecheck/lint each commit.

No placeholders remain. All file paths are exact. Types `DashboardTaskItem`, `DayRollup`, `TaskType`, and `WeekShape` are defined where introduced. The `WeeklySchedule.tsx` deletion in E1 cleanly removes the old demo data path.
