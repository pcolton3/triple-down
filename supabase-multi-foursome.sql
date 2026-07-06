alter table public.round_holes
  add column if not exists group_number integer not null default 1;

alter table public.round_matchups
  add column if not exists group_number integer not null default 1;

alter table public.round_players
  add column if not exists banker_participant boolean not null default true;

alter table public.round_players
  add column if not exists skins_participant boolean not null default true;

alter table public.round_players
  add column if not exists ctp_participant boolean not null default true;

alter table public.round_players
  add column if not exists low_net_participant boolean not null default true;

alter table public.round_matchups
  add column if not exists banker_participant boolean not null default true;

alter table public.rounds
  add column if not exists ryder_event_code text;

alter table public.rounds
  add column if not exists ryder_event_day integer;

create index if not exists rounds_ryder_event_code_idx
  on public.rounds (ryder_event_code, ryder_event_day);

alter table public.round_games
  drop constraint if exists round_games_game_type_check;

alter table public.round_games
  add constraint round_games_game_type_check
  check (game_type in (
    'banker',
    'skins',
    'low_net',
    'ctp',
    'nassau',
    'stableford',
    'birdie_pot',
    'eagle_pot',
    'hole_in_one',
    'wolf',
    'bingo_bango_bongo',
    'vegas',
    'match_play',
    'team_match_play',
    'aces_and_deuces',
    'arnies',
    'best_ball',
    'better_ball',
    'dots',
    'four_ball',
    'medal_play',
    'medal_play_group',
    'nines',
    'points',
    'quota',
    'rabbit',
    'scotch',
    'sixes',
    'skins_group',
    'snake',
    'stableford_group',
    'three_ball',
    'trouble'
  ));

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_matchups'
      and policyname = 'round_matchups_public_delete'
  ) then
    create policy round_matchups_public_delete
      on public.round_matchups for delete
      using (true);
  end if;
end $$;

alter table public.round_ctp_results
  add column if not exists group_number integer not null default 1;

alter table public.round_holes
  drop constraint if exists round_holes_round_id_hole_number_key;

create unique index if not exists round_holes_round_group_hole_idx
  on public.round_holes (round_id, group_number, hole_number);

alter table public.round_ctp_results
  drop constraint if exists round_ctp_results_round_id_hole_number_key;

drop index if exists public.round_ctp_results_round_id_hole_number_key;

create unique index if not exists round_ctp_results_round_group_hole_idx
  on public.round_ctp_results (round_id, group_number, hole_number);

create table if not exists public.round_groups (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  group_number integer not null,
  group_name text,
  tee_time text,
  scorekeeper_device_id text,
  scorekeeper_name text,
  current_hole integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, group_number)
);

create table if not exists public.round_group_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  round_group_id uuid not null references public.round_groups(id) on delete cascade,
  player_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, player_key)
);

create table if not exists public.round_settlement_snapshots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  round_code text not null,
  snapshot jsonb not null,
  finalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id),
  unique (round_code)
);

alter table public.round_groups enable row level security;
alter table public.round_group_players enable row level security;
alter table public.round_settlement_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_groups'
      and policyname = 'round_groups_public_read'
  ) then
    create policy round_groups_public_read
      on public.round_groups for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_groups'
      and policyname = 'round_groups_public_insert'
  ) then
    create policy round_groups_public_insert
      on public.round_groups for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_groups'
      and policyname = 'round_groups_public_update'
  ) then
    create policy round_groups_public_update
      on public.round_groups for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_group_players'
      and policyname = 'round_group_players_public_read'
  ) then
    create policy round_group_players_public_read
      on public.round_group_players for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_group_players'
      and policyname = 'round_group_players_public_insert'
  ) then
    create policy round_group_players_public_insert
      on public.round_group_players for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_group_players'
      and policyname = 'round_group_players_public_update'
  ) then
    create policy round_group_players_public_update
      on public.round_group_players for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_settlement_snapshots'
      and policyname = 'round_settlement_snapshots_public_read'
  ) then
    create policy round_settlement_snapshots_public_read
      on public.round_settlement_snapshots for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_settlement_snapshots'
      and policyname = 'round_settlement_snapshots_public_insert'
  ) then
    create policy round_settlement_snapshots_public_insert
      on public.round_settlement_snapshots for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_settlement_snapshots'
      and policyname = 'round_settlement_snapshots_public_update'
  ) then
    create policy round_settlement_snapshots_public_update
      on public.round_settlement_snapshots for update
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';

create table if not exists public.saved_golfers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  handicap numeric not null default 0,
  posted_rounds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

alter table public.saved_golfers
  add column if not exists posted_rounds integer not null default 0;

create table if not exists public.saved_golfer_scores (
  id uuid primary key default gen_random_uuid(),
  golfer_id uuid not null references public.saved_golfers(id) on delete cascade,
  round_code text not null,
  player_key text not null,
  course_name text not null,
  adjusted_gross_score numeric not null,
  course_rating numeric not null,
  slope_rating numeric not null,
  pcc numeric not null default 0,
  score_differential numeric not null,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (golfer_id, round_code, player_key)
);

create table if not exists public.saved_courses (
  id uuid primary key default gen_random_uuid(),
  source_provider text,
  source_course_id text,
  name text not null,
  normalized_name text not null,
  city text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name, city, state)
);

create table if not exists public.saved_course_holes (
  id uuid primary key default gen_random_uuid(),
  saved_course_id uuid not null references public.saved_courses(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  par integer check (par between 3 and 5),
  handicap_index integer check (handicap_index between 1 and 18),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (saved_course_id, hole_number)
);

create table if not exists public.saved_course_tees (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  course_name text not null,
  tee_name text not null,
  tee_color text not null,
  gender text,
  course_rating numeric not null,
  slope_rating numeric not null,
  total_yards integer,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_key, tee_name, gender)
);

alter table public.saved_course_tees add column if not exists tee_name text;
update public.saved_course_tees set tee_name = tee_color where tee_name is null;
alter table public.saved_course_tees alter column tee_name set not null;
alter table public.saved_course_tees add column if not exists gender text;
update public.saved_course_tees set gender = 'M' where gender is null;
alter table public.saved_course_tees add column if not exists total_yards integer;
alter table public.saved_course_tees add column if not exists source_url text;
alter table public.saved_course_tees drop constraint if exists saved_course_tees_course_key_tee_color_key;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_course_tees_course_key_tee_name_gender_key'
      and conrelid = 'public.saved_course_tees'::regclass
  ) then
    alter table public.saved_course_tees
      add constraint saved_course_tees_course_key_tee_name_gender_key unique (course_key, tee_name, gender);
  end if;
end $$;

alter table public.saved_golfers enable row level security;
alter table public.saved_golfer_scores enable row level security;
alter table public.saved_courses enable row level security;
alter table public.saved_course_holes enable row level security;
alter table public.saved_course_tees enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_golfers'
      and policyname = 'saved_golfers_public_read'
  ) then
    create policy saved_golfers_public_read
      on public.saved_golfers for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_golfers'
      and policyname = 'saved_golfers_public_insert'
  ) then
    create policy saved_golfers_public_insert
      on public.saved_golfers for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_golfers'
      and policyname = 'saved_golfers_public_update'
  ) then
    create policy saved_golfers_public_update
      on public.saved_golfers for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_golfer_scores'
      and policyname = 'saved_golfer_scores_public_read'
  ) then
    create policy saved_golfer_scores_public_read
      on public.saved_golfer_scores for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_golfer_scores'
      and policyname = 'saved_golfer_scores_public_insert'
  ) then
    create policy saved_golfer_scores_public_insert
      on public.saved_golfer_scores for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_golfer_scores'
      and policyname = 'saved_golfer_scores_public_update'
  ) then
    create policy saved_golfer_scores_public_update
      on public.saved_golfer_scores for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_courses'
      and policyname = 'saved_courses_public_read'
  ) then
    create policy saved_courses_public_read
      on public.saved_courses for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_courses'
      and policyname = 'saved_courses_public_insert'
  ) then
    create policy saved_courses_public_insert
      on public.saved_courses for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_courses'
      and policyname = 'saved_courses_public_update'
  ) then
    create policy saved_courses_public_update
      on public.saved_courses for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_course_holes'
      and policyname = 'saved_course_holes_public_read'
  ) then
    create policy saved_course_holes_public_read
      on public.saved_course_holes for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_course_holes'
      and policyname = 'saved_course_holes_public_insert'
  ) then
    create policy saved_course_holes_public_insert
      on public.saved_course_holes for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_course_holes'
      and policyname = 'saved_course_holes_public_update'
  ) then
    create policy saved_course_holes_public_update
      on public.saved_course_holes for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_course_tees'
      and policyname = 'saved_course_tees_public_read'
  ) then
    create policy saved_course_tees_public_read
      on public.saved_course_tees for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_course_tees'
      and policyname = 'saved_course_tees_public_insert'
  ) then
    create policy saved_course_tees_public_insert
      on public.saved_course_tees for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_course_tees'
      and policyname = 'saved_course_tees_public_update'
  ) then
    create policy saved_course_tees_public_update
      on public.saved_course_tees for update
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
