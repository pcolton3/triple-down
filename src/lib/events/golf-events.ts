import { supabase } from '@/lib/supabase/client';

export type DayFormat = 'team_match' | 'singles_match' | 'stroke_play' | 'scramble' | 'casual';
/** @deprecated kept for older imports */
export type RyderFormat = DayFormat;
export type TeamKey = 'team_one' | 'team_two';

/** A game played on one event day. Pot games come out of the buy-in; group games settle inside each group. */
export type EventGame = { key: string; amount: number };

export type GameDefinition = { key: string; label: string; kind: 'pot' | 'group'; blurb: string };

export const EVENT_GAMES: GameDefinition[] = [
  { key: 'skins', label: 'Net skins', kind: 'pot', blurb: 'Lowest net score on a hole wins a skin; the pot splits by skins won.' },
  { key: 'ctp', label: 'Closest to the pin', kind: 'pot', blurb: 'Pot splits across the par 3s.' },
  { key: 'low_net', label: 'Low net', kind: 'pot', blurb: 'Best net round of the day wins the pot.' },
  { key: 'stableford', label: 'Stableford', kind: 'pot', blurb: 'Most net Stableford points wins the pot.' },
  { key: 'birdie_pot', label: 'Birdie pot', kind: 'pot', blurb: 'Pot splits across every birdie made.' },
  { key: 'eagle_pot', label: 'Eagle pot', kind: 'pot', blurb: 'Pot splits across every eagle made.' },
  { key: 'hole_in_one', label: 'Hole-in-one pot', kind: 'pot', blurb: 'Pays only if someone makes an ace.' },
  { key: 'nassau', label: 'Nassau', kind: 'pot', blurb: 'Best net front 9, back 9 and total; the pot splits three ways.' },
  { key: 'match_play', label: 'Match play bet', kind: 'group', blurb: 'Head-to-head bet inside each group.' },
  { key: 'wolf', label: 'Wolf', kind: 'group', blurb: 'Rotating wolf picks a partner or goes alone.' },
  { key: 'vegas', label: 'Vegas', kind: 'group', blurb: 'Team scores combine into two-digit numbers.' },
  { key: 'bingo_bango_bongo', label: 'Bingo Bango Bongo', kind: 'group', blurb: 'Points for first on, closest, and first in.' },
  { key: 'banker', label: 'Banker', kind: 'group', blurb: 'Rotating banker takes on the group each hole.' },
  { key: 'best_ball', label: 'Best Ball', kind: 'group', blurb: 'Two teams of two in your foursome, best net ball per hole.' },
  { key: 'sixes', label: 'Sixes', kind: 'group', blurb: 'Foursome partners rotate every 6 holes.' },
  { key: 'rabbit', label: 'Rabbit', kind: 'group', blurb: 'Hold the rabbit at the turn and at 18 to win.' },
  { key: 'aces_and_deuces', label: 'Aces and Deuces', kind: 'group', blurb: 'Low score on a hole collects, high score pays.' },
  { key: 'medal_play', label: 'Medal Play', kind: 'group', blurb: 'Net strokes inside your group, settled per stroke.' },
];

export function gameDefinition(key: string): GameDefinition {
  return EVENT_GAMES.find((game) => game.key === key) ?? { key, label: key, kind: 'pot', blurb: '' };
}

export const TEAM_FORMATS: DayFormat[] = ['team_match', 'singles_match'];

/** True when any day pits the two event teams against each other (Ryder Cup style). */
export function isTeamEvent(event: Pick<GolfEvent, 'days'>) {
  return event.days.some((day) => TEAM_FORMATS.includes(day.format));
}

export type EventDay = {
  day: number;
  date: string; // YYYY-MM-DD
  format: DayFormat;
  games?: EventGame[];
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

/** What one player signed up for on one golf day. Missing days mean "playing, every game". */
export type DayChoice = { playing: boolean; games: string[] };
export type SignupChoices = { days?: Record<string, DayChoice> };

export type RosterEntry = { name: string; handicap: number; team: TeamKey | null; choices?: SignupChoices };

export type Signup = RosterEntry & {
  id: string;
  email: string;
  paid: boolean;
  created_at: string;
};

export const FORMAT_LABELS: Record<DayFormat, string> = {
  team_match: 'Team match play · 2 vs 2 low net',
  singles_match: 'Singles match play · 1 vs 1 net',
  stroke_play: 'Individual stroke play · net',
  scramble: 'Scramble',
  casual: 'Casual round · side games only',
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
  return normalizeEvent(event);
}

/** Older events stored CTP and skins as event-wide amounts; move them onto each day's game list. */
export function normalizeEvent(event: GolfEvent): GolfEvent {
  const legacyGames = (): EventGame[] => [
    ...(Number(event.ctp_per_day) > 0 ? [{ key: 'ctp', amount: Number(event.ctp_per_day) }] : []),
    ...(Number(event.skins_per_day) > 0 ? [{ key: 'skins', amount: Number(event.skins_per_day) }] : []),
  ];
  return {
    ...event,
    days: [...(event.days ?? [])]
      .sort((a, b) => a.day - b.day)
      .map((day) => ({ ...day, games: (day.games ?? legacyGames()).map((game) => ({ key: game.key, amount: Number(game.amount) || 0 })) })),
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

export async function signUp(code: string, name: string, email: string, handicap: number, choices?: SignupChoices) {
  const base = { p_code: code, p_name: name, p_email: email, p_handicap: handicap };
  let { data, error } = await supabase.rpc('signup_for_golf_event', choices ? { ...base, p_choices: choices } : base);
  // Before the game-choices SQL is run, the database only has the older function: still sign them up.
  if (error && choices && /could not find the function|does not exist/i.test(error.message ?? '')) {
    ({ data, error } = await supabase.rpc('signup_for_golf_event', base));
  }
  rpcError(error);
  return data as 'added' | 'updated';
}

export async function loadSignups(code: string, key: string): Promise<Signup[]> {
  const { data, error } = await supabase.rpc('organizer_golf_event_signups', { p_code: code, p_key: key });
  rpcError(error);
  return ((data ?? []) as Signup[]).map((entry) => ({ ...entry, handicap: Number(entry.handicap) }));
}

export async function updateSignup(code: string, key: string, signupId: string, patch: { team?: TeamKey | null; paid?: boolean; handicap?: number; remove?: boolean; choices?: SignupChoices }) {
  const { error } = await supabase.rpc('organizer_update_golf_signup', { p_code: code, p_key: key, p_signup_id: signupId, p_patch: patch });
  rpcError(error);
}

/** Permanently deletes the event and its signups. Rounds already started from it are kept. */
export async function deleteGolfEvent(code: string, key: string) {
  const { error } = await supabase.rpc('organizer_delete_golf_event', { p_code: code, p_key: key });
  rpcError(error);
}

export async function updateEvent(code: string, key: string, patch: Partial<Pick<GolfEvent, EditableField | 'signups_open'>>) {
  const { error } = await supabase.rpc('organizer_update_golf_event', { p_code: code, p_key: key, p_patch: patch });
  rpcError(error);
}

export type EditableField = 'title' | 'description' | 'days' | 'agenda' | 'team_one_name' | 'team_two_name' | 'buy_in' | 'team_bet' | 'max_players';
export type EventDraft = Pick<GolfEvent, EditableField>;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomEventCode(length = 6) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
}

/** Creates the event, retrying with a fresh code if one is already taken. */
export async function createGolfEvent(draft: EventDraft): Promise<{ code: string; organizerKey: string }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomEventCode();
    const { data, error } = await supabase.rpc('create_golf_event', {
      p_event: { ...draft, code, ctp_per_day: 0, skins_per_day: 0 },
    });
    if (error?.code === '23505' || error?.message?.includes('duplicate key')) continue;
    rpcError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { code: string; organizer_key: string };
    return { code: row.code, organizerKey: row.organizer_key };
  }
  throw new Error('Could not create a unique event code. Try again.');
}

export function organizerKeyStorageName(code: string) {
  return `triple-track-organizer:${code}`;
}

const MY_EVENTS_KEY = 'triple-track-my-events';
export type MyEvent = { code: string; title: string; createdAt: string };

export function readMyEvents(): MyEvent[] {
  try {
    const list = JSON.parse(localStorage.getItem(MY_EVENTS_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberMyEvent(code: string, title: string, organizerKey?: string) {
  setHidden(code, false);
  try {
    if (organizerKey) localStorage.setItem(organizerKeyStorageName(code), organizerKey);
    const list = readMyEvents().filter((entry) => entry.code !== code);
    list.unshift({ code, title, createdAt: new Date().toISOString() });
    localStorage.setItem(MY_EVENTS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* Storage can be unavailable; the links still work. */
  }
}

const JOINED_EVENTS_KEY = 'triple-track-joined-events';
const HIDDEN_EVENTS_KEY = 'triple-track-hidden-events';

function readHidden(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(HIDDEN_EVENTS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((code) => typeof code === 'string') : [];
  } catch {
    return [];
  }
}

function setHidden(code: string, hidden: boolean) {
  try {
    const next = new Set(readHidden());
    if (hidden) next.add(code.toUpperCase());
    else next.delete(code.toUpperCase());
    localStorage.setItem(HIDDEN_EVENTS_KEY, JSON.stringify([...next]));
  } catch {
    /* Storage unavailable. */
  }
}

/** Hides an event from "Your events" on this device. Opening it again brings it back. */
export function hideSavedEvent(code: string) {
  setHidden(code, true);
}

/** Removes every trace of an event from this device (used once it's been deleted). */
export function forgetSavedEvent(code: string) {
  const key = code.toUpperCase();
  try {
    localStorage.setItem(MY_EVENTS_KEY, JSON.stringify(readMyEvents().filter((entry) => entry.code.toUpperCase() !== key)));
    localStorage.setItem(JOINED_EVENTS_KEY, JSON.stringify(readList(JOINED_EVENTS_KEY).filter((entry) => entry.code.toUpperCase() !== key)));
    localStorage.removeItem(organizerKeyStorageName(key));
    localStorage.removeItem(`${SIGNUP_KEY_PREFIX}${key}`);
  } catch {
    /* Storage unavailable. */
  }
  setHidden(key, false);
}
const SIGNUP_KEY_PREFIX = 'triple-track-signup:';

/** Remembers on this device that the player signed up, so the event shows under "Your events". */
export function rememberJoinedEvent(code: string, title: string) {
  setHidden(code, false);
  try {
    const list = readList(JOINED_EVENTS_KEY).filter((entry) => entry.code !== code);
    list.unshift({ code, title, createdAt: new Date().toISOString() });
    localStorage.setItem(JOINED_EVENTS_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* Storage can be unavailable; the invite link still works. */
  }
}

function readList(key: string): MyEvent[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(list) ? list.filter((entry) => entry && typeof entry.code === 'string') : [];
  } catch {
    return [];
  }
}

export type SavedEvent = { code: string; title: string; organizer: boolean; joined: boolean };

/** Every event this device organizes or has signed up for. */
export function readSavedEvents(): SavedEvent[] {
  const saved = new Map<string, SavedEvent>();
  const add = (code: string, title: string, role: 'organizer' | 'joined') => {
    const key = code.toUpperCase();
    const entry = saved.get(key) ?? { code: key, title, organizer: false, joined: false };
    entry[role] = true;
    if (!entry.title) entry.title = title;
    saved.set(key, entry);
  };
  try {
    readMyEvents().forEach((entry) => {
      if (localStorage.getItem(organizerKeyStorageName(entry.code))) add(entry.code, entry.title, 'organizer');
    });
    readList(JOINED_EVENTS_KEY).forEach((entry) => add(entry.code, entry.title, 'joined'));
    // Signups made before this list existed.
    for (let index = 0; index < localStorage.length; index += 1) {
      const name = localStorage.key(index);
      if (name?.startsWith(SIGNUP_KEY_PREFIX)) add(name.slice(SIGNUP_KEY_PREFIX.length), '', 'joined');
    }
  } catch {
    /* Storage unavailable: nothing saved on this device. */
  }
  const hidden = new Set(readHidden());
  return [...saved.values()].filter((entry) => !hidden.has(entry.code));
}

/** First and last calendar dates of an event (golf days and agenda), or null if it has none. */
export function eventDateBounds(event: Pick<GolfEvent, 'days' | 'agenda'>) {
  const dates = [...event.days.map((day) => day.date), ...event.agenda.map((item) => item.date)].filter(Boolean).sort();
  return dates.length ? { first: dates[0], last: dates[dates.length - 1] } : null;
}

/** Upcoming events (soonest first, undated last) and past events (most recent first). `today` is YYYY-MM-DD. */
export function splitUpcoming<T extends { event: Pick<GolfEvent, 'days' | 'agenda'> }>(items: T[], today: string) {
  const withBounds = items.map((item) => ({ item, bounds: eventDateBounds(item.event) }));
  const upcoming = withBounds
    .filter(({ bounds }) => !bounds || bounds.last >= today)
    .sort((a, b) => (a.bounds?.first ?? '9999').localeCompare(b.bounds?.first ?? '9999'))
    .map(({ item }) => item);
  const past = withBounds
    .filter(({ bounds }) => bounds && bounds.last < today)
    .sort((a, b) => b.bounds!.last.localeCompare(a.bounds!.last))
    .map(({ item }) => item);
  return { upcoming, past };
}

/** The next golf day on or after `today`, if any. */
export function nextGolfDay(event: Pick<GolfEvent, 'days'>, today: string) {
  return event.days.filter((day) => day.date && day.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

/** Local calendar date as YYYY-MM-DD. */
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function potGames(day: EventDay) {
  return (day.games ?? []).filter((game) => gameDefinition(game.key).kind === 'pot' && game.amount > 0);
}

export function groupGames(day: EventDay) {
  return (day.games ?? []).filter((game) => gameDefinition(game.key).kind === 'group');
}

/** What the buy-in should be if it covers the team bet plus every pot game. */
export function suggestedBuyIn(event: Pick<GolfEvent, 'team_bet' | 'days'>) {
  const teamBet = isTeamEvent(event) ? event.team_bet : 0;
  return teamBet + event.days.reduce((total, day) => total + potGames(day).reduce((sum, game) => sum + game.amount, 0), 0);
}

/** Per-player buy-in breakdown and the resulting pots for a given field size. */
export function buyInBreakdown(event: Pick<GolfEvent, 'buy_in' | 'team_bet' | 'days'>, players: number, roster?: Array<{ choices?: SignupChoices }>) {
  const inGame = (day: EventDay, key: string) => (roster ? roster.filter((entry) => dayChoice(event, entry.choices, day.day).games.includes(key)).length : players);
  const teamBet = isTeamEvent(event) ? event.team_bet : 0;
  const lines = [
    ...(teamBet > 0 ? [{ label: 'Team bet (winning team splits)', perPlayer: teamBet, pot: teamBet * players }] : []),
    ...event.days.flatMap((day) =>
      potGames(day).map((game) => ({
        label: `${event.days.length > 1 ? `Day ${day.day} ` : ''}${gameDefinition(game.key).label.toLowerCase()}`,
        perPlayer: game.amount,
        pot: game.amount * inGame(day, game.key),
      }))
    ),
  ];
  const allocated = suggestedBuyIn(event);
  return { lines, allocated, unallocated: event.buy_in - allocated, total: event.buy_in * players };
}

/** Problems that should block saving an event. */
export function validateDraft(draft: EventDraft) {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push('Give the event a name.');
  if (!draft.days.length) problems.push('Add at least one golf day.');
  draft.days.forEach((day) => {
    if (!day.date) problems.push(`Pick a date for golf day ${day.day}.`);
  });
  draft.agenda.forEach((item) => {
    if (item.title.trim() && !item.date) problems.push(`Pick a date for "${item.title.trim()}".`);
  });
  if (draft.buy_in < 0 || draft.team_bet < 0) problems.push('Money amounts cannot be negative.');
  if (draft.max_players != null && draft.max_players < 2) problems.push('Player limit must be at least 2.');
  return problems;
}

/** Days renumbered 1..n in date order. */
export function renumberDays(days: EventDay[]) {
  return [...days]
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.day - b.day)
    .map((day, index) => ({ ...day, day: index + 1 }));
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

/** A player's choice for one day, defaulting to playing every game that day. */
export function dayChoice(event: Pick<GolfEvent, 'days'>, choices: SignupChoices | undefined, dayNumber: number): DayChoice {
  const day = event.days.find((item) => item.day === dayNumber);
  const all = (day?.games ?? []).map((game) => game.key);
  const saved = choices?.days?.[String(dayNumber)];
  if (!saved) return { playing: true, games: all };
  return { playing: saved.playing !== false, games: saved.playing === false ? [] : (saved.games ?? []).filter((key) => all.includes(key)) };
}

/** Full choices for every day, filling in defaults, so what's saved matches what the player saw. */
export function completeChoices(event: Pick<GolfEvent, 'days'>, choices?: SignupChoices): SignupChoices {
  return { days: Object.fromEntries(event.days.map((day) => [String(day.day), dayChoice(event, choices, day.day)])) };
}

export function isDayLocked(day: Pick<EventDay, 'roundCode'>) {
  return Boolean(day.roundCode?.trim());
}

/** What one player owes: the team bet (team events) plus only the pot games they joined. */
export function playerBuyIn(event: Pick<GolfEvent, 'days' | 'team_bet'>, choices?: SignupChoices) {
  const days = event.days.map((day) => ({ day, choice: dayChoice(event, choices, day.day) }));
  const playsAnyDay = days.some(({ choice }) => choice.playing);
  const teamBet = isTeamEvent(event) && playsAnyDay ? event.team_bet : 0;
  return teamBet + days.reduce((total, { day, choice }) => total + potGames(day).filter((game) => choice.games.includes(game.key)).reduce((sum, game) => sum + game.amount, 0), 0);
}

/** Games where the whole foursome has to be playing for it to work. */
export const FOURSOME_GAMES = ['wolf', 'vegas', 'sixes', 'best_ball'];

/**
 * Orders a day's players so foursomes keep people playing the same four-player games together
 * (Wolf, Vegas, Sixes, Best Ball). Rounds make groups of 4 in this order.
 */
export function suggestGroupOrder<T extends { games: string[] }>(players: T[]): T[] {
  const signature = (player: T) => FOURSOME_GAMES.filter((key) => player.games.includes(key)).join(',');
  const withGames = players.filter((player) => signature(player));
  const without = players.filter((player) => !signature(player));
  const buckets = new Map<string, T[]>();
  withGames.forEach((player) => buckets.set(signature(player), [...(buckets.get(signature(player)) ?? []), player]));
  // Largest matching sets first, so as many full foursomes as possible line up.
  const ordered = [...buckets.values()].sort((a, b) => b.length - a.length).flat();
  return [...ordered, ...without];
}
