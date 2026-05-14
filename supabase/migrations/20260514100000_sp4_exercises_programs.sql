-- SP-4: exercises, programmes, user progress, avatar_url on profiles

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
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.program_sessions on delete cascade,
  exercise_id  uuid not null references public.exercises on delete restrict,
  order_index  int not null default 0,
  sets         int,
  reps         text,
  weight       text,
  pct_of_1rm   int,
  rest_seconds int,
  notes        text,
  lift_key     text,
  tutorial_id  uuid
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

-- RLS
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
