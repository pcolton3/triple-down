alter table public.round_holes
  add column if not exists group_number integer not null default 1;

alter table public.round_matchups
  add column if not exists group_number integer not null default 1;

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

alter table public.round_groups enable row level security;
alter table public.round_group_players enable row level security;

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
end $$;

create table if not exists public.saved_golfers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  handicap numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

alter table public.saved_golfers enable row level security;

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
end $$;
