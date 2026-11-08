import { supabase } from '@/lib/supabase/client';

export type RyderFormat = 'team_match' | 'singles_match';
export type TeamKey = 'team_one' | 'team_two';

export type EventDay = {
  day: number;
  date: string; // YYYY-MM-DD
  format: RyderFormat;
  course?: string;
  address?: string;
  teeTime?: string; // HH:MM
  website?: string;
  notes?: string;
  roundCode?: string;
};

export type AgendaItem = {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  title: string;
  location?: string;
  address?: string;
  link?: string;
  notes?: string;
};

export type GolfEvent = {
  id: string;
  code: string;
  title: string;
  description: string;
  days: EventDay[];
  agenda: AgendaItem[];
  buy_in: number;
  team_bet: number;
  ctp_per_day: number;
  skins_per_day: number;
  team_one_name: string;
  team_two_name: string;
  signups_open: boolean;
  max_players: number | null;
};

export type RosterEntry = { name: string; handicap: number; team: TeamKey | null };

export type Signup = RosterEntry & {
  id: string;
  email: string;
  paid: boolean;
  created_at: string;
};

export const FORMAT_LABELS: Record<RyderFormat, string> = {
  team_match: 'Team match play · 2 vs 2 low net',
  singles_match: 'Singles match play · 1 vs 1 net',
};

function rpcError(error: { message?: string } | null) {
  if (!error) return;
  const message = error.message ?? 'Something went wrong.';
  if (message.includes('Could not find the function') || message.includes('does not exist')) {
    throw new Error('Events are not set up in the database yet. Run supabase-golf-events.sql in Supabase.');
  }
  throw new Error(message);
}

export async function loadGolfEvent(code: string): Promise<GolfEvent | null> {
  const { data, error } = await supabase.from('golf_events').select('*').eq('code', code.toUpperCase()).maybeSingle();
  rpcError(error);
  if (!data) return null;
  const event = data as GolfEvent;
  return {
    ...event,
    days: [...(event.days ?? [])].sort((a, b) => a.day - b.day),
    agenda: event.agenda ?? [],
    buy_in: Number(event.buy_in),
    team_bet: Number(event.team_bet),
    ctp_per_day: Number(event.ctp_per_day),
    skins_per_day: Number(event.skins_per_day),
  };
}

export async function loadRoster(code: string): Promise<RosterEntry[]> {
  const { data, error } = await supabase.rpc('golf_event_roster', { p_code: code });
  rpcError(error);
  return ((data ?? []) as RosterEntry[]).map((entry) => ({ ...entry, handicap: Number(entry.handicap) }));
}

export async function signUp(code: string, name: string, email: string, handicap: number) {
  const { data, error } = await supabase.rpc('signup_for_golf_event', { p_code: code, p_name: name, p_email: email, p_handicap: handicap });
  rpcError(error);
  return data as 'added' | 'updated';
}

export async function loadSignups(code: string, key: string): Promise<Signup[]> {
  const { data, error } = await supabase.rpc('organizer_golf_event_signups', { p_code: code, p_key: key });
  rpcError(error);
  return ((data ?? []) as Signup[]).map((entry) => ({ ...entry, handicap: Number(entry.handicap) }));
}

export async function updateSignup(code: string, key: string, signupId: string, patch: { team?: TeamKey | null; paid?: boolean; handicap?: number; remove?: boolean }) {
  const { error } = await supabase.rpc('organizer_update_golf_signup', { p_code: code, p_key: key, p_signup_id: signupId, p_patch: patch });
  rpcError(error);
}

export async function updateEvent(code: string, key: string, patch: Partial<Pick<GolfEvent, 'title' | 'description' | 'days' | 'agenda' | 'team_one_name' | 'team_two_name' | 'signups_open'>>) {
  const { error } = await supabase.rpc('organizer_update_golf_event', { p_code: code, p_key: key, p_patch: patch });
  rpcError(error);
}

/** Per-player buy-in breakdown and the resulting pots for a given field size. */
export function buyInBreakdown(event: Pick<GolfEvent, 'buy_in' | 'team_bet' | 'ctp_per_day' | 'skins_per_day' | 'days'>, players: number) {
  const dayCount = Math.max(1, event.days.length);
  const lines = [
    { label: 'Team bet (winning team splits)', perPlayer: event.team_bet, pot: event.team_bet * players },
    ...event.days.map((day) => ({ label: `Day ${day.day} closest to the pin`, perPlayer: event.ctp_per_day, pot: event.ctp_per_day * players })),
    ...event.days.map((day) => ({ label: `Day ${day.day} net skins`, perPlayer: event.skins_per_day, pot: event.skins_per_day * players })),
  ];
  const allocated = event.team_bet + (event.ctp_per_day + event.skins_per_day) * dayCount;
  return { lines, allocated, unallocated: event.buy_in - allocated, total: event.buy_in * players };
}

export function formatEventDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', options);
}

export function formatTime(time?: string) {
  if (!time) return '';
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour)) return time;
  return new Date(2000, 0, 1, hour, minute || 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function mapsLink(address?: string) {
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
}

export function safeLink(url?: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

/** One combined, time-ordered schedule: golf days plus agenda items. */
export function buildSchedule(event: Pick<GolfEvent, 'days' | 'agenda'>) {
  type Entry = { key: string; date: string; time?: string; kind: 'golf' | 'agenda'; day?: EventDay; item?: AgendaItem };
  const entries: Entry[] = [
    ...event.days.map((day) => ({ key: `day-${day.day}`, date: day.date, time: day.teeTime, kind: 'golf' as const, day })),
    ...event.agenda.map((item) => ({ key: item.id, date: item.date, time: item.time, kind: 'agenda' as const, item })),
  ];
  entries.sort((a, b) => `${a.date} ${a.time || '99:99'}`.localeCompare(`${b.date} ${b.time || '99:99'}`));
  const byDate = new Map<string, Entry[]>();
  entries.forEach((entry) => byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]));
  return Array.from(byDate.entries()).map(([date, items]) => ({ date, items }));
}
