-- SP-5: Daily Tasks accountability layer.
-- Three tables (task_weeks, daily_tasks, user_task_completions), one enum,
-- one RPC, and RLS. Admin writes go through service role from server actions
-- gated by requireCoach() -- there is no coach-row write policy on the shared
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
