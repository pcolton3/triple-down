-- Golf events: invitations, signups, buy-in tracking.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Privacy model: the app has no logins, so tables are locked down with RLS and
-- every write goes through the functions below.
--   * golf_events          public read (event details only)
--   * golf_event_secrets   no access (organizer key hash)
--   * golf_event_signups   no direct access; emails are only returned to the organizer key

create table if not exists public.golf_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  title text not null,
  description text not null default '',
  days jsonb not null default '[]'::jsonb,
  buy_in numeric not null default 0,
  team_bet numeric not null default 0,
  ctp_per_day numeric not null default 0,
  skins_per_day numeric not null default 0,
  team_one_name text not null default 'Team 1',
  team_two_name text not null default 'Team 2',
  signups_open boolean not null default true,
  max_players integer,
  created_at timestamptz not null default now()
);

-- days:   [{ day, date, format: 'team_match'|'singles_match', course, address, teeTime, website, notes, roundCode }]
-- agenda: [{ id, date, time, title, location, address, link, notes }]
alter table public.golf_events add column if not exists agenda jsonb not null default '[]'::jsonb;

create table if not exists public.golf_event_secrets (
  event_id uuid primary key references public.golf_events(id) on delete cascade,
  organizer_key_hash text not null
);

create table if not exists public.golf_event_signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.golf_events(id) on delete cascade,
  name text not null,
  email text not null,
  handicap numeric not null,
  team text check (team in ('team_one', 'team_two')),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists golf_event_signups_event_email
  on public.golf_event_signups (event_id, lower(email));

alter table public.golf_events enable row level security;
alter table public.golf_event_secrets enable row level security;
alter table public.golf_event_signups enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'golf_events' and policyname = 'golf_events_public_read') then
    create policy golf_events_public_read on public.golf_events for select using (true);
  end if;
end $$;

create or replace function public.golf_event_key_ok(p_event_id uuid, p_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from golf_event_secrets
    where event_id = p_event_id
      and organizer_key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex')
  );
$$;
revoke execute on function public.golf_event_key_ok(uuid, text) from public, anon, authenticated;

create or replace function public.create_golf_event(p_event jsonb)
returns table (code text, organizer_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_event->>'code'));
  v_key text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  if coalesce(trim(p_event->>'title'), '') = '' then raise exception 'Event title is required'; end if;
  insert into golf_events (code, title, description, days, agenda, buy_in, team_bet, ctp_per_day, skins_per_day, team_one_name, team_two_name, max_players)
  values (
    v_code,
    trim(p_event->>'title'),
    coalesce(p_event->>'description', ''),
    coalesce(p_event->'days', '[]'::jsonb),
    coalesce(p_event->'agenda', '[]'::jsonb),
    coalesce((p_event->>'buy_in')::numeric, 0),
    coalesce((p_event->>'team_bet')::numeric, 0),
    coalesce((p_event->>'ctp_per_day')::numeric, 0),
    coalesce((p_event->>'skins_per_day')::numeric, 0),
    coalesce(nullif(trim(p_event->>'team_one_name'), ''), 'Team 1'),
    coalesce(nullif(trim(p_event->>'team_two_name'), ''), 'Team 2'),
    nullif(p_event->>'max_players', '')::integer
  )
  returning id into v_id;
  insert into golf_event_secrets (event_id, organizer_key_hash)
  values (v_id, encode(sha256(convert_to(v_key, 'UTF8')), 'hex'));
  return query select v_code, v_key;
end;
$$;

create or replace function public.signup_for_golf_event(p_code text, p_name text, p_email text, p_handicap numeric)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event golf_events;
  v_count integer;
  v_existing uuid;
begin
  select * into v_event from golf_events where code = upper(trim(p_code));
  if not found then raise exception 'Event not found'; end if;
  if not v_event.signups_open then raise exception 'Signups for this event are closed'; end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 60 then raise exception 'Enter your name'; end if;
  if trim(coalesce(p_email, '')) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 120 then raise exception 'Enter a valid email'; end if;
  if p_handicap is null or p_handicap < -10 or p_handicap > 54 then raise exception 'Handicap must be between -10 and 54'; end if;

  select id into v_existing from golf_event_signups where event_id = v_event.id and lower(email) = lower(trim(p_email));
  if v_existing is not null then
    update golf_event_signups set name = trim(p_name), handicap = round(p_handicap, 1), updated_at = now() where id = v_existing;
    return 'updated';
  end if;

  select count(*) into v_count from golf_event_signups where event_id = v_event.id;
  if v_count >= coalesce(v_event.max_players, 200) then raise exception 'This event is full'; end if;

  insert into golf_event_signups (event_id, name, email, handicap)
  values (v_event.id, trim(p_name), lower(trim(p_email)), round(p_handicap, 1));
  return 'added';
end;
$$;

-- Public roster: names, handicaps and teams only, never emails.
create or replace function public.golf_event_roster(p_code text)
returns table (name text, handicap numeric, team text)
language sql
security definer
set search_path = public
stable
as $$
  select s.name, s.handicap, s.team
  from golf_event_signups s join golf_events e on e.id = s.event_id
  where e.code = upper(trim(p_code))
  order by s.created_at;
$$;

create or replace function public.organizer_golf_event_signups(p_code text, p_key text)
returns setof public.golf_event_signups
language plpgsql
security definer
set search_path = public
stable
as $$
declare v_id uuid;
begin
  select id into v_id from golf_events where code = upper(trim(p_code));
  if v_id is null or not golf_event_key_ok(v_id, p_key) then raise exception 'Organizer link is not valid'; end if;
  return query select * from golf_event_signups where event_id = v_id order by created_at;
end;
$$;

-- p_patch keys (all optional): team ('team_one' | 'team_two' | null), paid (bool), remove (bool)
create or replace function public.organizer_update_golf_signup(p_code text, p_key text, p_signup_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from golf_events where code = upper(trim(p_code));
  if v_id is null or not golf_event_key_ok(v_id, p_key) then raise exception 'Organizer link is not valid'; end if;
  if coalesce((p_patch->>'remove')::boolean, false) then
    delete from golf_event_signups where id = p_signup_id and event_id = v_id;
    return;
  end if;
  update golf_event_signups set
    team = case when p_patch ? 'team' then nullif(p_patch->>'team', '') else team end,
    paid = case when p_patch ? 'paid' then (p_patch->>'paid')::boolean else paid end,
    handicap = case when p_patch ? 'handicap' then round((p_patch->>'handicap')::numeric, 1) else handicap end,
    updated_at = now()
  where id = p_signup_id and event_id = v_id;
end;
$$;

create or replace function public.organizer_update_golf_event(p_code text, p_key text, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from golf_events where code = upper(trim(p_code));
  if v_id is null or not golf_event_key_ok(v_id, p_key) then raise exception 'Organizer link is not valid'; end if;
  update golf_events set
    title = coalesce(nullif(trim(p_patch->>'title'), ''), title),
    description = coalesce(p_patch->>'description', description),
    days = coalesce(p_patch->'days', days),
    agenda = coalesce(p_patch->'agenda', agenda),
    team_one_name = coalesce(nullif(trim(p_patch->>'team_one_name'), ''), team_one_name),
    team_two_name = coalesce(nullif(trim(p_patch->>'team_two_name'), ''), team_two_name),
    signups_open = coalesce((p_patch->>'signups_open')::boolean, signups_open)
  where id = v_id;
end;
$$;

grant execute on function public.create_golf_event(jsonb) to anon, authenticated;
grant execute on function public.signup_for_golf_event(text, text, text, numeric) to anon, authenticated;
grant execute on function public.golf_event_roster(text) to anon, authenticated;
grant execute on function public.organizer_golf_event_signups(text, text) to anon, authenticated;
grant execute on function public.organizer_update_golf_signup(text, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.organizer_update_golf_event(text, text, jsonb) to anon, authenticated;
