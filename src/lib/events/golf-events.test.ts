import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
import { buildSchedule, buyInBreakdown, completeChoices, forgetSavedEvent, hideSavedEvent, readSavedEvents, rememberJoinedEvent, rememberMyEvent, dayChoice, isTeamEvent, playerBuyIn, suggestGroupOrder, localToday, nextGolfDay, normalizeEvent, renumberDays, safeLink, splitUpcoming, suggestedBuyIn, validateDraft, type EventDay, type GolfEvent } from './golf-events';

const pots = [{ key: 'ctp', amount: 50 }, { key: 'skins', amount: 50 }];
const days: EventDay[] = [
  { day: 1, date: '2027-04-27', format: 'team_match', teeTime: '08:30', games: pots },
  { day: 2, date: '2027-04-28', format: 'singles_match', teeTime: '09:00', games: pots },
];

const legacy = {
  id: 'x', code: 'BDAY27', title: 'Birthday Cup', description: '', agenda: [], buy_in: 300, team_bet: 100,
  ctp_per_day: 50, skins_per_day: 50, team_one_name: 'A', team_two_name: 'B', signups_open: true, max_players: null,
  days: [{ day: 2, date: '2027-04-28', format: 'singles_match' }, { day: 1, date: '2027-04-27', format: 'team_match' }],
} as unknown as GolfEvent;

describe('buyInBreakdown', () => {
  it('splits a $300 buy-in into team bet, CTP and skins per day', () => {
    const result = buyInBreakdown({ buy_in: 300, team_bet: 100, days }, 12);
    expect(result.allocated).toBe(300);
    expect(result.unallocated).toBe(0);
    expect(result.total).toBe(3600);
    expect(result.lines.map((line) => line.pot)).toEqual([1200, 600, 600, 600, 600]);
  });

  it('leaves group games and non-team team bets out of the buy-in', () => {
    const casual: EventDay[] = [{ day: 1, date: '2027-05-01', format: 'stroke_play', games: [{ key: 'skins', amount: 20 }, { key: 'wolf', amount: 5 }] }];
    expect(suggestedBuyIn({ team_bet: 100, days: casual })).toBe(20);
    expect(isTeamEvent({ days: casual })).toBe(false);
    expect(buyInBreakdown({ buy_in: 20, team_bet: 100, days: casual }, 4).lines).toEqual([{ label: 'net skins', perPlayer: 20, pot: 80 }]);
  });
});

describe('normalizeEvent', () => {
  it('moves legacy CTP and skins amounts onto each day and sorts days', () => {
    const event = normalizeEvent(legacy);
    expect(event.days.map((day) => day.day)).toEqual([1, 2]);
    expect(event.days[0].games).toEqual([{ key: 'ctp', amount: 50 }, { key: 'skins', amount: 50 }]);
    expect(suggestedBuyIn(event)).toBe(300);
  });

  it('keeps an explicitly empty game list', () => {
    const event = normalizeEvent({ ...legacy, days: [{ day: 1, date: '2027-04-27', format: 'casual', games: [] }] });
    expect(event.days[0].games).toEqual([]);
  });
});

describe('event drafts', () => {
  it('renumbers days in date order', () => {
    const result = renumberDays([{ day: 1, date: '2027-04-28', format: 'casual' }, { day: 3, date: '2027-04-26', format: 'casual' }]);
    expect(result.map((day) => [day.day, day.date])).toEqual([[1, '2027-04-26'], [2, '2027-04-28']]);
  });

  it('requires a name, a day and dates', () => {
    const problems = validateDraft({ title: ' ', description: '', days: [{ day: 1, date: '', format: 'casual' }], agenda: [], buy_in: 0, team_bet: 0, team_one_name: '', team_two_name: '', max_players: null });
    expect(problems).toEqual(['Give the event a name.', 'Pick a date for golf day 1.']);
  });
});

describe('buildSchedule', () => {
  it('orders golf and agenda items by day and time', () => {
    const schedule = buildSchedule({
      days,
      agenda: [
        { id: 'dinner', date: '2027-04-27', time: '19:00', title: 'Dinner' },
        { id: 'arrive', date: '2027-04-26', title: 'Arrive' },
        { id: 'breakfast', date: '2027-04-27', time: '07:00', title: 'Breakfast' },
      ],
    });
    expect(schedule.map((group) => group.date)).toEqual(['2027-04-26', '2027-04-27', '2027-04-28']);
    expect(schedule[1].items.map((item) => item.key)).toEqual(['breakfast', 'day-1', 'dinner']);
  });

  it('puts golf with no tee time yet between morning plans and dinner', () => {
    const untimed = days.map((day) => ({ ...day, teeTime: undefined }));
    const schedule = buildSchedule({
      days: untimed,
      agenda: [
        { id: 'dinner', date: '2027-04-27', time: '18:30', title: 'Birthday dinner' },
        { id: 'breakfast', date: '2027-04-27', time: '07:00', title: 'Breakfast' },
        { id: 'awards', date: '2027-04-28', title: 'Awards + payouts' },
      ],
    });
    expect(schedule[0].items.map((item) => item.key)).toEqual(['breakfast', 'day-1', 'dinner']);
    expect(schedule[1].items.map((item) => item.key)).toEqual(['day-2', 'awards']);
  });
});

describe('safeLink', () => {
  it('allows web links only', () => {
    expect(safeLink('example.com/menu')).toBe('https://example.com/menu');
    expect(safeLink('javascript:alert(1)')).toBe('');
  });
});

describe('your events', () => {
  const make = (code: string, dates: string[]) => ({ code, event: { days: dates.map((date, i) => ({ day: i + 1, date, format: 'casual' as const })), agenda: [] } });

  it('splits upcoming (soonest first, undated last) from past (latest first)', () => {
    const items = [make('LATE', ['2027-04-27']), make('PAST1', ['2026-01-02']), make('NONE', []), make('NOW', ['2026-11-07', '2026-11-08']), make('PAST2', ['2026-06-01'])];
    const { upcoming, past } = splitUpcoming(items, '2026-11-08');
    expect(upcoming.map((item) => item.code)).toEqual(['NOW', 'LATE', 'NONE']);
    expect(past.map((item) => item.code)).toEqual(['PAST2', 'PAST1']);
  });

  it('finds the next golf day and formats local dates', () => {
    expect(nextGolfDay({ days }, '2027-04-28')?.day).toBe(2);
    expect(nextGolfDay({ days }, '2027-05-01')).toBeNull();
    expect(localToday(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('signup choices', () => {
  const event = {
    team_bet: 100,
    days: [
      { day: 1, date: '2027-04-27', format: 'team_match' as const, games: [{ key: 'skins', amount: 50 }, { key: 'ctp', amount: 50 }, { key: 'banker', amount: 5 }] },
      { day: 2, date: '2027-04-28', format: 'casual' as const, games: [{ key: 'skins', amount: 20 }] },
    ],
  };

  it('defaults to playing every game, and fills in defaults when saving', () => {
    expect(dayChoice(event, undefined, 1)).toEqual({ playing: true, games: ['skins', 'ctp', 'banker'] });
    expect(completeChoices(event, { days: { '2': { playing: false, games: [] } } }).days).toEqual({
      '1': { playing: true, games: ['skins', 'ctp', 'banker'] },
      '2': { playing: false, games: [] },
    });
  });

  it('charges half the team bet to someone playing one of two team days', () => {
    const twoDay = { team_bet: 100, days };
    const dayOneOnly = { days: { '1': { playing: true, games: [] }, '2': { playing: false, games: [] } } };
    expect(playerBuyIn(twoDay, undefined)).toBe(300);
    expect(playerBuyIn(twoDay, dayOneOnly)).toBe(50);
    expect(playerBuyIn(twoDay, { days: { '1': { playing: false, games: [] }, '2': { playing: true, games: ['ctp'] } } })).toBe(100);
    const lines = buyInBreakdown({ buy_in: 300, ...twoDay }, 2, [{}, { choices: dayOneOnly }]).lines;
    expect(lines[0].pot).toBe(150);
  });

  it('charges only for the pot games a player joined', () => {
    expect(playerBuyIn(event, undefined)).toBe(220); // team bet + 50 + 50 + 20
    expect(playerBuyIn(event, { days: { '1': { playing: true, games: ['banker'] }, '2': { playing: false, games: [] } } })).toBe(100);
    expect(playerBuyIn(event, { days: { '1': { playing: false, games: [] }, '2': { playing: false, games: [] } } })).toBe(0);
  });

  it('sizes pots by who is actually in them', () => {
    const roster = [{}, { choices: { days: { '1': { playing: true, games: ['ctp'] } } } }];
    const lines = buyInBreakdown({ buy_in: 220, ...event }, 2, roster).lines;
    expect(lines.find((line) => line.label === 'Day 1 net skins')?.pot).toBe(50);
    expect(lines.find((line) => line.label === 'Day 1 closest to the pin')?.pot).toBe(100);
  });

  it('keeps players of four-player games together when ordering groups', () => {
    const players = [
      { id: 'a', games: ['skins'] }, { id: 'b', games: ['wolf'] }, { id: 'c', games: [] }, { id: 'd', games: ['wolf'] },
      { id: 'e', games: ['wolf', 'skins'] }, { id: 'f', games: ['vegas'] }, { id: 'g', games: ['wolf'] },
    ];
    expect(suggestGroupOrder(players).map((player) => player.id)).toEqual(['b', 'd', 'e', 'g', 'f', 'a', 'c']);
  });
});

describe('events saved on this phone', () => {
  it('hides an event until it is opened again, and forgets a deleted one completely', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() { return data.size; },
      key: (index: number) => [...data.keys()][index] ?? null,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    });
    rememberMyEvent('BDAY27', 'Birthday Cup', 'secret');
    rememberJoinedEvent('TRIP26', 'Golf Trip');
    expect(readSavedEvents().map((entry) => entry.code).sort()).toEqual(['BDAY27', 'TRIP26']);
    hideSavedEvent('TRIP26');
    expect(readSavedEvents().map((entry) => entry.code)).toEqual(['BDAY27']);
    rememberJoinedEvent('TRIP26', 'Golf Trip');
    expect(readSavedEvents().map((entry) => entry.code).sort()).toEqual(['BDAY27', 'TRIP26']);
    forgetSavedEvent('BDAY27');
    expect(readSavedEvents().map((entry) => entry.code)).toEqual(['TRIP26']);
    expect(data.has('triple-track-organizer:BDAY27')).toBe(false);
    vi.unstubAllGlobals();
  });
});
