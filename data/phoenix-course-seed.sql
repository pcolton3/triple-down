-- Phoenix course seed data: 57 verified courses
-- Generated from data/phoenix-course-seed.csv
-- Safe to paste into Supabase SQL Editor and run more than once.

create extension if not exists pgcrypto;

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
  tee_color text not null,
  course_rating numeric not null,
  slope_rating numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_key, tee_color)
);

alter table public.saved_courses enable row level security;
alter table public.saved_course_holes enable row level security;
alter table public.saved_course_tees enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_courses' and policyname = 'saved_courses_public_read') then
    create policy saved_courses_public_read on public.saved_courses for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_courses' and policyname = 'saved_courses_public_insert') then
    create policy saved_courses_public_insert on public.saved_courses for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_courses' and policyname = 'saved_courses_public_update') then
    create policy saved_courses_public_update on public.saved_courses for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_course_holes' and policyname = 'saved_course_holes_public_read') then
    create policy saved_course_holes_public_read on public.saved_course_holes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_course_holes' and policyname = 'saved_course_holes_public_insert') then
    create policy saved_course_holes_public_insert on public.saved_course_holes for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_course_holes' and policyname = 'saved_course_holes_public_update') then
    create policy saved_course_holes_public_update on public.saved_course_holes for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_course_tees' and policyname = 'saved_course_tees_public_read') then
    create policy saved_course_tees_public_read on public.saved_course_tees for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_course_tees' and policyname = 'saved_course_tees_public_insert') then
    create policy saved_course_tees_public_insert on public.saved_course_tees for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_course_tees' and policyname = 'saved_course_tees_public_update') then
    create policy saved_course_tees_public_update on public.saved_course_tees for update using (true) with check (true);
  end if;
end $$;

begin;

-- 1. We-Ko-Pa Golf Club (Saguaro)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'we-ko-pa-golf-club-saguaro', 'We-Ko-Pa Golf Club (Saguaro)', 'we-ko-pa-golf-club-saguaro', 'Fort McDowell', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('we-ko-pa-golf-club-saguaro', 'We-Ko-Pa Golf Club (Saguaro)', 'White', 68.8, 125, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'we-ko-pa-golf-club-saguaro' and city is not distinct from 'Fort McDowell' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 5, now()),
  (id, 2, 4, 11, now()),
  (id, 3, 4, 9, now()),
  (id, 4, 5, 1, now()),
  (id, 5, 3, 15, now()),
  (id, 6, 4, 7, now()),
  (id, 7, 4, 13, now()),
  (id, 8, 5, 3, now()),
  (id, 9, 3, 17, now()),
  (id, 10, 4, 14, now()),
  (id, 11, 3, 18, now()),
  (id, 12, 4, 6, now()),
  (id, 13, 4, 8, now()),
  (id, 14, 5, 2, now()),
  (id, 15, 3, 16, now()),
  (id, 16, 4, 12, now()),
  (id, 17, 4, 10, now()),
  (id, 18, 4, 4, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 2. We-Ko-Pa Golf Club (Cholla)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'we-ko-pa-golf-club-cholla', 'We-Ko-Pa Golf Club (Cholla)', 'we-ko-pa-golf-club-cholla', 'Fort McDowell', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('we-ko-pa-golf-club-cholla', 'We-Ko-Pa Golf Club (Cholla)', 'Composite', 69.4, 126, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'we-ko-pa-golf-club-cholla' and city is not distinct from 'Fort McDowell' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 5, 3, now()),
  (id, 3, 3, 17, now()),
  (id, 4, 4, 9, now()),
  (id, 5, 3, 15, now()),
  (id, 6, 4, 7, now()),
  (id, 7, 4, 11, now()),
  (id, 8, 5, 1, now()),
  (id, 9, 4, 5, now()),
  (id, 10, 5, 4, now()),
  (id, 11, 3, 16, now()),
  (id, 12, 4, 10, now()),
  (id, 13, 4, 12, now()),
  (id, 14, 3, 18, now()),
  (id, 15, 4, 14, now()),
  (id, 16, 4, 6, now()),
  (id, 17, 5, 2, now()),
  (id, 18, 4, 8, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 3. Troon North Golf Club (Monument)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'troon-north-golf-club-monument', 'Troon North Golf Club (Monument)', 'troon-north-golf-club-monument', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('troon-north-golf-club-monument', 'Troon North Golf Club (Monument)', 'Silver', 69.8, 132, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'troon-north-golf-club-monument' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 5, now()),
  (id, 2, 3, 17, now()),
  (id, 3, 5, 3, now()),
  (id, 4, 4, 11, now()),
  (id, 5, 4, 1, now()),
  (id, 6, 4, 13, now()),
  (id, 7, 3, 15, now()),
  (id, 8, 4, 9, now()),
  (id, 9, 5, 7, now()),
  (id, 10, 4, 10, now()),
  (id, 11, 5, 6, now()),
  (id, 12, 4, 8, now()),
  (id, 13, 3, 18, now()),
  (id, 14, 5, 4, now()),
  (id, 15, 4, 14, now()),
  (id, 16, 3, 16, now()),
  (id, 17, 4, 2, now()),
  (id, 18, 4, 12, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 4. Troon North Golf Club (Pinnacle)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'troon-north-golf-club-pinnacle', 'Troon North Golf Club (Pinnacle)', 'troon-north-golf-club-pinnacle', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('troon-north-golf-club-pinnacle', 'Troon North Golf Club (Pinnacle)', 'Silver', 69.8, 131, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'troon-north-golf-club-pinnacle' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 9, now()),
  (id, 2, 4, 7, now()),
  (id, 3, 4, 3, now()),
  (id, 4, 4, 11, now()),
  (id, 5, 5, 5, now()),
  (id, 6, 3, 17, now()),
  (id, 7, 4, 1, now()),
  (id, 8, 3, 15, now()),
  (id, 9, 4, 13, now()),
  (id, 10, 4, 10, now()),
  (id, 11, 5, 8, now()),
  (id, 12, 4, 12, now()),
  (id, 13, 3, 16, now()),
  (id, 14, 5, 2, now()),
  (id, 15, 4, 14, now()),
  (id, 16, 3, 18, now()),
  (id, 17, 4, 4, now()),
  (id, 18, 4, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 5. Grayhawk Golf Club (Raptor)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'grayhawk-golf-club-raptor', 'Grayhawk Golf Club (Raptor)', 'grayhawk-golf-club-raptor', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('grayhawk-golf-club-raptor', 'Grayhawk Golf Club (Raptor)', 'Terra Cotta', 69.5, 130, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'grayhawk-golf-club-raptor' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 10, now()),
  (id, 2, 4, 16, now()),
  (id, 3, 4, 4, now()),
  (id, 4, 5, 2, now()),
  (id, 5, 3, 14, now()),
  (id, 6, 4, 12, now()),
  (id, 7, 5, 8, now()),
  (id, 8, 3, 18, now()),
  (id, 9, 4, 6, now()),
  (id, 10, 4, 9, now()),
  (id, 11, 5, 1, now()),
  (id, 12, 4, 5, now()),
  (id, 13, 3, 7, now()),
  (id, 14, 4, 13, now()),
  (id, 15, 4, 11, now()),
  (id, 16, 3, 17, now()),
  (id, 17, 4, 15, now()),
  (id, 18, 5, 3, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 6. Grayhawk Golf Club (Talon)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'grayhawk-golf-club-talon', 'Grayhawk Golf Club (Talon)', 'grayhawk-golf-club-talon', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('grayhawk-golf-club-talon', 'Grayhawk Golf Club (Talon)', 'Palo Verde', 71.4, 137, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'grayhawk-golf-club-talon' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 9, now()),
  (id, 2, 4, 13, now()),
  (id, 3, 5, 5, now()),
  (id, 4, 4, 7, now()),
  (id, 5, 3, 17, now()),
  (id, 6, 4, 1, now()),
  (id, 7, 4, 11, now()),
  (id, 8, 3, 15, now()),
  (id, 9, 5, 3, now()),
  (id, 10, 4, 4, now()),
  (id, 11, 3, 16, now()),
  (id, 12, 4, 2, now()),
  (id, 13, 4, 14, now()),
  (id, 14, 5, 10, now()),
  (id, 15, 4, 8, now()),
  (id, 16, 4, 12, now()),
  (id, 17, 3, 18, now()),
  (id, 18, 5, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 7. TPC Scottsdale PGA (Stadium)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'tpc-scottsdale-pga-stadium', 'TPC Scottsdale PGA (Stadium)', 'tpc-scottsdale-pga-stadium', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('tpc-scottsdale-pga-stadium', 'TPC Scottsdale PGA (Stadium)', 'Resort Men''s', 68.4, 123, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'tpc-scottsdale-pga-stadium' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 14, now()),
  (id, 2, 4, 8, now()),
  (id, 3, 5, 4, now()),
  (id, 4, 3, 18, now()),
  (id, 5, 4, 6, now()),
  (id, 6, 4, 12, now()),
  (id, 7, 3, 16, now()),
  (id, 8, 4, 2, now()),
  (id, 9, 4, 10, now()),
  (id, 10, 4, 11, now()),
  (id, 11, 4, 1, now()),
  (id, 12, 3, 15, now()),
  (id, 13, 5, 5, now()),
  (id, 14, 4, 7, now()),
  (id, 15, 5, 9, now()),
  (id, 16, 3, 17, now()),
  (id, 17, 4, 13, now()),
  (id, 18, 4, 3, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 8. TPC Scottsdale PGA (Champions)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'tpc-scottsdale-pga-champions', 'TPC Scottsdale PGA (Champions)', 'tpc-scottsdale-pga-champions', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('tpc-scottsdale-pga-champions', 'TPC Scottsdale PGA (Champions)', 'Blue/White', 69.9, 124, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'tpc-scottsdale-pga-champions' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 16, now()),
  (id, 2, 4, 8, now()),
  (id, 3, 3, 18, now()),
  (id, 4, 5, 6, now()),
  (id, 5, 4, 2, now()),
  (id, 6, 3, 12, now()),
  (id, 7, 4, 14, now()),
  (id, 8, 3, 10, now()),
  (id, 9, 5, 4, now()),
  (id, 10, 5, 11, now()),
  (id, 11, 4, 7, now()),
  (id, 12, 4, 5, now()),
  (id, 13, 3, 17, now()),
  (id, 14, 4, 13, now()),
  (id, 15, 4, 15, now()),
  (id, 16, 3, 9, now()),
  (id, 17, 5, 3, now()),
  (id, 18, 4, 1, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 9. Eagle Mountain Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'eagle-mountain-golf-club', 'Eagle Mountain Golf Club', 'eagle-mountain-golf-club', 'Fountain Hills', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('eagle-mountain-golf-club', 'Eagle Mountain Golf Club', 'Green', 69.1, 127, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'eagle-mountain-golf-club' and city is not distinct from 'Fountain Hills' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 11, now()),
  (id, 2, 4, 5, now()),
  (id, 3, 3, 9, now()),
  (id, 4, 5, 13, now()),
  (id, 5, 3, 15, now()),
  (id, 6, 4, 7, now()),
  (id, 7, 4, 1, now()),
  (id, 8, 3, 17, now()),
  (id, 9, 4, 3, now()),
  (id, 10, 5, 12, now()),
  (id, 11, 4, 4, now()),
  (id, 12, 5, 14, now()),
  (id, 13, 3, 10, now()),
  (id, 14, 4, 2, now()),
  (id, 15, 3, 18, now()),
  (id, 16, 4, 8, now()),
  (id, 17, 4, 6, now()),
  (id, 18, 4, 16, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 10. Phoenician Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'phoenician-golf-club', 'Phoenician Golf Club', 'phoenician-golf-club', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('phoenician-golf-club', 'Phoenician Golf Club', 'Phoenician', 68.0, 122, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'phoenician-golf-club' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 7, now()),
  (id, 2, 4, 5, now()),
  (id, 3, 3, 15, now()),
  (id, 4, 4, 1, now()),
  (id, 5, 3, 9, now()),
  (id, 6, 4, 17, now()),
  (id, 7, 4, 13, now()),
  (id, 8, 5, 11, now()),
  (id, 9, 4, 3, now()),
  (id, 10, 4, 2, now()),
  (id, 11, 3, 14, now()),
  (id, 12, 4, 12, now()),
  (id, 13, 4, 16, now()),
  (id, 14, 4, 6, now()),
  (id, 15, 5, 8, now()),
  (id, 16, 4, 10, now()),
  (id, 17, 3, 18, now()),
  (id, 18, 5, 4, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 11. Quintero Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'quintero-golf-club', 'Quintero Golf Club', 'quintero-golf-club', 'Peoria', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('quintero-golf-club', 'Quintero Golf Club', 'Silver', 70.7, 137, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'quintero-golf-club' and city is not distinct from 'Peoria' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 5, 7, now()),
  (id, 3, 4, 5, now()),
  (id, 4, 4, 3, now()),
  (id, 5, 4, 11, now()),
  (id, 6, 3, 17, now()),
  (id, 7, 4, 9, now()),
  (id, 8, 5, 1, now()),
  (id, 9, 3, 15, now()),
  (id, 10, 5, 10, now()),
  (id, 11, 4, 8, now()),
  (id, 12, 4, 4, now()),
  (id, 13, 3, 18, now()),
  (id, 14, 5, 2, now()),
  (id, 15, 4, 14, now()),
  (id, 16, 3, 16, now()),
  (id, 17, 4, 12, now()),
  (id, 18, 4, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 13. Wickenburg Ranch (Big Wick)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'wickenburg-ranch-big-wick', 'Wickenburg Ranch (Big Wick)', 'wickenburg-ranch-big-wick', 'Wickenburg', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('wickenburg-ranch-big-wick', 'Wickenburg Ranch (Big Wick)', 'Blue/White', 69.6, 136, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'wickenburg-ranch-big-wick' and city is not distinct from 'Wickenburg' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 7, now()),
  (id, 2, 3, 17, now()),
  (id, 3, 4, 9, now()),
  (id, 4, 3, 15, now()),
  (id, 5, 5, 1, now()),
  (id, 6, 4, 13, now()),
  (id, 7, 5, 3, now()),
  (id, 8, 3, 11, now()),
  (id, 9, 5, 5, now()),
  (id, 10, 4, 14, now()),
  (id, 11, 3, 18, now()),
  (id, 12, 4, 2, now()),
  (id, 13, 3, 16, now()),
  (id, 14, 5, 10, now()),
  (id, 15, 4, 6, now()),
  (id, 16, 4, 8, now()),
  (id, 17, 3, 12, now()),
  (id, 18, 5, 4, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 14. Ak-Chin Southern Dunes
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'ak-chin-southern-dunes', 'Ak-Chin Southern Dunes', 'ak-chin-southern-dunes', 'Maricopa', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('ak-chin-southern-dunes', 'Ak-Chin Southern Dunes', 'Blue', 71.2, 129, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'ak-chin-southern-dunes' and city is not distinct from 'Maricopa' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 9, now()),
  (id, 2, 4, 15, now()),
  (id, 3, 5, 1, now()),
  (id, 4, 3, 17, now()),
  (id, 5, 4, 7, now()),
  (id, 6, 3, 13, now()),
  (id, 7, 5, 3, now()),
  (id, 8, 4, 5, now()),
  (id, 9, 4, 11, now()),
  (id, 10, 4, 14, now()),
  (id, 11, 3, 18, now()),
  (id, 12, 4, 8, now()),
  (id, 13, 5, 2, now()),
  (id, 14, 4, 12, now()),
  (id, 15, 4, 6, now()),
  (id, 16, 5, 4, now()),
  (id, 17, 3, 16, now()),
  (id, 18, 4, 10, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 15. Verrado (Founders)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'verrado-founders', 'Verrado (Founders)', 'verrado-founders', 'Buckeye', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('verrado-founders', 'Verrado (Founders)', 'White/Blue', 68.1, 119, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'verrado-founders' and city is not distinct from 'Buckeye' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 4, 5, now()),
  (id, 3, 3, 15, now()),
  (id, 4, 4, 3, now()),
  (id, 5, 5, 9, now()),
  (id, 6, 3, 17, now()),
  (id, 7, 5, 7, now()),
  (id, 8, 4, 1, now()),
  (id, 9, 4, 11, now()),
  (id, 10, 5, 10, now()),
  (id, 11, 4, 14, now()),
  (id, 12, 4, 4, now()),
  (id, 13, 4, 12, now()),
  (id, 14, 3, 16, now()),
  (id, 15, 5, 8, now()),
  (id, 16, 4, 6, now()),
  (id, 17, 3, 18, now()),
  (id, 18, 4, 2, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 16. Verrado (Victory)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'verrado-victory', 'Verrado (Victory)', 'verrado-victory', 'Buckeye', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('verrado-victory', 'Verrado (Victory)', 'Silver/White', 68.8, 121, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'verrado-victory' and city is not distinct from 'Buckeye' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 11, now()),
  (id, 2, 3, 15, now()),
  (id, 3, 5, 5, now()),
  (id, 4, 4, 7, now()),
  (id, 5, 3, 17, now()),
  (id, 6, 4, 9, now()),
  (id, 7, 4, 13, now()),
  (id, 8, 5, 3, now()),
  (id, 9, 4, 1, now()),
  (id, 10, 4, 10, now()),
  (id, 11, 4, 8, now()),
  (id, 12, 3, 16, now()),
  (id, 13, 4, 6, now()),
  (id, 14, 4, 14, now()),
  (id, 15, 5, 4, now()),
  (id, 16, 3, 18, now()),
  (id, 17, 4, 12, now()),
  (id, 18, 5, 2, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 18. Gold Canyon (Dinosaur Mountain)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'gold-canyon-dinosaur-mountain', 'Gold Canyon (Dinosaur Mountain)', 'gold-canyon-dinosaur-mountain', 'Gold Canyon', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('gold-canyon-dinosaur-mountain', 'Gold Canyon (Dinosaur Mountain)', 'Black/Blue', 68.6, 132, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'gold-canyon-dinosaur-mountain' and city is not distinct from 'Gold Canyon' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 5, now()),
  (id, 2, 3, 15, now()),
  (id, 3, 5, 3, now()),
  (id, 4, 4, 1, now()),
  (id, 5, 3, 9, now()),
  (id, 6, 4, 11, now()),
  (id, 7, 4, 7, now()),
  (id, 8, 3, 13, now()),
  (id, 9, 5, 17, now()),
  (id, 10, 3, 16, now()),
  (id, 11, 5, 18, now()),
  (id, 12, 4, 12, now()),
  (id, 13, 4, 2, now()),
  (id, 14, 3, 6, now()),
  (id, 15, 4, 4, now()),
  (id, 16, 5, 14, now()),
  (id, 17, 3, 8, now()),
  (id, 18, 4, 10, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 19. Gold Canyon (Sidewinder)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'gold-canyon-sidewinder', 'Gold Canyon (Sidewinder)', 'gold-canyon-sidewinder', 'Gold Canyon', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('gold-canyon-sidewinder', 'Gold Canyon (Sidewinder)', 'Black/Blue', 68.7, 126, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'gold-canyon-sidewinder' and city is not distinct from 'Gold Canyon' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 18, now()),
  (id, 2, 3, 10, now()),
  (id, 3, 4, 6, now()),
  (id, 4, 3, 16, now()),
  (id, 5, 4, 12, now()),
  (id, 6, 5, 8, now()),
  (id, 7, 3, 14, now()),
  (id, 8, 4, 4, now()),
  (id, 9, 4, 2, now()),
  (id, 10, 3, 13, now()),
  (id, 11, 5, 9, now()),
  (id, 12, 4, 11, now()),
  (id, 13, 4, 17, now()),
  (id, 14, 3, 7, now()),
  (id, 15, 4, 1, now()),
  (id, 16, 4, 3, now()),
  (id, 17, 4, 15, now()),
  (id, 18, 5, 5, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 20. Las Sendas Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'las-sendas-golf-club', 'Las Sendas Golf Club', 'las-sendas-golf-club', 'Mesa', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('las-sendas-golf-club', 'Las Sendas Golf Club', 'Blue', 69.6, 125, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'las-sendas-golf-club' and city is not distinct from 'Mesa' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 1, now()),
  (id, 2, 5, 9, now()),
  (id, 3, 4, 7, now()),
  (id, 4, 4, 3, now()),
  (id, 5, 3, 15, now()),
  (id, 6, 5, 11, now()),
  (id, 7, 3, 17, now()),
  (id, 8, 4, 13, now()),
  (id, 9, 4, 5, now()),
  (id, 10, 5, 18, now()),
  (id, 11, 3, 10, now()),
  (id, 12, 4, 2, now()),
  (id, 13, 4, 4, now()),
  (id, 14, 3, 16, now()),
  (id, 15, 5, 6, now()),
  (id, 16, 3, 12, now()),
  (id, 17, 4, 8, now()),
  (id, 18, 5, 14, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 21. The Westin Kierland Golf Club (Acacia/Mesquite)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'the-westin-kierland-golf-club-acacia-mesquite', 'The Westin Kierland Golf Club (Acacia/Mesquite)', 'the-westin-kierland-golf-club-acacia-mesquite', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('the-westin-kierland-golf-club-acacia-mesquite', 'The Westin Kierland Golf Club (Acacia/Mesquite)', 'Copper', 69.2, 123, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'the-westin-kierland-golf-club-acacia-mesquite' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 16, now()),
  (id, 2, 4, 8, now()),
  (id, 3, 4, 4, now()),
  (id, 4, 3, 18, now()),
  (id, 5, 5, 2, now()),
  (id, 6, 3, 12, now()),
  (id, 7, 4, 10, now()),
  (id, 8, 3, 14, now()),
  (id, 9, 5, 6, now()),
  (id, 10, 4, 11, now()),
  (id, 11, 4, 9, now()),
  (id, 12, 4, 17, now()),
  (id, 13, 3, 15, now()),
  (id, 14, 5, 5, now()),
  (id, 15, 4, 3, now()),
  (id, 16, 5, 7, now()),
  (id, 17, 3, 13, now()),
  (id, 18, 4, 1, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 22. Talking Stick Golf Club (O'odham (formerly North))
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'talking-stick-golf-club-o-odham-formerly-north', 'Talking Stick Golf Club (O''odham (formerly North))', 'talking-stick-golf-club-o-odham-formerly-north', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('talking-stick-golf-club-o-odham-formerly-north', 'Talking Stick Golf Club (O''odham (formerly North))', 'Gold/Jade', 67.0, 116, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'talking-stick-golf-club-o-odham-formerly-north' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 15, now()),
  (id, 2, 5, 13, now()),
  (id, 3, 4, 1, now()),
  (id, 4, 4, 3, now()),
  (id, 5, 4, 11, now()),
  (id, 6, 3, 5, now()),
  (id, 7, 4, 9, now()),
  (id, 8, 3, 17, now()),
  (id, 9, 4, 7, now()),
  (id, 10, 4, 12, now()),
  (id, 11, 3, 6, now()),
  (id, 12, 4, 2, now()),
  (id, 13, 4, 16, now()),
  (id, 14, 4, 8, now()),
  (id, 15, 4, 14, now()),
  (id, 16, 3, 18, now()),
  (id, 17, 5, 4, now()),
  (id, 18, 4, 10, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 23. Talking Stick Golf Club (Piipaash (formerly South))
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'talking-stick-golf-club-piipaash-formerly-south', 'Talking Stick Golf Club (Piipaash (formerly South))', 'talking-stick-golf-club-piipaash-formerly-south', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('talking-stick-golf-club-piipaash-formerly-south', 'Talking Stick Golf Club (Piipaash (formerly South))', 'Gold/Jade', 67.4, 117, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'talking-stick-golf-club-piipaash-formerly-south' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 4, 3, now()),
  (id, 3, 3, 7, now()),
  (id, 4, 4, 17, now()),
  (id, 5, 4, 1, now()),
  (id, 6, 4, 15, now()),
  (id, 7, 5, 9, now()),
  (id, 8, 4, 5, now()),
  (id, 9, 3, 11, now()),
  (id, 10, 4, 10, now()),
  (id, 11, 4, 8, now()),
  (id, 12, 4, 2, now()),
  (id, 13, 3, 16, now()),
  (id, 14, 5, 6, now()),
  (id, 15, 4, 4, now()),
  (id, 16, 5, 14, now()),
  (id, 17, 3, 18, now()),
  (id, 18, 4, 12, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 24. Camelback Golf Club (Ambiente)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'camelback-golf-club-ambiente', 'Camelback Golf Club (Ambiente)', 'camelback-golf-club-ambiente', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('camelback-golf-club-ambiente', 'Camelback Golf Club (Ambiente)', 'Tan', 69.1, 125, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'camelback-golf-club-ambiente' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 5, now()),
  (id, 2, 3, 11, now()),
  (id, 3, 5, 17, now()),
  (id, 4, 4, 13, now()),
  (id, 5, 4, 15, now()),
  (id, 6, 4, 1, now()),
  (id, 7, 5, 7, now()),
  (id, 8, 3, 9, now()),
  (id, 9, 4, 3, now()),
  (id, 10, 4, 18, now()),
  (id, 11, 3, 12, now()),
  (id, 12, 4, 2, now()),
  (id, 13, 4, 14, now()),
  (id, 14, 5, 6, now()),
  (id, 15, 3, 8, now()),
  (id, 16, 5, 16, now()),
  (id, 17, 4, 4, now()),
  (id, 18, 4, 10, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 25. Camelback Golf Club (Padres)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'camelback-golf-club-padres', 'Camelback Golf Club (Padres)', 'camelback-golf-club-padres', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('camelback-golf-club-padres', 'Camelback Golf Club (Padres)', 'White', 70.0, 123, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'camelback-golf-club-padres' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 7, now()),
  (id, 2, 4, 13, now()),
  (id, 3, 3, 17, now()),
  (id, 4, 4, 9, now()),
  (id, 5, 5, 1, now()),
  (id, 6, 4, 3, now()),
  (id, 7, 4, 15, now()),
  (id, 8, 3, 11, now()),
  (id, 9, 5, 5, now()),
  (id, 10, 4, 2, now()),
  (id, 11, 3, 18, now()),
  (id, 12, 4, 16, now()),
  (id, 13, 5, 10, now()),
  (id, 14, 4, 14, now()),
  (id, 15, 4, 6, now()),
  (id, 16, 4, 12, now()),
  (id, 17, 3, 8, now()),
  (id, 18, 5, 4, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 26. Raven Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'raven-golf-club', 'Raven Golf Club', 'raven-golf-club', 'Phoenix', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('raven-golf-club', 'Raven Golf Club', 'Regular', 68.3, 121, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'raven-golf-club' and city is not distinct from 'Phoenix' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 11, now()),
  (id, 2, 3, 17, now()),
  (id, 3, 4, 1, now()),
  (id, 4, 5, 3, now()),
  (id, 5, 4, 15, now()),
  (id, 6, 4, 7, now()),
  (id, 7, 3, 13, now()),
  (id, 8, 4, 5, now()),
  (id, 9, 5, 9, now()),
  (id, 10, 4, 12, now()),
  (id, 11, 3, 16, now()),
  (id, 12, 5, 8, now()),
  (id, 13, 4, 10, now()),
  (id, 14, 3, 18, now()),
  (id, 15, 4, 14, now()),
  (id, 16, 4, 4, now()),
  (id, 17, 5, 2, now()),
  (id, 18, 4, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 27. Lookout Mountain Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'lookout-mountain-golf-club', 'Lookout Mountain Golf Club', 'lookout-mountain-golf-club', 'Phoenix', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('lookout-mountain-golf-club', 'Lookout Mountain Golf Club', 'Blue/White', 69.0, 130, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'lookout-mountain-golf-club' and city is not distinct from 'Phoenix' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 11, now()),
  (id, 2, 5, 9, now()),
  (id, 3, 3, 15, now()),
  (id, 4, 4, 3, now()),
  (id, 5, 5, 7, now()),
  (id, 6, 3, 13, now()),
  (id, 7, 5, 1, now()),
  (id, 8, 4, 5, now()),
  (id, 9, 3, 17, now()),
  (id, 10, 4, 4, now()),
  (id, 11, 3, 12, now()),
  (id, 12, 4, 2, now()),
  (id, 13, 4, 18, now()),
  (id, 14, 4, 8, now()),
  (id, 15, 5, 16, now()),
  (id, 16, 3, 6, now()),
  (id, 17, 4, 14, now()),
  (id, 18, 5, 10, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 30. Longbow Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'longbow-golf-club', 'Longbow Golf Club', 'longbow-golf-club', 'Mesa', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('longbow-golf-club', 'Longbow Golf Club', 'Green/White', 69.0, 124, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'longbow-golf-club' and city is not distinct from 'Mesa' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 9, now()),
  (id, 2, 4, 11, now()),
  (id, 3, 3, 15, now()),
  (id, 4, 4, 1, now()),
  (id, 5, 4, 7, now()),
  (id, 6, 4, 5, now()),
  (id, 7, 3, 13, now()),
  (id, 8, 4, 17, now()),
  (id, 9, 4, 3, now()),
  (id, 10, 4, 4, now()),
  (id, 11, 3, 10, now()),
  (id, 12, 4, 8, now()),
  (id, 13, 4, 14, now()),
  (id, 14, 4, 2, now()),
  (id, 15, 5, 18, now()),
  (id, 16, 3, 6, now()),
  (id, 17, 4, 12, now()),
  (id, 18, 5, 16, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 31. McCormick Ranch (Palm)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'mccormick-ranch-palm', 'McCormick Ranch (Palm)', 'mccormick-ranch-palm', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('mccormick-ranch-palm', 'McCormick Ranch (Palm)', 'White', 70.1, 127, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'mccormick-ranch-palm' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 4, 9, now()),
  (id, 3, 5, 5, now()),
  (id, 4, 4, 7, now()),
  (id, 5, 3, 15, now()),
  (id, 6, 4, 11, now()),
  (id, 7, 5, 1, now()),
  (id, 8, 3, 17, now()),
  (id, 9, 4, 3, now()),
  (id, 10, 4, 14, now()),
  (id, 11, 4, 10, now()),
  (id, 12, 5, 6, now()),
  (id, 13, 3, 16, now()),
  (id, 14, 4, 12, now()),
  (id, 15, 4, 4, now()),
  (id, 16, 5, 2, now()),
  (id, 17, 3, 18, now()),
  (id, 18, 4, 8, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 32. McCormick Ranch (Pine)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'mccormick-ranch-pine', 'McCormick Ranch (Pine)', 'mccormick-ranch-pine', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('mccormick-ranch-pine', 'McCormick Ranch (Pine)', 'White', 70.5, 127, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'mccormick-ranch-pine' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 14, now()),
  (id, 2, 4, 12, now()),
  (id, 3, 4, 8, now()),
  (id, 4, 5, 6, now()),
  (id, 5, 3, 18, now()),
  (id, 6, 4, 4, now()),
  (id, 7, 5, 2, now()),
  (id, 8, 3, 16, now()),
  (id, 9, 4, 10, now()),
  (id, 10, 4, 13, now()),
  (id, 11, 4, 7, now()),
  (id, 12, 5, 3, now()),
  (id, 13, 3, 15, now()),
  (id, 14, 4, 11, now()),
  (id, 15, 4, 1, now()),
  (id, 16, 4, 9, now()),
  (id, 17, 3, 17, now()),
  (id, 18, 5, 5, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 33. McDowell Mountain Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'mcdowell-mountain-golf-club', 'McDowell Mountain Golf Club', 'mcdowell-mountain-golf-club', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('mcdowell-mountain-golf-club', 'McDowell Mountain Golf Club', 'Gold/White', 68.4, 123, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'mcdowell-mountain-golf-club' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 3, now()),
  (id, 2, 4, 17, now()),
  (id, 3, 3, 15, now()),
  (id, 4, 5, 5, now()),
  (id, 5, 4, 11, now()),
  (id, 6, 4, 13, now()),
  (id, 7, 4, 1, now()),
  (id, 8, 3, 7, now()),
  (id, 9, 5, 9, now()),
  (id, 10, 4, 8, now()),
  (id, 11, 4, 4, now()),
  (id, 12, 4, 10, now()),
  (id, 13, 5, 14, now()),
  (id, 14, 3, 18, now()),
  (id, 15, 5, 12, now()),
  (id, 16, 4, 16, now()),
  (id, 17, 3, 6, now()),
  (id, 18, 4, 2, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 34. Orange Tree Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'orange-tree-golf-club', 'Orange Tree Golf Club', 'orange-tree-golf-club', 'Scottsdale', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('orange-tree-golf-club', 'Orange Tree Golf Club', 'White', 69.3, 119, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'orange-tree-golf-club' and city is not distinct from 'Scottsdale' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 5, 1, now()),
  (id, 3, 4, 11, now()),
  (id, 4, 3, 15, now()),
  (id, 5, 4, 9, now()),
  (id, 6, 5, 5, now()),
  (id, 7, 3, 17, now()),
  (id, 8, 4, 3, now()),
  (id, 9, 4, 7, now()),
  (id, 10, 4, 12, now()),
  (id, 11, 4, 10, now()),
  (id, 12, 3, 16, now()),
  (id, 13, 5, 2, now()),
  (id, 14, 4, 14, now()),
  (id, 15, 3, 18, now()),
  (id, 16, 4, 4, now()),
  (id, 17, 5, 8, now()),
  (id, 18, 4, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 35. Stonecreek Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'stonecreek-golf-club', 'Stonecreek Golf Club', 'stonecreek-golf-club', 'Phoenix', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('stonecreek-golf-club', 'Stonecreek Golf Club', 'Middle', 68.1, 125, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'stonecreek-golf-club' and city is not distinct from 'Phoenix' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 4, 3, now()),
  (id, 3, 3, 17, now()),
  (id, 4, 4, 5, now()),
  (id, 5, 3, 15, now()),
  (id, 6, 4, 1, now()),
  (id, 7, 5, 9, now()),
  (id, 8, 4, 7, now()),
  (id, 9, 4, 11, now()),
  (id, 10, 4, 8, now()),
  (id, 11, 4, 10, now()),
  (id, 12, 3, 16, now()),
  (id, 13, 5, 14, now()),
  (id, 14, 4, 4, now()),
  (id, 15, 3, 18, now()),
  (id, 16, 5, 2, now()),
  (id, 17, 4, 6, now()),
  (id, 18, 4, 12, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 36. Ocotillo Golf Club (Blue/White)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'ocotillo-golf-club-blue-white', 'Ocotillo Golf Club (Blue/White)', 'ocotillo-golf-club-blue-white', 'Chandler', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('ocotillo-golf-club-blue-white', 'Ocotillo Golf Club (Blue/White)', 'Blue', 69.2, 122, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'ocotillo-golf-club-blue-white' and city is not distinct from 'Chandler' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 3, 5, now()),
  (id, 2, 4, 13, now()),
  (id, 3, 4, 9, now()),
  (id, 4, 3, 11, now()),
  (id, 5, 4, 17, now()),
  (id, 6, 5, 1, now()),
  (id, 7, 3, 15, now()),
  (id, 8, 4, 3, now()),
  (id, 9, 4, 7, now()),
  (id, 10, 4, 11, now()),
  (id, 11, 5, 1, now()),
  (id, 12, 3, 13, now()),
  (id, 13, 4, 9, now()),
  (id, 14, 4, 7, now()),
  (id, 15, 4, 5, now()),
  (id, 16, 3, 17, now()),
  (id, 17, 4, 15, now()),
  (id, 18, 4, 3, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 37. Bear Creek Golf Club (Bear Course)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'bear-creek-golf-club-bear-course', 'Bear Creek Golf Club (Bear Course)', 'bear-creek-golf-club-bear-course', 'Chandler', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('bear-creek-golf-club-bear-course', 'Bear Creek Golf Club (Bear Course)', 'Blue', 69.6, 116, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'bear-creek-golf-club-bear-course' and city is not distinct from 'Chandler' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 3, 15, now()),
  (id, 3, 5, 17, now()),
  (id, 4, 4, 9, now()),
  (id, 5, 3, 5, now()),
  (id, 6, 5, 7, now()),
  (id, 7, 4, 3, now()),
  (id, 8, 3, 11, now()),
  (id, 9, 4, 1, now()),
  (id, 10, 4, 4, now()),
  (id, 11, 4, 2, now()),
  (id, 12, 5, 16, now()),
  (id, 13, 4, 10, now()),
  (id, 14, 4, 14, now()),
  (id, 15, 3, 12, now()),
  (id, 16, 4, 18, now()),
  (id, 17, 3, 8, now()),
  (id, 18, 5, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 39. Legacy Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'legacy-golf-club', 'Legacy Golf Club', 'legacy-golf-club', 'Phoenix', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('legacy-golf-club', 'Legacy Golf Club', 'White', 67.1, 110, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'legacy-golf-club' and city is not distinct from 'Phoenix' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 10, now()),
  (id, 2, 4, 6, now()),
  (id, 3, 4, 16, now()),
  (id, 4, 3, 12, now()),
  (id, 5, 4, 14, now()),
  (id, 6, 5, 2, now()),
  (id, 7, 3, 18, now()),
  (id, 8, 5, 8, now()),
  (id, 9, 4, 4, now()),
  (id, 10, 4, 9, now()),
  (id, 11, 3, 11, now()),
  (id, 12, 4, 3, now()),
  (id, 13, 4, 15, now()),
  (id, 14, 5, 1, now()),
  (id, 15, 3, 13, now()),
  (id, 16, 4, 17, now()),
  (id, 17, 3, 5, now()),
  (id, 18, 5, 7, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 40. SunRidge Canyon
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'sunridge-canyon', 'SunRidge Canyon', 'sunridge-canyon', 'Fountain Hills', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('sunridge-canyon', 'SunRidge Canyon', 'Middle', 68.2, 129, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'sunridge-canyon' and city is not distinct from 'Fountain Hills' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 17, now()),
  (id, 2, 4, 11, now()),
  (id, 3, 5, 7, now()),
  (id, 4, 4, 9, now()),
  (id, 5, 4, 1, now()),
  (id, 6, 3, 13, now()),
  (id, 7, 4, 15, now()),
  (id, 8, 3, 5, now()),
  (id, 9, 5, 3, now()),
  (id, 10, 4, 16, now()),
  (id, 11, 4, 8, now()),
  (id, 12, 3, 18, now()),
  (id, 13, 5, 2, now()),
  (id, 14, 3, 14, now()),
  (id, 15, 4, 6, now()),
  (id, 16, 5, 12, now()),
  (id, 17, 3, 10, now()),
  (id, 18, 4, 4, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 42. Superstition Springs
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'superstition-springs', 'Superstition Springs', 'superstition-springs', 'Mesa', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('superstition-springs', 'Superstition Springs', 'Middle', 70.5, 124, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'superstition-springs' and city is not distinct from 'Mesa' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 4, 7, now()),
  (id, 3, 3, 11, now()),
  (id, 4, 4, 15, now()),
  (id, 5, 4, 17, now()),
  (id, 6, 5, 1, now()),
  (id, 7, 3, 5, now()),
  (id, 8, 5, 9, now()),
  (id, 9, 4, 3, now()),
  (id, 10, 4, 12, now()),
  (id, 11, 5, 14, now()),
  (id, 12, 3, 18, now()),
  (id, 13, 4, 16, now()),
  (id, 14, 4, 8, now()),
  (id, 15, 3, 4, now()),
  (id, 16, 4, 10, now()),
  (id, 17, 5, 2, now()),
  (id, 18, 4, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 44. Trilogy at Power Ranch
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'trilogy-at-power-ranch', 'Trilogy at Power Ranch', 'trilogy-at-power-ranch', 'Gilbert', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('trilogy-at-power-ranch', 'Trilogy at Power Ranch', 'Blue', 69.0, 122, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'trilogy-at-power-ranch' and city is not distinct from 'Gilbert' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 14, now()),
  (id, 2, 4, 16, now()),
  (id, 3, 5, 2, now()),
  (id, 4, 3, 18, now()),
  (id, 5, 4, 10, now()),
  (id, 6, 3, 12, now()),
  (id, 7, 5, 4, now()),
  (id, 8, 3, 8, now()),
  (id, 9, 4, 6, now()),
  (id, 10, 4, 13, now()),
  (id, 11, 3, 15, now()),
  (id, 12, 4, 11, now()),
  (id, 13, 5, 7, now()),
  (id, 14, 4, 9, now()),
  (id, 15, 3, 17, now()),
  (id, 16, 4, 1, now()),
  (id, 17, 5, 3, now()),
  (id, 18, 4, 5, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 45. Poston Butte Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'poston-butte-golf-club', 'Poston Butte Golf Club', 'poston-butte-golf-club', 'Florence', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('poston-butte-golf-club', 'Poston Butte Golf Club', 'White', 69.2, 119, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'poston-butte-golf-club' and city is not distinct from 'Florence' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 11, now()),
  (id, 2, 4, 1, now()),
  (id, 3, 5, 13, now()),
  (id, 4, 3, 9, now()),
  (id, 5, 4, 17, now()),
  (id, 6, 4, 3, now()),
  (id, 7, 3, 15, now()),
  (id, 8, 4, 7, now()),
  (id, 9, 5, 5, now()),
  (id, 10, 4, 2, now()),
  (id, 11, 4, 6, now()),
  (id, 12, 3, 14, now()),
  (id, 13, 5, 10, now()),
  (id, 14, 4, 4, now()),
  (id, 15, 4, 16, now()),
  (id, 16, 4, 8, now()),
  (id, 17, 3, 12, now()),
  (id, 18, 5, 18, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 49. Sundance Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'sundance-golf-club', 'Sundance Golf Club', 'sundance-golf-club', 'Buckeye', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('sundance-golf-club', 'Sundance Golf Club', 'Blue', 70.6, 123, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'sundance-golf-club' and city is not distinct from 'Buckeye' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 12, now()),
  (id, 2, 4, 2, now()),
  (id, 3, 3, 14, now()),
  (id, 4, 5, 8, now()),
  (id, 5, 4, 6, now()),
  (id, 6, 3, 16, now()),
  (id, 7, 4, 18, now()),
  (id, 8, 4, 4, now()),
  (id, 9, 5, 10, now()),
  (id, 10, 5, 15, now()),
  (id, 11, 4, 11, now()),
  (id, 12, 4, 3, now()),
  (id, 13, 3, 13, now()),
  (id, 14, 4, 9, now()),
  (id, 15, 4, 7, now()),
  (id, 16, 3, 17, now()),
  (id, 17, 4, 1, now()),
  (id, 18, 5, 5, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 50. Palm Valley Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'palm-valley-golf-club', 'Palm Valley Golf Club', 'palm-valley-golf-club', 'Goodyear', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('palm-valley-golf-club', 'Palm Valley Golf Club', 'Regular', 69.1, 123, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'palm-valley-golf-club' and city is not distinct from 'Goodyear' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 5, 11, now()),
  (id, 3, 4, 3, now()),
  (id, 4, 3, 15, now()),
  (id, 5, 4, 9, now()),
  (id, 6, 4, 7, now()),
  (id, 7, 4, 5, now()),
  (id, 8, 3, 17, now()),
  (id, 9, 5, 1, now()),
  (id, 10, 4, 16, now()),
  (id, 11, 5, 4, now()),
  (id, 12, 3, 14, now()),
  (id, 13, 4, 12, now()),
  (id, 14, 5, 8, now()),
  (id, 15, 4, 2, now()),
  (id, 16, 3, 18, now()),
  (id, 17, 4, 10, now()),
  (id, 18, 4, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 51. Papago Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'papago-golf-club', 'Papago Golf Club', 'papago-golf-club', 'Phoenix', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('papago-golf-club', 'Papago Golf Club', 'White/Green', 68.2, 117, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'papago-golf-club' and city is not distinct from 'Phoenix' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 15, now()),
  (id, 2, 4, 17, now()),
  (id, 3, 4, 3, now()),
  (id, 4, 3, 13, now()),
  (id, 5, 4, 11, now()),
  (id, 6, 4, 1, now()),
  (id, 7, 4, 7, now()),
  (id, 8, 3, 9, now()),
  (id, 9, 5, 5, now()),
  (id, 10, 5, 18, now()),
  (id, 11, 3, 12, now()),
  (id, 12, 4, 16, now()),
  (id, 13, 4, 10, now()),
  (id, 14, 4, 8, now()),
  (id, 15, 5, 14, now()),
  (id, 16, 4, 4, now()),
  (id, 17, 3, 6, now()),
  (id, 18, 4, 2, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 52. Encanto 18
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'encanto-18', 'Encanto 18', 'encanto-18', 'Phoenix', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('encanto-18', 'Encanto 18', 'White', 68.3, 111, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'encanto-18' and city is not distinct from 'Phoenix' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 3, now()),
  (id, 2, 4, 15, now()),
  (id, 3, 3, 13, now()),
  (id, 4, 4, 7, now()),
  (id, 5, 3, 11, now()),
  (id, 6, 4, 9, now()),
  (id, 7, 3, 17, now()),
  (id, 8, 5, 5, now()),
  (id, 9, 4, 1, now()),
  (id, 10, 4, 16, now()),
  (id, 11, 3, 18, now()),
  (id, 12, 5, 12, now()),
  (id, 13, 4, 6, now()),
  (id, 14, 3, 8, now()),
  (id, 15, 4, 4, now()),
  (id, 16, 4, 2, now()),
  (id, 17, 4, 10, now()),
  (id, 18, 4, 14, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 53. Cave Creek
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'cave-creek', 'Cave Creek', 'cave-creek', 'Phoenix', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('cave-creek', 'Cave Creek', 'Regular', 69.0, 116, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'cave-creek' and city is not distinct from 'Phoenix' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 15, now()),
  (id, 2, 5, 5, now()),
  (id, 3, 3, 17, now()),
  (id, 4, 4, 11, now()),
  (id, 5, 4, 7, now()),
  (id, 6, 5, 13, now()),
  (id, 7, 3, 9, now()),
  (id, 8, 4, 1, now()),
  (id, 9, 4, 3, now()),
  (id, 10, 4, 16, now()),
  (id, 11, 5, 4, now()),
  (id, 12, 4, 14, now()),
  (id, 13, 3, 18, now()),
  (id, 14, 4, 6, now()),
  (id, 15, 4, 10, now()),
  (id, 16, 5, 12, now()),
  (id, 17, 3, 2, now()),
  (id, 18, 4, 8, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 56. Dobson Ranch
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'dobson-ranch', 'Dobson Ranch', 'dobson-ranch', 'Mesa', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('dobson-ranch', 'Dobson Ranch', 'White', 68.9, 119, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'dobson-ranch' and city is not distinct from 'Mesa' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 5, now()),
  (id, 2, 4, 3, now()),
  (id, 3, 4, 13, now()),
  (id, 4, 3, 11, now()),
  (id, 5, 5, 15, now()),
  (id, 6, 4, 9, now()),
  (id, 7, 3, 17, now()),
  (id, 8, 4, 1, now()),
  (id, 9, 5, 7, now()),
  (id, 10, 4, 8, now()),
  (id, 11, 4, 2, now()),
  (id, 12, 3, 10, now()),
  (id, 13, 5, 12, now()),
  (id, 14, 3, 14, now()),
  (id, 15, 4, 18, now()),
  (id, 16, 4, 4, now()),
  (id, 17, 3, 6, now()),
  (id, 18, 5, 16, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 57. San Marcos
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'san-marcos', 'San Marcos', 'san-marcos', 'Chandler', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('san-marcos', 'San Marcos', 'Blue', 69.3, 120, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'san-marcos' and city is not distinct from 'Chandler' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 7, now()),
  (id, 2, 4, 9, now()),
  (id, 3, 3, 17, now()),
  (id, 4, 4, 3, now()),
  (id, 5, 5, 1, now()),
  (id, 6, 4, 11, now()),
  (id, 7, 4, 5, now()),
  (id, 8, 3, 13, now()),
  (id, 9, 5, 15, now()),
  (id, 10, 4, 2, now()),
  (id, 11, 4, 4, now()),
  (id, 12, 4, 16, now()),
  (id, 13, 3, 14, now()),
  (id, 14, 4, 10, now()),
  (id, 15, 3, 6, now()),
  (id, 16, 4, 18, now()),
  (id, 17, 5, 8, now()),
  (id, 18, 5, 12, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 58. Seville
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'seville', 'Seville', 'seville', 'Gilbert', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('seville', 'Seville', 'Gold/Blue', 69.8, 116, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'seville' and city is not distinct from 'Gilbert' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 5, 9, now()),
  (id, 3, 4, 5, now()),
  (id, 4, 3, 17, now()),
  (id, 5, 5, 3, now()),
  (id, 6, 4, 1, now()),
  (id, 7, 4, 11, now()),
  (id, 8, 3, 15, now()),
  (id, 9, 4, 7, now()),
  (id, 10, 4, 2, now()),
  (id, 11, 4, 12, now()),
  (id, 12, 5, 4, now()),
  (id, 13, 4, 10, now()),
  (id, 14, 3, 18, now()),
  (id, 15, 4, 6, now()),
  (id, 16, 4, 16, now()),
  (id, 17, 3, 14, now()),
  (id, 18, 5, 8, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 59. Western Skies Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'western-skies-golf-club', 'Western Skies Golf Club', 'western-skies-golf-club', 'Gilbert', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('western-skies-golf-club', 'Western Skies Golf Club', 'White', 68.1, 113, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'western-skies-golf-club' and city is not distinct from 'Gilbert' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 5, now()),
  (id, 2, 3, 15, now()),
  (id, 3, 5, 7, now()),
  (id, 4, 3, 3, now()),
  (id, 5, 4, 13, now()),
  (id, 6, 4, 17, now()),
  (id, 7, 3, 9, now()),
  (id, 8, 4, 1, now()),
  (id, 9, 4, 11, now()),
  (id, 10, 4, 10, now()),
  (id, 11, 4, 6, now()),
  (id, 12, 3, 2, now()),
  (id, 13, 5, 8, now()),
  (id, 14, 4, 14, now()),
  (id, 15, 4, 18, now()),
  (id, 16, 5, 12, now()),
  (id, 17, 4, 4, now()),
  (id, 18, 4, 16, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 61. Apache Wells
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'apache-wells', 'Apache Wells', 'apache-wells', 'Mesa', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('apache-wells', 'Apache Wells', 'White', 66.3, 106, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'apache-wells' and city is not distinct from 'Mesa' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 9, now()),
  (id, 2, 3, 17, now()),
  (id, 3, 4, 1, now()),
  (id, 4, 3, 13, now()),
  (id, 5, 4, 15, now()),
  (id, 6, 4, 7, now()),
  (id, 7, 3, 11, now()),
  (id, 8, 5, 3, now()),
  (id, 9, 4, 5, now()),
  (id, 10, 4, 10, now()),
  (id, 11, 5, 18, now()),
  (id, 12, 3, 12, now()),
  (id, 13, 5, 4, now()),
  (id, 14, 4, 2, now()),
  (id, 15, 3, 6, now()),
  (id, 16, 5, 16, now()),
  (id, 17, 3, 14, now()),
  (id, 18, 5, 8, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 64. Toka Sticks Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'toka-sticks-golf-club', 'Toka Sticks Golf Club', 'toka-sticks-golf-club', 'Mesa', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('toka-sticks-golf-club', 'Toka Sticks Golf Club', 'Silver', 66.9, 110, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'toka-sticks-golf-club' and city is not distinct from 'Mesa' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 13, now()),
  (id, 2, 5, 17, now()),
  (id, 3, 3, 7, now()),
  (id, 4, 5, 3, now()),
  (id, 5, 3, 9, now()),
  (id, 6, 4, 11, now()),
  (id, 7, 4, 15, now()),
  (id, 8, 3, 5, now()),
  (id, 9, 5, 1, now()),
  (id, 10, 4, 10, now()),
  (id, 11, 4, 4, now()),
  (id, 12, 5, 16, now()),
  (id, 13, 3, 8, now()),
  (id, 14, 4, 14, now()),
  (id, 15, 3, 6, now()),
  (id, 16, 4, 12, now()),
  (id, 17, 5, 18, now()),
  (id, 18, 4, 2, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 65. Lone Tree Golf Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'lone-tree-golf-club', 'Lone Tree Golf Club', 'lone-tree-golf-club', 'Chandler', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('lone-tree-golf-club', 'Lone Tree Golf Club', 'Blue', 69.8, 116, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'lone-tree-golf-club' and city is not distinct from 'Chandler' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 7, now()),
  (id, 2, 3, 15, now()),
  (id, 3, 4, 9, now()),
  (id, 4, 4, 11, now()),
  (id, 5, 5, 5, now()),
  (id, 6, 4, 17, now()),
  (id, 7, 4, 3, now()),
  (id, 8, 3, 13, now()),
  (id, 9, 5, 1, now()),
  (id, 10, 4, 10, now()),
  (id, 11, 4, 12, now()),
  (id, 12, 3, 14, now()),
  (id, 13, 4, 8, now()),
  (id, 14, 3, 18, now()),
  (id, 15, 4, 2, now()),
  (id, 16, 4, 16, now()),
  (id, 17, 4, 6, now()),
  (id, 18, 5, 4, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 67. Coyote Lakes
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'coyote-lakes', 'Coyote Lakes', 'coyote-lakes', 'Surprise', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('coyote-lakes', 'Coyote Lakes', 'Green', 69.1, 120, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'coyote-lakes' and city is not distinct from 'Surprise' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 9, now()),
  (id, 2, 4, 3, now()),
  (id, 3, 5, 11, now()),
  (id, 4, 3, 13, now()),
  (id, 5, 4, 7, now()),
  (id, 6, 5, 1, now()),
  (id, 7, 4, 5, now()),
  (id, 8, 4, 17, now()),
  (id, 9, 3, 15, now()),
  (id, 10, 5, 4, now()),
  (id, 11, 4, 14, now()),
  (id, 12, 3, 18, now()),
  (id, 13, 5, 8, now()),
  (id, 14, 3, 16, now()),
  (id, 15, 4, 6, now()),
  (id, 16, 3, 10, now()),
  (id, 17, 4, 12, now()),
  (id, 18, 4, 2, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 68. Hillcrest
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'hillcrest', 'Hillcrest', 'hillcrest', 'Sun City West', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('hillcrest', 'Hillcrest', 'White', 69.1, 116, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'hillcrest' and city is not distinct from 'Sun City West' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 17, now()),
  (id, 2, 4, 15, now()),
  (id, 3, 3, 11, now()),
  (id, 4, 5, 3, now()),
  (id, 5, 4, 7, now()),
  (id, 6, 4, 9, now()),
  (id, 7, 5, 1, now()),
  (id, 8, 3, 13, now()),
  (id, 9, 4, 5, now()),
  (id, 10, 5, 8, now()),
  (id, 11, 4, 12, now()),
  (id, 12, 4, 18, now()),
  (id, 13, 5, 2, now()),
  (id, 14, 3, 14, now()),
  (id, 15, 4, 10, now()),
  (id, 16, 4, 6, now()),
  (id, 17, 3, 16, now()),
  (id, 18, 4, 4, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 71. Viewpoint Golf Resort
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'viewpoint-golf-resort', 'Viewpoint Golf Resort', 'viewpoint-golf-resort', 'Mesa', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('viewpoint-golf-resort', 'Viewpoint Golf Resort', 'Champ', 69.2, 117, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'viewpoint-golf-resort' and city is not distinct from 'Mesa' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 3, now()),
  (id, 2, 4, 13, now()),
  (id, 3, 3, 17, now()),
  (id, 4, 5, 5, now()),
  (id, 5, 4, 9, now()),
  (id, 6, 3, 7, now()),
  (id, 7, 5, 1, now()),
  (id, 8, 4, 11, now()),
  (id, 9, 3, 15, now()),
  (id, 10, 4, 14, now()),
  (id, 11, 4, 16, now()),
  (id, 12, 5, 2, now()),
  (id, 13, 4, 10, now()),
  (id, 14, 3, 18, now()),
  (id, 15, 4, 12, now()),
  (id, 16, 4, 8, now()),
  (id, 17, 3, 4, now()),
  (id, 18, 5, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 83. Phoenix Country Club
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'phoenix-country-club', 'Phoenix Country Club', 'phoenix-country-club', 'Phoenix', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('phoenix-country-club', 'Phoenix Country Club', 'White/Blue', 68.9, 125, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'phoenix-country-club' and city is not distinct from 'Phoenix' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 13, now()),
  (id, 2, 3, 15, now()),
  (id, 3, 4, 1, now()),
  (id, 4, 4, 5, now()),
  (id, 5, 4, 17, now()),
  (id, 6, 4, 3, now()),
  (id, 7, 5, 7, now()),
  (id, 8, 3, 11, now()),
  (id, 9, 4, 9, now()),
  (id, 10, 4, 2, now()),
  (id, 11, 4, 4, now()),
  (id, 12, 4, 16, now()),
  (id, 13, 3, 12, now()),
  (id, 14, 4, 8, now()),
  (id, 15, 3, 10, now()),
  (id, 16, 4, 18, now()),
  (id, 17, 4, 6, now()),
  (id, 18, 5, 14, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 87. Bear Creek (Cub Course)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'bear-creek-cub-course', 'Bear Creek (Cub Course)', 'bear-creek-cub-course', 'Chandler', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('bear-creek-cub-course', 'Bear Creek (Cub Course)', 'Blue', 58.4, 85, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'bear-creek-cub-course' and city is not distinct from 'Chandler' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 3, 3, now()),
  (id, 2, 3, 13, now()),
  (id, 3, 3, 1, now()),
  (id, 4, 3, 7, now()),
  (id, 5, 3, 15, now()),
  (id, 6, 3, 17, now()),
  (id, 7, 4, 5, now()),
  (id, 8, 3, 9, now()),
  (id, 9, 4, 11, now()),
  (id, 10, 4, 12, now()),
  (id, 11, 3, 14, now()),
  (id, 12, 4, 8, now()),
  (id, 13, 3, 18, now()),
  (id, 14, 3, 6, now()),
  (id, 15, 3, 10, now()),
  (id, 16, 3, 2, now()),
  (id, 17, 4, 16, now()),
  (id, 18, 3, 4, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 95. Corte Bella
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'corte-bella', 'Corte Bella', 'corte-bella', 'Sun City West', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('corte-bella', 'Corte Bella', 'White/Copper', 68.0, 118, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'corte-bella' and city is not distinct from 'Sun City West' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 4, 17, now()),
  (id, 2, 4, 3, now()),
  (id, 3, 4, 5, now()),
  (id, 4, 3, 15, now()),
  (id, 5, 5, 11, now()),
  (id, 6, 4, 7, now()),
  (id, 7, 4, 1, now()),
  (id, 8, 3, 13, now()),
  (id, 9, 5, 9, now()),
  (id, 10, 4, 12, now()),
  (id, 11, 4, 14, now()),
  (id, 12, 3, 16, now()),
  (id, 13, 5, 2, now()),
  (id, 14, 4, 6, now()),
  (id, 15, 3, 18, now()),
  (id, 16, 4, 4, now()),
  (id, 17, 5, 8, now()),
  (id, 18, 4, 10, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

-- 100. Wigwam (Gold)
insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
values ('manual_seed', 'wigwam-gold', 'Wigwam (Gold)', 'wigwam-gold', 'Litchfield Park', 'AZ', now())
on conflict (normalized_name, city, state) do update set name = excluded.name, source_provider = excluded.source_provider, source_course_id = excluded.source_course_id, updated_at = now();

insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
values ('wigwam-gold', 'Wigwam (Gold)', 'Club', 70.3, 125, now())
on conflict (course_key, tee_color) do update set course_name = excluded.course_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating, updated_at = now();

with course as (
  select id from public.saved_courses where normalized_name = 'wigwam-gold' and city is not distinct from 'Litchfield Park' and state is not distinct from 'AZ' limit 1
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select * from course cross join (values
  (id, 1, 5, 11, now()),
  (id, 2, 4, 7, now()),
  (id, 3, 3, 15, now()),
  (id, 4, 5, 3, now()),
  (id, 5, 4, 13, now()),
  (id, 6, 3, 17, now()),
  (id, 7, 4, 9, now()),
  (id, 8, 4, 1, now()),
  (id, 9, 4, 5, now()),
  (id, 10, 5, 2, now()),
  (id, 11, 3, 16, now()),
  (id, 12, 4, 8, now()),
  (id, 13, 4, 10, now()),
  (id, 14, 5, 12, now()),
  (id, 15, 4, 14, now()),
  (id, 16, 3, 18, now()),
  (id, 17, 4, 4, now()),
  (id, 18, 4, 6, now())
) as holes(saved_course_id, hole_number, par, handicap_index, updated_at)
on conflict (saved_course_id, hole_number) do update set par = excluded.par, handicap_index = excluded.handicap_index, updated_at = now();

commit;

select
  (select count(*) from public.saved_courses where source_provider = 'manual_seed') as seeded_courses,
  (select count(*) from public.saved_course_holes h join public.saved_courses c on c.id = h.saved_course_id where c.source_provider = 'manual_seed') as seeded_holes,
  (select count(*) from public.saved_course_tees where course_key in (select normalized_name from public.saved_courses where source_provider = 'manual_seed')) as seeded_tees;
