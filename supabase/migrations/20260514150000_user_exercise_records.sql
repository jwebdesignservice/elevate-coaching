-- SP-4-followup: per-exercise user records (1RM, 5-6 rep max, 10-12 rep max)

create table public.user_exercise_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles on delete cascade,
  exercise_id  uuid not null references public.exercises on delete cascade,
  one_rm_kg    numeric,
  five_rm_kg   numeric,
  twelve_rm_kg numeric,
  updated_at   timestamptz not null default now(),
  unique (user_id, exercise_id)
);

alter table public.user_exercise_records enable row level security;

create policy "users read own records"
  on public.user_exercise_records for select
  using (auth.uid() = user_id);

create policy "users insert own records"
  on public.user_exercise_records for insert
  with check (auth.uid() = user_id);

create policy "users update own records"
  on public.user_exercise_records for update
  using (auth.uid() = user_id);

create policy "users delete own records"
  on public.user_exercise_records for delete
  using (auth.uid() = user_id);

create index user_exercise_records_user_idx on public.user_exercise_records (user_id);
create index user_exercise_records_exercise_idx on public.user_exercise_records (exercise_id);
