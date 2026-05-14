# SP-4: Exercises + Programmes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the exercise library, programme hierarchy, user progress tracking, admin builder, and settings profile gaps.

**Architecture:** Server components throughout; server actions for mutations; Supabase admin client for coach writes; RLS for user-scoped progress data. All 11 phases commit independently.

**Tech Stack:** Next.js 16 App Router, Supabase (SSR + admin client), Tailwind 4, Vitest, Playwright, Zod, `@base-ui/react`

**Key codebase facts:**
- `user_role` enum = `"user" | "coach"` — use existing `requireCoach()` from `lib/auth.ts` for all `/admin` routes
- Profile columns `max_lift_*` and `phone` already exist in DB and types — only `avatar_url` is missing
- Write-cast pattern: `{ ... } as never`; read-cast: `rawRow as { field: type }`
- Admin client: `createSupabaseAdminClient()` bypasses RLS; use for all coach writes to content tables

---

## File Structure

**Create:**
- `supabase/migrations/20260514100000_sp4_exercises_programs.sql`
- `lib/lifts.ts`
- `lib/programs.ts`
- `tests/lib/lifts.test.ts`
- `tests/lib/programs.test.ts`
- `app/(authed)/admin/layout.tsx`
- `app/(authed)/admin/page.tsx`
- `app/(authed)/admin/exercises/page.tsx`
- `app/(authed)/admin/exercises/new/page.tsx`
- `app/(authed)/admin/exercises/new/exercise-form.tsx`
- `app/(authed)/admin/exercises/new/actions.ts`
- `app/(authed)/admin/exercises/[id]/edit/page.tsx`
- `app/(authed)/admin/exercises/[id]/edit/actions.ts`
- `app/(authed)/admin/programs/page.tsx`
- `app/(authed)/admin/programs/new/page.tsx`
- `app/(authed)/admin/programs/new/program-form.tsx`
- `app/(authed)/admin/programs/new/actions.ts`
- `app/(authed)/admin/programs/[id]/edit/page.tsx`
- `app/(authed)/admin/programs/[id]/edit/actions.ts`
- `app/(authed)/exercises/page.tsx`
- `app/(authed)/exercises/[id]/page.tsx`
- `app/(authed)/programs/page.tsx`
- `app/(authed)/programs/[id]/page.tsx`
- `app/(authed)/programs/[id]/actions.ts`
- `app/(authed)/programs/[id]/week/[n]/page.tsx`
- `app/(authed)/programs/[id]/week/[n]/session/[s]/page.tsx`
- `app/(authed)/programs/[id]/week/[n]/session/[s]/session-complete-btn.tsx`
- `app/(authed)/programs/[id]/week/[n]/session/[s]/actions.ts`
- `app/(authed)/settings/profile-edit-card.tsx`
- `app/(authed)/settings/max-lifts-card.tsx`
- `tests/e2e/sp4-exercises-programs.spec.ts`

**Modify:**
- `middleware.ts` — add `/programs`, `/exercises`, `/admin` to `isProtectedPage`
- `app/(authed)/dashboard/page.tsx` — replace DEMO hero + two stat cards with real data
- `app/(authed)/settings/page.tsx` — swap static profile card for `ProfileEditCard`; swap static lifts card for `MaxLiftsCard`
- `app/(authed)/settings/actions.ts` — add `updateProfileAction`, `updateMaxLiftsAction`, `uploadAvatarAction`
- `components/layout/Sidebar.tsx` — wire Programs → `/programs`, Exercises → `/exercises`

---

## Phase A: DB Migration + Types

### Task 1: Write the migration

**Files:**
- Create: `supabase/migrations/20260514100000_sp4_exercises_programs.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260514100000_sp4_exercises_programs.sql

-- Avatar URL on profiles (max_lift_*, phone already exist from earlier migrations)
alter table public.profiles
  add column if not exists avatar_url text;

-- Exercise library
create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  video_url     text,
  muscle_groups text[] not null default '{}',
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- Programmes
create table public.programs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  cover_image_url text,
  category        user_category,
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
  id                      uuid primary key default gen_random_uuid(),
  week_id                 uuid not null references public.program_weeks on delete cascade,
  session_number          int not null,
  title                   text not null,
  instructions            text,
  estimated_duration_mins int,
  completion_rule         text,
  unique (week_id, session_number)
);

create table public.session_exercises (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.program_sessions on delete cascade,
  exercise_id uuid not null references public.exercises on delete restrict,
  order_index int not null default 0,
  sets        int,
  reps        text,
  weight      text,
  pct_of_1rm  int,
  rest_seconds int,
  notes       text,
  lift_key    text,
  tutorial_id uuid
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
  unique (user_id, session_id)
);

create table public.progress_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles on delete cascade,
  date               date not null default current_date,
  metric_type        text not null,
  value              numeric not null default 1,
  related_program_id uuid references public.programs,
  related_session_id uuid references public.program_sessions
);

-- RLS: content tables readable by all authenticated users
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_weeks enable row level security;
alter table public.program_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.user_program_enrollments enable row level security;
alter table public.user_session_completions enable row level security;
alter table public.progress_logs enable row level security;

create policy "authenticated_read_exercises" on public.exercises
  for select to authenticated using (true);

create policy "authenticated_read_programs" on public.programs
  for select to authenticated using (true);

create policy "authenticated_read_program_weeks" on public.program_weeks
  for select to authenticated using (true);

create policy "authenticated_read_program_sessions" on public.program_sessions
  for select to authenticated using (true);

create policy "authenticated_read_session_exercises" on public.session_exercises
  for select to authenticated using (true);

-- User progress: own rows only
create policy "own_enrollments" on public.user_program_enrollments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_completions" on public.user_session_completions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_progress_logs" on public.progress_logs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Supabase Storage bucket for avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

create policy "avatar_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_public_read" on storage.objects
  for select to public using (bucket_id = 'avatars');
```

- [ ] **Step 2: Push migration and regenerate types**

```bash
npx supabase db push
npx supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts
```

Expected: `lib/supabase/database.types.ts` now includes `exercises`, `programs`, `program_weeks`, `program_sessions`, `session_exercises`, `user_program_enrollments`, `user_session_completions`, `progress_logs` tables. `profiles` Row includes `avatar_url: string | null`.

- [ ] **Step 3: Verify typecheck passes**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514100000_sp4_exercises_programs.sql lib/supabase/database.types.ts
git commit -m "feat(SP-4-A): DB migration — exercises, programmes, progress tables + avatar_url"
```

---

## Phase B: lib utilities + unit tests

### Task 2: lib/lifts.ts (TDD)

**Files:**
- Create: `tests/lib/lifts.test.ts`
- Create: `lib/lifts.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/lifts.test.ts
import { describe, it, expect } from 'vitest';
import { calcWeight } from '@/lib/lifts';

describe('calcWeight', () => {
  const profile = {
    max_lift_squat: 100,
    max_lift_bench: 80,
    max_lift_deadlift: 120,
    max_lift_ohp: 60,
  };

  it('returns pct label when no max lift recorded for key', () => {
    expect(calcWeight(75, 'squat', { ...profile, max_lift_squat: null }))
      .toBe('75% 1RM');
  });

  it('returns pct label when lift_key is null', () => {
    expect(calcWeight(75, null, profile)).toBe('75% 1RM');
  });

  it('returns pct label when lift_key is unknown', () => {
    expect(calcWeight(75, 'unknown', profile)).toBe('75% 1RM');
  });

  it('calculates squat weight correctly (rounds to 0.5kg)', () => {
    // 75% of 100kg = 75kg
    expect(calcWeight(75, 'squat', profile)).toBe('75% 1RM → 75 kg');
  });

  it('calculates bench weight correctly', () => {
    // 80% of 80kg = 64kg
    expect(calcWeight(80, 'bench', profile)).toBe('80% 1RM → 64 kg');
  });

  it('rounds to nearest 0.5kg', () => {
    // 75% of 101kg = 75.75kg → rounds to 76kg
    expect(calcWeight(75, 'squat', { ...profile, max_lift_squat: 101 }))
      .toBe('75% 1RM → 76 kg');
    // 75% of 103kg = 77.25kg → rounds to 77.5kg
    expect(calcWeight(75, 'squat', { ...profile, max_lift_squat: 103 }))
      .toBe('75% 1RM → 77.5 kg');
  });

  it('handles ohp key', () => {
    // 85% of 60kg = 51kg
    expect(calcWeight(85, 'ohp', profile)).toBe('85% 1RM → 51 kg');
  });

  it('handles deadlift key', () => {
    // 90% of 120kg = 108kg
    expect(calcWeight(90, 'deadlift', profile)).toBe('90% 1RM → 108 kg');
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd "C:\Users\Jack\Desktop\AI Website\htdocs\Websites\elevate-coaching"
npx vitest run tests/lib/lifts.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/lifts'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/lifts.ts
export interface MaxLifts {
  max_lift_squat: number | null;
  max_lift_bench: number | null;
  max_lift_deadlift: number | null;
  max_lift_ohp: number | null;
}

const LIFT_KEY_TO_PROFILE: Record<string, keyof MaxLifts> = {
  squat: 'max_lift_squat',
  bench: 'max_lift_bench',
  deadlift: 'max_lift_deadlift',
  ohp: 'max_lift_ohp',
};

export function calcWeight(
  pctOf1rm: number,
  liftKey: string | null,
  profile: MaxLifts,
): string {
  const col = liftKey ? LIFT_KEY_TO_PROFILE[liftKey] : null;
  const max1rm = col ? profile[col] : null;
  if (!max1rm) return `${pctOf1rm}% 1RM`;
  const kg = Math.round((pctOf1rm / 100) * max1rm * 2) / 2;
  return `${pctOf1rm}% 1RM → ${kg} kg`;
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npx vitest run tests/lib/lifts.test.ts
```

Expected: All 8 tests PASS.

### Task 3: lib/programs.ts (TDD)

**Files:**
- Create: `tests/lib/programs.test.ts`
- Create: `lib/programs.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/programs.test.ts
import { describe, it, expect } from 'vitest';
import { programProgressPct } from '@/lib/programs';

describe('programProgressPct', () => {
  it('returns 0 when total is 0', () => {
    expect(programProgressPct(0, 0)).toBe(0);
  });

  it('returns 0 when no sessions completed', () => {
    expect(programProgressPct(12, 0)).toBe(0);
  });

  it('returns 100 when all sessions completed', () => {
    expect(programProgressPct(12, 12)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    // 1/3 = 33.33… → 33
    expect(programProgressPct(3, 1)).toBe(33);
    // 2/3 = 66.66… → 67
    expect(programProgressPct(3, 2)).toBe(67);
  });

  it('handles partial progress', () => {
    expect(programProgressPct(20, 5)).toBe(25);
    expect(programProgressPct(12, 8)).toBe(67);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run tests/lib/programs.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/programs'`

- [ ] **Step 3: Write the implementation**

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

- [ ] **Step 4: Run to confirm pass**

```bash
npx vitest run tests/lib/programs.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run full unit test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/lifts.ts lib/programs.ts tests/lib/lifts.test.ts tests/lib/programs.test.ts
git commit -m "feat(SP-4-B): lib/lifts calcWeight + lib/programs progressPct with Vitest tests"
```

---

## Phase C: Admin middleware + /admin index

### Task 4: Protect /admin and /programs and /exercises routes

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Update isProtectedPage in middleware**

In `middleware.ts`, replace the line:
```typescript
const isProtectedPage = pathname.startsWith('/dashboard') || pathname.startsWith('/settings');
```
with:
```typescript
const isProtectedPage =
  pathname.startsWith('/dashboard') ||
  pathname.startsWith('/settings') ||
  pathname.startsWith('/programs') ||
  pathname.startsWith('/exercises') ||
  pathname.startsWith('/admin');
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

### Task 5: Admin layout (role gate)

**Files:**
- Create: `app/(authed)/admin/layout.tsx`

- [ ] **Step 1: Write the layout**

```typescript
// app/(authed)/admin/layout.tsx
import { requireCoach } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCoach();
  return <>{children}</>;
}
```

### Task 6: Admin index page

**Files:**
- Create: `app/(authed)/admin/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// app/(authed)/admin/page.tsx
import Link from 'next/link';
import { Dumbbell, LayoutList, Settings2 } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { requireCoach } from '@/lib/auth';

export const metadata = { title: 'Admin · Elevate Coaching' };

export default async function AdminPage() {
  const { profile } = await requireCoach();

  const tiles = [
    {
      href: '/admin/exercises',
      Icon: Dumbbell,
      title: 'Exercises',
      description: 'Create and manage the global exercise library.',
    },
    {
      href: '/admin/programs',
      Icon: LayoutList,
      title: 'Programmes',
      description: 'Build and publish training programmes.',
    },
  ];

  return (
    <>
      <TopBar
        title="Admin"
        subtitle="Coach control panel"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ href, Icon, title, description }) => (
            <Link key={href} href={href}>
              <Card className="bg-surface border-border hover:border-accent/40 flex items-start gap-4 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20">
                <div className="bg-accent/15 rounded-md p-2">
                  <Icon className="text-accent h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-text font-semibold">{title}</h2>
                  <p className="text-text-muted mt-1 text-sm">{description}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts app/(authed)/admin/layout.tsx app/(authed)/admin/page.tsx
git commit -m "feat(SP-4-C): admin layout + index, middleware protects /admin /programs /exercises"
```

---

## Phase D: Admin exercise CRUD

### Task 7: Exercise table page

**Files:**
- Create: `app/(authed)/admin/exercises/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// app/(authed)/admin/exercises/page.tsx
import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Exercises · Admin · Elevate Coaching' };

type ExerciseRow = {
  id: string;
  title: string;
  muscle_groups: string[];
  tags: string[];
};

export default async function AdminExercisesPage() {
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase
    .from('exercises')
    .select('id, title, muscle_groups, tags')
    .order('title');

  const exercises = (raw ?? []) as ExerciseRow[];

  return (
    <>
      <TopBar
        title="Exercises"
        subtitle={`${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} in library`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 flex justify-end">
          <Button asChild>
            <Link href="/admin/exercises/new">
              <Plus className="mr-1 h-4 w-4" />
              New Exercise
            </Link>
          </Button>
        </div>
        <Card className="bg-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-text-muted px-4 py-3 text-left font-medium">Title</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Muscle groups</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Tags</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {exercises.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-text-muted px-4 py-8 text-center">
                    No exercises yet. Create the first one.
                  </td>
                </tr>
              )}
              {exercises.map((ex) => (
                <tr key={ex.id} className="border-border border-b last:border-0">
                  <td className="text-text px-4 py-3 font-medium">{ex.title}</td>
                  <td className="text-text-muted px-4 py-3">
                    {ex.muscle_groups.join(', ') || '—'}
                  </td>
                  <td className="text-text-muted px-4 py-3">
                    {ex.tags.join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/exercises/${ex.id}/edit`}
                      className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-xs font-medium"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
```

### Task 8: Exercise form component (shared by new + edit)

**Files:**
- Create: `app/(authed)/admin/exercises/new/exercise-form.tsx`

- [ ] **Step 1: Write the form component**

```typescript
// app/(authed)/admin/exercises/new/exercise-form.tsx
'use client';

import { useActionState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ExerciseFormState = {
  status: 'idle' | 'error' | 'success';
  error: string | null;
};

export const exerciseFormInitialState: ExerciseFormState = {
  status: 'idle',
  error: null,
};

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body',
];

interface ExerciseFormProps {
  action: (prev: ExerciseFormState, formData: FormData) => Promise<ExerciseFormState>;
  defaultValues?: {
    title?: string;
    description?: string;
    video_url?: string;
    muscle_groups?: string[];
    tags?: string;
  };
  submitLabel?: string;
}

export function ExerciseForm({
  action,
  defaultValues,
  submitLabel = 'Create exercise',
}: ExerciseFormProps) {
  const [state, formAction, isPending] = useActionState<ExerciseFormState, FormData>(
    action,
    exerciseFormInitialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <Card className="bg-surface border-border p-6 space-y-5">
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            name="title"
            required
            defaultValue={defaultValues?.title}
            className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            placeholder="e.g. Back Squat"
          />
        </div>

        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Description</label>
          <textarea
            name="description"
            rows={4}
            defaultValue={defaultValues?.description}
            className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            placeholder="Cues, technique notes…"
          />
        </div>

        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Video URL</label>
          <input
            name="video_url"
            type="url"
            defaultValue={defaultValues?.video_url}
            className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            placeholder="https://youtube.com/…"
          />
        </div>

        <div>
          <p className="text-text mb-2 text-sm font-medium">Muscle groups</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {MUSCLE_GROUPS.map((mg) => (
              <label key={mg} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="muscle_groups"
                  value={mg}
                  defaultChecked={defaultValues?.muscle_groups?.includes(mg)}
                  className="accent-accent"
                />
                <span className="text-text-muted">{mg}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">
            Tags <span className="text-text-dim text-xs font-normal">(comma-separated)</span>
          </label>
          <input
            name="tags"
            defaultValue={defaultValues?.tags}
            className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            placeholder="compound, push, lower"
          />
        </div>
      </Card>

      {state.status === 'error' && state.error && (
        <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <X className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/90">
          {isPending ? 'Saving…' : submitLabel}
          {!isPending && <ArrowRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
```

### Task 9: Create exercise action + page

**Files:**
- Create: `app/(authed)/admin/exercises/new/actions.ts`
- Create: `app/(authed)/admin/exercises/new/page.tsx`

- [ ] **Step 1: Write the server action**

```typescript
// app/(authed)/admin/exercises/new/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { ExerciseFormState } from './exercise-form';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().trim().optional(),
  video_url: z.string().trim().url('Must be a valid URL.').optional().or(z.literal('')),
  muscle_groups: z.array(z.string()).default([]),
  tags: z.string().trim().optional(),
});

export async function createExerciseAction(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  await requireCoach();

  const parsed = schema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    video_url: formData.get('video_url') ?? '',
    muscle_groups: formData.getAll('muscle_groups') as string[],
    tags: formData.get('tags') ?? undefined,
  });

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const { title, description, video_url, muscle_groups, tags } = parsed.data;
  const tagArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.from('exercises').insert({
    title,
    description: description || null,
    video_url: video_url || null,
    muscle_groups,
    tags: tagArray,
  } as never);

  if (error) {
    return { status: 'error', error: 'Failed to create exercise. Please try again.' };
  }

  revalidatePath('/admin/exercises');
  redirect('/admin/exercises');
}
```

- [ ] **Step 2: Write the new exercise page**

```typescript
// app/(authed)/admin/exercises/new/page.tsx
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { requireCoach } from '@/lib/auth';
import { ExerciseForm } from './exercise-form';
import { createExerciseAction } from './actions';

export const metadata = { title: 'New Exercise · Admin · Elevate Coaching' };

export default async function NewExercisePage() {
  const { profile } = await requireCoach();

  return (
    <>
      <TopBar
        title="New Exercise"
        subtitle="Add to the global library"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
        <Link
          href="/admin/exercises"
          className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to exercises
        </Link>
        <ExerciseForm action={createExerciseAction} />
      </div>
    </>
  );
}
```

### Task 10: Edit exercise page + action

**Files:**
- Create: `app/(authed)/admin/exercises/[id]/edit/page.tsx`
- Create: `app/(authed)/admin/exercises/[id]/edit/actions.ts`

- [ ] **Step 1: Write the edit action**

```typescript
// app/(authed)/admin/exercises/[id]/edit/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { ExerciseFormState } from '../../new/exercise-form';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().trim().optional(),
  video_url: z.string().trim().url('Must be a valid URL.').optional().or(z.literal('')),
  muscle_groups: z.array(z.string()).default([]),
  tags: z.string().trim().optional(),
});

export async function updateExerciseAction(
  id: string,
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  await requireCoach();

  const parsed = schema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    video_url: formData.get('video_url') ?? '',
    muscle_groups: formData.getAll('muscle_groups') as string[],
    tags: formData.get('tags') ?? undefined,
  });

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const { title, description, video_url, muscle_groups, tags } = parsed.data;
  const tagArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from('exercises')
    .update({ title, description: description || null, video_url: video_url || null, muscle_groups, tags: tagArray } as never)
    .eq('id', id);

  if (error) {
    return { status: 'error', error: 'Failed to update exercise. Please try again.' };
  }

  revalidatePath('/admin/exercises');
  redirect('/admin/exercises');
}
```

- [ ] **Step 2: Write the edit page**

```typescript
// app/(authed)/admin/exercises/[id]/edit/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ExerciseForm } from '../../new/exercise-form';
import { updateExerciseAction } from './actions';

type ExerciseRow = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  muscle_groups: string[];
  tags: string[];
};

export const metadata = { title: 'Edit Exercise · Admin · Elevate Coaching' };

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase
    .from('exercises')
    .select('id, title, description, video_url, muscle_groups, tags')
    .eq('id', id)
    .single();

  if (!raw) notFound();

  const ex = raw as ExerciseRow;
  const boundAction = updateExerciseAction.bind(null, id);

  return (
    <>
      <TopBar
        title={`Edit: ${ex.title}`}
        subtitle="Update exercise details"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
        <Link
          href="/admin/exercises"
          className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to exercises
        </Link>
        <ExerciseForm
          action={boundAction}
          defaultValues={{
            title: ex.title,
            description: ex.description ?? '',
            video_url: ex.video_url ?? '',
            muscle_groups: ex.muscle_groups,
            tags: ex.tags.join(', '),
          }}
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(authed\)/admin/
git commit -m "feat(SP-4-D): admin exercise CRUD — table, create, edit"
```

---

## Phase E: Admin programme builder

### Task 11: Programme table page

**Files:**
- Create: `app/(authed)/admin/programs/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// app/(authed)/admin/programs/page.tsx
import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Programmes · Admin · Elevate Coaching' };

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', active: 'Active' };

type ProgramRow = {
  id: string;
  title: string;
  category: string | null;
  plan_access: string;
  status: string;
};

export default async function AdminProgramsPage() {
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase
    .from('programs')
    .select('id, title, category, plan_access, status')
    .order('created_at', { ascending: false });

  const programs = (raw ?? []) as ProgramRow[];

  return (
    <>
      <TopBar
        title="Programmes"
        subtitle={`${programs.length} programme${programs.length !== 1 ? 's' : ''}`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 flex justify-end">
          <Button asChild>
            <Link href="/admin/programs/new">
              <Plus className="mr-1 h-4 w-4" />
              New Programme
            </Link>
          </Button>
        </div>
        <Card className="bg-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-text-muted px-4 py-3 text-left font-medium">Title</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Category</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Plan</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Status</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {programs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-text-muted px-4 py-8 text-center">
                    No programmes yet.
                  </td>
                </tr>
              )}
              {programs.map((p) => (
                <tr key={p.id} className="border-border border-b last:border-0">
                  <td className="text-text px-4 py-3 font-medium">{p.title}</td>
                  <td className="text-text-muted px-4 py-3">{p.category ?? 'All'}</td>
                  <td className="text-text-muted px-4 py-3 capitalize">{p.plan_access}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${
                      p.status === 'active' ? 'bg-accent/15 text-accent' : 'bg-surface-hover text-text-muted'
                    }`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/programs/${p.id}/edit`}
                      className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-xs font-medium"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
```

### Task 12: Create programme form + action

**Files:**
- Create: `app/(authed)/admin/programs/new/program-form.tsx`
- Create: `app/(authed)/admin/programs/new/actions.ts`
- Create: `app/(authed)/admin/programs/new/page.tsx`

- [ ] **Step 1: Write the program metadata form**

```typescript
// app/(authed)/admin/programs/new/program-form.tsx
'use client';

import { useActionState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ProgramFormState = {
  status: 'idle' | 'error' | 'success';
  error: string | null;
};

export const programFormInitialState: ProgramFormState = { status: 'idle', error: null };

interface ProgramFormProps {
  action: (prev: ProgramFormState, formData: FormData) => Promise<ProgramFormState>;
  defaultValues?: {
    title?: string;
    description?: string;
    cover_image_url?: string;
    category?: string;
    plan_access?: string;
    status?: string;
  };
  submitLabel?: string;
}

export function ProgramForm({ action, defaultValues, submitLabel = 'Create programme' }: ProgramFormProps) {
  const [state, formAction, isPending] = useActionState<ProgramFormState, FormData>(
    action,
    programFormInitialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <Card className="bg-surface border-border p-6 space-y-5">
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            name="title"
            required
            defaultValue={defaultValues?.title}
            className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            placeholder="e.g. 12-Week Hybrid Performance"
          />
        </div>

        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Description</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={defaultValues?.description}
            className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Cover image URL</label>
          <input
            name="cover_image_url"
            type="url"
            defaultValue={defaultValues?.cover_image_url}
            className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            placeholder="https://…"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Category</label>
            <select
              name="category"
              defaultValue={defaultValues?.category ?? ''}
              className="bg-background border-border text-text focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            >
              <option value="">All categories</option>
              <option value="A">A — Strength</option>
              <option value="B">B — Hybrid</option>
              <option value="C">C — Conditioning</option>
              <option value="D">D — Beginner</option>
            </select>
          </div>

          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Plan access</label>
            <select
              name="plan_access"
              defaultValue={defaultValues?.plan_access ?? 'free'}
              className="bg-background border-border text-text focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            >
              <option value="free">Free</option>
              <option value="basic">Basic+</option>
              <option value="pro">Pro only</option>
            </select>
          </div>

          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Status</label>
            <select
              name="status"
              defaultValue={defaultValues?.status ?? 'draft'}
              className="bg-background border-border text-text focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>
      </Card>

      {state.status === 'error' && state.error && (
        <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <X className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/90">
          {isPending ? 'Saving…' : submitLabel}
          {!isPending && <ArrowRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Write the create action**

```typescript
// app/(authed)/admin/programs/new/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { ProgramFormState } from './program-form';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().trim().optional(),
  cover_image_url: z.string().trim().url().optional().or(z.literal('')),
  category: z.enum(['A', 'B', 'C', 'D', '']),
  plan_access: z.enum(['free', 'basic', 'pro']),
  status: z.enum(['draft', 'active']),
});

export async function createProgramAction(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await requireCoach();

  const parsed = schema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    cover_image_url: formData.get('cover_image_url') ?? '',
    category: formData.get('category') ?? '',
    plan_access: formData.get('plan_access') ?? 'free',
    status: formData.get('status') ?? 'draft',
  });

  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const { title, description, cover_image_url, category, plan_access, status } = parsed.data;

  const adminClient = createSupabaseAdminClient();
  const { data: newProgram, error } = await adminClient
    .from('programs')
    .insert({
      title,
      description: description || null,
      cover_image_url: cover_image_url || null,
      category: category || null,
      plan_access,
      status,
    } as never)
    .select('id')
    .single();

  if (error || !newProgram) {
    return { status: 'error', error: 'Failed to create programme. Please try again.' };
  }

  const prog = newProgram as { id: string };
  revalidatePath('/admin/programs');
  redirect(`/admin/programs/${prog.id}/edit`);
}
```

- [ ] **Step 3: Write the new programme page**

```typescript
// app/(authed)/admin/programs/new/page.tsx
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { requireCoach } from '@/lib/auth';
import { ProgramForm } from './program-form';
import { createProgramAction } from './actions';

export const metadata = { title: 'New Programme · Admin · Elevate Coaching' };

export default async function NewProgramPage() {
  const { profile } = await requireCoach();

  return (
    <>
      <TopBar
        title="New Programme"
        subtitle="Create metadata — add weeks and sessions next"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
        <Link href="/admin/programs" className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />
          Back to programmes
        </Link>
        <ProgramForm action={createProgramAction} />
      </div>
    </>
  );
}
```

### Task 13: Programme builder (edit page with weeks/sessions/exercises)

**Files:**
- Create: `app/(authed)/admin/programs/[id]/edit/page.tsx`
- Create: `app/(authed)/admin/programs/[id]/edit/actions.ts`

- [ ] **Step 1: Write all builder server actions**

```typescript
// app/(authed)/admin/programs/[id]/edit/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

function builderPath(programId: string) {
  return `/admin/programs/${programId}/edit`;
}

// ── Programme metadata ───────────────────────────────────────────────
export async function updateProgramMetaAction(programId: string, formData: FormData) {
  await requireCoach();
  const title = (formData.get('title') as string)?.trim();
  if (!title) return;

  const adminClient = createSupabaseAdminClient();
  await adminClient.from('programs').update({
    title,
    description: (formData.get('description') as string) || null,
    cover_image_url: (formData.get('cover_image_url') as string) || null,
    category: (formData.get('category') as string) || null,
    plan_access: formData.get('plan_access') as string,
    status: formData.get('status') as string,
  } as never).eq('id', programId);

  revalidatePath(builderPath(programId));
}

// ── Weeks ────────────────────────────────────────────────────────────
export async function addWeekAction(programId: string, formData: FormData) {
  await requireCoach();
  const title = (formData.get('week_title') as string)?.trim();
  if (!title) return;

  const adminClient = createSupabaseAdminClient();

  const { data: existing } = await adminClient
    .from('program_weeks')
    .select('week_number')
    .eq('program_id', programId)
    .order('week_number', { ascending: false })
    .limit(1);

  const rows = (existing ?? []) as { week_number: number }[];
  const nextWeek = (rows[0]?.week_number ?? 0) + 1;

  await adminClient.from('program_weeks').insert({
    program_id: programId,
    week_number: nextWeek,
    title,
    description: (formData.get('week_description') as string) || null,
  } as never);

  revalidatePath(builderPath(programId));
}

export async function deleteWeekAction(programId: string, weekId: string) {
  await requireCoach();
  const adminClient = createSupabaseAdminClient();
  await adminClient.from('program_weeks').delete().eq('id', weekId);
  revalidatePath(builderPath(programId));
}

// ── Sessions ─────────────────────────────────────────────────────────
export async function addSessionAction(programId: string, weekId: string, formData: FormData) {
  await requireCoach();
  const title = (formData.get('session_title') as string)?.trim();
  if (!title) return;

  const adminClient = createSupabaseAdminClient();

  const { data: existing } = await adminClient
    .from('program_sessions')
    .select('session_number')
    .eq('week_id', weekId)
    .order('session_number', { ascending: false })
    .limit(1);

  const rows = (existing ?? []) as { session_number: number }[];
  const nextSession = (rows[0]?.session_number ?? 0) + 1;

  await adminClient.from('program_sessions').insert({
    week_id: weekId,
    session_number: nextSession,
    title,
    instructions: (formData.get('session_instructions') as string) || null,
    estimated_duration_mins: parseInt(formData.get('estimated_duration_mins') as string) || null,
    completion_rule: (formData.get('completion_rule') as string) || null,
  } as never);

  revalidatePath(builderPath(programId));
}

export async function deleteSessionAction(programId: string, sessionId: string) {
  await requireCoach();
  const adminClient = createSupabaseAdminClient();
  await adminClient.from('program_sessions').delete().eq('id', sessionId);
  revalidatePath(builderPath(programId));
}

// ── Session exercises ─────────────────────────────────────────────────
export async function addSessionExerciseAction(
  programId: string,
  sessionId: string,
  formData: FormData,
) {
  await requireCoach();
  const exerciseId = (formData.get('exercise_id') as string)?.trim();
  if (!exerciseId) return;

  const adminClient = createSupabaseAdminClient();

  const { data: existing } = await adminClient
    .from('session_exercises')
    .select('order_index')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: false })
    .limit(1);

  const rows = (existing ?? []) as { order_index: number }[];
  const nextIndex = (rows[0]?.order_index ?? -1) + 1;

  const pctRaw = parseInt(formData.get('pct_of_1rm') as string);
  const pctOf1rm = isNaN(pctRaw) ? null : pctRaw;

  await adminClient.from('session_exercises').insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    order_index: nextIndex,
    sets: parseInt(formData.get('sets') as string) || null,
    reps: (formData.get('reps') as string) || null,
    weight: (formData.get('weight') as string) || null,
    pct_of_1rm: pctOf1rm,
    lift_key: (formData.get('lift_key') as string) || null,
    rest_seconds: parseInt(formData.get('rest_seconds') as string) || null,
    notes: (formData.get('notes') as string) || null,
  } as never);

  revalidatePath(builderPath(programId));
}

export async function removeSessionExerciseAction(programId: string, seId: string) {
  await requireCoach();
  const adminClient = createSupabaseAdminClient();
  await adminClient.from('session_exercises').delete().eq('id', seId);
  revalidatePath(builderPath(programId));
}
```

- [ ] **Step 2: Write the builder page**

```typescript
// app/(authed)/admin/programs/[id]/edit/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  updateProgramMetaAction,
  addWeekAction,
  deleteWeekAction,
  addSessionAction,
  deleteSessionAction,
  addSessionExerciseAction,
  removeSessionExerciseAction,
} from './actions';

type ProgramFull = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  plan_access: string;
  status: string;
  program_weeks: WeekFull[];
};

type WeekFull = {
  id: string;
  week_number: number;
  title: string;
  description: string | null;
  program_sessions: SessionFull[];
};

type SessionFull = {
  id: string;
  session_number: number;
  title: string;
  instructions: string | null;
  estimated_duration_mins: number | null;
  completion_rule: string | null;
  session_exercises: SessionExerciseFull[];
};

type SessionExerciseFull = {
  id: string;
  order_index: number;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  pct_of_1rm: number | null;
  lift_key: string | null;
  rest_seconds: number | null;
  notes: string | null;
  exercises: { id: string; title: string } | null;
};

type ExerciseOption = { id: string; title: string };

const INPUT =
  'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 rounded-md border px-3 py-2 text-sm outline-none transition-colors';

export const metadata = { title: 'Edit Programme · Admin · Elevate Coaching' };

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const [programRes, exercisesRes] = await Promise.all([
    supabase
      .from('programs')
      .select(
        `id, title, description, cover_image_url, category, plan_access, status,
        program_weeks (
          id, week_number, title, description,
          program_sessions (
            id, session_number, title, instructions, estimated_duration_mins, completion_rule,
            session_exercises (
              id, order_index, sets, reps, weight, pct_of_1rm, lift_key, rest_seconds, notes,
              exercises ( id, title )
            )
          )
        )`,
      )
      .eq('id', id)
      .single(),
    supabase.from('exercises').select('id, title').order('title'),
  ]);

  if (!programRes.data) notFound();

  const program = programRes.data as unknown as ProgramFull;
  const exercises = (exercisesRes.data ?? []) as ExerciseOption[];
  const weeks = [...(program.program_weeks ?? [])].sort((a, b) => a.week_number - b.week_number);

  const metaAction = updateProgramMetaAction.bind(null, id);
  const addWeek = addWeekAction.bind(null, id);

  return (
    <>
      <TopBar
        title={`Edit: ${program.title}`}
        subtitle="Builder — weeks → sessions → exercises"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/admin/programs" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />
          Back to programmes
        </Link>

        {/* Metadata */}
        <Card className="bg-surface border-border p-6">
          <h2 className="text-text mb-4 font-semibold">Programme metadata</h2>
          <form action={metaAction} className="space-y-4">
            <input name="title" defaultValue={program.title} required className={`${INPUT} w-full`} placeholder="Title" />
            <textarea name="description" defaultValue={program.description ?? ''} rows={2} className={`${INPUT} w-full`} placeholder="Description" />
            <input name="cover_image_url" defaultValue={program.cover_image_url ?? ''} className={`${INPUT} w-full`} placeholder="Cover image URL" />
            <div className="grid grid-cols-3 gap-3">
              <select name="category" defaultValue={program.category ?? ''} className={INPUT}>
                <option value="">All categories</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
              <select name="plan_access" defaultValue={program.plan_access} className={INPUT}>
                <option value="free">Free</option>
                <option value="basic">Basic+</option>
                <option value="pro">Pro only</option>
              </select>
              <select name="status" defaultValue={program.status} className={INPUT}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/90">Save metadata</Button>
            </div>
          </form>
        </Card>

        {/* Weeks */}
        {weeks.map((week) => {
          const sessions = [...(week.program_sessions ?? [])].sort((a, b) => a.session_number - b.session_number);
          const delWeek = deleteWeekAction.bind(null, id, week.id);
          const addSess = addSessionAction.bind(null, id, week.id);

          return (
            <Card key={week.id} className="bg-surface border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-text font-semibold">Week {week.week_number}: {week.title}</h3>
                <form action={delWeek}>
                  <button type="submit" className="text-destructive hover:text-destructive/80 inline-flex items-center gap-1 text-xs">
                    <Trash2 className="h-3 w-3" /> Delete week
                  </button>
                </form>
              </div>

              {/* Sessions */}
              {sessions.map((session) => {
                const ses = session.session_exercises?.sort((a, b) => a.order_index - b.order_index) ?? [];
                const delSess = deleteSessionAction.bind(null, id, session.id);
                const addSE = addSessionExerciseAction.bind(null, id, session.id);

                return (
                  <div key={session.id} className="border-border rounded-md border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-text text-sm font-medium">Session {session.session_number}: {session.title}</p>
                      <form action={delSess}>
                        <button type="submit" className="text-destructive hover:text-destructive/80 text-xs">Delete</button>
                      </form>
                    </div>

                    {/* Exercise list */}
                    {ses.map((se) => {
                      const removeSE = removeSessionExerciseAction.bind(null, id, se.id);
                      return (
                        <div key={se.id} className="bg-surface-hover/50 flex items-center justify-between rounded-sm px-3 py-2 text-xs">
                          <span className="text-text">{se.exercises?.title ?? '—'}</span>
                          <span className="text-text-muted">
                            {se.sets ? `${se.sets}×` : ''}{se.reps ?? ''}{se.pct_of_1rm ? ` @ ${se.pct_of_1rm}%` : se.weight ? ` · ${se.weight}` : ''}
                          </span>
                          <form action={removeSE}>
                            <button type="submit" className="text-destructive hover:text-destructive/80">Remove</button>
                          </form>
                        </div>
                      );
                    })}

                    {/* Add exercise to session */}
                    <form action={addSE} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <select name="exercise_id" required className={`${INPUT} col-span-2 sm:col-span-1`}>
                        <option value="">Pick exercise…</option>
                        {exercises.map((ex) => (
                          <option key={ex.id} value={ex.id}>{ex.title}</option>
                        ))}
                      </select>
                      <input name="sets" type="number" min="1" placeholder="Sets" className={INPUT} />
                      <input name="reps" placeholder="Reps (e.g. 5 or 8-12)" className={INPUT} />
                      <input name="weight" placeholder='Weight (e.g. 80kg)' className={INPUT} />
                      <input name="pct_of_1rm" type="number" min="1" max="100" placeholder="% 1RM" className={INPUT} />
                      <select name="lift_key" className={INPUT}>
                        <option value="">No 1RM key</option>
                        <option value="squat">Squat</option>
                        <option value="bench">Bench</option>
                        <option value="deadlift">Deadlift</option>
                        <option value="ohp">OHP</option>
                      </select>
                      <input name="rest_seconds" type="number" placeholder="Rest (s)" className={INPUT} />
                      <input name="notes" placeholder="Notes" className={INPUT} />
                      <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">
                        <Plus className="mr-1 h-3 w-3" /> Add exercise
                      </Button>
                    </form>
                  </div>
                );
              })}

              {/* Add session */}
              <form action={addSess} className="border-border grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-3">
                <input name="session_title" required placeholder="Session title" className={`${INPUT} col-span-2 sm:col-span-1`} />
                <input name="estimated_duration_mins" type="number" placeholder="Duration (mins)" className={INPUT} />
                <input name="completion_rule" placeholder="Completion rule (optional)" className={INPUT} />
                <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">
                  <Plus className="mr-1 h-3 w-3" /> Add session
                </Button>
              </form>
            </Card>
          );
        })}

        {/* Add week */}
        <Card className="bg-surface border-border p-6">
          <h3 className="text-text mb-3 font-semibold">Add week</h3>
          <form action={addWeek} className="flex gap-3">
            <input name="week_title" required placeholder="Week title (e.g. Foundation)" className={`${INPUT} flex-1`} />
            <Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/90">
              <Plus className="mr-1 h-4 w-4" /> Add week
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(authed\)/admin/programs/
git commit -m "feat(SP-4-E): admin programme builder — create, edit metadata, weeks/sessions/exercises"
```

---

## Phase F: User exercise library

### Task 14: Wire sidebar + exercise listing page

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Create: `app/(authed)/exercises/page.tsx`

- [ ] **Step 1: Update Sidebar nav items**

In `components/layout/Sidebar.tsx`, replace:
```typescript
  { label: 'Programs', href: '#', Icon: LibraryBig, comingSoon: true },
  { label: 'Exercises', href: '#', Icon: Dumbbell, comingSoon: true },
```
with:
```typescript
  { label: 'Programs', href: '/programs', Icon: LibraryBig },
  { label: 'Exercises', href: '/exercises', Icon: Dumbbell },
```

- [ ] **Step 2: Write the exercises listing page**

```typescript
// app/(authed)/exercises/page.tsx
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Dumbbell } from 'lucide-react';

export const metadata = { title: 'Exercises Â· Elevate Coaching' };

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body',
];

type ExerciseRow = { id: string; title: string; description: string | null; muscle_groups: string[]; tags: string[] };

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ muscle?: string }>;
}) {
  const sp = await searchParams;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('exercises').select('id, title, description, muscle_groups, tags').order('title');
  if (sp.muscle) query = query.contains('muscle_groups', [sp.muscle]);

  const { data: raw } = await query;
  const exercises = (raw ?? []) as ExerciseRow[];

  return (
    <>
      <TopBar title="Exercise Library" subtitle={`${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/exercises" className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${!sp.muscle ? 'bg-accent text-accent-fg' : 'bg-surface-hover text-text-muted hover:text-text'}`}>All</Link>
          {MUSCLE_GROUPS.map((mg) => (
            <Link key={mg} href={`/exercises?muscle=${encodeURIComponent(mg)}`} className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${sp.muscle === mg ? 'bg-accent text-accent-fg' : 'bg-surface-hover text-text-muted hover:text-text'}`}>{mg}</Link>
          ))}
        </div>
        {exercises.length === 0 && <p className="text-text-muted text-center py-12">No exercises found.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => (
            <Link key={ex.id} href={`/exercises/${ex.id}`}>
              <Card className="bg-surface border-border hover:border-accent/40 group flex h-full flex-col gap-3 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20">
                <div className="bg-accent/15 w-fit rounded-md p-2"><Dumbbell className="text-accent h-4 w-4" /></div>
                <h3 className="text-text font-semibold leading-snug group-hover:text-accent/90 transition-colors">{ex.title}</h3>
                {ex.description && <p className="text-text-muted line-clamp-2 text-sm leading-relaxed">{ex.description}</p>}
                {ex.muscle_groups.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1">
                    {ex.muscle_groups.slice(0, 3).map((mg) => (
                      <span key={mg} className="bg-surface-hover text-text-dim rounded-sm px-1.5 py-0.5 text-[10px] font-medium">{mg}</span>
                    ))}
                    {ex.muscle_groups.length > 3 && <span className="text-text-dim text-[10px]">+{ex.muscle_groups.length - 3}</span>}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
```

### Task 15: Exercise detail page

**Files:**
- Create: `app/(authed)/exercises/[id]/page.tsx`

- [ ] **Step 1: Write the detail page**

```typescript
// app/(authed)/exercises/[id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Dumbbell, Video } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import type { MaxLifts } from '@/lib/lifts';

type ExerciseRow = { id: string; title: string; description: string | null; video_url: string | null; muscle_groups: string[]; tags: string[] };

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase.from('exercises').select('id, title, description, video_url, muscle_groups, tags').eq('id', id).single();
  if (!raw) notFound();

  const ex = raw as ExerciseRow;
  const lifts = profile as unknown as MaxLifts;
  const liftDisplay = [
    { label: 'Squat', value: lifts.max_lift_squat },
    { label: 'Bench', value: lifts.max_lift_bench },
    { label: 'Deadlift', value: lifts.max_lift_deadlift },
    { label: 'OHP', value: lifts.max_lift_ohp },
  ];

  return (
    <>
      <TopBar title={ex.title} subtitle={ex.muscle_groups.join(' Â· ') || 'Exercise'} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/exercises" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm"><ChevronLeft className="h-4 w-4" />Back to library</Link>
        <Card className="bg-surface border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-accent/15 rounded-md p-2.5"><Dumbbell className="text-accent h-5 w-5" /></div>
            <h1 className="text-text text-2xl font-bold">{ex.title}</h1>
          </div>
          {ex.description && <p className="text-text-muted leading-relaxed">{ex.description}</p>}
          {ex.muscle_groups.length > 0 && (
            <div>
              <p className="text-text-dim mb-2 text-xs font-semibold uppercase tracking-wider">Muscles</p>
              <div className="flex flex-wrap gap-1.5">{ex.muscle_groups.map((mg) => <span key={mg} className="bg-accent/10 text-accent rounded-sm px-2 py-0.5 text-xs font-medium">{mg}</span>)}</div>
            </div>
          )}
          {ex.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{ex.tags.map((tag) => <span key={tag} className="bg-surface-hover text-text-muted rounded-sm px-2 py-0.5 text-xs">{tag}</span>)}</div>}
          {ex.video_url ? (
            <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80 inline-flex items-center gap-1.5 text-sm font-medium"><Video className="h-4 w-4" />Watch tutorial</a>
          ) : (
            <p className="text-text-dim text-xs italic">Video tutorial â€” coming in SP-6.</p>
          )}
        </Card>
        <Card className="bg-surface border-border p-6">
          <h2 className="text-text mb-3 font-semibold">Your 1RM reference</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {liftDisplay.map(({ label, value }) => (
              <div key={label} className="bg-surface-hover/50 rounded-md px-3 py-2 text-center">
                <p className="text-text-dim text-[10px] font-medium uppercase tracking-wider">{label}</p>
                <p className="text-text mt-1 text-lg font-bold">{value != null ? `${value} kg` : 'â€”'}</p>
              </div>
            ))}
          </div>
          <p className="text-text-dim mt-3 text-xs">Update your max lifts in <Link href="/settings" className="text-accent hover:underline">Settings</Link>.</p>
        </Card>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/layout/Sidebar.tsx app/\(authed\)/exercises/
git commit -m "feat(SP-4-F): user exercise library â€” grid with muscle filter + detail page"
```

---

## Phase G: Programme listing, detail, enrolment

### Task 16: Programme listing page

**Files:**
- Create: `app/(authed)/programs/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// app/(authed)/programs/page.tsx
import Link from 'next/link';
import { Lock, LayoutList } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { hasPlanAtLeast, type PlanTier } from '@/lib/plans';

export const metadata = { title: 'Programmes Â· Elevate Coaching' };

type ProgramRow = { id: string; title: string; description: string | null; cover_image_url: string | null; category: string | null; plan_access: string; status: string };
type EnrolmentRow = { program_id: string };

export default async function ProgramsPage() {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const tier = (profile.subscription_tier as PlanTier) ?? 'free';

  const [programsRes, enrolmentsRes] = await Promise.all([
    supabase.from('programs').select('id, title, description, cover_image_url, category, plan_access, status').eq('status', 'active').order('created_at'),
    supabase.from('user_program_enrollments').select('program_id').eq('user_id', profile.id),
  ]);

  const programs = (programsRes.data ?? []) as ProgramRow[];
  const enrolledIds = new Set(((enrolmentsRes.data ?? []) as EnrolmentRow[]).map((e) => e.program_id));
  const accessible = programs.filter((p) => !profile.category || !p.category || p.category === profile.category);

  return (
    <>
      <TopBar title="Programmes" subtitle="Your training journeys" userTier={profile.subscription_tier} userName={profile.name} />
      <div className="p-4 sm:p-6 lg:p-8">
        {accessible.length === 0 && <p className="text-text-muted py-12 text-center">No programmes available yet.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accessible.map((p) => {
            const canAccess = hasPlanAtLeast(tier, p.plan_access as PlanTier);
            const enrolled = enrolledIds.has(p.id);
            return (
              <Link key={p.id} href={`/programs/${p.id}`}>
                <Card className={`bg-surface border-border group flex h-full flex-col gap-3 overflow-hidden p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 ${canAccess ? 'hover:border-accent/40' : 'opacity-70'}`}>
                  {p.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_image_url} alt={p.title} className="h-32 w-full rounded-sm object-cover" />
                  ) : (
                    <div className="bg-surface-hover flex h-32 w-full items-center justify-center rounded-sm"><LayoutList className="text-text-dim h-8 w-8" /></div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-text font-semibold leading-snug">{p.title}</h3>
                    {!canAccess && <Lock className="text-text-dim mt-0.5 h-4 w-4 shrink-0" />}
                  </div>
                  {p.description && <p className="text-text-muted line-clamp-2 text-sm">{p.description}</p>}
                  <div className="mt-auto flex items-center gap-2">
                    {enrolled && <span className="bg-accent/15 text-accent rounded-pill px-2 py-0.5 text-[10px] font-semibold">Enrolled</span>}
                    {!canAccess && <span className="bg-surface-hover text-text-muted rounded-pill px-2 py-0.5 text-[10px] font-semibold capitalize">{p.plan_access}+ plan</span>}
                    {p.category && <span className="bg-surface-hover text-text-dim rounded-pill px-2 py-0.5 text-[10px]">Cat {p.category}</span>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
```

### Task 17: Programme detail + enrolment

**Files:**
- Create: `app/(authed)/programs/[id]/actions.ts`
- Create: `app/(authed)/programs/[id]/page.tsx`

- [ ] **Step 1: Write the enrol action**

```typescript
// app/(authed)/programs/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function enrollAction(programId: string) {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  await supabase.from('user_program_enrollments').upsert(
    { user_id: profile.id, program_id: programId } as never,
    { onConflict: 'user_id,program_id' },
  );

  await supabase.from('progress_logs').insert({
    user_id: profile.id,
    metric_type: 'program_enrolled',
    related_program_id: programId,
  } as never);

  revalidatePath(`/programs/${programId}`);
  revalidatePath('/dashboard');
}
```

- [ ] **Step 2: Write the programme detail page**

```typescript
// app/(authed)/programs/[id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, CheckCircle, Circle, Lock } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hasPlanAtLeast, type PlanTier } from '@/lib/plans';
import { programProgressPct } from '@/lib/programs';
import { enrollAction } from './actions';

type ProgramRow = { id: string; title: string; description: string | null; cover_image_url: string | null; plan_access: string };
type WeekRow = { id: string; week_number: number; title: string; program_sessions: { id: string }[] };
type EnrolmentRow = { current_week_number: number; last_session_id: string | null } | null;
type CompletionRow = { session_id: string };

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const tier = (profile.subscription_tier as PlanTier) ?? 'free';

  const [programRes, weeksRes, enrolmentRes, completionsRes] = await Promise.all([
    supabase.from('programs').select('id, title, description, cover_image_url, plan_access').eq('id', id).single(),
    supabase.from('program_weeks').select('id, week_number, title, program_sessions(id)').eq('program_id', id).order('week_number'),
    supabase.from('user_program_enrollments').select('current_week_number, last_session_id').eq('user_id', profile.id).eq('program_id', id).maybeSingle(),
    supabase.from('user_session_completions').select('session_id').eq('user_id', profile.id).eq('program_id', id),
  ]);

  if (!programRes.data) notFound();

  const program = programRes.data as ProgramRow;
  const weeks = (weeksRes.data ?? []) as unknown as WeekRow[];
  const enrolment = (enrolmentRes.data ?? null) as EnrolmentRow;
  const completedIds = new Set(((completionsRes.data ?? []) as CompletionRow[]).map((c) => c.session_id));

  const canAccess = hasPlanAtLeast(tier, program.plan_access as PlanTier);
  const isEnrolled = enrolment !== null;
  const totalSessions = weeks.reduce((sum, w) => sum + (w.program_sessions?.length ?? 0), 0);
  const progressPct = programProgressPct(totalSessions, completedIds.size);

  const enrol = enrollAction.bind(null, id);

  let continueHref = `/programs/${id}/week/1`;
  outer: for (const week of weeks) {
    for (const sess of (week.program_sessions ?? [])) {
      if (!completedIds.has(sess.id)) { continueHref = `/programs/${id}/week/${week.week_number}`; break outer; }
    }
  }

  return (
    <>
      <TopBar title={program.title} subtitle={`${totalSessions} sessions Â· ${progressPct}% complete`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/programs" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm"><ChevronLeft className="h-4 w-4" />All programmes</Link>
        <Card className="bg-surface border-border overflow-hidden p-0">
          {program.cover_image_url && <img src={program.cover_image_url} alt={program.title} className="h-48 w-full object-cover" />}
          <div className="p-6 space-y-4">
            <h1 className="text-text text-2xl font-bold">{program.title}</h1>
            {program.description && <p className="text-text-muted leading-relaxed">{program.description}</p>}
            {!canAccess && (
              <div className="border-border bg-surface-hover/50 flex items-center gap-3 rounded-md border p-4">
                <Lock className="text-text-dim h-5 w-5 shrink-0" />
                <div>
                  <p className="text-text text-sm font-medium">Requires {program.plan_access} plan</p>
                  <Link href="/pricing" className="text-accent text-xs hover:underline">Upgrade to unlock â†’</Link>
                </div>
              </div>
            )}
            {canAccess && (
              <div className="flex items-center gap-3">
                {isEnrolled ? (
                  <Button asChild className="bg-accent text-accent-fg hover:bg-accent/90"><Link href={continueHref}>Continue programme â†’</Link></Button>
                ) : (
                  <form action={enrol}><Button type="submit" className="bg-accent text-accent-fg hover:bg-accent/90">Start programme</Button></form>
                )}
              </div>
            )}
            {isEnrolled && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="text-text-dim">Progress</span><span className="text-text-muted">{progressPct}%</span></div>
                <div className="bg-surface-hover h-1.5 w-full rounded-full"><div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} /></div>
              </div>
            )}
          </div>
        </Card>
        {canAccess && (
          <div className="space-y-3">
            <h2 className="text-text font-semibold">Programme weeks</h2>
            {weeks.map((week) => {
              const weekSessions = week.program_sessions ?? [];
              const weekDone = weekSessions.filter((s) => completedIds.has(s.id)).length;
              return (
                <Link key={week.id} href={`/programs/${id}/week/${week.week_number}`}>
                  <Card className="bg-surface border-border hover:border-accent/40 flex items-center justify-between p-4 transition-all hover:-translate-y-0.5">
                    <div className="flex items-center gap-3">
                      {weekDone === weekSessions.length && weekSessions.length > 0 ? <CheckCircle className="text-accent h-5 w-5 shrink-0" /> : <Circle className="text-text-dim h-5 w-5 shrink-0" />}
                      <div>
                        <p className="text-text font-medium">Week {week.week_number}: {week.title}</p>
                        <p className="text-text-muted text-xs">{weekDone}/{weekSessions.length} sessions done</p>
                      </div>
                    </div>
                    <ChevronLeft className="text-text-dim h-4 w-4 rotate-180" />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/\(authed\)/programs/
git commit -m "feat(SP-4-G): programme listing, detail page, enrolment server action"
```

---

## Phase H: Week detail + session view + completion

### Task 18: Week detail page

**Files:**
- Create: `app/(authed)/programs/[id]/week/[n]/page.tsx`

- [ ] **Step 1: Write the week detail page**

```typescript
// app/(authed)/programs/[id]/week/[n]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, CheckCircle, Circle } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';

type WeekRow = { id: string; week_number: number; title: string; description: string | null };
type SessionRow = { id: string; session_number: number; title: string; estimated_duration_mins: number | null };
type CompletionRow = { session_id: string };

export default async function WeekDetailPage({ params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const weekNumber = parseInt(n);
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [weekRes, completionsRes] = await Promise.all([
    supabase.from('program_weeks').select('id, week_number, title, description, program_sessions(id, session_number, title, estimated_duration_mins)').eq('program_id', id).eq('week_number', weekNumber).single(),
    supabase.from('user_session_completions').select('session_id').eq('user_id', profile.id).eq('program_id', id),
  ]);

  if (!weekRes.data) notFound();

  const week = weekRes.data as unknown as WeekRow & { program_sessions: SessionRow[] };
  const completedIds = new Set(((completionsRes.data ?? []) as CompletionRow[]).map((c) => c.session_id));
  const sessions = [...(week.program_sessions ?? [])].sort((a, b) => a.session_number - b.session_number);

  return (
    <>
      <TopBar title={`Week ${week.week_number}: ${week.title}`} subtitle={`${completedIds.size} of ${sessions.length} sessions complete`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-lg space-y-4 p-4 sm:p-6 lg:p-8">
        <Link href={`/programs/${id}`} className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm"><ChevronLeft className="h-4 w-4" />Back to programme</Link>
        {week.description && <p className="text-text-muted text-sm leading-relaxed">{week.description}</p>}
        {sessions.map((sess) => {
          const done = completedIds.has(sess.id);
          return (
            <Link key={sess.id} href={`/programs/${id}/week/${weekNumber}/session/${sess.session_number}`}>
              <Card className={`bg-surface border-border hover:border-accent/40 flex items-center justify-between p-4 transition-all hover:-translate-y-0.5 ${done ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3">
                  {done ? <CheckCircle className="text-accent h-5 w-5 shrink-0" /> : <Circle className="text-text-dim h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-text font-medium">Session {sess.session_number}: {sess.title}</p>
                    {sess.estimated_duration_mins && <p className="text-text-dim text-xs">{sess.estimated_duration_mins} min</p>}
                  </div>
                </div>
                <ChevronLeft className="text-text-dim h-4 w-4 rotate-180" />
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
```

### Task 19: Session complete button + action + session view

**Files:**
- Create: `app/(authed)/programs/[id]/week/[n]/session/[s]/session-complete-btn.tsx`
- Create: `app/(authed)/programs/[id]/week/[n]/session/[s]/actions.ts`
- Create: `app/(authed)/programs/[id]/week/[n]/session/[s]/page.tsx`

- [ ] **Step 1: Write the client button**

```typescript
// app/(authed)/programs/[id]/week/[n]/session/[s]/session-complete-btn.tsx
'use client';

import { useTransition } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { action: () => Promise<void>; alreadyDone: boolean }

export function SessionCompleteBtn({ action, alreadyDone }: Props) {
  const [isPending, startTransition] = useTransition();
  if (alreadyDone) {
    return <div className="flex items-center gap-2 text-sm font-medium text-accent"><CheckCircle className="h-5 w-5" />Session completed</div>;
  }
  return (
    <Button onClick={() => startTransition(() => action())} disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/90 w-full sm:w-auto">
      {isPending ? 'Savingâ€¦' : 'Mark session complete'}{!isPending && <CheckCircle className="ml-2 h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 2: Write the complete action**

```typescript
// app/(authed)/programs/[id]/week/[n]/session/[s]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function completeSessionAction(programId: string, weekNumber: number, sessionId: string) {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  await supabase.from('user_session_completions').upsert(
    { user_id: profile.id, session_id: sessionId, program_id: programId, week_number: weekNumber } as never,
    { onConflict: 'user_id,session_id' },
  );

  await supabase.from('progress_logs').insert({
    user_id: profile.id,
    metric_type: 'session_completed',
    related_program_id: programId,
    related_session_id: sessionId,
  } as never);

  await supabase.from('user_program_enrollments').update({ last_session_id: sessionId } as never).eq('user_id', profile.id).eq('program_id', programId);

  revalidatePath(`/programs/${programId}`);
  revalidatePath('/dashboard');
}
```

- [ ] **Step 3: Write the session view page**

```typescript
// app/(authed)/programs/[id]/week/[n]/session/[s]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { calcWeight, type MaxLifts } from '@/lib/lifts';
import { SessionCompleteBtn } from './session-complete-btn';
import { completeSessionAction } from './actions';

type SessionExRow = { id: string; order_index: number; sets: number | null; reps: string | null; weight: string | null; pct_of_1rm: number | null; lift_key: string | null; rest_seconds: number | null; notes: string | null; exercises: { title: string } | null };
type CompletionRow = { session_id: string };

export default async function SessionViewPage({ params }: { params: Promise<{ id: string; n: string; s: string }> }) {
  const { id, n, s } = await params;
  const weekNumber = parseInt(n);
  const sessionNumber = parseInt(s);
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const weekRes = await supabase.from('program_weeks').select('id').eq('program_id', id).eq('week_number', weekNumber).single();
  if (!weekRes.data) notFound();
  const weekId = (weekRes.data as { id: string }).id;

  const sessionRes = await supabase.from('program_sessions').select('id, session_number, title, instructions, estimated_duration_mins').eq('week_id', weekId).eq('session_number', sessionNumber).single();
  if (!sessionRes.data) notFound();

  const session = sessionRes.data as { id: string; session_number: number; title: string; instructions: string | null; estimated_duration_mins: number | null };

  const [seRes, completionRes] = await Promise.all([
    supabase.from('session_exercises').select('id, order_index, sets, reps, weight, pct_of_1rm, lift_key, rest_seconds, notes, exercises(title)').eq('session_id', session.id).order('order_index'),
    supabase.from('user_session_completions').select('session_id').eq('user_id', profile.id).eq('program_id', id),
  ]);

  const sessionExercises = (seRes.data ?? []) as unknown as SessionExRow[];
  const completedIds = new Set(((completionRes.data ?? []) as CompletionRow[]).map((c) => c.session_id));
  const alreadyDone = completedIds.has(session.id);
  const maxLifts = profile as unknown as MaxLifts;
  const completeAction = completeSessionAction.bind(null, id, weekNumber, session.id);

  return (
    <>
      <TopBar title={session.title} subtitle={`Week ${weekNumber} Â· Session ${sessionNumber}${session.estimated_duration_mins ? ` Â· ${session.estimated_duration_mins} min` : ''}`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href={`/programs/${id}/week/${weekNumber}`} className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm"><ChevronLeft className="h-4 w-4" />Back to week</Link>
        {session.instructions && <Card className="bg-surface border-border p-5"><p className="text-text-muted text-sm leading-relaxed">{session.instructions}</p></Card>}
        <div className="space-y-3">
          {sessionExercises.map((se, i) => {
            const weightDisplay = se.pct_of_1rm != null ? calcWeight(se.pct_of_1rm, se.lift_key, maxLifts) : se.weight ?? null;
            return (
              <Card key={se.id} className="bg-surface border-border p-5">
                <div className="flex items-start gap-3">
                  <span className="bg-accent/15 text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-text font-semibold">{se.exercises?.title ?? 'Unknown exercise'}</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      {se.sets != null && <div><span className="text-text-dim text-[10px] uppercase tracking-wider">Sets</span><p className="text-text font-medium">{se.sets}</p></div>}
                      {se.reps && <div><span className="text-text-dim text-[10px] uppercase tracking-wider">Reps</span><p className="text-text font-medium">{se.reps}</p></div>}
                      {weightDisplay && <div><span className="text-text-dim text-[10px] uppercase tracking-wider">Load</span><p className="text-accent font-medium">{weightDisplay}</p></div>}
                      {se.rest_seconds != null && <div><span className="text-text-dim text-[10px] uppercase tracking-wider">Rest</span><p className="text-text font-medium">{se.rest_seconds}s</p></div>}
                    </div>
                    {se.notes && <p className="text-text-dim text-xs italic">{se.notes}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <div className="flex justify-end pt-2"><SessionCompleteBtn action={completeAction} alreadyDone={alreadyDone} /></div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/\(authed\)/programs/\[id\]/week/
git commit -m "feat(SP-4-H): week detail, session view with 1RM calc, mark-complete action"
```

---

## Phase I: Dashboard real data

### Task 20: Replace DEMO programme data in dashboard

**Files:**
- Modify: `app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Add real-data fetches to dashboard**

The dashboard already imports `requireUser`, `CATEGORY_INFO`, chart components etc. Add these imports at the top:
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { programProgressPct } from '@/lib/programs';
import Link from 'next/link';
```

Replace the `export default async function DashboardPage()` body. Keep all DEMO_ constants (tasks, schedule, performance, videos â€” those are SP-5). Change only the data fetching and the JSX that renders the hero card and first two stat cards:

```typescript
export default async function DashboardPage() {
  const { profile } = await requireUser();
  const firstName = profile.name?.split(/\s+/)[0]?.trim() || 'there';
  const category = profile.category as Category;
  const categoryInfo = CATEGORY_INFO[category];
  const supabase = await createSupabaseServerClient();

  // Fetch most recent programme enrolment
  const enrolmentRes = await supabase
    .from('user_program_enrollments')
    .select('program_id, current_week_number, programs(title, program_weeks(id))')
    .eq('user_id', profile.id)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Total sessions done (all time)
  const { count: totalSessionsDone } = await supabase
    .from('user_session_completions')
    .select('session_id', { count: 'exact', head: true })
    .eq('user_id', profile.id);

  type EnrolmentRow = { program_id: string; current_week_number: number; programs: { title: string; program_weeks: { id: string }[] } | null };
  const enrolment = (enrolmentRes.data ?? null) as EnrolmentRow | null;

  let programProgressValue = 0;
  let heroTitle = 'Start a programme';
  let heroMeta = 'Explore the programme library to begin your journey.';
  let heroPct = 0;
  let primaryCta = { label: 'Browse programmes', href: '/programs' };
  let secondaryCta = { label: 'View exercises', href: '/exercises' };

  if (enrolment?.programs) {
    const prog = enrolment.programs;
    const totalWeeks = prog.program_weeks?.length ?? 0;
    heroTitle = prog.title;
    heroMeta = `Week ${enrolment.current_week_number} of ${totalWeeks} Â· ${categoryInfo.name}`;
    heroPct = totalWeeks > 0 ? Math.round((enrolment.current_week_number / totalWeeks) * 100) : 0;
    programProgressValue = heroPct;
    primaryCta = { label: 'Continue programme', href: `/programs/${enrolment.program_id}` };
    secondaryCta = { label: 'View exercises', href: '/exercises' };
  }

  const sessionsDone = totalSessionsDone ?? 0;

  return (
    <>
      <TopBar title={`Welcome back, ${firstName} ðŸ‘‹`} subtitle="Ready to elevate your performance today?" userTier={profile.subscription_tier} userName={profile.name} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <ProgramHero
            eyebrow={`Category ${category} Â· ${categoryInfo.name}`}
            title={heroTitle}
            meta={heroMeta}
            progressPct={heroPct}
            primary={primaryCta}
            secondary={secondaryCta}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Programme Progress" value={`${programProgressValue}%`} caption={enrolment ? 'Current programme' : 'No programme started'} captionTone={enrolment ? 'accent' : 'muted'} visual={<CircularProgress value={programProgressValue} size={48} strokeWidth={4} label={`${programProgressValue}%`} />} />
            <StatCard icon={<Dumbbell className="h-3.5 w-3.5" />} label="Sessions Done" value={String(sessionsDone)} caption="All time" captionTone="muted" visual={<CircularProgress value={Math.min(sessionsDone * 5, 100)} size={48} strokeWidth={4} label={String(sessionsDone)} />} />
            <StatCard icon={<Flame className="h-3.5 w-3.5" />} label="Active Streak" value="â€”" caption="Coming in SP-5" captionTone="muted" visual={<MiniBars data={[1,1,1,1,1,1,1]} />} />
            <StatCard icon={<Bookmark className="h-3.5 w-3.5" />} label="Tasks Done" value="â€”" caption="Coming in SP-5" captionTone="muted" visual={<CircularProgress value={0} size={48} strokeWidth={4} label="â€”" />} />
          </div>
          {/* Video Tutorials section â€” keep existing DEMO_VIDEOS JSX unchanged */}
          ...existing video section...
        </div>
        <RightRail>
          <TodaysTasks tasks={DEMO_TASKS} />
          <WeeklySchedule days={DEMO_DAYS} activeDayIndex={3} items={DEMO_SCHEDULE} />
          <PerformanceOverview metricLabel="Strength Score" series={DEMO_PERFORMANCE} defaultPeriod="30D" />
        </RightRail>
      </div>
    </>
  );
}
```

Note: keep the existing `DEMO_VIDEOS` JSX section unchanged between the stat cards and the right rail.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/\(authed\)/dashboard/page.tsx
git commit -m "feat(SP-4-I): dashboard â€” real programme progress + sessions done stat cards"
```

---

## Phase J: Settings profile gaps

### Task 21: ProfileEditCard (avatar, name, email, phone)

**Files:**
- Create: `app/(authed)/settings/profile-edit-card.tsx`

- [ ] **Step 1: Write the profile edit card**

```typescript
// app/(authed)/settings/profile-edit-card.tsx
'use client';

import { useActionState, useRef } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateProfileAction, uploadAvatarAction } from './actions';

type PState = { status: 'idle' | 'error' | 'success'; error: string | null; message: string | null };
const INIT: PState = { status: 'idle', error: null, message: null };
const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors';

interface Props { name: string | null; email: string; phone: string | null; avatarUrl: string | null; initials: string }

export function ProfileEditCard({ name, email, phone, avatarUrl, initials }: Props) {
  const [state, formAction, isPending] = useActionState<PState, FormData>(updateProfileAction, INIT);
  const [avatarState, avatarAction, avatarPending] = useActionState<PState, FormData>(uploadAvatarAction, INIT);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="bg-surface border-border p-6 space-y-6">
      <h2 className="text-text text-xl font-semibold tracking-tight">Profile</h2>
      <div className="flex items-center gap-5">
        <Avatar size="lg" className="size-16 shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? 'Avatar'} />}
          <AvatarFallback className="bg-surface-hover text-text text-xl font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <form action={avatarAction}>
          <input ref={fileRef} type="file" name="avatar" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) { const fd = new FormData(); fd.append('avatar', e.target.files[0]); avatarAction(fd); } }} />
          <Button type="button" variant="outline" size="sm" disabled={avatarPending} onClick={() => fileRef.current?.click()}>
            {avatarPending ? 'Uploadingâ€¦' : 'Change photo'}
          </Button>
          {avatarState.status === 'error' && <p className="text-destructive mt-1 text-xs">{avatarState.error}</p>}
          {avatarState.status === 'success' && <p className="text-accent mt-1 text-xs flex items-center gap-1"><Check className="h-3 w-3" />{avatarState.message}</p>}
        </form>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="text-text mb-1.5 block text-sm font-medium">Full name</label><input name="name" defaultValue={name ?? ''} className={INPUT} placeholder="Your name" /></div>
          <div><label className="text-text mb-1.5 block text-sm font-medium">Phone</label><input name="phone" type="tel" defaultValue={phone ?? ''} className={INPUT} placeholder="+44 7700 000000" /></div>
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Email</label>
          <input name="email" type="email" defaultValue={email} className={INPUT} />
          <p className="text-text-dim mt-1 text-xs">Changing your email sends a verification link to the new address.</p>
        </div>
        {state.status === 'error' && state.error && <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><X className="h-3.5 w-3.5 shrink-0" />{state.error}</p>}
        {state.status === 'success' && state.message && <p role="status" className="text-accent flex items-center gap-2 text-sm"><Check className="h-4 w-4" />{state.message}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/90">
            {isPending ? 'Savingâ€¦' : 'Save changes'}{!isPending && <ArrowRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

### Task 22: MaxLiftsCard + settings actions + settings page wiring

**Files:**
- Create: `app/(authed)/settings/max-lifts-card.tsx`
- Modify: `app/(authed)/settings/actions.ts`
- Modify: `app/(authed)/settings/page.tsx`

- [ ] **Step 1: Write MaxLiftsCard**

```typescript
// app/(authed)/settings/max-lifts-card.tsx
'use client';

import { useActionState, useState } from 'react';
import { ArrowRight, Check, Dumbbell, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { calcWeight } from '@/lib/lifts';
import { updateMaxLiftsAction } from './actions';

type LState = { status: 'idle' | 'error' | 'success'; error: string | null; message: string | null };
const INIT: LState = { status: 'idle', error: null, message: null };
const LIFTS = [
  { key: 'max_lift_squat' as const, label: 'Back Squat', liftKey: 'squat' },
  { key: 'max_lift_bench' as const, label: 'Bench Press', liftKey: 'bench' },
  { key: 'max_lift_deadlift' as const, label: 'Deadlift', liftKey: 'deadlift' },
  { key: 'max_lift_ohp' as const, label: 'Overhead Press', liftKey: 'ohp' },
];
type MaxLiftVals = { max_lift_squat: number | null; max_lift_bench: number | null; max_lift_deadlift: number | null; max_lift_ohp: number | null };
const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors';

export function MaxLiftsCard({ defaults }: { defaults: MaxLiftVals }) {
  const [state, formAction, isPending] = useActionState<LState, FormData>(updateMaxLiftsAction, INIT);
  const [vals, setVals] = useState<Record<string, string>>({
    max_lift_squat: String(defaults.max_lift_squat ?? ''),
    max_lift_bench: String(defaults.max_lift_bench ?? ''),
    max_lift_deadlift: String(defaults.max_lift_deadlift ?? ''),
    max_lift_ohp: String(defaults.max_lift_ohp ?? ''),
  });

  return (
    <Card className="bg-surface border-border p-6 space-y-5">
      <div><h2 className="text-text text-xl font-semibold tracking-tight">Performance Baselines</h2><p className="text-text-muted mt-1 text-sm">Your 1-rep max lifts. Used to auto-calculate training weights.</p></div>
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LIFTS.map(({ key, label, liftKey }) => {
            const num = parseFloat(vals[key]);
            const preview = !isNaN(num) && num > 0 ? calcWeight(75, liftKey, { max_lift_squat: key === 'max_lift_squat' ? num : null, max_lift_bench: key === 'max_lift_bench' ? num : null, max_lift_deadlift: key === 'max_lift_deadlift' ? num : null, max_lift_ohp: key === 'max_lift_ohp' ? num : null }) : null;
            return (
              <div key={key}>
                <label className="text-text mb-1.5 block text-sm font-medium">{label}</label>
                <div className="relative">
                  <input name={key} type="number" min="0" step="0.5" value={vals[key]} onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))} className={INPUT} placeholder="kg" />
                  <span className="text-text-dim pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">kg</span>
                </div>
                {preview && <p className="text-accent mt-1 text-xs">75% â†’ {preview.split('â†’')[1]?.trim()}</p>}
              </div>
            );
          })}
        </div>
        {state.status === 'error' && state.error && <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><X className="h-3.5 w-3.5 shrink-0" />{state.error}</p>}
        {state.status === 'success' && state.message && <p role="status" className="text-accent flex items-center gap-2 text-sm"><Check className="h-4 w-4" />{state.message}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/90">{isPending ? 'Savingâ€¦' : 'Save lifts'}{!isPending && <ArrowRight className="ml-1 h-4 w-4" />}</Button>
        </div>
      </form>
      <p className="text-text-dim text-xs"><Dumbbell className="mr-1 inline h-3 w-3" />Session views use these values to show auto-calculated working weights.</p>
    </Card>
  );
}
```

- [ ] **Step 2: Append new actions to `app/(authed)/settings/actions.ts`**

Add these exports at the end of the existing file (after `requestCategoryChangeAction`). Also add `revalidatePath` to the existing import if not present:

```typescript
// Add to top import block if not already there:
// import { revalidatePath } from 'next/cache';

type ProfileActionState = { status: 'idle' | 'error' | 'success'; error: string | null; message: string | null };

export async function updateProfileAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const name = (formData.get('name') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const newEmail = (formData.get('email') as string)?.trim();

  const { error } = await supabase.from('profiles').update({ name, phone } as never).eq('id', user.id);
  if (error) return { status: 'error', error: 'Failed to update profile.', message: null };

  if (newEmail && newEmail !== user.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
    if (emailError) return { status: 'error', error: emailError.message, message: null };
    revalidatePath('/settings');
    return { status: 'success', error: null, message: 'Profile saved. A verification link has been sent to your new email.' };
  }

  revalidatePath('/settings');
  return { status: 'success', error: null, message: 'Profile saved.' };
}

export async function updateMaxLiftsAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const parse = (key: string) => { const v = parseFloat(formData.get(key) as string); return isNaN(v) || v <= 0 ? null : v; };

  const { error } = await supabase.from('profiles').update({
    max_lift_squat: parse('max_lift_squat'),
    max_lift_bench: parse('max_lift_bench'),
    max_lift_deadlift: parse('max_lift_deadlift'),
    max_lift_ohp: parse('max_lift_ohp'),
  } as never).eq('id', user.id);

  if (error) return { status: 'error', error: 'Failed to save lifts.', message: null };
  revalidatePath('/settings');
  return { status: 'success', error: null, message: 'Max lifts saved.' };
}

export async function uploadAvatarAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const file = formData.get('avatar') as File | null;
  if (!file || file.size === 0) return { status: 'error', error: 'No file selected.', message: null };
  if (file.size > 2 * 1024 * 1024) return { status: 'error', error: 'File must be under 2MB.', message: null };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { status: 'error', error: 'Only JPEG, PNG, or WebP allowed.', message: null };

  const ext = file.type.split('/')[1];
  const path = `${user.id}/avatar.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: file.type, upsert: true });
  if (uploadError) return { status: 'error', error: 'Upload failed. Please try again.', message: null };

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const { error: profileError } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl } as never).eq('id', user.id);
  if (profileError) return { status: 'error', error: 'Failed to save avatar URL.', message: null };

  revalidatePath('/settings');
  return { status: 'success', error: null, message: 'Photo updated.' };
}
```

- [ ] **Step 3: Update settings/page.tsx to use new cards**

In `app/(authed)/settings/page.tsx`:

1. Add imports:
```typescript
import { ProfileEditCard } from './profile-edit-card';
import { MaxLiftsCard } from './max-lifts-card';
```

2. Replace the static Profile `<Card>` block (the `from-surface to-surface-hover` gradient card) with:
```tsx
<ProfileEditCard
  name={profile.name}
  email={profile.email}
  phone={(profile as { phone: string | null }).phone}
  avatarUrl={(profile as { avatar_url: string | null }).avatar_url}
  initials={initials}
/>
```

3. Replace the static Performance Baselines `<Card>` block with:
```tsx
<MaxLiftsCard
  defaults={{
    max_lift_squat: profile.max_lift_squat,
    max_lift_bench: profile.max_lift_bench,
    max_lift_deadlift: profile.max_lift_deadlift,
    max_lift_ohp: profile.max_lift_ohp,
  }}
/>
```

4. Remove now-unused icon imports from the page (`BadgeCheck, Phone, User as UserIcon` if no longer used).

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/\(authed\)/settings/
git commit -m "feat(SP-4-J): settings â€” editable name/email/phone, avatar upload, max lifts with live % preview"
```

---

## Phase K: Playwright smoke tests + acceptance

### Task 23: Write smoke tests + final checks

**Files:**
- Create: `tests/e2e/sp4-exercises-programs.spec.ts`

- [ ] **Step 1: Write the smoke tests**

```typescript
// tests/e2e/sp4-exercises-programs.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SP-4 /exercises smoke', () => {
  test('renders filter bar with muscle groups', async ({ page }) => {
    await page.goto('/exercises');
    await expect(page.getByRole('link', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chest' })).toBeVisible();
  });

  test('filter by muscle group updates URL', async ({ page }) => {
    await page.goto('/exercises');
    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page).toHaveURL(/muscle=Back/);
  });
});

test.describe('SP-4 /programs smoke', () => {
  test('renders programmes page heading', async ({ page }) => {
    await page.goto('/programs');
    await expect(page).toHaveURL(/\/programs/);
  });
});

test.describe('SP-4 /admin redirect', () => {
  test('unauthenticated /admin redirects to sign-in', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/sign-in/);
  });
});
```

- [ ] **Step 2: Run unit tests**

```bash
npx vitest run
```

Expected: All unit tests pass (lifts, programs, plans, categories, auth, env).

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Build**

```bash
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/sp4-exercises-programs.spec.ts
git commit -m "feat(SP-4-K): Playwright smoke tests â€” exercises filter, programs, admin redirect"
```

---

## Acceptance checklist

Walk through these manually after all phases are committed:

- [ ] `/exercises` renders exercise grid. Muscle group pills filter the list. URL updates.
- [ ] Clicking an exercise opens detail page with description, muscle groups, 1RM reference.
- [ ] Admin at `/admin/exercises/new` creates an exercise â€” visible in `/exercises` immediately.
- [ ] Admin at `/admin/programs/new` creates programme, then builder adds weeks â†’ sessions â†’ exercises.
- [ ] Setting programme status = active makes it appear in `/programs`.
- [ ] User can enrol in a programme. Enrolment persists on refresh.
- [ ] Session view shows exercises with sets/reps. Load column shows `75% 1RM â†’ 75 kg` when max lift is set.
- [ ] "Mark session complete" records completion. Revisiting shows green check.
- [ ] Dashboard hero shows active programme name. Programme Progress % and Sessions Done update.
- [ ] Free user sees `plan_access = 'basic'` programme locked with upgrade prompt.
- [ ] `/settings` â€” name, phone save. Email change shows "verification link sent" message. Avatar upload updates photo.
- [ ] Max lifts save. Live `75% â†’ X kg` preview updates as you type.
- [ ] `npx vitest run` â€” all green.
- [ ] `npx tsc --noEmit` â€” 0 errors.
- [ ] `npx next build` â€” succeeds.

