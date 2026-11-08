create extension if not exists pgcrypto;

create table if not exists public.saved_courses (id uuid primary key default gen_random_uuid(), source_provider text, source_course_id text, name text not null, normalized_name text not null, city text, state text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (normalized_name, city, state));
create table if not exists public.saved_course_holes (id uuid primary key default gen_random_uuid(), saved_course_id uuid not null references public.saved_courses(id) on delete cascade, hole_number integer not null check (hole_number between 1 and 18), par integer check (par between 3 and 5), handicap_index integer check (handicap_index between 1 and 18), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (saved_course_id, hole_number));
create table if not exists public.saved_course_tees (id uuid primary key default gen_random_uuid(), course_key text not null, course_name text not null, tee_name text not null, tee_color text not null, gender text, course_rating numeric not null, slope_rating numeric not null, total_yards integer, source_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (course_key, tee_name, gender));

alter table public.saved_course_tees add column if not exists tee_name text;
update public.saved_course_tees set tee_name = tee_color where tee_name is null;
alter table public.saved_course_tees alter column tee_name set not null;
alter table public.saved_course_tees add column if not exists gender text;
update public.saved_course_tees set gender = 'M' where gender is null;
alter table public.saved_course_tees add column if not exists total_yards integer;
alter table public.saved_course_tees add column if not exists source_url text;
alter table public.saved_course_tees drop constraint if exists saved_course_tees_course_key_tee_color_key;
drop index if exists public.saved_course_tees_course_key_tee_color_idx;
do $$ begin
if not exists (select 1 from pg_constraint where conname='saved_course_tees_course_key_tee_name_gender_key' and conrelid='public.saved_course_tees'::regclass) then alter table public.saved_course_tees add constraint saved_course_tees_course_key_tee_name_gender_key unique (course_key, tee_name, gender); end if;
end $$;

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

with course_seed(course_key, course_name, city, state, pars, hcps) as (
values
  ('palmbrook-country-club', 'Palmbrook Country Club', 'Sun City', 'AZ', array[4,5,4,4,3,5,3,4,4,4,3,4,5,4,3,4,5,4]::int[], array[4,6,2,10,16,8,18,14,12,11,17,1,7,13,15,3,9,5]::int[]),
  ('willowcreek-golf-course', 'Willowcreek Golf Course', 'Sun City', 'AZ', array[4,3,3,3,4,3,3,3,4,4,3,4,3,3,3,3,3,4]::int[], array[5,15,9,7,3,17,11,13,1,2,10,4,16,18,12,14,8,6]::int[]),
  ('willowbrook-golf-course', 'Willowbrook Golf Course', 'Sun City', 'AZ', array[4,3,3,3,4,3,3,3,4,4,3,4,3,3,3,3,3,4]::int[], array[5,15,9,7,3,17,11,13,1,2,10,4,16,18,12,14,8,6]::int[]),
  ('desert-trails-golf-course', 'Desert Trails Golf Course', 'Sun City West', 'AZ', array[4,3,3,3,3,4,3,3,4,4,3,3,4,3,4,3,3,4]::int[], array[6,12,14,18,10,2,4,16,8,3,17,5,9,11,1,15,13,7]::int[]),
  ('echo-mesa-golf-course', 'Echo Mesa Golf Course', 'Sun City West', 'AZ', array[4,3,3,3,4,3,3,3,4,4,3,3,3,4,3,3,3,4]::int[], array[7,17,15,5,1,11,13,9,3,10,18,12,8,2,16,14,6,4]::int[]),
  ('grandview-golf-course', 'Grandview Golf Course', 'Sun City West', 'AZ', array[5,4,3,5,4,4,4,3,4,4,4,3,5,4,3,4,5,4]::int[], array[3,7,15,1,13,5,11,17,9,16,12,18,2,10,14,4,8,6]::int[]),
  ('stardust-golf-course', 'Stardust Golf Course', 'Sun City West', 'AZ', array[4,3,3,4,3,3,3,3,4,4,3,3,3,3,4,3,3,4]::int[], array[5,13,9,1,11,7,15,17,3,6,18,10,16,12,2,14,8,4]::int[]),
  ('desert-springs-golf-course', 'Desert Springs Golf Course', 'Surprise', 'AZ', array[4,4,3,5,4,3,5,4,4,4,5,4,4,3,4,4,3,5]::int[], array[7,11,17,3,1,15,9,5,13,4,2,12,10,18,14,6,16,8]::int[]),
  ('arizona-traditions-golf-club', 'Arizona Traditions Golf Club', 'Surprise', 'AZ', array[4,4,3,4,4,4,3,5,4,4,3,4,5,3,4,4,3,5]::int[], array[13,9,15,1,3,7,11,5,17,14,18,4,2,12,8,10,16,6]::int[]),
  ('great-eagle-golf-club', 'Great Eagle Golf Club', 'Surprise', 'AZ', array[5,4,4,3,5,4,4,3,4,4,3,5,4,3,4,4,5,4]::int[], array[2,10,16,18,6,8,14,12,4,9,17,1,13,11,3,15,5,7]::int[]),
  ('sun-village-golf', 'Sun Village Golf Course', 'Surprise', 'AZ', array[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]::int[], array[10,18,11,14,5,15,4,12,7,6,1,17,16,8,9,3,2,13]::int[]),
  ('trilogy-golf-club-at-vistancia', 'Trilogy Golf Club at Vistancia', 'Peoria', 'AZ', array[4,3,4,4,5,4,3,4,5,4,4,3,4,5,4,4,3,5]::int[], array[11,17,1,13,3,9,15,5,7,14,8,16,2,4,12,10,18,6]::int[]),
  ('blackstone-country-club', 'Blackstone Country Club', 'Peoria', 'AZ', array[4,3,5,4,4,4,3,4,5,4,5,4,3,5,3,4,3,5]::int[], array[11,15,9,7,5,13,17,3,1,10,2,4,12,6,14,16,18,8]::int[]),
  ('westbrook-village-golf-club-lakes-course', 'Westbrook Village Golf Club (Lakes Course)', 'Peoria', 'AZ', array[4,4,3,5,5,4,3,4,4,4,4,3,4,4,4,4,3,5]::int[], array[9,7,15,3,1,5,17,11,13,4,6,18,14,8,12,10,16,2]::int[]),
  ('westbrook-village-golf-club-vistas-course', 'Westbrook Village Golf Club (Vistas Course)', 'Peoria', 'AZ', array[4,4,3,5,5,4,3,4,4,4,4,3,4,4,4,4,3,5]::int[], array[9,7,15,3,1,5,17,11,13,4,6,18,14,8,12,10,16,2]::int[]),
  ('peoria-pines-golf-restaurant', 'Peoria Pines Golf and Restaurant', 'Peoria', 'AZ', array[3,4,3,3,3,3,4,3,5,4,3,3,3,4,3,4,3,5]::int[], array[9,13,11,1,5,17,15,3,7,8,16,14,2,18,4,6,12,10]::int[]),
  ('arrowhead-country-club', 'Arrowhead Country Club', 'Glendale', 'AZ', array[4,5,3,4,4,5,3,4,4,4,3,5,4,4,3,4,4,5]::int[], array[7,17,9,15,5,1,11,3,13,8,12,14,2,6,16,18,4,10]::int[]),
  ('the-legend-at-arrowhead', 'The Legend at Arrowhead', 'Glendale', 'AZ', array[4,5,4,3,4,5,4,3,4,5,4,4,4,3,4,3,4,5]::int[], array[11,3,15,17,5,1,9,13,7,4,18,8,12,16,10,14,6,2]::int[]),
  ('the-500-club-the-500', 'The 500 Club', 'Glendale', 'AZ', array[4,5,4,4,3,4,4,3,5,5,3,4,3,4,4,4,4,5]::int[], array[1,3,5,7,9,11,13,15,17,2,4,6,8,10,12,14,16,18]::int[]),
  ('coldwater-golf-club', 'Coldwater Golf Club', 'Avondale', 'AZ', array[4,5,4,4,3,5,4,3,4,4,5,4,4,3,4,3,4,5]::int[], array[10,4,2,18,12,6,16,14,8,5,1,7,9,17,15,11,13,3]::int[]),
  ('wigwam-resort-heritage', 'Wigwam Golf Club - Heritage Course', 'Litchfield Park', 'AZ', array[4,3,4,5,3,5,4,4,4,4,4,3,5,4,4,4,3,5]::int[], array[11,9,1,15,17,7,3,13,5,14,12,18,16,10,8,2,6,4]::int[]),
  ('copper-canyon-golf-club', 'Copper Canyon Golf Club', 'Buckeye', 'AZ', array[4,4,4,3,5,4,3,4,5,4,3,5,4,4,4,3,4,5]::int[], array[9,13,1,17,7,5,15,11,3,2,18,6,14,12,4,16,10,8]::int[]),
  ('rancho-de-los-caballeros-golf-club', 'Los Caballeros Golf Club', 'Wickenburg', 'AZ', array[4,4,3,4,5,4,5,3,4,4,4,3,5,4,3,4,4,5]::int[], array[11,9,17,15,5,7,1,13,3,14,16,18,4,10,12,2,6,8]::int[]),
  ('wickenburg-country-club', 'Wickenburg Country Club', 'Wickenburg', 'AZ', array[4,5,3,4,4,4,4,4,4,4,4,5,4,3,4,3,3,5]::int[], array[13,11,9,1,7,17,15,3,5,6,14,12,2,4,16,18,8,10]::int[]),
  ('anthem-golf-country-club-persimmon', 'Anthem Golf and Country Club - Persimmon Course', 'Anthem', 'AZ', array[4,3,5,4,4,4,3,5,4,4,5,4,3,4,4,5,3,4]::int[], array[14,16,2,6,10,4,18,8,12,15,3,9,13,7,5,1,17,11]::int[]),
  ('anthem-golf-country-club-ironwood', 'Anthem Golf and Country Club - Ironwood Course', 'Anthem', 'AZ', array[4,4,5,3,4,5,4,3,4,4,3,5,4,4,4,4,3,5]::int[], array[6,4,2,16,10,8,14,18,12,3,13,1,5,9,11,7,17,15]::int[]),
  ('dove-valley-ranch-golf-club', 'Dove Valley Ranch Golf Club', 'Cave Creek', 'AZ', array[5,4,3,4,4,3,4,5,4,4,4,4,3,4,5,3,5,4]::int[], array[9,3,17,11,13,15,5,1,7,6,2,12,18,14,4,16,10,8]::int[]),
  ('tatum-ranch-golf-club', 'Tatum Ranch Golf Club', 'Cave Creek', 'AZ', array[4,4,3,5,4,5,4,3,4,4,3,4,4,5,4,3,5,4]::int[], array[7,17,15,3,1,13,9,11,5,2,12,18,16,10,4,14,8,6]::int[]),
  ('terravita-golf-club', 'Terravita Golf and Country Club', 'Scottsdale', 'AZ', array[4,4,5,3,4,4,5,3,4,4,3,5,4,5,4,3,4,4]::int[], array[12,8,2,14,10,4,6,18,16,1,11,7,9,3,5,15,17,13]::int[]),
  ('legend-trail-golf-club', 'Legend Trail Golf Club', 'Scottsdale', 'AZ', array[4,4,4,5,3,4,5,3,4,4,4,3,4,4,3,5,5,4]::int[], array[11,7,5,1,17,15,3,13,9,6,2,12,4,16,18,8,14,10]::int[]),
  ('the-boulders-golf-club-north', 'Boulders Resort - North Course', 'Carefree', 'AZ', array[5,3,5,4,4,3,4,4,4,4,4,5,4,3,5,4,3,4]::int[], array[6,18,4,10,2,16,12,8,14,1,9,5,3,15,13,7,17,11]::int[]),
  ('the-boulders-golf-club-south', 'Boulders Resort - South Course', 'Carefree', 'AZ', array[4,3,4,4,5,4,3,4,4,3,5,4,4,5,3,3,4,5]::int[], array[9,13,7,1,3,15,17,5,11,12,2,16,10,6,18,14,8,4]::int[]),
  ('wigwam-resort-gold', 'Wigwam Golf Club - Gold Course', 'Litchfield Park', 'AZ', array[5,4,3,5,4,3,4,4,4,5,3,4,4,5,4,3,4,4]::int[], array[11,3,7,15,9,17,13,1,5,4,8,14,12,18,10,16,2,6]::int[]),
  ('wigwam-resort-patriot', 'Wigwam Golf Club - Patriot Course', 'Litchfield Park', 'AZ', array[5,3,5,3,5,4,4,4,3,5,4,4,3,4,3,4,3,4]::int[], array[5,7,17,9,13,3,15,1,11,4,16,12,6,18,8,10,14,2]::int[]),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'Scottsdale', 'AZ', array[5,4,3,4,4,4,3,4,5,4,5,3,4,4,3,5,3,5]::int[], array[11,5,17,1,13,3,9,7,15,4,18,10,8,2,16,6,14,12]::int[]),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'Scottsdale', 'AZ', array[4,4,5,4,3,4,4,3,5,4,4,3,4,3,5,4,5,4]::int[], array[2,18,12,6,4,14,10,16,8,1,5,15,9,17,3,11,13,7]::int[]),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'Scottsdale', 'AZ', array[5,4,4,3,4,4,3,4,5,4,3,5,4,4,5,4,4,3]::int[], array[9,3,1,13,7,5,15,11,17,2,10,14,4,16,18,6,12,8]::int[]),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'Surprise', 'AZ', array[4,4,3,5,4,4,3,4,5,4,5,4,3,4,4,4,3,5]::int[], array[5,15,13,7,1,17,9,3,11,12,14,2,16,10,6,18,8,4]::int[]),
  ('desert-mountain-golf-club-renegade', 'Desert Mountain Club - Renegade Course', 'Scottsdale', 'AZ', array[4,4,4,3,5,3,4,4,5,5,4,3,4,3,5,3,5,4]::int[], array[5,7,1,3,11,15,17,9,13,6,12,16,8,18,2,14,4,10]::int[])
), deduped_course_seed as (
  select distinct on (course_key, city, state) course_key, course_name, city, state, pars, hcps
  from course_seed
  order by course_key, city, state, course_name
), tee_seed(course_key, course_name, tee_name, tee_color, gender, course_rating, slope_rating, total_yards, source_url) as (
values
  ('palmbrook-country-club', 'Palmbrook Country Club', 'Gold', 'Gold', 'M', 71.5, 125, 6857, 'https://www.golfify.io/courses/palmbrook-country-club'),
  ('palmbrook-country-club', 'Palmbrook Country Club', 'Black', 'Black', 'M', 70.1, 120, 6529, 'https://www.golfify.io/courses/palmbrook-country-club'),
  ('palmbrook-country-club', 'Palmbrook Country Club', 'Silver', 'Silver', 'M', 69.2, 115, 6300, 'https://www.golfify.io/courses/palmbrook-country-club'),
  ('palmbrook-country-club', 'Palmbrook Country Club', 'Navy', 'Navy', 'M', 65.5, 109, 5490, 'https://www.golfify.io/courses/palmbrook-country-club'),
  ('palmbrook-country-club', 'Palmbrook Country Club', 'Copper', 'Brown', 'F', 68, 111, 5111, 'https://www.golfify.io/courses/palmbrook-country-club'),
  ('willowcreek-golf-course', 'Willowcreek Golf Course', 'White', 'White', 'M', 57.8, 89, 3800, 'https://www.golfify.io/courses/willowcreek-golf-course-willowbrook'),
  ('willowcreek-golf-course', 'Willowcreek Golf Course', 'Red', 'Red', 'F', 58.6, 89, 3414, 'https://www.golfify.io/courses/willowcreek-golf-course-willowbrook'),
  ('willowbrook-golf-course', 'Willowbrook Golf Course', 'White', 'White', 'M', 57.8, 89, 3800, 'https://www.golfify.io/courses/willowcreek-golf-course-willowbrook'),
  ('willowbrook-golf-course', 'Willowbrook Golf Course', 'Red', 'Red', 'F', 58.6, 89, 3414, 'https://www.golfify.io/courses/willowcreek-golf-course-willowbrook'),
  ('desert-trails-golf-course', 'Desert Trails Golf Course', 'Blue', 'Blue', 'M', 59.6, 89, 4027, 'https://www.golfify.io/courses/desert-trails-golf-course'),
  ('desert-trails-golf-course', 'Desert Trails Golf Course', 'White', 'White', 'M', 58.4, 88, 3696, 'https://www.golfify.io/courses/desert-trails-golf-course'),
  ('desert-trails-golf-course', 'Desert Trails Golf Course', 'Red', 'Red', 'M', 56.1, 78, 3090, 'https://www.golfify.io/courses/desert-trails-golf-course'),
  ('echo-mesa-golf-course', 'Echo Mesa Golf Course', 'Blue', 'Blue', 'M', 60.6, 96, 4157, 'https://www.golfify.io/courses/echo-mesa-golf-course'),
  ('echo-mesa-golf-course', 'Echo Mesa Golf Course', 'White', 'White', 'M', 58.5, 90, 3512, 'https://www.golfify.io/courses/echo-mesa-golf-course'),
  ('echo-mesa-golf-course', 'Echo Mesa Golf Course', 'Red', 'Red', 'M', 56.1, 86, 3005, 'https://www.golfify.io/courses/echo-mesa-golf-course'),
  ('grandview-golf-course', 'Grandview Golf Course', 'Blue', 'Blue', 'M', 72.3, 129, 6775, 'https://www.golfify.io/courses/grandview-golf-course'),
  ('grandview-golf-course', 'Grandview Golf Course', 'White', 'White', 'M', 70.3, 124, 6365, 'https://www.golfify.io/courses/grandview-golf-course'),
  ('grandview-golf-course', 'Grandview Golf Course', 'Gold', 'Gold', 'M', 67.3, 119, 5805, 'https://www.golfify.io/courses/grandview-golf-course'),
  ('grandview-golf-course', 'Grandview Golf Course', 'Red', 'Red', 'F', 71.4, 115, 5598, 'https://www.golfify.io/courses/grandview-golf-course'),
  ('grandview-golf-course', 'Grandview Golf Course', 'Green', 'Green', 'M', 61.3, 108, 4330, 'https://www.golfify.io/courses/grandview-golf-course'),
  ('stardust-golf-course', 'Stardust Golf Course', 'Blue', 'Blue', 'M', 60.6, 96, 4267, 'https://www.golfify.io/courses/stardust-golf-course'),
  ('stardust-golf-course', 'Stardust Golf Course', 'White', 'White', 'M', 59.5, 94, 3954, 'https://www.golfify.io/courses/stardust-golf-course'),
  ('stardust-golf-course', 'Stardust Golf Course', 'Red', 'Red', 'M', 59, 86, 3489, 'https://www.golfify.io/courses/stardust-golf-course'),
  ('arizona-traditions-golf-club', 'Arizona Traditions Golf Club', 'Black', 'Black', 'M', 68.7, 115, 6235, 'https://www.golfify.io/courses/arizona-traditions-golf-club'),
  ('arizona-traditions-golf-club', 'Arizona Traditions Golf Club', 'Copper', 'Brown', 'M', 67.5, 110, 5908, 'https://www.golfify.io/courses/arizona-traditions-golf-club'),
  ('arizona-traditions-golf-club', 'Arizona Traditions Golf Club', 'White', 'White', 'M', 65.6, 107, 5701, 'https://www.golfify.io/courses/arizona-traditions-golf-club'),
  ('arizona-traditions-golf-club', 'Arizona Traditions Golf Club', 'Yellow', 'Yellow', 'M', 63.3, 100, 5050, 'https://www.golfify.io/courses/arizona-traditions-golf-club'),
  ('arizona-traditions-golf-club', 'Arizona Traditions Golf Club', 'Red', 'Red', 'M', 63.3, 97, 4350, 'https://www.golfify.io/courses/arizona-traditions-golf-club'),
  ('great-eagle-golf-club', 'Great Eagle Golf Club', 'Black', 'Black', 'M', 71.3, 124, 6683, 'https://www.golfify.io/courses/great-eagle-golf-club'),
  ('great-eagle-golf-club', 'Great Eagle Golf Club', 'Copper', 'Brown', 'M', 67.9, 118, 6348, 'https://www.golfify.io/courses/great-eagle-golf-club'),
  ('great-eagle-golf-club', 'Great Eagle Golf Club', 'White', 'White', 'M', 68.3, 117, 6006, 'https://www.golfify.io/courses/great-eagle-golf-club'),
  ('great-eagle-golf-club', 'Great Eagle Golf Club', 'Yellow', 'Yellow', 'M', 68.7, 113, 5642, 'https://www.golfify.io/courses/great-eagle-golf-club'),
  ('trilogy-golf-club-at-vistancia', 'Trilogy Golf Club at Vistancia', 'Tournament', 'Black', 'M', 73.6, 135, 7291, 'https://www.golfify.io/courses/trilogy-golf-club-at-vistancia'),
  ('trilogy-golf-club-at-vistancia', 'Trilogy Golf Club at Vistancia', 'Trilogy', 'Gold', 'M', 72.1, 128, 6868, 'https://www.golfify.io/courses/trilogy-golf-club-at-vistancia'),
  ('trilogy-golf-club-at-vistancia', 'Trilogy Golf Club at Vistancia', 'Vistancia', 'White', 'M', 70.6, 124, 6508, 'https://www.golfify.io/courses/trilogy-golf-club-at-vistancia'),
  ('trilogy-golf-club-at-vistancia', 'Trilogy Golf Club at Vistancia', 'Vistancia/Verde', 'Turquoise', 'M', 69.6, 122, 6307, 'https://www.golfify.io/courses/trilogy-golf-club-at-vistancia'),
  ('trilogy-golf-club-at-vistancia', 'Trilogy Golf Club at Vistancia', 'Verde', 'Green', 'F', 75.2, 137, 6132, 'https://www.golfify.io/courses/trilogy-golf-club-at-vistancia'),
  ('trilogy-golf-club-at-vistancia', 'Trilogy Golf Club at Vistancia', 'Forward', 'Red', 'F', 71.9, 127, 5573, 'https://www.golfify.io/courses/trilogy-golf-club-at-vistancia'),
  ('copper-canyon-golf-club', 'Copper Canyon Golf Club', 'Black', 'Black', 'M', 71.7, 127, 6845, 'https://www.golfify.io/courses/copper-canyon-golf-club'),
  ('copper-canyon-golf-club', 'Copper Canyon Golf Club', 'Copper', 'Brown', 'M', 69.4, 122, 6399, 'https://www.golfify.io/courses/copper-canyon-golf-club'),
  ('copper-canyon-golf-club', 'Copper Canyon Golf Club', 'Silver', 'silver', 'M', 66.9, 117, 5945, 'https://www.golfify.io/courses/copper-canyon-golf-club'),
  ('copper-canyon-golf-club', 'Copper Canyon Golf Club', 'Jade', 'Green', 'M', 67.5, 109, 5208, 'https://www.golfify.io/courses/copper-canyon-golf-club'),
  ('copper-canyon-golf-club', 'Copper Canyon Golf Club', 'Jade', 'Green', 'F', 67.9, 116, 5208, 'https://www.golfify.io/courses/copper-canyon-golf-club'),
  ('arrowhead-country-club', 'Arrowhead Country Club', 'Professional', 'Professional', 'M', 73.1, 123, 7001, 'https://www.golfify.io/courses/arrowhead-country-club-glendale'),
  ('arrowhead-country-club', 'Arrowhead Country Club', 'Championship', 'Championship', 'M', 70.9, 122, 6548, 'https://www.golfify.io/courses/arrowhead-country-club-glendale'),
  ('arrowhead-country-club', 'Arrowhead Country Club', 'Player''s Course', 'Player''s Course', 'M', 70.6, 121, 6522, 'https://www.golfify.io/courses/arrowhead-country-club-glendale'),
  ('arrowhead-country-club', 'Arrowhead Country Club', 'Back', 'Back', 'M', 69.7, 120, 6302, 'https://www.golfify.io/courses/arrowhead-country-club-glendale'),
  ('arrowhead-country-club', 'Arrowhead Country Club', 'Middle', 'Middle', 'F', 73.8, 129, 5750, 'https://www.golfify.io/courses/arrowhead-country-club-glendale'),
  ('arrowhead-country-club', 'Arrowhead Country Club', 'Mixed', 'Mixed', 'F', 72.1, 127, 5533, 'https://www.golfify.io/courses/arrowhead-country-club-glendale'),
  ('arrowhead-country-club', 'Arrowhead Country Club', 'Forward', 'Forward', 'F', 70.9, 125, 5282, 'https://www.golfify.io/courses/arrowhead-country-club-glendale'),
  ('the-legend-at-arrowhead', 'The Legend at Arrowhead', 'Palmer', 'Palmer', 'M', 73.1, 131, 6974, 'https://www.golfify.io/courses/the-legend-at-arrowhead'),
  ('the-legend-at-arrowhead', 'The Legend at Arrowhead', 'Back', 'Back', 'M', 70.7, 125, 6509, 'https://www.golfify.io/courses/the-legend-at-arrowhead'),
  ('the-legend-at-arrowhead', 'The Legend at Arrowhead', 'Middle', 'Middle', 'M', 68.4, 117, 6013, 'https://www.golfify.io/courses/the-legend-at-arrowhead'),
  ('the-legend-at-arrowhead', 'The Legend at Arrowhead', 'Forward', 'Forward', 'F', 70.1, 120, 5233, 'https://www.golfify.io/courses/the-legend-at-arrowhead'),
  ('desert-springs-golf-course', 'Desert Springs Golf Course', 'Championship', 'Blue', 'M', 71.9, 123, 7006, 'https://www.golfify.io/courses/desert-springs-golf-club-surprise'),
  ('desert-springs-golf-course', 'Desert Springs Golf Course', 'Grand', 'White', 'M', 69.3, 118, 6306, 'https://www.golfify.io/courses/desert-springs-golf-club-surprise'),
  ('desert-springs-golf-course', 'Desert Springs Golf Course', 'Vintage', 'Gold', 'M', 66.7, 110, 5791, 'https://www.golfify.io/courses/desert-springs-golf-club-surprise'),
  ('desert-springs-golf-course', 'Desert Springs Golf Course', 'Vintage (L)', 'Red', 'F', 72.3, 117, 5283, 'https://www.golfify.io/courses/desert-springs-golf-club-surprise'),
  ('desert-springs-golf-course', 'Desert Springs Golf Course', 'Forward', 'Orange', 'F', 68.8, 113, 4217, 'https://www.golfify.io/courses/desert-springs-golf-club-surprise'),
  ('desert-springs-golf-course', 'Desert Springs Golf Course', 'Forward (L)', 'Red', 'F', 68.8, 113, 5283, 'https://www.golfify.io/courses/desert-springs-golf-club-surprise'),
  ('blackstone-country-club', 'Blackstone Country Club', 'Black', 'Black', 'M', 73.1, 136, 7089, 'https://www.golfify.io/courses/blackstone-country-club'),
  ('blackstone-country-club', 'Blackstone Country Club', 'Black/Blue', 'Purple', 'M', 70.9, 132, 6679, 'https://www.golfify.io/courses/blackstone-country-club'),
  ('blackstone-country-club', 'Blackstone Country Club', 'Blue', 'Blue', 'M', 69.5, 129, 6360, 'https://www.golfify.io/courses/blackstone-country-club'),
  ('blackstone-country-club', 'Blackstone Country Club', 'Blue/White', 'Turquoise', 'M', 67.8, 111, 6009, 'https://www.golfify.io/courses/blackstone-country-club'),
  ('blackstone-country-club', 'Blackstone Country Club', 'White', 'White', 'M', 65.7, 107, 5535, 'https://www.golfify.io/courses/blackstone-country-club'),
  ('blackstone-country-club', 'Blackstone Country Club', 'White/Red', 'Pink', 'F', 69.1, 120, 5013, 'https://www.golfify.io/courses/blackstone-country-club'),
  ('blackstone-country-club', 'Blackstone Country Club', 'Red', 'Red', 'F', 68.1, 107, 4738, 'https://www.golfify.io/courses/blackstone-country-club'),
  ('westbrook-village-golf-club-lakes-course', 'Westbrook Village Golf Club (Lakes Course)', 'Blue', 'Blue', 'M', 70.1, 122, 6412, 'https://www.golfify.io/courses/westbrook-village-golf-club-lakes'),
  ('westbrook-village-golf-club-lakes-course', 'Westbrook Village Golf Club (Lakes Course)', 'White', 'White', 'M', 68.4, 116, 6016, 'https://www.golfify.io/courses/westbrook-village-golf-club-lakes'),
  ('westbrook-village-golf-club-lakes-course', 'Westbrook Village Golf Club (Lakes Course)', 'Red 5380', 'Red', 'F', 69.6, 115, 5380, 'https://www.golfify.io/courses/westbrook-village-golf-club-lakes'),
  ('westbrook-village-golf-club-lakes-course', 'Westbrook Village Golf Club (Lakes Course)', 'Red 5333', 'Red', 'F', 69.4, 114, 5333, 'https://www.golfify.io/courses/westbrook-village-golf-club-lakes'),
  ('westbrook-village-golf-club-vistas-course', 'Westbrook Village Golf Club (Vistas Course)', 'Blue', 'Blue', 'M', 70.1, 122, 6412, 'https://www.golfify.io/courses/westbrook-village-golf-club-vistas'),
  ('westbrook-village-golf-club-vistas-course', 'Westbrook Village Golf Club (Vistas Course)', 'White', 'White', 'M', 68.4, 116, 6016, 'https://www.golfify.io/courses/westbrook-village-golf-club-vistas'),
  ('westbrook-village-golf-club-vistas-course', 'Westbrook Village Golf Club (Vistas Course)', 'Red 5380', 'Red', 'F', 69.6, 115, 5380, 'https://www.golfify.io/courses/westbrook-village-golf-club-vistas'),
  ('westbrook-village-golf-club-vistas-course', 'Westbrook Village Golf Club (Vistas Course)', 'Red 5151', 'Red', 'F', 68.7, 110, 5151, 'https://www.golfify.io/courses/westbrook-village-golf-club-vistas'),
  ('westbrook-village-golf-club-vistas-course', 'Westbrook Village Golf Club (Vistas Course)', 'Red 5235', 'Red', 'F', 68.3, 107, 5235, 'https://www.golfify.io/courses/westbrook-village-golf-club-vistas'),
  ('coldwater-golf-club', 'Coldwater Golf Club', 'Deep End', 'Black', 'M', 71.5, 120, 6758, 'https://www.golfify.io/courses/coldwater-golf-club'),
  ('coldwater-golf-club', 'Coldwater Golf Club', 'Coldwater', 'Blue', 'M', 69.7, 113, 6305, 'https://www.golfify.io/courses/coldwater-golf-club'),
  ('coldwater-golf-club', 'Coldwater Golf Club', 'Vintage', 'Green', 'M', 67, 108, 5798, 'https://www.golfify.io/courses/coldwater-golf-club'),
  ('coldwater-golf-club', 'Coldwater Golf Club', 'Upstream', 'Brown', 'M', 68.6, 111, 5147, 'https://www.golfify.io/courses/coldwater-golf-club'),
  ('coldwater-golf-club', 'Coldwater Golf Club', 'Upstream', 'Red', 'F', 69.4, 114, 5147, 'https://www.golfify.io/courses/coldwater-golf-club'),
  ('wickenburg-country-club', 'Wickenburg Country Club', 'Back', 'Black', 'M', 70.5, 128, 6320, 'https://www.golfify.io/courses/wickenburg-country-club'),
  ('wickenburg-country-club', 'Wickenburg Country Club', 'Middle', 'White', 'M', 67.2, 121, 5562, 'https://www.golfify.io/courses/wickenburg-country-club'),
  ('wickenburg-country-club', 'Wickenburg Country Club', 'Forward', 'Red', 'F', 67.6, 105, 4674, 'https://www.golfify.io/courses/wickenburg-country-club'),
  ('dove-valley-ranch-golf-club', 'Dove Valley Ranch Golf Club', 'Black', 'Black', 'M', 72.7, 131, 7011, 'https://www.golfify.io/courses/dove-valley-ranch-golf-club'),
  ('dove-valley-ranch-golf-club', 'Dove Valley Ranch Golf Club', 'Gold', 'Gold', 'M', 69.6, 120, 6630, 'https://www.golfify.io/courses/dove-valley-ranch-golf-club'),
  ('dove-valley-ranch-golf-club', 'Dove Valley Ranch Golf Club', 'White', 'White', 'M', 66.8, 117, 6138, 'https://www.golfify.io/courses/dove-valley-ranch-golf-club'),
  ('dove-valley-ranch-golf-club', 'Dove Valley Ranch Golf Club', 'Green', 'Green', 'F', 70.5, 114, 5337, 'https://www.golfify.io/courses/dove-valley-ranch-golf-club'),
  ('tatum-ranch-golf-club', 'Tatum Ranch Golf Club', 'Championship', 'Green', 'M', 72.7, 135, 6856, 'https://www.golfify.io/courses/tatum-ranch-golf-club'),
  ('tatum-ranch-golf-club', 'Tatum Ranch Golf Club', 'Players', 'Blue', 'M', 71.7, 127, 6601, 'https://www.golfify.io/courses/tatum-ranch-golf-club'),
  ('tatum-ranch-golf-club', 'Tatum Ranch Golf Club', 'Back', 'Gold', 'M', 70.9, 122, 6344, 'https://www.golfify.io/courses/tatum-ranch-golf-club'),
  ('tatum-ranch-golf-club', 'Tatum Ranch Golf Club', 'Middle', 'Black', 'M', 68.4, 114, 5851, 'https://www.golfify.io/courses/tatum-ranch-golf-club'),
  ('tatum-ranch-golf-club', 'Tatum Ranch Golf Club', 'Championship (L)', 'Black', 'F', 74.3, 131, 5851, 'https://www.golfify.io/courses/tatum-ranch-golf-club'),
  ('tatum-ranch-golf-club', 'Tatum Ranch Golf Club', 'Standard', 'Gold', 'F', 71.4, 117, 5384, 'https://www.golfify.io/courses/tatum-ranch-golf-club'),
  ('tatum-ranch-golf-club', 'Tatum Ranch Golf Club', 'Forward', 'Silver', 'F', 69.6, 115, 5081, 'https://www.golfify.io/courses/tatum-ranch-golf-club'),
  ('legend-trail-golf-club', 'Legend Trail Golf Club', 'Black', 'Black', 'M', 71.8, 138, 6845, 'https://www.golfify.io/courses/legend-trail-golf-club'),
  ('legend-trail-golf-club', 'Legend Trail Golf Club', 'Silver', 'Silver', 'M', 69.3, 130, 6400, 'https://www.golfify.io/courses/legend-trail-golf-club'),
  ('legend-trail-golf-club', 'Legend Trail Golf Club', 'Copper', 'Brown', 'M', 67.8, 125, 6055, 'https://www.golfify.io/courses/legend-trail-golf-club'),
  ('legend-trail-golf-club', 'Legend Trail Golf Club', 'Copper (L)', 'Copper', 'F', 74.6, 137, 6055, 'https://www.golfify.io/courses/legend-trail-golf-club'),
  ('legend-trail-golf-club', 'Legend Trail Golf Club', 'Sandstone', 'White', 'M', 68.2, 122, 5465, 'https://www.golfify.io/courses/legend-trail-golf-club'),
  ('legend-trail-golf-club', 'Legend Trail Golf Club', 'Sandstone', 'Pink', 'F', 71, 129, 5465, 'https://www.golfify.io/courses/legend-trail-golf-club'),
  ('legend-trail-golf-club', 'Legend Trail Golf Club', 'Sage', 'Green', 'F', 69, 114, 4910, 'https://www.golfify.io/courses/legend-trail-golf-club'),
  ('sun-village-golf', 'Sun Village Golf Course', 'Blue', 'Blue', 'M', 50.8, 64, 2019, 'https://www.golfify.io/courses/sun-village-golf'),
  ('sun-village-golf', 'Sun Village Golf Course', 'White', 'White', 'M', 50.4, 63, 1876, 'https://www.golfify.io/courses/sun-village-golf'),
  ('sun-village-golf', 'Sun Village Golf Course', 'Red', 'Red', 'M', 50, 63, 1610, 'https://www.golfify.io/courses/sun-village-golf'),
  ('peoria-pines-golf-restaurant', 'Peoria Pines Golf and Restaurant', 'Blue', 'Blue', 'M', 61.1, 100, 4412, 'https://www.golfify.io/courses/peoria-pines-golf-restaurant'),
  ('peoria-pines-golf-restaurant', 'Peoria Pines Golf and Restaurant', 'White', 'White', 'M', 59.4, 94, 3940, 'https://www.golfify.io/courses/peoria-pines-golf-restaurant'),
  ('peoria-pines-golf-restaurant', 'Peoria Pines Golf and Restaurant', 'Red', 'Red', 'M', 57.7, 85, 3341, 'https://www.golfify.io/courses/peoria-pines-golf-restaurant'),
  ('the-500-club-the-500', 'The 500 Club', 'Championship', 'Blue', 'M', 72.2, 122, 6803, 'https://www.golfify.io/courses/the-500-club-the-500'),
  ('the-500-club-the-500', 'The 500 Club', 'Regular', 'White', 'M', 69, 118, 6152, 'https://www.golfify.io/courses/the-500-club-the-500'),
  ('the-500-club-the-500', 'The 500 Club', 'Forward', 'Red', 'F', 71.3, 125, 5528, 'https://www.golfify.io/courses/the-500-club-the-500'),
  ('wigwam-resort-heritage', 'Wigwam Golf Club - Heritage Course', 'Championship', 'Blue', 'M', 71.9, 124, 6852, 'https://www.golfify.io/courses/wigwam-resort-heritage'),
  ('wigwam-resort-heritage', 'Wigwam Golf Club - Heritage Course', 'Club', 'Orange', 'M', 69.3, 117, 6291, 'https://www.golfify.io/courses/wigwam-resort-heritage'),
  ('wigwam-resort-heritage', 'Wigwam Golf Club - Heritage Course', 'Forward', 'Yellow', 'M', 71.7, 122, 5806, 'https://www.golfify.io/courses/wigwam-resort-heritage'),
  ('rancho-de-los-caballeros-golf-club', 'Los Caballeros Golf Club', 'Black', 'Black', 'M', 73.1, 137, 7020, 'https://www.golfify.io/courses/rancho-de-los-caballeros-golf-club'),
  ('rancho-de-los-caballeros-golf-club', 'Los Caballeros Golf Club', 'Blue', 'Blue', 'M', 71.7, 134, 6626, 'https://www.golfify.io/courses/rancho-de-los-caballeros-golf-club'),
  ('rancho-de-los-caballeros-golf-club', 'Los Caballeros Golf Club', 'White', 'White', 'M', 70.1, 130, 6277, 'https://www.golfify.io/courses/rancho-de-los-caballeros-golf-club'),
  ('rancho-de-los-caballeros-golf-club', 'Los Caballeros Golf Club', 'Gold', 'Gold', 'M', 68.2, 125, 5867, 'https://www.golfify.io/courses/rancho-de-los-caballeros-golf-club'),
  ('rancho-de-los-caballeros-golf-club', 'Los Caballeros Golf Club', 'Gold (L)', 'Gold', 'F', 74.3, 137, 5867, 'https://www.golfify.io/courses/rancho-de-los-caballeros-golf-club'),
  ('rancho-de-los-caballeros-golf-club', 'Los Caballeros Golf Club', 'Red', 'Red', 'F', 70.5, 129, 5264, 'https://www.golfify.io/courses/rancho-de-los-caballeros-golf-club'),
  ('anthem-golf-country-club-persimmon', 'Anthem Golf and Country Club - Persimmon Course', 'The Rocks', 'Black', 'M', 74.9, 141, 7221, 'https://www.golfify.io/courses/anthem-golf-country-club-persimmon'),
  ('anthem-golf-country-club-persimmon', 'Anthem Golf and Country Club - Persimmon Course', 'Black', 'Black', 'M', 72.6, 139, 6852, 'https://www.golfify.io/courses/anthem-golf-country-club-persimmon'),
  ('anthem-golf-country-club-persimmon', 'Anthem Golf and Country Club - Persimmon Course', 'Blue', 'Blue', 'M', 71.1, 137, 6574, 'https://www.golfify.io/courses/anthem-golf-country-club-persimmon'),
  ('anthem-golf-country-club-persimmon', 'Anthem Golf and Country Club - Persimmon Course', 'White', 'White', 'M', 69.5, 131, 6292, 'https://www.golfify.io/courses/anthem-golf-country-club-persimmon'),
  ('anthem-golf-country-club-persimmon', 'Anthem Golf and Country Club - Persimmon Course', 'Green', 'Green', 'M', 66.9, 125, 5764, 'https://www.golfify.io/courses/anthem-golf-country-club-persimmon'),
  ('anthem-golf-country-club-persimmon', 'Anthem Golf and Country Club - Persimmon Course', 'Red', 'Red', 'F', 70.8, 124, 5379, 'https://www.golfify.io/courses/anthem-golf-country-club-persimmon'),
  ('anthem-golf-country-club-ironwood', 'Anthem Golf and Country Club - Ironwood Course', 'The Rocks', 'Black', 'M', 74.8, 146, 7253, 'https://www.golfify.io/courses/anthem-golf-country-club-ironwood'),
  ('anthem-golf-country-club-ironwood', 'Anthem Golf and Country Club - Ironwood Course', 'Black', 'Black', 'M', 72.2, 137, 6802, 'https://www.golfify.io/courses/anthem-golf-country-club-ironwood'),
  ('anthem-golf-country-club-ironwood', 'Anthem Golf and Country Club - Ironwood Course', 'Blue', 'Blue', 'M', 71.1, 135, 6448, 'https://www.golfify.io/courses/anthem-golf-country-club-ironwood'),
  ('anthem-golf-country-club-ironwood', 'Anthem Golf and Country Club - Ironwood Course', 'White', 'White', 'M', 69.5, 130, 6111, 'https://www.golfify.io/courses/anthem-golf-country-club-ironwood'),
  ('anthem-golf-country-club-ironwood', 'Anthem Golf and Country Club - Ironwood Course', 'Green', 'Green', 'M', 67.1, 122, 5649, 'https://www.golfify.io/courses/anthem-golf-country-club-ironwood'),
  ('anthem-golf-country-club-ironwood', 'Anthem Golf and Country Club - Ironwood Course', 'Red', 'Red', 'F', 71.6, 125, 5405, 'https://www.golfify.io/courses/anthem-golf-country-club-ironwood'),
  ('terravita-golf-club', 'Terravita Golf and Country Club', 'Black', 'Black', 'M', 73.4, 142, 7075, 'https://www.golfify.io/courses/terravita-golf-club'),
  ('terravita-golf-club', 'Terravita Golf and Country Club', 'Blue', 'Blue', 'M', 71.3, 133, 6589, 'https://www.golfify.io/courses/terravita-golf-club'),
  ('terravita-golf-club', 'Terravita Golf and Country Club', 'White', 'White', 'M', 69, 127, 6114, 'https://www.golfify.io/courses/terravita-golf-club'),
  ('terravita-golf-club', 'Terravita Golf and Country Club', 'Burgundy (L)', 'Red', 'F', 72.9, 126, 5615, 'https://www.golfify.io/courses/terravita-golf-club'),
  ('terravita-golf-club', 'Terravita Golf and Country Club', 'Gold 5284', 'Gold', 'F', 71, 122, 5284, 'https://www.golfify.io/courses/terravita-golf-club'),
  ('terravita-golf-club', 'Terravita Golf and Country Club', 'Gold 5367', 'Gold', 'F', 71.9, 126, 5367, 'https://www.golfify.io/courses/terravita-golf-club'),
  ('the-boulders-golf-club-north', 'Boulders Resort - North Course', 'Black', 'Black', 'M', 73.3, 138, 6959, 'https://www.golfify.io/courses/the-boulders-golf-club-north'),
  ('the-boulders-golf-club-north', 'Boulders Resort - North Course', 'Blue', 'Blue', 'M', 72.6, 139, 6811, 'https://www.golfify.io/courses/the-boulders-golf-club-north'),
  ('the-boulders-golf-club-north', 'Boulders Resort - North Course', 'White', 'White', 'M', 70.1, 131, 6311, 'https://www.golfify.io/courses/the-boulders-golf-club-north'),
  ('the-boulders-golf-club-north', 'Boulders Resort - North Course', 'Copper', 'Brown', 'M', 68.3, 123, 5864, 'https://www.golfify.io/courses/the-boulders-golf-club-north'),
  ('the-boulders-golf-club-north', 'Boulders Resort - North Course', 'Gold', 'Gold', 'F', 70.7, 126, 5440, 'https://www.golfify.io/courses/the-boulders-golf-club-north'),
  ('the-boulders-golf-club-north', 'Boulders Resort - North Course', 'Red', 'Red', 'M', 68.1, 116, 4900, 'https://www.golfify.io/courses/the-boulders-golf-club-north'),
  ('the-boulders-golf-club-south', 'Boulders Resort - South Course', 'Black', 'Black', 'M', 72.9, 142, 6917, 'https://www.golfify.io/courses/the-boulders-golf-club-south'),
  ('the-boulders-golf-club-south', 'Boulders Resort - South Course', 'Blue', 'Blue', 'M', 71.8, 142, 6726, 'https://www.golfify.io/courses/the-boulders-golf-club-south'),
  ('the-boulders-golf-club-south', 'Boulders Resort - South Course', 'White', 'White', 'M', 69.9, 135, 6246, 'https://www.golfify.io/courses/the-boulders-golf-club-south'),
  ('the-boulders-golf-club-south', 'Boulders Resort - South Course', 'Copper', 'Brown', 'M', 67.6, 120, 5642, 'https://www.golfify.io/courses/the-boulders-golf-club-south'),
  ('the-boulders-golf-club-south', 'Boulders Resort - South Course', 'Gold', 'Gold', 'F', 70.1, 122, 5119, 'https://www.golfify.io/courses/the-boulders-golf-club-south'),
  ('the-boulders-golf-club-south', 'Boulders Resort - South Course', 'Red', 'Red', 'M', 67.7, 116, 4684, 'https://www.golfify.io/courses/the-boulders-golf-club-south'),
  ('wigwam-resort-gold', 'Wigwam Golf Club - Gold Course', 'Jones', 'Black', 'M', 74.3, 132, 7430, 'https://www.golfify.io/courses/wigwam-resort-gold'),
  ('wigwam-resort-gold', 'Wigwam Golf Club - Gold Course', 'Black/Blue', 'Brown', 'M', 72.7, 129, 7025, 'https://www.golfify.io/courses/wigwam-resort-gold'),
  ('wigwam-resort-gold', 'Wigwam Golf Club - Gold Course', 'Championship', 'Blue', 'M', 71.9, 127, 6830, 'https://www.golfify.io/courses/wigwam-resort-gold'),
  ('wigwam-resort-gold', 'Wigwam Golf Club - Gold Course', 'Club', 'Orange', 'M', 69.8, 121, 6348, 'https://www.golfify.io/courses/wigwam-resort-gold'),
  ('wigwam-resort-gold', 'Wigwam Golf Club - Gold Course', 'Forward', 'Yellow', 'F', 73.5, 123, 5885, 'https://www.golfify.io/courses/wigwam-resort-gold'),
  ('wigwam-resort-patriot', 'Wigwam Golf Club - Patriot Course', 'Jones', 'Black', 'M', 69, 123, 6000, 'https://www.golfify.io/courses/wigwam-resort-patriot'),
  ('wigwam-resort-patriot', 'Wigwam Golf Club - Patriot Course', 'Championship', 'Blue', 'M', 67.1, 117, 5572, 'https://www.golfify.io/courses/wigwam-resort-patriot'),
  ('wigwam-resort-patriot', 'Wigwam Golf Club - Patriot Course', 'Club', 'Orange', 'M', 65.6, 113, 5199, 'https://www.golfify.io/courses/wigwam-resort-patriot'),
  ('wigwam-resort-patriot', 'Wigwam Golf Club - Patriot Course', 'Forward', 'Yellow', 'F', 67, 113, 4791, 'https://www.golfify.io/courses/wigwam-resort-patriot'),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'Bear', 'Black', 'M', 74.1, 136, 7211, 'https://www.golfify.io/courses/desert-mountain-golf-club-apache'),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'Blue', 'Blue', 'M', 72.3, 131, 6860, 'https://www.golfify.io/courses/desert-mountain-golf-club-apache'),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'Copper', 'Brown', 'M', 70.3, 129, 6489, 'https://www.golfify.io/courses/desert-mountain-golf-club-apache'),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'White', 'White', 'M', 69.8, 125, 6220, 'https://www.golfify.io/courses/desert-mountain-golf-club-apache'),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'Red', 'Red', 'M', 66.3, 117, 5596, 'https://www.golfify.io/courses/desert-mountain-golf-club-apache'),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'White', 'White', 'F', 74.1, 128, 6220, 'https://www.golfify.io/courses/desert-mountain-golf-club-apache'),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'Red', 'Red', 'F', 70.7, 120, 5599, 'https://www.golfify.io/courses/desert-mountain-golf-club-apache'),
  ('desert-mountain-golf-club-apache', 'Desert Mountain Club - Apache Course', 'Green', 'Green', 'F', 65.2, 110, 4657, 'https://www.golfify.io/courses/desert-mountain-golf-club-apache'),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'Bear', 'Black', 'M', 75.2, 151, 7347, 'https://www.golfify.io/courses/desert-mountain-golf-club-chiricahua'),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'Blue', 'Blue', 'M', 72.5, 143, 6796, 'https://www.golfify.io/courses/desert-mountain-golf-club-chiricahua'),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'Copper', 'Brown', 'M', 70.1, 141, 6460, 'https://www.golfify.io/courses/desert-mountain-golf-club-chiricahua'),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'White', 'White', 'M', 69.5, 138, 6289, 'https://www.golfify.io/courses/desert-mountain-golf-club-chiricahua'),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'Red', 'Red', 'M', 66.5, 131, 5614, 'https://www.golfify.io/courses/desert-mountain-golf-club-chiricahua'),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'White (L)', 'White', 'F', 76.1, 146, 6289, 'https://www.golfify.io/courses/desert-mountain-golf-club-chiricahua'),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'Red (L)', 'Red', 'F', 72.3, 138, 5614, 'https://www.golfify.io/courses/desert-mountain-golf-club-chiricahua'),
  ('desert-mountain-golf-club-chiricahua', 'Desert Mountain Club - Chiricahua Course', 'Green (L)', 'Green', 'F', 68.8, 127, 5034, 'https://www.golfify.io/courses/desert-mountain-golf-club-chiricahua'),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'Bear', 'Black', 'M', 73.5, 147, 7293, 'https://www.golfify.io/courses/desert-mountain-golf-club-geronimo'),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'Blue', 'Blue', 'M', 72, 142, 6858, 'https://www.golfify.io/courses/desert-mountain-golf-club-geronimo'),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'Copper', 'Brown', 'M', 70, 135, 6441, 'https://www.golfify.io/courses/desert-mountain-golf-club-geronimo'),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'White', 'White', 'M', 68.3, 131, 6071, 'https://www.golfify.io/courses/desert-mountain-golf-club-geronimo'),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'Red', 'Red', 'M', 65.3, 125, 5401, 'https://www.golfify.io/courses/desert-mountain-golf-club-geronimo'),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'White', 'White', 'F', 76.5, 150, 6071, 'https://www.golfify.io/courses/desert-mountain-golf-club-geronimo'),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'Red', 'Red', 'F', 71, 135, 5401, 'https://www.golfify.io/courses/desert-mountain-golf-club-geronimo'),
  ('desert-mountain-golf-club-geronimo', 'Desert Mountain Club - Geronimo Course', 'Green', 'Green', 'F', 66.5, 124, 4590, 'https://www.golfify.io/courses/desert-mountain-golf-club-geronimo'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'Black', 'Black', 'M', 74.1, 133, 7258, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'Black/Blue', 'Black/Blue', 'M', 72.4, 129, 6890, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'Blue', 'Blue', 'M', 70.5, 126, 6485, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'Blue/White', 'Blue/White', 'M', 68.8, 121, 6188, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'White', 'White', 'M', 67.3, 114, 5840, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'White/Red', 'White/Red', 'M', 65.5, 108, 5361, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'Red', 'Red', 'M', 63.5, 98, 4886, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'White', 'White', 'F', 73.2, 126, 5840, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'White/Red', 'White/Red', 'F', 70.0, 120, 5361, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('sterling-grove-golf-and-country-club', 'Sterling Grove Golf and Country Club', 'Red', 'Red', 'F', 67.0, 113, 4886, 'https://www.sterlinggroveclub.com/golf/scorecard'),
  ('desert-mountain-golf-club-renegade', 'Desert Mountain Club - Renegade Course', 'Copper', 'Brown', 'M', 68.0, 126, 6011, 'https://golfscorekeeper.com/view_course.cfm?State=AZ&Course=3350&Country=210'),
  ('desert-mountain-golf-club-renegade', 'Desert Mountain Club - Renegade Course', 'White', 'White', 'M', 67.7, 125, 5956, 'https://golfscorekeeper.com/view_course.cfm?State=AZ&Course=3350&Country=210'),
  ('desert-mountain-golf-club-renegade', 'Desert Mountain Club - Renegade Course', 'Red', 'Red', 'F', 71.1, 136, 5553, 'https://golfscorekeeper.com/view_course.cfm?State=AZ&Course=3350&Country=210')
), deduped_tee_seed as (
  select distinct on (course_key, tee_name, gender) course_key, course_name, tee_name, tee_color, gender, course_rating, slope_rating, total_yards, source_url
  from tee_seed
  order by course_key, tee_name, gender, total_yards desc nulls last
), upsert_courses as (
  insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
  select 'manual_seed', course_key, course_name, course_key, city, state, now() from deduped_course_seed
  on conflict (normalized_name, city, state) do update set name=excluded.name, source_provider=excluded.source_provider, source_course_id=excluded.source_course_id, updated_at=now()
  returning id, normalized_name, city, state
), all_courses as (
  select c.id, s.* from deduped_course_seed s join public.saved_courses c on c.normalized_name=s.course_key and c.city is not distinct from s.city and c.state is not distinct from s.state
), upsert_tees as (
  insert into public.saved_course_tees (course_key, course_name, tee_name, tee_color, gender, course_rating, slope_rating, total_yards, source_url, updated_at)
  select course_key, course_name, tee_name, tee_color, gender, course_rating, slope_rating, total_yards, source_url, now() from deduped_tee_seed
  on conflict (course_key, tee_name, gender) do update set course_name=excluded.course_name, tee_color=excluded.tee_color, course_rating=excluded.course_rating, slope_rating=excluded.slope_rating, total_yards=excluded.total_yards, source_url=excluded.source_url, updated_at=now()
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select c.id, hole_number, c.pars[hole_number], c.hcps[hole_number], now() from all_courses c cross join generate_series(1,18) as hole_number
on conflict (saved_course_id, hole_number) do update set par=excluded.par, handicap_index=excluded.handicap_index, updated_at=now();

select 40 as latest_seed_courses, 202 as latest_seed_tee_rows, 202 as latest_seed_unique_tee_rows;
