-- Announcements and push notifications for events and rounds. Run once in the Supabase SQL editor
-- (safe to run again). Tables are closed to direct access; everything goes through these functions.
--   Event announcements: posted with the organizer key; shown on the invite page and the event's rounds.
--   Round announcements: posted from the phone that created the round.

create table if not exists public.golf_announcements (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('event', 'round')),
  code text not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists golf_announcements_scope_code on public.golf_announcements (scope, code, created_at desc);
alter table public.golf_announcements enable row level security;

create table if not exists public.golf_push_subscriptions (
  scope text not null check (scope in ('event', 'round')),
  code text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  primary key (scope, code, endpoint)
);
alter table public.golf_push_subscriptions enable row level security;

-- Event codes whose golf days include this round.
create or replace function public.golf_events_for_round(p_round_code text)
returns setof text language sql stable security definer set search_path = public as $$
  select e.code from golf_events e
  where exists (select 1 from jsonb_array_elements(coalesce(e.days, '[]'::jsonb)) d where upper(d->>'roundCode') = upper(trim(p_round_code)));
$$;

-- Latest announcements. For a round this includes its event's announcements.
create or replace function public.list_announcements(p_scope text, p_code text)
returns table (id uuid, scope text, code text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.scope, a.code, a.body, a.created_at from golf_announcements a
  where (a.scope = p_scope and a.code = upper(trim(p_code)))
     or (p_scope = 'round' and a.scope = 'event' and a.code in (select golf_events_for_round(p_code)))
  order by a.created_at desc limit 20;
$$;

-- Who may post: the event's organizer key, or the round creator's phone.
create or replace function public.announcement_allowed(p_scope text, p_code text, p_key text, p_device_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_id uuid; v_creator text;
begin
  if p_scope = 'event' then
    select id into v_id from golf_events where code = upper(trim(p_code));
    return v_id is not null and golf_event_key_ok(v_id, p_key);
  end if;
  select creator_device_id into v_creator from rounds where round_code = upper(trim(p_code));
  return v_creator is not null and v_creator = p_device_id;
end; $$;

-- Posts an announcement and returns the push subscriptions to notify (only to someone allowed to post).
create or replace function public.post_announcement(p_scope text, p_code text, p_key text, p_device_id text, p_body text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(p_code));
begin
  if p_scope not in ('event', 'round') or not announcement_allowed(p_scope, v_code, p_key, p_device_id) then
    raise exception 'Only the organizer can post here.';
  end if;
  if (select count(*) from golf_announcements a where a.scope = p_scope and a.code = v_code and a.created_at > now() - interval '1 day') >= 20 then
    raise exception 'That is a lot of announcements for one day.';
  end if;
  insert into golf_announcements (scope, code, body) values (p_scope, v_code, left(trim(p_body), 1000));
  return query
    select distinct s.endpoint, s.p256dh, s.auth from golf_push_subscriptions s
    where (s.scope = p_scope and s.code = v_code)
       or (p_scope = 'event' and s.scope = 'round' and s.code in (
            select upper(d->>'roundCode') from golf_events e, jsonb_array_elements(coalesce(e.days, '[]'::jsonb)) d
            where e.code = v_code and coalesce(d->>'roundCode', '') <> ''));
end; $$;

create or replace function public.delete_announcement(p_id uuid, p_key text, p_device_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_scope text; v_code text;
begin
  select a.scope, a.code into v_scope, v_code from golf_announcements a where a.id = p_id;
  if v_scope is null then return; end if;
  if not announcement_allowed(v_scope, v_code, p_key, p_device_id) then raise exception 'Only the organizer can remove this.'; end if;
  delete from golf_announcements where id = p_id;
end; $$;

create or replace function public.push_subscribe(p_scope text, p_code text, p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_scope not in ('event', 'round') or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'Bad subscription.'; end if;
  insert into golf_push_subscriptions (scope, code, endpoint, p256dh, auth)
  values (p_scope, upper(trim(p_code)), p_endpoint, left(p_p256dh, 200), left(p_auth, 100))
  on conflict (scope, code, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
end; $$;

-- Removes a phone's subscription (turned off, or the push service says it's gone).
create or replace function public.push_unsubscribe(p_endpoint text, p_scope text default null, p_code text default null)
returns void language sql security definer set search_path = public as $$
  delete from golf_push_subscriptions
  where endpoint = p_endpoint and (p_scope is null or (scope = p_scope and code = upper(trim(p_code))));
$$;

grant execute on function public.golf_events_for_round(text) to anon, authenticated;
grant execute on function public.list_announcements(text, text) to anon, authenticated;
grant execute on function public.post_announcement(text, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_announcement(uuid, text, text) to anon, authenticated;
grant execute on function public.push_subscribe(text, text, text, text, text) to anon, authenticated;
grant execute on function public.push_unsubscribe(text, text, text) to anon, authenticated;
revoke execute on function public.announcement_allowed(text, text, text, text) from anon, authenticated, public;
