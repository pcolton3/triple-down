import {
  EVENT_GAMES,
  FORMAT_LABELS,
  formatEventDate,
  formatTime,
  gameDefinition,
  isDayLocked,
  suggestedBuyIn,
  validateDraft,
  type AgendaItem,
  type DayFormat,
  type EditableField,
  type EventDay,
  type EventDraft,
  type GolfEvent,
  type Signup,
  type TeamKey,
} from '@/lib/events/golf-events';
import { formatCurrency } from '@/lib/utils/currency';

/**
 * Edits the event assistant can propose. The model never writes anything: it returns these,
 * the organizer reviews the plain-English summary, and Apply runs them through the same
 * organizer calls the page already uses. Adding/removing golf days and removing players are
 * left to the editor on purpose (day numbers key players' picks; removal is destructive).
 */
export type AssistantChange =
  | { op: 'set_text'; field: 'title' | 'description' | 'team_one_name' | 'team_two_name'; value: string }
  | { op: 'set_money'; field: 'buy_in' | 'team_bet'; amount: number }
  | { op: 'set_max_players'; value: number | null }
  | { op: 'set_signups_open'; open: boolean }
  | {
      op: 'update_day';
      day: number;
      date: string | null;
      format: DayFormat | null;
      course: string | null;
      address: string | null;
      teeTime: string | null;
      website: string | null;
      notes: string | null;
    }
  | { op: 'set_day_games'; day: number; games: Array<{ key: string; amount: number }> }
  | { op: 'add_agenda_item'; date: string; time: string; title: string; location: string; address: string; link: string; notes: string }
  | {
      op: 'update_agenda_item';
      id: string;
      date: string | null;
      time: string | null;
      title: string | null;
      location: string | null;
      address: string | null;
      link: string | null;
      notes: string | null;
    }
  | { op: 'remove_agenda_item'; id: string }
  | { op: 'update_player'; signup_id: string; paid: boolean | null; team: TeamKey | 'none' | null; handicap: number | null };

/**
 * What the model actually sends: one field per change, with no optional values (structured
 * outputs limits how many nullable/union fields a schema may have). Normalized into
 * AssistantChange before planning.
 */
export type WireChange =
  | Extract<AssistantChange, { op: 'set_text' | 'set_money' | 'set_signups_open' | 'set_day_games' | 'add_agenda_item' | 'remove_agenda_item' }>
  | { op: 'set_max_players'; value: number }
  | { op: 'set_day_field'; day: number; field: DayField; value: string }
  | { op: 'set_schedule_field'; id: string; field: AgendaField; value: string }
  | { op: 'set_player_paid'; signup_id: string; paid: boolean }
  | { op: 'set_player_team'; signup_id: string; team: TeamKey | 'none' }
  | { op: 'set_player_handicap'; signup_id: string; handicap: number };

export type AssistantReply = { reply: string; changes: WireChange[] };

const DAY_FIELDS = ['date', 'format', 'course', 'address', 'teeTime', 'website', 'notes'] as const;
const AGENDA_FIELDS = ['date', 'time', 'title', 'location', 'address', 'link', 'notes'] as const;
type DayField = (typeof DAY_FIELDS)[number];
type AgendaField = (typeof AGENDA_FIELDS)[number];
const FORMATS = Object.keys(FORMAT_LABELS) as DayFormat[];

function op(name: string, properties: Record<string, unknown>) {
  return {
    type: 'object',
    properties: { op: { type: 'string', const: name }, ...properties },
    required: ['op', ...Object.keys(properties)],
    additionalProperties: false,
  };
}

/** Structured-output schema for organizer replies. */
export const ORGANIZER_REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'changes'],
  properties: {
    reply: { type: 'string', description: 'What to tell the organizer. If changes are proposed, say what they do; they are not applied until the organizer taps Apply.' },
    changes: {
      type: 'array',
      description: 'Proposed edits, one field per item. Empty unless the organizer asked for a change.',
      items: {
        anyOf: [
          op('set_text', { field: { type: 'string', enum: ['title', 'description', 'team_one_name', 'team_two_name'] }, value: { type: 'string' } }),
          op('set_money', { field: { type: 'string', enum: ['buy_in', 'team_bet'] }, amount: { type: 'number' } }),
          op('set_max_players', { value: { type: 'integer', description: '0 removes the limit' } }),
          op('set_signups_open', { open: { type: 'boolean' } }),
          op('set_day_field', {
            day: { type: 'integer' },
            field: { type: 'string', enum: DAY_FIELDS },
            value: { type: 'string', description: `date: YYYY-MM-DD; teeTime: HH:MM 24-hour or "" for TBA; format: one of ${FORMATS.join(', ')}; "" clears other fields` },
          }),
          op('set_day_games', {
            day: { type: 'integer' },
            games: {
              type: 'array',
              description: "The day's full game list after the change.",
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['key', 'amount'],
                properties: { key: { type: 'string', enum: EVENT_GAMES.map((game) => game.key) }, amount: { type: 'number' } },
              },
            },
          }),
          op('add_agenda_item', {
            date: { type: 'string', description: 'YYYY-MM-DD' },
            time: { type: 'string', description: 'HH:MM 24-hour, or ""' },
            title: { type: 'string' },
            location: { type: 'string' },
            address: { type: 'string' },
            link: { type: 'string' },
            notes: { type: 'string' },
          }),
          op('set_schedule_field', {
            id: { type: 'string' },
            field: { type: 'string', enum: AGENDA_FIELDS },
            value: { type: 'string', description: 'date: YYYY-MM-DD; time: HH:MM 24-hour; "" clears' },
          }),
          op('remove_agenda_item', { id: { type: 'string' } }),
          op('set_player_paid', { signup_id: { type: 'string' }, paid: { type: 'boolean' } }),
          op('set_player_team', { signup_id: { type: 'string' }, team: { type: 'string', enum: ['team_one', 'team_two', 'none'] } }),
          op('set_player_handicap', { signup_id: { type: 'string' }, handicap: { type: 'number' } }),
        ],
      },
    },
  },
} as const;

const NO_DAY_CHANGE = { date: null, format: null, course: null, address: null, teeTime: null, website: null, notes: null };
const NO_AGENDA_CHANGE = { date: null, time: null, title: null, location: null, address: null, link: null, notes: null };
const NO_PLAYER_CHANGE = { paid: null, team: null, handicap: null };

/** Turns the model's one-field changes into the planner's shape. Unknown shapes are dropped. */
export function normalizeChange(change: WireChange | AssistantChange): AssistantChange | null {
  switch (change.op) {
    case 'set_max_players':
      return { op: 'set_max_players', value: change.value ? change.value : null };
    case 'set_day_field':
      return DAY_FIELDS.includes(change.field) ? { op: 'update_day', day: change.day, ...NO_DAY_CHANGE, [change.field]: change.value } as AssistantChange : null;
    case 'set_schedule_field':
      return AGENDA_FIELDS.includes(change.field) ? { op: 'update_agenda_item', id: change.id, ...NO_AGENDA_CHANGE, [change.field]: change.value } as AssistantChange : null;
    case 'set_player_paid':
      return { op: 'update_player', signup_id: change.signup_id, ...NO_PLAYER_CHANGE, paid: change.paid };
    case 'set_player_team':
      return { op: 'update_player', signup_id: change.signup_id, ...NO_PLAYER_CHANGE, team: change.team };
    case 'set_player_handicap':
      return { op: 'update_player', signup_id: change.signup_id, ...NO_PLAYER_CHANGE, handicap: change.handicap };
    case 'set_text': case 'set_money': case 'set_signups_open': case 'update_day': case 'set_day_games':
    case 'add_agenda_item': case 'update_agenda_item': case 'remove_agenda_item': case 'update_player':
      return change;
    default:
      return null;
  }
}

export type SignupPatch = { id: string; name: string; patch: { paid?: boolean; team?: TeamKey | null; handicap?: number } };

export type PlannedChanges = {
  eventPatch: Partial<Pick<GolfEvent, EditableField | 'signups_open'>>;
  signupPatches: SignupPatch[];
  lines: string[];
  problems: string[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function money(amount: number) {
  return formatCurrency(amount);
}

function dayLabel(day: EventDay) {
  return `Day ${day.day}${day.date ? ` (${formatEventDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })})` : ''}`;
}

function gamesText(games: Array<{ key: string; amount: number }>) {
  if (!games.length) return 'no games';
  return games.map((game) => `${gameDefinition(game.key).label}${game.amount ? ` ${money(game.amount)}` : ''}`).join(', ');
}

function shown(value: string, field: string) {
  if (!value) return 'cleared';
  if (field === 'teeTime' || field === 'time') return formatTime(value);
  if (field === 'date') return formatEventDate(value, { weekday: 'short', month: 'short', day: 'numeric' });
  if (field === 'format') return FORMAT_LABELS[value as DayFormat] ?? value;
  return value.length > 80 ? `"${value.slice(0, 77)}…"` : `"${value}"`;
}

/**
 * Works out exactly what a proposal would change on the current event, in plain English,
 * and anything that blocks it. Pure, so it runs on proposal arrival and again on Apply
 * against freshly loaded data.
 */
export function planChanges(event: GolfEvent, signups: Signup[], incoming: Array<WireChange | AssistantChange>): PlannedChanges {
  const changes = incoming.map(normalizeChange).filter((change): change is AssistantChange => change !== null);
  const lines: string[] = [];
  const problems: string[] = [];
  const eventPatch: PlannedChanges['eventPatch'] = {};
  const days: EventDay[] = event.days.map((day) => ({ ...day, games: [...(day.games ?? [])] }));
  let agenda: AgendaItem[] = event.agenda.map((item) => ({ ...item }));
  let daysTouched = false;
  let gamesTouched = false;
  let agendaTouched = false;
  let buyInSet = false;
  const signupPatches = new Map<string, SignupPatch>();

  const findDay = (number: number) => {
    const day = days.find((item) => item.day === number);
    if (!day) problems.push(`There is no golf day ${number}.`);
    else if (isDayLocked(day)) problems.push(`${dayLabel(day)} has already started its round (${day.roundCode}), so it can't be changed here.`);
    return day && !isDayLocked(day) ? day : null;
  };

  for (const change of changes) {
    switch (change.op) {
      case 'set_text': {
        const value = change.field === 'description' ? change.value : change.value.trim();
        if (change.field !== 'description' && !value) { problems.push('Names can\'t be blank.'); break; }
        if (value === event[change.field]) break;
        eventPatch[change.field] = value;
        const label = { title: 'Event name', description: 'Description', team_one_name: 'Team one name', team_two_name: 'Team two name' }[change.field];
        lines.push(change.field === 'description' ? 'Rewrite the event description (shown below).' : `${label} → ${shown(value, change.field)}`);
        break;
      }
      case 'set_money': {
        if (!(change.amount >= 0)) { problems.push('Money amounts can\'t be negative.'); break; }
        const amount = Math.round(change.amount * 100) / 100;
        if (change.field === 'buy_in') buyInSet = true;
        if (amount === event[change.field]) break;
        eventPatch[change.field] = amount;
        lines.push(`${change.field === 'buy_in' ? 'Buy-in' : 'Team bet'}: ${money(event[change.field])} → ${money(amount)}`);
        break;
      }
      case 'set_max_players': {
        if (change.value != null && change.value < 2) { problems.push('Player limit must be at least 2.'); break; }
        if (change.value === event.max_players) break;
        eventPatch.max_players = change.value;
        lines.push(change.value == null ? 'Remove the player limit' : `Player limit → ${change.value}`);
        break;
      }
      case 'set_signups_open': {
        if (change.open === event.signups_open) break;
        eventPatch.signups_open = change.open;
        lines.push(change.open ? 'Reopen signups' : 'Close signups');
        break;
      }
      case 'update_day': {
        const day = findDay(change.day);
        if (!day) break;
        for (const field of DAY_FIELDS) {
          const raw = change[field];
          if (raw == null) continue;
          const value = raw.trim();
          if (field === 'date' && !DATE.test(value)) { problems.push(`"${value}" isn't a date (YYYY-MM-DD).`); continue; }
          if (field === 'teeTime' && value && !TIME.test(value)) { problems.push(`"${value}" isn't a tee time (HH:MM).`); continue; }
          if (field === 'format' && !FORMATS.includes(value as DayFormat)) { problems.push(`Unknown format "${value}".`); continue; }
          if ((day[field] ?? '') === value) continue;
          const label = { date: 'date', format: 'format', course: 'course', address: 'address', teeTime: 'tee time', website: 'website', notes: 'notes' }[field];
          lines.push(`${dayLabel(day)} ${label} → ${shown(value, field)}`);
          (day as Record<string, unknown>)[field] = field === 'format' ? (value as DayFormat) : value || undefined;
          daysTouched = true;
        }
        break;
      }
      case 'set_day_games': {
        const day = findDay(change.day);
        if (!day) break;
        const seen = new Set<string>();
        const games = change.games
          .filter((game) => EVENT_GAMES.some((known) => known.key === game.key) && !seen.has(game.key) && seen.add(game.key))
          .map((game) => ({ key: game.key, amount: Math.max(0, Math.round(Number(game.amount) * 100) / 100 || 0) }));
        if (JSON.stringify(games) === JSON.stringify(day.games ?? [])) break;
        lines.push(`${dayLabel(day)} games: ${gamesText(day.games ?? [])} → ${gamesText(games)}`);
        day.games = games;
        daysTouched = true;
        gamesTouched = true;
        break;
      }
      case 'add_agenda_item': {
        const title = change.title.trim();
        if (!title) { problems.push('Schedule items need a title.'); break; }
        if (!DATE.test(change.date)) { problems.push(`"${change.date}" isn't a date (YYYY-MM-DD).`); break; }
        if (change.time && !TIME.test(change.time)) { problems.push(`"${change.time}" isn't a time (HH:MM).`); break; }
        const item: AgendaItem = {
          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `a-${Date.now()}`,
          date: change.date,
          title,
          ...(change.time ? { time: change.time } : {}),
          ...(change.location.trim() ? { location: change.location.trim() } : {}),
          ...(change.address.trim() ? { address: change.address.trim() } : {}),
          ...(change.link.trim() ? { link: change.link.trim() } : {}),
          ...(change.notes.trim() ? { notes: change.notes.trim() } : {}),
        };
        agenda = [...agenda, item];
        agendaTouched = true;
        lines.push(`Add to schedule: ${title}, ${shown(item.date, 'date')}${item.time ? ` at ${formatTime(item.time)}` : ''}${item.location ? ` · ${item.location}` : ''}`);
        break;
      }
      case 'update_agenda_item': {
        const item = agenda.find((entry) => entry.id === change.id);
        if (!item) { problems.push('That schedule item no longer exists.'); break; }
        for (const field of AGENDA_FIELDS) {
          const raw = change[field];
          if (raw == null) continue;
          const value = raw.trim();
          if (field === 'date' && !DATE.test(value)) { problems.push(`"${value}" isn't a date (YYYY-MM-DD).`); continue; }
          if (field === 'time' && value && !TIME.test(value)) { problems.push(`"${value}" isn't a time (HH:MM).`); continue; }
          if (field === 'title' && !value) { problems.push('Schedule items need a title.'); continue; }
          if ((item[field] ?? '') === value) continue;
          lines.push(`${item.title}: ${field} → ${shown(value, field)}`);
          (item as Record<string, unknown>)[field] = value || undefined;
          agendaTouched = true;
        }
        break;
      }
      case 'remove_agenda_item': {
        const item = agenda.find((entry) => entry.id === change.id);
        if (!item) { problems.push('That schedule item no longer exists.'); break; }
        agenda = agenda.filter((entry) => entry.id !== change.id);
        agendaTouched = true;
        lines.push(`Remove from schedule: ${item.title}`);
        break;
      }
      case 'update_player': {
        const signup = signups.find((entry) => entry.id === change.signup_id);
        if (!signup) { problems.push('One of those players is no longer signed up.'); break; }
        const existing = signupPatches.get(signup.id) ?? { id: signup.id, name: signup.name, patch: {} };
        if (change.paid != null && change.paid !== signup.paid) {
          existing.patch.paid = change.paid;
          lines.push(`${signup.name}: mark ${change.paid ? 'paid' : 'not paid'}`);
        }
        if (change.team != null) {
          const team = change.team === 'none' ? null : change.team;
          if (team !== signup.team) {
            existing.patch.team = team;
            lines.push(`${signup.name}: ${team ? `move to ${team === 'team_one' ? event.team_one_name : event.team_two_name}` : 'take off their team'}`);
          }
        }
        if (change.handicap != null) {
          const handicap = Math.round(change.handicap * 10) / 10;
          if (handicap < -10 || handicap > 54) problems.push(`${handicap} isn't a valid handicap for ${signup.name}.`);
          else if (handicap !== signup.handicap) {
            existing.patch.handicap = handicap;
            lines.push(`${signup.name}: handicap ${signup.handicap} → ${handicap}`);
          }
        }
        if (Object.keys(existing.patch).length) signupPatches.set(signup.id, existing);
        break;
      }
    }
  }

  // Same rule as the editor: a buy-in that was covering exactly the games follows them.
  if (gamesTouched && !buyInSet && event.buy_in === suggestedBuyIn(event)) {
    const next = suggestedBuyIn({ team_bet: eventPatch.team_bet ?? event.team_bet, days });
    if (next !== event.buy_in) {
      eventPatch.buy_in = next;
      lines.push(`Buy-in follows the games: ${money(event.buy_in)} → ${money(next)}`);
    }
  }
  if (daysTouched) eventPatch.days = days;
  if (agendaTouched) {
    agenda = [...agenda].sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`));
    eventPatch.agenda = agenda;
  }

  if (daysTouched || agendaTouched || eventPatch.title != null) {
    problems.push(...validateDraft({
      title: eventPatch.title ?? event.title,
      description: eventPatch.description ?? event.description,
      days: eventPatch.days ?? event.days,
      agenda: eventPatch.agenda ?? event.agenda,
      team_one_name: eventPatch.team_one_name ?? event.team_one_name,
      team_two_name: eventPatch.team_two_name ?? event.team_two_name,
      buy_in: eventPatch.buy_in ?? event.buy_in,
      team_bet: eventPatch.team_bet ?? event.team_bet,
      max_players: eventPatch.max_players === undefined ? event.max_players : eventPatch.max_players,
    }));
  }

  return { eventPatch, signupPatches: Array.from(signupPatches.values()), lines, problems: Array.from(new Set(problems)) };
}

/* ---------- Planning a new event (create page) ---------- */

/** A complete event plan as the planner sends it: flat strings, "" for unknown, 0 max_players for no limit. */
export type WireDraft = {
  title: string;
  description: string;
  team_one_name: string;
  team_two_name: string;
  buy_in: number;
  team_bet: number;
  max_players: number;
  days: Array<{ date: string; format: string; course: string; address: string; teeTime: string; website: string; notes: string; games: Array<{ key: string; amount: number }> }>;
  agenda: Array<{ date: string; time: string; title: string; location: string; address: string; link: string; notes: string }>;
};

export type PlannerReply = { reply: string; draft: WireDraft | null };

const str = (description?: string) => (description ? { type: 'string', description } : { type: 'string' });
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

const DRAFT_SCHEMA = obj({
  title: str(),
  description: str('What players read on the invite. Plain text: a short opening message, then sections each starting with its own heading line, exactly FORMAT, SIDE GAMES, RULES or OTHER ACTIVITIES (skip any that are empty).'),
  team_one_name: str(),
  team_two_name: str(),
  buy_in: { type: 'number', description: 'Per player. Usually the team bet plus every pot game on every day.' },
  team_bet: { type: 'number', description: 'Per player, only for team_match / singles_match days; else 0.' },
  max_players: { type: 'integer', description: '0 for no limit' },
  days: {
    type: 'array',
    description: 'Golf days in date order.',
    items: obj({
      date: str('YYYY-MM-DD, or "" if not decided'),
      format: { type: 'string', enum: FORMATS },
      course: str(),
      address: str(),
      teeTime: str('HH:MM 24-hour, or "" for TBA'),
      website: str(),
      notes: str(),
      games: { type: 'array', items: obj({ key: { type: 'string', enum: EVENT_GAMES.map((game) => game.key) }, amount: { type: 'number' } }) },
    }),
  },
  agenda: {
    type: 'array',
    description: 'Non-golf plans: dinners, travel, awards.',
    items: obj({ date: str('YYYY-MM-DD'), time: str('HH:MM 24-hour or ""'), title: str(), location: str(), address: str(), link: str(), notes: str() }),
  },
});

export const PLANNER_REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'draft'],
  properties: {
    reply: { type: 'string', description: 'What to tell the organizer.' },
    draft: { anyOf: [DRAFT_SCHEMA, { type: 'null' }], description: 'The complete plan for the form, building on the current form; null when only talking or asking questions.' },
  },
} as const;

const clip = (value: unknown, length = 300) => (typeof value === 'string' ? value.trim().slice(0, length) : '');

/** Turns the planner's plan into a form draft, dropping anything malformed. */
export function draftFromWire(wire: WireDraft): EventDraft {
  const days: EventDay[] = (Array.isArray(wire.days) ? wire.days : []).slice(0, 10).map((day, index) => {
    const date = clip(day.date);
    const teeTime = clip(day.teeTime);
    const seen = new Set<string>();
    return {
      day: index + 1,
      date: DATE.test(date) ? date : '',
      format: FORMATS.includes(day.format as DayFormat) ? (day.format as DayFormat) : 'casual',
      games: (Array.isArray(day.games) ? day.games : [])
        .filter((game) => EVENT_GAMES.some((known) => known.key === game.key) && !seen.has(game.key) && seen.add(game.key))
        .map((game) => ({ key: game.key, amount: Math.max(0, Math.round(Number(game.amount) * 100) / 100 || 0) })),
      ...(clip(day.course) ? { course: clip(day.course) } : {}),
      ...(clip(day.address) ? { address: clip(day.address) } : {}),
      ...(TIME.test(teeTime) ? { teeTime } : {}),
      ...(clip(day.website) ? { website: clip(day.website) } : {}),
      ...(clip(day.notes, 1000) ? { notes: clip(day.notes, 1000) } : {}),
    };
  });
  const agenda: AgendaItem[] = (Array.isArray(wire.agenda) ? wire.agenda : []).slice(0, 30).flatMap((item, index) => {
    const title = clip(item.title);
    const date = clip(item.date);
    const time = clip(item.time);
    if (!title) return [];
    return [{
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `a-${Date.now()}-${index}`,
      date: DATE.test(date) ? date : '',
      title,
      ...(TIME.test(time) ? { time } : {}),
      ...(clip(item.location) ? { location: clip(item.location) } : {}),
      ...(clip(item.address) ? { address: clip(item.address) } : {}),
      ...(clip(item.link) ? { link: clip(item.link) } : {}),
      ...(clip(item.notes, 1000) ? { notes: clip(item.notes, 1000) } : {}),
    }];
  });
  const money = (value: unknown) => Math.max(0, Math.round(Number(value) * 100) / 100 || 0);
  return {
    title: clip(wire.title, 120),
    description: clip(wire.description, 5000),
    team_one_name: clip(wire.team_one_name, 60) || 'Team 1',
    team_two_name: clip(wire.team_two_name, 60) || 'Team 2',
    buy_in: money(wire.buy_in),
    team_bet: money(wire.team_bet),
    max_players: Number(wire.max_players) >= 2 ? Math.round(Number(wire.max_players)) : null,
    days: days.length ? days : [{ day: 1, date: '', format: 'casual', games: [] }],
    agenda,
  };
}

/** A short plain-English outline of a plan, for the "Use this plan" card. */
export function draftOutline(draft: EventDraft): string[] {
  const lines = [draft.title || 'Untitled event'];
  for (const day of draft.days) {
    lines.push(
      `${dayLabel(day)}: ${day.course || 'course TBD'} · ${FORMAT_LABELS[day.format] ?? day.format}${day.teeTime ? ` · ${formatTime(day.teeTime)}` : ''} · ${gamesText(day.games ?? [])}`
    );
  }
  for (const item of draft.agenda) lines.push(`${item.date ? formatEventDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD'}${item.time ? ` ${formatTime(item.time)}` : ''}: ${item.title}${item.location ? ` · ${item.location}` : ''}`);
  lines.push(`Buy-in ${money(draft.buy_in)}${draft.team_bet ? ` (includes ${money(draft.team_bet)} team bet)` : ''}${draft.max_players ? ` · up to ${draft.max_players} players` : ''}`);
  return lines;
}

/** Structured output for a drafted email to players. */
export const EMAIL_REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'body'],
  properties: { subject: { type: 'string' }, body: { type: 'string', description: 'Plain text email body.' } },
} as const;
