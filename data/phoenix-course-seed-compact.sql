create extension if not exists pgcrypto;

create table if not exists public.saved_courses (id uuid primary key default gen_random_uuid(), source_provider text, source_course_id text, name text not null, normalized_name text not null, city text, state text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (normalized_name, city, state));
create table if not exists public.saved_course_holes (id uuid primary key default gen_random_uuid(), saved_course_id uuid not null references public.saved_courses(id) on delete cascade, hole_number integer not null check (hole_number between 1 and 18), par integer check (par between 3 and 5), handicap_index integer check (handicap_index between 1 and 18), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (saved_course_id, hole_number));
create table if not exists public.saved_course_tees (id uuid primary key default gen_random_uuid(), course_key text not null, course_name text not null, tee_color text not null, course_rating numeric not null, slope_rating numeric not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (course_key, tee_color));

alter table public.saved_courses enable row level security;
alter table public.saved_course_holes enable row level security;
alter table public.saved_course_tees enable row level security;

do $$ begin
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_courses' and policyname='saved_courses_public_read') then create policy saved_courses_public_read on public.saved_courses for select using (true); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_courses' and policyname='saved_courses_public_insert') then create policy saved_courses_public_insert on public.saved_courses for insert with check (true); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_courses' and policyname='saved_courses_public_update') then create policy saved_courses_public_update on public.saved_courses for update using (true) with check (true); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_course_holes' and policyname='saved_course_holes_public_read') then create policy saved_course_holes_public_read on public.saved_course_holes for select using (true); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_course_holes' and policyname='saved_course_holes_public_insert') then create policy saved_course_holes_public_insert on public.saved_course_holes for insert with check (true); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_course_holes' and policyname='saved_course_holes_public_update') then create policy saved_course_holes_public_update on public.saved_course_holes for update using (true) with check (true); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_course_tees' and policyname='saved_course_tees_public_read') then create policy saved_course_tees_public_read on public.saved_course_tees for select using (true); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_course_tees' and policyname='saved_course_tees_public_insert') then create policy saved_course_tees_public_insert on public.saved_course_tees for insert with check (true); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_course_tees' and policyname='saved_course_tees_public_update') then create policy saved_course_tees_public_update on public.saved_course_tees for update using (true) with check (true); end if;
end $$;

with seed(course_key, course_name, city, state, tee_color, course_rating, slope_rating, pars, hcps) as (
values
  ('we-ko-pa-golf-club-saguaro', 'We-Ko-Pa Golf Club (Saguaro)', 'Fort McDowell', 'AZ', 'White', 68.8, 125, array[4,4,4,5,3,4,4,5,3,4,3,4,4,5,3,4,4,4]::int[], array[5,11,9,1,15,7,13,3,17,14,18,6,8,2,16,12,10,4]::int[]),
  ('we-ko-pa-golf-club-cholla', 'We-Ko-Pa Golf Club (Cholla)', 'Fort McDowell', 'AZ', 'Composite', 69.4, 126, array[4,5,3,4,3,4,4,5,4,5,3,4,4,3,4,4,5,4]::int[], array[13,3,17,9,15,7,11,1,5,4,16,10,12,18,14,6,2,8]::int[]),
  ('troon-north-golf-club-monument', 'Troon North Golf Club (Monument)', 'Scottsdale', 'AZ', 'Silver', 69.8, 132, array[4,3,5,4,4,4,3,4,5,4,5,4,3,5,4,3,4,4]::int[], array[5,17,3,11,1,13,15,9,7,10,6,8,18,4,14,16,2,12]::int[]),
  ('troon-north-golf-club-pinnacle', 'Troon North Golf Club (Pinnacle)', 'Scottsdale', 'AZ', 'Silver', 69.8, 131, array[4,4,4,4,5,3,4,3,4,4,5,4,3,5,4,3,4,4]::int[], array[9,7,3,11,5,17,1,15,13,10,8,12,16,2,14,18,4,6]::int[]),
  ('grayhawk-golf-club-raptor', 'Grayhawk Golf Club (Raptor)', 'Scottsdale', 'AZ', 'Terra Cotta', 69.5, 130, array[4,4,4,5,3,4,5,3,4,4,5,4,3,4,4,3,4,5]::int[], array[10,16,4,2,14,12,8,18,6,9,1,5,7,13,11,17,15,3]::int[]),
  ('grayhawk-golf-club-talon', 'Grayhawk Golf Club (Talon)', 'Scottsdale', 'AZ', 'Palo Verde', 71.4, 137, array[4,4,5,4,3,4,4,3,5,4,3,4,4,5,4,4,3,5]::int[], array[9,13,5,7,17,1,11,15,3,4,16,2,14,10,8,12,18,6]::int[]),
  ('tpc-scottsdale-pga-stadium', 'TPC Scottsdale PGA (Stadium)', 'Scottsdale', 'AZ', 'Resort Men''s', 68.4, 123, array[4,4,5,3,4,4,3,4,4,4,4,3,5,4,5,3,4,4]::int[], array[14,8,4,18,6,12,16,2,10,11,1,15,5,7,9,17,13,3]::int[]),
  ('tpc-scottsdale-pga-champions', 'TPC Scottsdale PGA (Champions)', 'Scottsdale', 'AZ', 'Blue/White', 69.9, 124, array[4,4,3,5,4,3,4,3,5,5,4,4,3,4,4,3,5,4]::int[], array[16,8,18,6,2,12,14,10,4,11,7,5,17,13,15,9,3,1]::int[]),
  ('eagle-mountain-golf-club', 'Eagle Mountain Golf Club', 'Fountain Hills', 'AZ', 'Green', 69.1, 127, array[5,4,3,5,3,4,4,3,4,5,4,5,3,4,3,4,4,4]::int[], array[11,5,9,13,15,7,1,17,3,12,4,14,10,2,18,8,6,16]::int[]),
  ('phoenician-golf-club', 'Phoenician Golf Club', 'Scottsdale', 'AZ', 'Phoenician', 68.0, 122, array[4,4,3,4,3,4,4,5,4,4,3,4,4,4,5,4,3,5]::int[], array[7,5,15,1,9,17,13,11,3,2,14,12,16,6,8,10,18,4]::int[]),
  ('quintero-golf-club', 'Quintero Golf Club', 'Peoria', 'AZ', 'Silver', 70.7, 137, array[4,5,4,4,4,3,4,5,3,5,4,4,3,5,4,3,4,4]::int[], array[13,7,5,3,11,17,9,1,15,10,8,4,18,2,14,16,12,6]::int[]),
  ('rancho-manana', 'Rancho Manana', 'Cave Creek', 'AZ', 'White', 71.2, 130, array[5,4,3,4,4,4,3,4,5,4,4,4,4,3,5,3,4,5]::int[], array[5,3,7,11,15,1,13,9,17,2,16,18,14,12,6,10,4,8]::int[]),
  ('wickenburg-ranch-big-wick', 'Wickenburg Ranch (Big Wick)', 'Wickenburg', 'AZ', 'Blue/White', 69.6, 136, array[4,3,4,3,5,4,5,3,5,4,3,4,3,5,4,4,3,5]::int[], array[7,17,9,15,1,13,3,11,5,14,18,2,16,10,6,8,12,4]::int[]),
  ('ak-chin-southern-dunes', 'Ak-Chin Southern Dunes', 'Maricopa', 'AZ', 'Blue', 71.2, 129, array[4,4,5,3,4,3,5,4,4,4,3,4,5,4,4,5,3,4]::int[], array[9,15,1,17,7,13,3,5,11,14,18,8,2,12,6,4,16,10]::int[]),
  ('verrado-founders', 'Verrado (Founders)', 'Buckeye', 'AZ', 'White/Blue', 68.1, 119, array[4,4,3,4,5,3,5,4,4,5,4,4,4,3,5,4,3,4]::int[], array[13,5,15,3,9,17,7,1,11,10,14,4,12,16,8,6,18,2]::int[]),
  ('verrado-victory', 'Verrado (Victory)', 'Buckeye', 'AZ', 'Silver/White', 68.8, 121, array[4,3,5,4,3,4,4,5,4,4,4,3,4,4,5,3,4,5]::int[], array[11,15,5,7,17,9,13,3,1,10,8,16,6,14,4,18,12,2]::int[]),
  ('estrella-golf-club', 'Estrella Golf Club', 'Goodyear', 'AZ', 'Gold', 68.4, 123, array[4,4,3,5,4,4,3,5,4,4,4,4,5,3,4,5,3,4]::int[], array[16,4,18,6,12,10,14,8,2,15,3,17,13,7,5,1,11,9]::int[]),
  ('gold-canyon-dinosaur-mountain', 'Gold Canyon (Dinosaur Mountain)', 'Gold Canyon', 'AZ', 'Black/Blue', 68.6, 132, array[4,3,5,4,3,4,4,3,5,3,5,4,4,3,4,5,3,4]::int[], array[5,15,3,1,9,11,7,13,17,16,18,12,2,6,4,14,8,10]::int[]),
  ('gold-canyon-sidewinder', 'Gold Canyon (Sidewinder)', 'Gold Canyon', 'AZ', 'Black/Blue', 68.7, 126, array[5,3,4,3,4,5,3,4,4,3,5,4,4,3,4,4,4,5]::int[], array[18,10,6,16,12,8,14,4,2,13,9,11,17,7,1,3,15,5]::int[]),
  ('las-sendas-golf-club', 'Las Sendas Golf Club', 'Mesa', 'AZ', 'Blue', 69.6, 125, array[4,5,4,4,3,5,3,4,4,5,3,4,4,3,5,3,4,5]::int[], array[1,9,7,3,15,11,17,13,5,18,10,2,4,16,6,12,8,14]::int[]),
  ('the-westin-kierland-golf-club-acacia-mesquite', 'The Westin Kierland Golf Club (Acacia/Mesquite)', 'Scottsdale', 'AZ', 'Copper', 69.2, 123, array[5,4,4,3,5,3,4,3,5,4,4,4,3,5,4,5,3,4]::int[], array[16,8,4,18,2,12,10,14,6,11,9,17,15,5,3,7,13,1]::int[]),
  ('talking-stick-golf-club-o-odham-formerly-north', 'Talking Stick Golf Club (O''odham (formerly North))', 'Scottsdale', 'AZ', 'Gold/Jade', 67.0, 116, array[4,5,4,4,4,3,4,3,4,4,3,4,4,4,4,3,5,4]::int[], array[15,13,1,3,11,5,9,17,7,12,6,2,16,8,14,18,4,10]::int[]),
  ('talking-stick-golf-club-piipaash-formerly-south', 'Talking Stick Golf Club (Piipaash (formerly South))', 'Scottsdale', 'AZ', 'Gold/Jade', 67.4, 117, array[4,4,3,4,4,4,5,4,3,4,4,4,3,5,4,5,3,4]::int[], array[13,3,7,17,1,15,9,5,11,10,8,2,16,6,4,14,18,12]::int[]),
  ('camelback-golf-club-ambiente', 'Camelback Golf Club (Ambiente)', 'Scottsdale', 'AZ', 'Tan', 69.1, 125, array[4,3,5,4,4,4,5,3,4,4,3,4,4,5,3,5,4,4]::int[], array[5,11,17,13,15,1,7,9,3,18,12,2,14,6,8,16,4,10]::int[]),
  ('camelback-golf-club-padres', 'Camelback Golf Club (Padres)', 'Scottsdale', 'AZ', 'White', 70.0, 123, array[4,4,3,4,5,4,4,3,5,4,3,4,5,4,4,4,3,5]::int[], array[7,13,17,9,1,3,15,11,5,2,18,16,10,14,6,12,8,4]::int[]),
  ('raven-golf-club', 'Raven Golf Club', 'Phoenix', 'AZ', 'Regular', 68.3, 121, array[4,3,4,5,4,4,3,4,5,4,3,5,4,3,4,4,5,4]::int[], array[11,17,1,3,15,7,13,5,9,12,16,8,10,18,14,4,2,6]::int[]),
  ('lookout-mountain-golf-club', 'Lookout Mountain Golf Club', 'Phoenix', 'AZ', 'Blue/White', 69.0, 130, array[4,5,3,4,5,3,5,4,3,4,3,4,4,4,5,3,4,5]::int[], array[11,9,15,3,7,13,1,5,17,4,12,2,18,8,16,6,14,10]::int[]),
  ('wildfire-golf-club-palmer', 'Wildfire Golf Club (Palmer)', 'Phoenix', 'AZ', 'Regular', 68.1, 122, array[4,4,5,4,3,4,4,3,5,4,5,4,3,5,3,4,4,4]::int[], array[14,10,2,12,18,8,6,16,4,11,3,7,17,1,15,13,5,9]::int[]),
  ('wildfire-golf-club-faldo', 'Wildfire Golf Club (Faldo)', 'Phoenix', 'AZ', 'Regular', 67.7, 118, array[4,4,3,4,4,4,3,4,5,4,5,4,4,3,5,4,3,4]::int[], array[7,5,17,1,9,13,15,11,3,8,4,6,16,14,2,12,18,10]::int[]),
  ('longbow-golf-club', 'Longbow Golf Club', 'Mesa', 'AZ', 'Green/White', 69.0, 124, array[5,4,3,4,4,4,3,4,4,4,3,4,4,4,5,3,4,5]::int[], array[9,11,15,1,7,5,13,17,3,4,10,8,14,2,18,6,12,16]::int[]),
  ('mccormick-ranch-palm', 'McCormick Ranch (Palm)', 'Scottsdale', 'AZ', 'White', 70.1, 127, array[4,4,5,4,3,4,5,3,4,4,4,5,3,4,4,5,3,4]::int[], array[13,9,5,7,15,11,1,17,3,14,10,6,16,12,4,2,18,8]::int[]),
  ('mccormick-ranch-pine', 'McCormick Ranch (Pine)', 'Scottsdale', 'AZ', 'White', 70.5, 127, array[4,4,4,5,3,4,5,3,4,4,4,5,3,4,4,4,3,5]::int[], array[14,12,8,6,18,4,2,16,10,13,7,3,15,11,1,9,17,5]::int[]),
  ('mcdowell-mountain-golf-club', 'McDowell Mountain Golf Club', 'Scottsdale', 'AZ', 'Gold/White', 68.4, 123, array[4,4,3,5,4,4,4,3,5,4,4,4,5,3,5,4,3,4]::int[], array[3,17,15,5,11,13,1,7,9,8,4,10,14,18,12,16,6,2]::int[]),
  ('orange-tree-golf-club', 'Orange Tree Golf Club', 'Scottsdale', 'AZ', 'White', 69.3, 119, array[4,5,4,3,4,5,3,4,4,4,4,3,5,4,3,4,5,4]::int[], array[13,1,11,15,9,5,17,3,7,12,10,16,2,14,18,4,8,6]::int[]),
  ('stonecreek-golf-club', 'Stonecreek Golf Club', 'Phoenix', 'AZ', 'Middle', 68.1, 125, array[4,4,3,4,3,4,5,4,4,4,4,3,5,4,3,5,4,4]::int[], array[13,3,17,5,15,1,9,7,11,8,10,16,14,4,18,2,6,12]::int[]),
  ('ocotillo-golf-club-blue-white', 'Ocotillo Golf Club (Blue/White)', 'Chandler', 'AZ', 'Blue', 69.2, 122, array[3,4,4,3,4,5,3,4,4,4,5,3,4,4,4,3,4,4]::int[], array[5,13,9,11,17,1,15,3,7,12,2,14,10,8,6,18,16,4]::int[]),
  ('bear-creek-golf-club-bear-course', 'Bear Creek Golf Club (Bear Course)', 'Chandler', 'AZ', 'Blue', 69.6, 116, array[4,3,5,4,3,5,4,3,4,4,4,5,4,4,3,4,3,5]::int[], array[13,15,17,9,5,7,3,11,1,4,2,16,10,14,12,18,8,6]::int[]),
  ('arizona-grand-golf-course', 'Arizona Grand Golf Course', 'Phoenix', 'AZ', 'Blue', 67, 119, array[4,4,5,4,3,5,4,3,4,4,5,3,5,3,4,4,4,3]::int[], array[7,9,1,5,17,3,15,13,11,8,4,18,2,16,6,14,12,10]::int[]),
  ('legacy-golf-club', 'Legacy Golf Club', 'Phoenix', 'AZ', 'White', 67.1, 110, array[4,4,4,3,4,5,3,5,4,4,3,4,4,5,3,4,3,5]::int[], array[10,6,16,12,14,2,18,8,4,9,11,3,15,1,13,17,5,7]::int[]),
  ('sunridge-canyon', 'SunRidge Canyon', 'Fountain Hills', 'AZ', 'Middle', 68.2, 129, array[4,4,5,4,4,3,4,3,5,4,4,3,5,3,4,5,3,4]::int[], array[17,11,7,9,1,13,15,5,3,16,8,18,2,14,6,12,10,4]::int[]),
  ('red-mountain-ranch', 'Red Mountain Ranch', 'Mesa', 'AZ', 'Blue', 69.4, 134, array[4,4,4,3,5,3,4,4,5,5,3,4,4,4,3,4,5,4]::int[], array[5,9,1,17,11,15,3,13,7,2,16,12,4,14,18,10,6,8]::int[]),
  ('superstition-springs', 'Superstition Springs', 'Mesa', 'AZ', 'Middle', 70.5, 124, array[4,4,3,4,4,5,3,5,4,4,5,3,4,4,3,4,5,4]::int[], array[13,7,11,15,17,1,5,9,3,12,14,18,16,8,4,10,2,6]::int[]),
  ('kokopelli', 'Kokopelli', 'Gilbert', 'AZ', 'Black', 68.6, 125, array[5,3,4,4,4,3,4,5,4,4,4,4,4,3,5,4,3,5]::int[], array[3,15,9,7,5,17,13,1,11,8,14,6,10,18,2,12,16,4]::int[]),
  ('trilogy-at-power-ranch', 'Trilogy at Power Ranch', 'Gilbert', 'AZ', 'Blue', 69.0, 122, array[4,4,5,3,4,3,5,3,4,4,3,4,5,4,3,4,5,4]::int[], array[14,16,2,18,10,12,4,8,6,13,15,11,7,9,17,1,3,5]::int[]),
  ('poston-butte-golf-club', 'Poston Butte Golf Club', 'Florence', 'AZ', 'White', 69.2, 119, array[4,4,5,3,4,4,3,4,5,4,4,3,5,4,4,4,3,5]::int[], array[11,1,13,9,17,3,15,7,5,2,6,14,10,4,16,8,12,18]::int[]),
  ('las-colinas', 'Las Colinas', 'Queen Creek', 'AZ', 'Roadrunner', 68.6, 115, array[5,4,4,4,5,3,4,3,4,4,3,5,4,3,5,4,3,4]::int[], array[7,13,5,1,3,15,17,9,11,4,10,6,14,18,8,12,16,2]::int[]),
  ('mountain-brook', 'Mountain Brook', 'Gold Canyon', 'AZ', 'White', 66.3, 109, array[4,3,5,3,4,4,3,4,5,5,4,3,4,3,4,5,4,4]::int[], array[4,12,10,18,14,6,16,2,8,11,13,17,9,15,3,7,5,1]::int[]),
  ('falcon-dunes', 'Falcon Dunes', 'Waddell', 'AZ', 'Phantom', 66.7, 117, array[4,3,4,4,3,4,4,4,5,5,3,4,4,4,4,5,3,4]::int[], array[5,17,7,11,15,13,1,9,3,6,18,12,14,4,10,2,16,8]::int[]),
  ('sundance-golf-club', 'Sundance Golf Club', 'Buckeye', 'AZ', 'Blue', 70.6, 123, array[4,4,3,5,4,3,4,4,5,5,4,4,3,4,4,3,4,5]::int[], array[12,2,14,8,6,16,18,4,10,15,11,3,13,9,7,17,1,5]::int[]),
  ('palm-valley-golf-club', 'Palm Valley Golf Club', 'Goodyear', 'AZ', 'Regular', 69.1, 123, array[4,5,4,3,4,4,4,3,5,4,5,3,4,5,4,3,4,4]::int[], array[13,11,3,15,9,7,5,17,1,16,4,14,12,8,2,18,10,6]::int[]),
  ('papago-golf-club', 'Papago Golf Club', 'Phoenix', 'AZ', 'White/Green', 68.2, 117, array[5,4,4,3,4,4,4,3,5,5,3,4,4,4,5,4,3,4]::int[], array[15,17,3,13,11,1,7,9,5,18,12,16,10,8,14,4,6,2]::int[]),
  ('encanto-18', 'Encanto 18', 'Phoenix', 'AZ', 'White', 68.3, 111, array[5,4,3,4,3,4,3,5,4,4,3,5,4,3,4,4,4,4]::int[], array[3,15,13,7,11,9,17,5,1,16,18,12,6,8,4,2,10,14]::int[]),
  ('cave-creek', 'Cave Creek', 'Phoenix', 'AZ', 'Regular', 69.0, 116, array[4,5,3,4,4,5,3,4,4,4,5,4,3,4,4,5,3,4]::int[], array[15,5,17,11,7,13,9,1,3,16,4,14,18,6,10,12,2,8]::int[]),
  ('foothills', 'Foothills', 'Phoenix', 'AZ', 'Middle', 68.1, 116, array[4,5,4,3,4,4,3,5,4,4,4,5,3,4,4,3,5,4]::int[], array[3,7,1,17,11,15,13,9,5,6,10,12,16,14,2,18,8,4]::int[]),
  ('aguila', 'Aguila', 'Phoenix', 'AZ', 'Silver', 70.0, 123, array[4,5,3,4,5,4,3,4,4,5,4,4,3,4,5,3,4,4]::int[], array[5,7,9,1,11,15,13,17,3,10,8,4,18,16,6,12,14,2]::int[]),
  ('dobson-ranch', 'Dobson Ranch', 'Mesa', 'AZ', 'White', 68.9, 119, array[5,4,4,3,5,4,3,4,5,4,4,3,5,3,4,4,3,5]::int[], array[5,3,13,11,15,9,17,1,7,8,2,10,12,14,18,4,6,16]::int[]),
  ('san-marcos', 'San Marcos', 'Chandler', 'AZ', 'Blue', 69.3, 120, array[4,4,3,4,5,4,4,3,5,4,4,4,3,4,3,4,5,5]::int[], array[7,9,17,3,1,11,5,13,15,2,4,16,14,10,6,18,8,12]::int[]),
  ('seville', 'Seville', 'Gilbert', 'AZ', 'Gold/Blue', 69.8, 116, array[4,5,4,3,5,4,4,3,4,4,4,5,4,3,4,4,3,5]::int[], array[13,9,5,17,3,1,11,15,7,2,12,4,10,18,6,16,14,8]::int[]),
  ('western-skies-golf-club', 'Western Skies Golf Club', 'Gilbert', 'AZ', 'White', 68.1, 113, array[5,3,5,3,4,4,3,4,4,4,4,3,5,4,4,5,4,4]::int[], array[5,15,7,3,13,17,9,1,11,10,6,2,8,14,18,12,4,16]::int[]),
  ('apache-creek', 'Apache Creek', 'Apache Junction', 'AZ', 'White', 64.4, 111, array[4,4,5,4,4,3,4,4,3,5,4,3,4,4,5,3,4,4]::int[], array[5,1,11,13,7,15,17,3,9,6,2,16,14,12,8,18,10,4]::int[]),
  ('apache-wells', 'Apache Wells', 'Mesa', 'AZ', 'White', 66.3, 106, array[4,3,4,3,4,4,3,5,4,4,5,3,5,4,3,5,3,5]::int[], array[9,17,1,13,15,7,11,3,5,10,18,12,4,2,6,16,14,8]::int[]),
  ('oakwood', 'Oakwood', 'Sun Lakes', 'AZ', 'White', 66.4, 110, array[4,5,4,3,4,4,3,4,5,4,4,3,4,5,4,4,3,5]::int[], array[11,9,3,17,5,13,15,1,7,6,12,14,4,16,18,8,10,2]::int[]),
  ('johnson-ranch', 'Johnson Ranch', 'San Tan Valley', 'AZ', 'White', 67.8, 114, array[5,4,3,4,4,4,3,4,5,4,3,4,4,5,4,4,3,5]::int[], array[9,5,11,7,3,13,17,1,15,2,18,6,10,14,8,12,16,4]::int[]),
  ('toka-sticks-golf-club', 'Toka Sticks Golf Club', 'Mesa', 'AZ', 'Silver', 66.9, 110, array[4,5,3,5,3,4,4,3,5,4,4,5,3,4,3,4,5,4]::int[], array[13,17,7,3,9,11,15,5,1,10,4,16,8,14,6,12,18,2]::int[]),
  ('lone-tree-golf-club', 'Lone Tree Golf Club', 'Chandler', 'AZ', 'Blue', 69.8, 116, array[4,3,4,4,5,4,4,3,5,4,4,3,4,3,4,4,4,5]::int[], array[7,15,9,11,5,17,3,13,1,10,12,14,8,18,2,16,6,4]::int[]),
  ('ahwatukee', 'Ahwatukee', 'Phoenix', 'AZ', 'Middle', 68.1, 114, array[4,5,4,3,4,4,4,3,5,4,5,3,4,3,4,4,4,5]::int[], array[1,9,15,13,3,5,17,7,11,6,8,12,10,18,16,4,2,14]::int[]),
  ('coyote-lakes', 'Coyote Lakes', 'Surprise', 'AZ', 'Green', 69.1, 120, array[4,4,5,3,4,5,4,4,3,5,4,3,5,3,4,3,4,4]::int[], array[9,3,11,13,7,1,5,17,15,4,14,18,8,16,6,10,12,2]::int[]),
  ('hillcrest', 'Hillcrest', 'Sun City West', 'AZ', 'White', 69.1, 116, array[4,4,3,5,4,4,5,3,4,5,4,4,5,3,4,4,3,4]::int[], array[17,15,11,3,7,9,1,13,5,8,12,18,2,14,10,6,16,4]::int[]),
  ('union-hills', 'Union Hills', 'Sun City', 'AZ', 'White', 68.9, 116, array[4,4,5,4,3,5,3,4,4,5,4,3,4,4,3,5,4,4]::int[], array[17,5,15,1,11,3,9,13,7,16,10,18,6,12,14,2,8,4]::int[]),
  ('bellair', 'Bellair', 'Glendale', 'AZ', 'Middle', 55.8, 89, array[4,3,3,3,3,3,3,3,4,4,3,3,3,3,3,3,4,4]::int[], array[7,13,15,1,17,9,11,3,5,14,18,2,12,4,16,10,6,8]::int[]),
  ('viewpoint-golf-resort', 'Viewpoint Golf Resort', 'Mesa', 'AZ', 'Champ', 69.2, 117, array[4,4,3,5,4,3,5,4,3,4,4,5,4,3,4,4,3,5]::int[], array[3,13,17,5,9,7,1,11,15,14,16,2,10,18,12,8,4,6]::int[]),
  ('apache-sun', 'Apache Sun', 'Queen Creek', 'AZ', 'Blue', 63.0, 99, array[5,4,4,4,3,4,3,4,3,5,4,4,4,3,4,3,4,3]::int[], array[1,11,3,7,13,9,15,5,17,2,12,4,8,14,10,16,6,18]::int[]),
  ('painted-mountain', 'Painted Mountain', 'Mesa', 'AZ', 'Blue', 66.3, 110, array[5,3,4,4,3,4,5,4,5,3,5,3,4,4,3,3,4,4]::int[], array[1,15,11,7,17,9,5,13,3,18,2,12,8,10,16,14,4,6]::int[]),
  ('granite-falls-north', 'Granite Falls (North)', 'Surprise', 'AZ', 'White', 68.9, 116, array[4,4,3,5,4,4,4,3,5,5,4,3,4,4,3,4,4,5]::int[], array[7,11,17,1,13,3,9,15,5,2,4,18,14,8,16,12,10,6]::int[]),
  ('granite-falls-south', 'Granite Falls (South)', 'Surprise', 'AZ', 'White', 68.8, 113, array[4,4,5,3,4,5,4,3,4,4,4,5,3,4,4,4,3,5]::int[], array[7,9,1,17,5,3,11,15,13,14,8,12,16,2,4,10,18,6]::int[]),
  ('palo-verde', 'Palo Verde', 'Sun Lakes', 'AZ', 'Blue', 59.7, 96, array[4,3,3,3,3,3,5,3,4,4,3,3,4,3,3,3,3,5]::int[], array[4,14,16,12,8,18,2,10,6,1,9,17,5,7,15,11,13,3]::int[]),
  ('paradise-valley-gc', 'Paradise Valley GC', 'Phoenix', 'AZ', 'Regular', 58.5, 85, array[4,3,3,3,3,4,3,3,5,4,3,3,3,4,3,3,3,4]::int[], array[3,7,9,13,15,5,11,17,1,2,14,12,10,6,18,8,16,4]::int[]),
  ('villa-de-paz', 'Villa de Paz', 'Phoenix', 'AZ', 'Middle', 67.9, 117, array[4,3,5,5,4,3,4,4,5,5,3,4,4,4,4,3,4,4]::int[], array[11,15,3,1,9,17,13,5,7,6,18,2,8,10,14,16,12,4]::int[]),
  ('encanto-9', 'Encanto 9', 'Phoenix', 'AZ', 'Black', 28.5, 80, array[4,3,3,3,4,3,3,3,4,4,3,3,3,4,3,3,3,4]::int[], array[2,9,8,7,5,6,3,4,1,11,18,17,16,14,15,12,13,10]::int[]),
  ('rolling-hills', 'Rolling Hills', 'Tempe', 'AZ', 'Blue', 57.4, 90, array[4,3,4,3,3,3,3,3,4,4,4,4,3,3,4,3,3,4]::int[], array[6,10,2,14,16,12,4,18,8,5,3,9,17,11,7,15,13,1]::int[]),
  ('moon-valley-cc', 'Moon Valley CC', 'Phoenix', 'AZ', 'White', 68.1, 118, array[4,3,4,5,3,4,4,5,4,5,3,4,5,4,3,4,4,4]::int[], array[9,17,15,3,13,5,1,11,7,6,18,14,8,10,16,2,12,4]::int[]),
  ('arizona-country-club', 'Arizona Country Club', 'Phoenix', 'AZ', 'White', 70.0, 124, array[5,4,5,3,4,4,3,5,3,5,3,4,4,4,3,4,4,5]::int[], array[8,4,6,10,2,14,18,12,16,1,11,5,15,7,13,17,3,9]::int[]),
  ('phoenix-country-club', 'Phoenix Country Club', 'Phoenix', 'AZ', 'White/Blue', 68.9, 125, array[5,3,4,4,4,4,5,3,4,4,4,4,3,4,3,4,4,5]::int[], array[13,15,1,5,17,3,7,11,9,2,4,16,12,8,10,18,6,14]::int[]),
  ('gcu-golf-course', 'GCU Golf Course', 'Phoenix', 'AZ', 'White', 68.4, 120, array[4,3,5,4,4,4,4,3,4,5,3,4,3,4,4,4,4,5]::int[], array[3,17,1,13,9,11,5,15,7,2,16,6,18,14,12,10,8,4]::int[]),
  ('desert-canyon', 'Desert Canyon', 'Fountain Hills', 'AZ', 'White', 66.4, 114, array[4,3,4,5,4,4,4,3,4,4,4,5,3,5,4,3,4,4]::int[], array[1,3,5,7,9,11,13,15,17,2,4,6,8,10,12,14,16,18]::int[]),
  ('apache-wells-executive', 'Apache Wells Executive', 'Mesa', 'AZ', 'Blue', 67.9, 109, array[4,3,4,3,4,4,3,5,4,4,5,3,5,4,3,5,3,5]::int[], array[9,17,1,13,15,7,11,3,5,10,18,12,4,2,6,16,14,8]::int[]),
  ('bear-creek-cub-course', 'Bear Creek (Cub Course)', 'Chandler', 'AZ', 'Blue', 58.4, 85, array[3,3,3,3,3,3,4,3,4,4,3,4,3,3,3,3,4,3]::int[], array[3,13,1,7,15,17,5,9,11,12,14,8,18,6,10,2,16,4]::int[]),
  ('briarwood', 'Briarwood', 'Sun City West', 'AZ', 'Tan', 68.1, 122, array[4,4,3,4,4,5,3,5,4,4,3,4,5,3,4,4,5,4]::int[], array[13,11,17,3,1,7,15,5,9,4,18,12,6,16,14,2,10,8]::int[]),
  ('sun-city-north', 'Sun City North', 'Sun City', 'AZ', 'White', 68.4, 112, array[4,4,3,4,5,5,3,4,4,4,4,3,5,3,5,4,3,5]::int[], array[11,1,17,15,5,7,9,3,13,12,8,16,2,10,6,14,18,4]::int[]),
  ('sun-city-south', 'Sun City South', 'Sun City', 'AZ', 'White', 67.8, 113, array[4,4,4,4,3,4,5,4,4,4,3,4,5,4,4,4,3,5]::int[], array[1,15,3,13,17,11,5,9,7,10,16,4,8,14,6,2,18,12]::int[]),
  ('sun-city-lakes-east', 'Sun City Lakes East', 'Sun City', 'AZ', 'White', 56.8, 84, array[4,3,3,4,3,3,4,3,3,3,4,3,4,3,3,3,3,4]::int[], array[3,17,11,5,15,13,1,9,7,14,4,12,6,18,16,10,8,2]::int[]),
  ('sun-city-lakes-west', 'Sun City Lakes West', 'Sun City', 'AZ', 'White', 67.8, 112, array[4,3,4,4,4,5,3,4,5,4,3,5,4,4,3,5,4,4]::int[], array[5,15,1,17,3,9,13,11,7,2,10,6,4,16,18,8,14,12]::int[]),
  ('pebblebrook', 'Pebblebrook', 'Sun City West', 'AZ', 'White', 68.6, 116, array[4,4,3,5,4,4,5,3,4,4,3,4,5,4,3,4,5,4]::int[], array[9,11,13,5,17,1,7,15,3,4,14,16,12,18,8,2,10,6]::int[]),
  ('corte-bella', 'Corte Bella', 'Sun City West', 'AZ', 'White/Copper', 68.0, 118, array[4,4,4,3,5,4,4,3,5,4,4,3,5,4,3,4,5,4]::int[], array[17,3,5,15,11,7,1,13,9,12,14,16,2,6,18,4,8,10]::int[]),
  ('cimarron', 'Cimarron', 'Surprise', 'AZ', 'Vintage', 67.3, 117, array[4,4,5,3,4,5,3,4,4,4,4,4,5,4,3,4,3,5]::int[], array[9,13,1,17,11,3,15,5,7,18,2,12,6,4,14,8,16,10]::int[]),
  ('trail-ridge', 'Trail Ridge', 'Sun City West', 'AZ', 'White', 69.6, 122, array[4,5,4,4,3,4,3,5,4,4,4,3,5,4,4,3,5,4]::int[], array[7,17,1,5,9,11,3,15,13,8,12,14,6,2,18,10,16,4]::int[]),
  ('deer-valley', 'Deer Valley', 'Sun City West', 'AZ', 'White', 68.3, 118, array[4,3,4,5,3,4,4,5,4,4,4,4,5,3,5,4,3,4]::int[], array[9,17,5,3,15,1,13,7,11,14,2,10,8,16,4,6,18,12]::int[]),
  ('executive-at-palm-valley-lakes-south-west', 'Executive at Palm Valley (Lakes (South/West))', 'Goodyear', 'AZ', 'White', 58.2, 89, array[4,5,3,4,5,4,3,4,4,4,4,3,5,4,3,3,4,5]::int[], array[16,4,14,12,8,2,18,10,6,5,1,13,11,9,17,7,15,3]::int[]),
  ('leisure-world-country-club-coyote-run', 'Leisure World Country Club (Coyote Run)', 'Mesa', 'AZ', 'White', 68.3, 115, array[4,4,4,5,5,3,4,4,3,4,4,5,3,4,5,3,5,4]::int[], array[13,7,5,3,1,17,9,11,15,12,16,10,18,2,8,14,4,6]::int[]),
  ('wigwam-gold', 'Wigwam (Gold)', 'Litchfield Park', 'AZ', 'Club', 70.3, 125, array[5,4,3,5,4,3,4,4,4,5,3,4,4,5,4,3,4,4]::int[], array[11,7,15,3,13,17,9,1,5,2,16,8,10,12,14,18,4,6]::int[])
), upsert_courses as (
  insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
  select 'manual_seed', course_key, course_name, course_key, city, state, now() from seed
  on conflict (normalized_name, city, state) do update set name=excluded.name, source_provider=excluded.source_provider, source_course_id=excluded.source_course_id, updated_at=now()
  returning id, normalized_name, city, state
), all_courses as (
  select c.id, s.* from seed s join public.saved_courses c on c.normalized_name=s.course_key and c.city is not distinct from s.city and c.state is not distinct from s.state
), upsert_tees as (
  insert into public.saved_course_tees (course_key, course_name, tee_color, course_rating, slope_rating, updated_at)
  select course_key, course_name, tee_color, course_rating, slope_rating, now() from seed
  on conflict (course_key, tee_color) do update set course_name=excluded.course_name, course_rating=excluded.course_rating, slope_rating=excluded.slope_rating, updated_at=now()
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select c.id, hole_number, c.pars[hole_number], c.hcps[hole_number], now() from all_courses c cross join generate_series(1,18) as hole_number
on conflict (saved_course_id, hole_number) do update set par=excluded.par, handicap_index=excluded.handicap_index, updated_at=now();

select (select count(*) from public.saved_courses where source_provider='manual_seed') as seeded_courses, (select count(*) from public.saved_course_holes h join public.saved_courses c on c.id=h.saved_course_id where c.source_provider='manual_seed') as seeded_holes, (select count(*) from public.saved_course_tees where course_key in (select normalized_name from public.saved_courses where source_provider='manual_seed')) as seeded_tees;
