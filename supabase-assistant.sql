-- Event assistant usage limits. Run once in the Supabase SQL editor.
-- Daily question limits per event, and a monthly spend cap ($20) across the whole app.
-- No table access for anyone; the API route goes through the two functions below.

create table if not exists public.assistant_usage (
  day date not null default current_date,
  event_code text not null,
  mode text not null,
  turns integer not null default 0,
  cost_cents numeric not null default 0,
  primary key (day, event_code, mode)
);
alter table public.assistant_usage enable row level security;

create or replace function public.assistant_take_turn(p_code text, p_mode text)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(p_code)); v_mode text := case when p_mode = 'organizer' then 'organizer' else 'player' end;
begin
  if (select coalesce(sum(cost_cents), 0) from assistant_usage where day >= date_trunc('month', current_date)) >= 2000 then return 'monthly_cap'; end if;
  if (select coalesce(sum(turns), 0) from assistant_usage where day = current_date) >= 400 then return 'daily_limit'; end if;
  if (select coalesce(sum(turns), 0) from assistant_usage where day = current_date and event_code = v_code and mode = v_mode)
     >= case when v_mode = 'organizer' then 80 else 60 end then return 'daily_limit'; end if;
  insert into assistant_usage (day, event_code, mode, turns) values (current_date, v_code, v_mode, 1)
  on conflict (day, event_code, mode) do update set turns = assistant_usage.turns + 1;
  return 'ok';
end; $$;

create or replace function public.assistant_record_cost(p_code text, p_mode text, p_cents numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update assistant_usage set cost_cents = cost_cents + least(greatest(coalesce(p_cents, 0), 0), 100)
  where day = current_date and event_code = upper(trim(p_code)) and mode = case when p_mode = 'organizer' then 'organizer' else 'player' end;
end; $$;

grant execute on function public.assistant_take_turn(text, text) to anon, authenticated;
grant execute on function public.assistant_record_cost(text, text, numeric) to anon, authenticated;
