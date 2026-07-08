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
  ('sedona-golf-resort', 'Sedona Golf Resort', 'Sedona', 'AZ', array[4,3,5,4,5,4,3,4,5,3,4,5,4,3,4,4,3,4]::int[], array[13,17,15,9,1,7,11,3,5,10,8,4,12,16,2,6,18,14]::int[]),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Sedona', 'AZ', array[5,4,4,3,4,5,3,4,4,5,4,5,3,4,4,3,4,4]::int[], array[3,11,1,17,15,7,13,9,5,14,18,12,8,6,4,16,10,2]::int[]),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Sedona', 'AZ', array[4,3,4,4,5,4,5,4,3,4,4,4,5,3,4,4,3,4]::int[], array[6,18,14,16,2,12,8,4,10,5,11,1,7,17,9,13,15,3]::int[]),
  ('elephant-rocks-golf-course', 'Elephant Rocks Golf Course', 'Williams', 'AZ', array[4,4,3,4,4,4,4,5,4,5,4,3,5,3,4,4,5,3]::int[], array[11,17,13,1,15,5,3,7,9,10,6,16,14,12,8,2,4,18]::int[]),
  ('pinewood-country-club', 'Pinewood Country Club', 'Munds Park', 'AZ', array[4,4,5,3,5,3,4,4,4,5,3,5,4,4,4,3,4,4]::int[], array[1,3,7,9,17,11,13,15,5,16,14,18,10,2,8,12,4,6]::int[]),
  ('prescott-golf-club', 'Prescott Golf Club', 'Dewey', 'AZ', array[4,4,3,4,4,5,3,4,5,4,4,3,5,4,3,4,4,5]::int[], array[13,7,11,5,1,15,9,3,17,12,2,4,18,14,6,10,16,8]::int[]),
  ('stoneridge-golf-course', 'StoneRidge Golf Course', 'Prescott Valley', 'AZ', array[4,5,3,4,4,4,4,3,5,4,4,3,4,4,4,5,3,5]::int[], array[17,1,5,11,9,7,15,13,3,4,8,18,12,6,16,10,14,2]::int[]),
  ('capital-canyon-club', 'Capital Canyon Club', 'Prescott', 'AZ', array[4,4,3,4,5,3,4,5,4,5,3,4,4,5,4,3,3,4]::int[], array[15,3,17,7,1,13,11,9,5,8,18,4,10,12,2,16,14,6]::int[]),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Flagstaff', 'AZ', array[4,4,3,5,4,5,3,4,4,4,4,3,4,4,4,4,3,5]::int[], array[3,13,15,1,7,11,17,5,9,4,18,12,2,10,6,8,16,14]::int[]),
  ('agave-highlands-golf-course', 'Agave Highlands Golf Course', 'Cornville', 'AZ', array[4,3,4,3,4,4,5,4,5,4,4,5,3,3,4,3,4,5]::int[], array[9,17,1,13,5,11,15,3,7,14,2,10,8,18,12,16,4,6]::int[]),
  ('continental-country-club', 'Continental Country Club', 'Flagstaff', 'AZ', array[4,4,5,3,5,4,4,3,5,4,4,4,3,5,3,4,4,5]::int[], array[11,15,13,7,1,17,9,3,5,8,4,2,18,10,16,12,14,6]::int[]),
  ('prescott-lakes-golf-club', 'Prescott Lakes Golf Club', 'Prescott', 'AZ', array[4,4,5,4,3,4,3,5,4,4,5,3,4,4,4,3,4,5]::int[], array[18,16,4,6,14,10,12,2,8,15,17,13,5,11,1,9,3,7]::int[]),
  ('quailwood-greens-golf-course', 'Quailwood Greens Golf Course', 'Dewey', 'AZ', array[5,3,3,4,3,4,3,4,4,4,3,4,3,4,5,3,4,5]::int[], array[3,17,7,9,11,5,15,1,13,16,12,10,14,2,4,18,6,8]::int[]),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club (Canyon Course)', 'Flagstaff', 'AZ', array[4,4,5,3,5,3,4,3,4,3,4,3,5,3,5,4,4,5]::int[], array[9,11,7,13,3,17,5,15,1,14,8,16,2,18,6,10,12,4]::int[]),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club (Meadow Course)', 'Flagstaff', 'AZ', array[4,3,5,4,5,4,4,3,4,4,3,4,4,5,4,4,3,5]::int[], array[11,17,5,9,3,15,7,13,1,12,18,16,8,2,10,4,14,6]::int[]),
  ('talking-rock-golf-club', 'Talking Rock Golf Club', 'Prescott', 'AZ', array[4,4,3,4,4,5,3,4,5,4,5,4,3,4,4,3,4,5]::int[], array[13,5,15,9,3,1,17,7,11,14,10,8,16,6,18,12,4,2]::int[]),
  ('pine-canyon-club', 'Pine Canyon Club', 'Flagstaff', 'AZ', array[4,4,3,5,3,4,5,4,4,4,3,5,4,4,4,5,3,4]::int[], array[5,1,9,13,11,3,15,7,17,8,14,12,18,16,2,6,10,4]::int[]),
  ('payson-golf-club', 'Payson Golf Club', 'Payson', 'AZ', array[5,3,4,5,3,4,4,3,5,4,4,4,4,3,4,4,3,5]::int[], array[9,7,5,3,13,15,11,17,1,14,4,12,2,18,10,8,16,6]::int[]),
  ('the-rim-golf-club', 'The Rim Golf Club', 'Payson', 'AZ', array[4,4,4,3,4,5,4,3,5,4,4,3,5,4,4,4,3,4]::int[], array[11,1,5,17,13,3,7,15,9,4,2,18,12,8,14,10,16,6]::int[]),
  ('chaparral-pines-golf-club', 'Chaparral Pines Golf Club', 'Payson', 'AZ', array[4,5,4,3,4,3,5,3,4,4,4,5,3,5,4,3,5,4]::int[], array[5,11,3,15,9,17,1,13,7,8,16,6,18,4,12,14,2,10]::int[]),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Flagstaff', 'AZ', array[4,5,3,4,4,4,4,3,5,4,4,3,4,5,3,4,5,4]::int[], array[7,3,13,5,9,11,1,15,17,4,6,14,8,18,12,16,10,2]::int[])
), tee_seed(course_key, course_name, tee_name, tee_color, gender, course_rating, slope_rating, total_yards, source_url) as (
values
  ('sedona-golf-resort', 'Sedona Golf Resort', 'Blue', 'Blue', 'M', 70.6, 128, 6646, 'https://mysliceofgolf.blogspot.com/2013/02/the-ridge-at-sedona-golf-resort.html'),
  ('sedona-golf-resort', 'Sedona Golf Resort', 'White', 'White', 'M', 68.2, 120, 6127, 'https://mysliceofgolf.blogspot.com/2013/02/the-ridge-at-sedona-golf-resort.html'),
  ('sedona-golf-resort', 'Sedona Golf Resort', 'White', 'White', 'F', 75.0, 145, 6127, 'https://mysliceofgolf.blogspot.com/2013/02/the-ridge-at-sedona-golf-resort.html'),
  ('sedona-golf-resort', 'Sedona Golf Resort', 'Gold', 'Gold', 'M', 66.1, 115, 5652, 'https://mysliceofgolf.blogspot.com/2013/02/the-ridge-at-sedona-golf-resort.html'),
  ('sedona-golf-resort', 'Sedona Golf Resort', 'Gold', 'Gold', 'F', 72.6, 137, 5652, 'https://mysliceofgolf.blogspot.com/2013/02/the-ridge-at-sedona-golf-resort.html'),
  ('sedona-golf-resort', 'Sedona Golf Resort', 'Red', 'Red', 'F', 69.6, 128, 5075, 'https://mysliceofgolf.blogspot.com/2013/02/the-ridge-at-sedona-golf-resort.html'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Black', 'Black', 'M', 72.0, 134, 6824, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Blue', 'Blue', 'M', 69.7, 128, 6353, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'White', 'White', 'M', 67.7, 123, 5965, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'White', 'White', 'F', 73.3, 137, 5965, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Gold', 'Gold', 'M', 65.8, 114, 5579, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Gold', 'Gold', 'F', 70.6, 114, 5579, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Gold/Teal Combo', 'Combo', 'M', 63.5, 109, 5058, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Gold/Teal Combo', 'Combo', 'F', 68.1, 126, 5058, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Teal', 'Teal', 'M', 61.6, 103, 4419, 'https://oakcreekcc.com/course-details/'),
  ('oakcreek-country-club', 'Oakcreek Country Club', 'Teal', 'Teal', 'F', 61.6, 116, 4419, 'https://oakcreekcc.com/course-details/'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Weiskopf', 'Weiskopf', 'M', 71.8, 142, 6858, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Weiskopf/Member', 'Combo', 'M', 70.6, 139, 6689, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Member', 'Member', 'M', 70.0, 136, 6418, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Member', 'Member', 'F', 76.0, 155, 6418, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Member/Regular', 'Combo', 'M', 68.6, 131, 6219, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Member/Regular', 'Combo', 'F', 74.0, 155, 6219, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Regular', 'Regular', 'M', 67.7, 126, 5884, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Regular', 'Regular', 'F', 72.5, 150, 5884, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Regular/Forward', 'Combo', 'M', 65.2, 120, 5469, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Regular/Forward', 'Combo', 'F', 69.4, 134, 5469, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Forward', 'Forward', 'M', 63.6, 116, 5143, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('seven-canyons-golf-club', 'Seven Canyons Golf Club', 'Forward', 'Forward', 'F', 67.8, 124, 5143, 'https://sevencanyons.com/documents/20124/47310/SevenCanyons_Scorecard.pdf'),
  ('elephant-rocks-golf-course', 'Elephant Rocks Golf Course', 'Championship', 'Championship', 'M', 70.8, 130, 6695, 'https://www.elephant-rocks.com/wp-content/uploads/sites/7414/2022/04/Scorecard-2022-Scan1.jpg'),
  ('elephant-rocks-golf-course', 'Elephant Rocks Golf Course', 'Middle', 'Middle', 'M', 68.1, 121, 6082, 'https://www.elephant-rocks.com/wp-content/uploads/sites/7414/2022/04/Scorecard-2022-Scan1.jpg'),
  ('elephant-rocks-golf-course', 'Elephant Rocks Golf Course', 'Front', 'Front', 'M', 65.0, 113, 5427, 'https://www.elephant-rocks.com/wp-content/uploads/sites/7414/2022/04/Scorecard-2022-Scan1.jpg'),
  ('elephant-rocks-golf-course', 'Elephant Rocks Golf Course', 'Front', 'Front', 'F', 70.0, 131, 5427, 'https://www.elephant-rocks.com/wp-content/uploads/sites/7414/2022/04/Scorecard-2022-Scan1.jpg'),
  ('pinewood-country-club', 'Pinewood Country Club', 'Elk', 'Elk', 'M', 70.6, 127, 6637, 'https://pinewoodcountryclubaz.com/Course_Info'),
  ('pinewood-country-club', 'Pinewood Country Club', 'Pine Cone', 'Pine Cone', 'M', 68.6, 122, 6211, 'https://pinewoodcountryclubaz.com/Course_Info'),
  ('pinewood-country-club', 'Pinewood Country Club', 'Coyote', 'Coyote', 'M', 67.3, 116, 5650, 'https://pinewoodcountryclubaz.com/Course_Info'),
  ('pinewood-country-club', 'Pinewood Country Club', 'Pine Tree', 'Pine Tree', 'M', 64.6, 107, 5359, 'https://pinewoodcountryclubaz.com/Course_Info'),
  ('pinewood-country-club', 'Pinewood Country Club', 'Deer', 'Deer', 'M', 61.8, 101, 5067, 'https://pinewoodcountryclubaz.com/Course_Info'),
  ('prescott-golf-club', 'Prescott Golf Club', 'Blue', 'Blue', 'M', 71.0, 127, 6655, 'https://www.prescottgolfclub.com/wp-content/uploads/sites/8834/2023/04/prescott-scorecard.pdf'),
  ('prescott-golf-club', 'Prescott Golf Club', 'Blue/White', 'Blue/White', 'M', 70.1, 124, 6457, 'https://www.prescottgolfclub.com/wp-content/uploads/sites/8834/2023/04/prescott-scorecard.pdf'),
  ('prescott-golf-club', 'Prescott Golf Club', 'White', 'White', 'M', 69.0, 121, 6302, 'https://www.prescottgolfclub.com/wp-content/uploads/sites/8834/2023/04/prescott-scorecard.pdf'),
  ('prescott-golf-club', 'Prescott Golf Club', 'White', 'White', 'F', 74.5, 133, 6302, 'https://www.prescottgolfclub.com/wp-content/uploads/sites/8834/2023/04/prescott-scorecard.pdf'),
  ('prescott-golf-club', 'Prescott Golf Club', 'Yellow', 'Yellow', 'M', 67.3, 118, 5946, 'https://www.prescottgolfclub.com/wp-content/uploads/sites/8834/2023/04/prescott-scorecard.pdf'),
  ('prescott-golf-club', 'Prescott Golf Club', 'Yellow', 'Yellow', 'F', 72.4, 128, 5946, 'https://www.prescottgolfclub.com/wp-content/uploads/sites/8834/2023/04/prescott-scorecard.pdf'),
  ('prescott-golf-club', 'Prescott Golf Club', 'Red', 'Red', 'M', 66.4, 116, 5732, 'https://www.prescottgolfclub.com/wp-content/uploads/sites/8834/2023/04/prescott-scorecard.pdf'),
  ('prescott-golf-club', 'Prescott Golf Club', 'Red', 'Red', 'F', 71.1, 125, 5732, 'https://www.prescottgolfclub.com/wp-content/uploads/sites/8834/2023/04/prescott-scorecard.pdf'),
  ('stoneridge-golf-course', 'StoneRidge Golf Course', 'Black', 'Black', 'M', 72.5, 142, 7052, 'https://stoneridgegolf.com/golf-course/'),
  ('stoneridge-golf-course', 'StoneRidge Golf Course', 'Black/Gold', 'Gold', 'M', 71.5, 139, 6392, 'https://stoneridgegolf.com/golf-course/'),
  ('stoneridge-golf-course', 'StoneRidge Golf Course', 'White', 'White', 'M', 66.9, 124, 5898, 'https://stoneridgegolf.com/golf-course/'),
  ('stoneridge-golf-course', 'StoneRidge Golf Course', 'White', 'White', 'F', 72.5, 143, 5898, 'https://stoneridgegolf.com/golf-course/'),
  ('stoneridge-golf-course', 'StoneRidge Golf Course', 'Green', 'Green', 'M', 64.1, 119, 5246, 'https://stoneridgegolf.com/golf-course/'),
  ('stoneridge-golf-course', 'StoneRidge Golf Course', 'Green', 'Green', 'F', 66.6, 133, 5246, 'https://stoneridgegolf.com/golf-course/'),
  ('stoneridge-golf-course', 'StoneRidge Golf Course', 'Red', 'Red', 'F', 67.2, 127, 4953, 'https://stoneridgegolf.com/golf-course/'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Black', 'Black', 'M', 71.6, 139, 6622, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Black/Blue', 'Combo', 'M', 70.3, 137, 6315, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Blue', 'Blue', 'M', 69.1, 134, 6121, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Blue/White', 'Combo', 'M', 68.0, 131, 5913, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'White', 'White', 'M', 67.1, 127, 5740, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'White', 'White', 'F', 72.2, 146, 5740, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'White/Gray', 'Combo', 'M', 65.1, 120, 5252, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Gray', 'Gray', 'M', 64.4, 116, 5085, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Gray', 'Gray', 'F', 68.7, 135, 5085, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Gray/Teal', 'Combo', 'F', 67.5, 129, 4890, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Teal', 'Teal', 'M', 63.0, 109, 4689, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('capital-canyon-club', 'Capital Canyon Club', 'Teal', 'Teal', 'F', 66.2, 125, 4689, 'https://www.capitalcanyonclub.com/Files/Library/CCCSCORECARD2022.PDF'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Black', 'Black', 'M', 73.1, 140, 7127, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Black/Blue', 'Combo', 'M', 72.0, 136, 6909, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Blue', 'Blue', 'M', 71.1, 133, 6736, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Blue/Gold', 'Combo', 'M', 69.1, 129, 6307, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Gold', 'Gold', 'M', 68.2, 125, 6090, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Gold', 'Gold', 'F', 73.8, 151, 6090, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Gold/Burgundy', 'Combo', 'F', 71.6, 145, 5710, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'Burgundy', 'Burgundy', 'F', 68.6, 134, 5210, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'White', 'White', 'M', 62.3, 109, 4762, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('flagstaff-ranch-golf-club', 'Flagstaff Ranch Golf Club', 'White', 'White', 'F', 66.6, 129, 4762, 'https://www.flagstaffranch.com/files/Scorecard_Page_1.pdf'),
  ('agave-highlands-golf-course', 'Agave Highlands Golf Course', 'Black', 'Black', 'M', 71.1, 121, 6406, 'https://www.agavehighlands.com/golf-course'),
  ('agave-highlands-golf-course', 'Agave Highlands Golf Course', 'White', 'White', 'M', 68.4, 116, 5988, 'https://www.agavehighlands.com/golf-course'),
  ('agave-highlands-golf-course', 'Agave Highlands Golf Course', 'Gold', 'Gold', 'M', 65.7, 110, 5400, 'https://www.agavehighlands.com/golf-course'),
  ('agave-highlands-golf-course', 'Agave Highlands Golf Course', 'Teal', 'Teal', 'M', 63.7, 105, 5057, 'https://www.agavehighlands.com/golf-course'),
  ('agave-highlands-golf-course', 'Agave Highlands Golf Course', 'Teal', 'Teal', 'F', 68.1, 116, 5057, 'https://www.agavehighlands.com/golf-course'),
  ('continental-country-club', 'Continental Country Club', 'White', 'White', 'M', 67.5, 118, 6014, 'https://www.golfify.io/courses/continental-country-club'),
  ('prescott-lakes-golf-club', 'Prescott Lakes Golf Club', 'Black Bear', 'Black Bear', 'M', 72.9, 137, 7190, 'https://www.theclubatprescottlakes.com/golf/scorecard'),
  ('prescott-lakes-golf-club', 'Prescott Lakes Golf Club', 'Cougar', 'Cougar', 'M', 70.9, 129, 6684, 'https://www.theclubatprescottlakes.com/golf/scorecard'),
  ('prescott-lakes-golf-club', 'Prescott Lakes Golf Club', 'Antelope', 'Antelope', 'M', 69.3, 127, 6255, 'https://www.theclubatprescottlakes.com/golf/scorecard'),
  ('prescott-lakes-golf-club', 'Prescott Lakes Golf Club', 'Coyote', 'Coyote', 'M', 66.5, 115, 5734, 'https://www.theclubatprescottlakes.com/golf/scorecard'),
  ('prescott-lakes-golf-club', 'Prescott Lakes Golf Club', 'Coyote', 'Coyote', 'F', 72.0, 139, 5734, 'https://www.theclubatprescottlakes.com/golf/scorecard'),
  ('prescott-lakes-golf-club', 'Prescott Lakes Golf Club', 'Jackrabbit', 'Jackrabbit', 'F', 69.8, 129, 5281, 'https://www.theclubatprescottlakes.com/golf/scorecard'),
  ('prescott-lakes-golf-club', 'Prescott Lakes Golf Club', 'Roadrunner', 'Roadrunner', 'F', 65.9, 120, 4724, 'https://www.theclubatprescottlakes.com/golf/scorecard'),
  ('quailwood-greens-golf-course', 'Quailwood Greens Golf Course', 'Blue', 'Blue', 'M', 64.2, 106, 5199, 'https://www.quailwoodgreens.com/golf/course'),
  ('quailwood-greens-golf-course', 'Quailwood Greens Golf Course', 'White', 'White', 'M', 61.9, 98, 4789, 'https://www.quailwoodgreens.com/golf/course'),
  ('quailwood-greens-golf-course', 'Quailwood Greens Golf Course', 'Red', 'Red', 'M', 59.9, 93, 4359, 'https://www.quailwoodgreens.com/golf/course'),
  ('quailwood-greens-golf-course', 'Quailwood Greens Golf Course', 'Red', 'Red', 'F', 61.7, 100, 4359, 'https://www.quailwoodgreens.com/golf/course'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'Green', 'Green', 'M', 72.7, 143, 7007, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'Brown', 'Brown', 'M', 71.1, 139, 6624, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'Brown/White', 'Brown/White', 'M', 70.4, 135, 6388, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'White', 'White', 'M', 69.9, 131, 6217, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'White/Gold', 'White/Gold', 'M', 67.9, 128, 5820, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'Gold', 'Gold', 'M', 67.1, 124, 5660, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'Gold', 'Gold', 'F', 73.3, 141, 5660, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'Red/Gold', 'Red/Gold', 'F', 71.1, 139, 5337, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'Red', 'Red', 'F', 69.1, 134, 5003, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-canyon-course', 'Forest Highlands Golf Club - Canyon Course', 'Black', 'Black', 'F', 63.9, 125, 4091, 'https://fhgc.com/canyon-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'Green', 'Green', 'M', 74.3, 143, 7340, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'Brown', 'Brown', 'M', 72.9, 140, 7033, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'Brown/White', 'Brown/White', 'M', 71.6, 137, 6737, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'White', 'White', 'M', 70.5, 134, 6476, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'White/Gold', 'White/Gold', 'M', 69.1, 129, 6205, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'Gold', 'Gold', 'M', 68.1, 126, 5986, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'Gold', 'Gold', 'F', 73.6, 148, 5986, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'Red/Gold', 'Red/Gold', 'F', 71.9, 140, 5616, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'Red', 'Red', 'F', 70.3, 132, 5291, 'https://fhgc.com/meadow-course/'),
  ('forest-highlands-golf-club-meadow-course', 'Forest Highlands Golf Club - Meadow Course', 'Black', 'Black', 'F', 63.5, 118, 4105, 'https://fhgc.com/meadow-course/'),
  ('talking-rock-golf-club', 'Talking Rock Golf Club', 'Heritage', 'Green', 'M', 67.3, 117, 6095, 'https://www.golfify.io/courses/talking-rock-golf-club'),
  ('pine-canyon-club', 'Pine Canyon Club', 'Copper', 'Brown', 'M', 68.3, 128, 6352, 'https://www.golfify.io/courses/pine-canyon-golf-club'),
  ('payson-golf-club', 'Payson Golf Club', 'White', 'White', 'M', 66, 111, 5894, 'https://www.golfify.io/courses/payson-golf-course'),
  ('the-rim-golf-club', 'The Rim Golf Club', 'Member', 'Silver', 'M', 68.8, 129, 6179, 'https://www.golfify.io/courses/the-rim-golf-club'),
  ('chaparral-pines-golf-club', 'Chaparral Pines Golf Club', 'Gold', 'Gold', 'M', 68, 123, 5906, 'https://www.golfify.io/courses/golf-club-at-chaparral-pines'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Black', 'Black', 'M', 72.3, 134, 6926, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Black/Blue', 'Black/Blue', 'M', 71.3, 130, 6732, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Blue', 'Blue', 'M', 70.4, 127, 6457, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Blue/White', 'Blue/White', 'M', 68.9, 125, 6115, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'White', 'White', 'M', 67.3, 123, 5791, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'White/Gold', 'White/Gold', 'M', 65.9, 119, 5502, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Gold', 'Gold', 'M', 64.8, 116, 5312, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'White', 'White', 'F', 72.3, 133, 5791, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'White/Gold', 'White/Gold', 'F', 70.7, 129, 5502, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Gold', 'Gold', 'F', 69.5, 127, 5312, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Gold/Green', 'Gold/Green', 'F', 66.5, 121, 4715, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx'),
  ('aspen-valley-golf-club', 'Aspen Valley Golf Club', 'Green', 'Green', 'F', 63.8, 114, 4298, 'https://www.aspenvalleygolf.com/getmedia/756782a6-c79f-4c75-ba7b-ef2ea1ef320e/Aspen_Valley_Scorecard_2026.aspx')
), upsert_courses as (
  insert into public.saved_courses (source_provider, source_course_id, name, normalized_name, city, state, updated_at)
  select 'manual_seed', course_key, course_name, course_key, city, state, now() from course_seed
  on conflict (normalized_name, city, state) do update set name=excluded.name, source_provider=excluded.source_provider, source_course_id=excluded.source_course_id, updated_at=now()
  returning id, normalized_name, city, state
), all_courses as (
  select c.id, s.* from course_seed s join public.saved_courses c on c.normalized_name=s.course_key and c.city is not distinct from s.city and c.state is not distinct from s.state
), upsert_tees as (
  insert into public.saved_course_tees (course_key, course_name, tee_name, tee_color, gender, course_rating, slope_rating, total_yards, source_url, updated_at)
  select course_key, course_name, tee_name, tee_color, gender, course_rating, slope_rating, total_yards, source_url, now() from tee_seed
  on conflict (course_key, tee_name, gender) do update set course_name=excluded.course_name, tee_color=excluded.tee_color, course_rating=excluded.course_rating, slope_rating=excluded.slope_rating, total_yards=excluded.total_yards, source_url=excluded.source_url, updated_at=now()
)
insert into public.saved_course_holes (saved_course_id, hole_number, par, handicap_index, updated_at)
select c.id, hole_number, c.pars[hole_number], c.hcps[hole_number], now() from all_courses c cross join generate_series(1,18) as hole_number
on conflict (saved_course_id, hole_number) do update set par=excluded.par, handicap_index=excluded.handicap_index, updated_at=now();

select (select count(*) from public.saved_courses where normalized_name in ('sedona-golf-resort', 'oakcreek-country-club', 'seven-canyons-golf-club', 'elephant-rocks-golf-course', 'pinewood-country-club', 'prescott-golf-club', 'stoneridge-golf-course', 'capital-canyon-club', 'flagstaff-ranch-golf-club', 'agave-highlands-golf-course', 'continental-country-club', 'prescott-lakes-golf-club', 'quailwood-greens-golf-course', 'forest-highlands-golf-club-canyon-course', 'forest-highlands-golf-club-meadow-course', 'talking-rock-golf-club', 'pine-canyon-club', 'payson-golf-club', 'the-rim-golf-club', 'chaparral-pines-golf-club', 'aspen-valley-golf-club')) as northern_seeded_courses, (select count(*) from public.saved_course_holes h join public.saved_courses c on c.id=h.saved_course_id where c.normalized_name in ('sedona-golf-resort', 'oakcreek-country-club', 'seven-canyons-golf-club', 'elephant-rocks-golf-course', 'pinewood-country-club', 'prescott-golf-club', 'stoneridge-golf-course', 'capital-canyon-club', 'flagstaff-ranch-golf-club', 'agave-highlands-golf-course', 'continental-country-club', 'prescott-lakes-golf-club', 'quailwood-greens-golf-course', 'forest-highlands-golf-club-canyon-course', 'forest-highlands-golf-club-meadow-course', 'talking-rock-golf-club', 'pine-canyon-club', 'payson-golf-club', 'the-rim-golf-club', 'chaparral-pines-golf-club', 'aspen-valley-golf-club')) as northern_seeded_holes, (select count(*) from public.saved_course_tees where course_key in ('sedona-golf-resort', 'oakcreek-country-club', 'seven-canyons-golf-club', 'elephant-rocks-golf-course', 'pinewood-country-club', 'prescott-golf-club', 'stoneridge-golf-course', 'capital-canyon-club', 'flagstaff-ranch-golf-club', 'agave-highlands-golf-course', 'continental-country-club', 'prescott-lakes-golf-club', 'quailwood-greens-golf-course', 'forest-highlands-golf-club-canyon-course', 'forest-highlands-golf-club-meadow-course', 'talking-rock-golf-club', 'pine-canyon-club', 'payson-golf-club', 'the-rim-golf-club', 'chaparral-pines-golf-club', 'aspen-valley-golf-club')) as northern_seeded_tees;
