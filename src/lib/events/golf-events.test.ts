import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
import { buildSchedule, buyInBreakdown, isTeamEvent, normalizeEvent, renumberDays, safeLink, suggestedBuyIn, validateDraft, type EventDay, type GolfEvent } from './golf-events';

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
    const casual: EventDay[] = [{ day: 1, date: '2027-05-01', format: 'stroke_play', games: [{ key: 'skins', amount: 20 }, { key: 'nassau', amount: 5 }] }];
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
});

describe('safeLink', () => {
  it('allows web links only', () => {
    expect(safeLink('example.com/menu')).toBe('https://example.com/menu');
    expect(safeLink('javascript:alert(1)')).toBe('');
  });
});
