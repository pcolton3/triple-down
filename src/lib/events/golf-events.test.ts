import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
import { buildSchedule, buyInBreakdown, safeLink, type EventDay } from './golf-events';

const days: EventDay[] = [
  { day: 1, date: '2027-04-27', format: 'team_match', teeTime: '08:30' },
  { day: 2, date: '2027-04-28', format: 'singles_match', teeTime: '09:00' },
];

describe('buyInBreakdown', () => {
  it('splits a $300 buy-in into team bet, CTP and skins per day', () => {
    const result = buyInBreakdown({ buy_in: 300, team_bet: 100, ctp_per_day: 50, skins_per_day: 50, days }, 12);
    expect(result.allocated).toBe(300);
    expect(result.unallocated).toBe(0);
    expect(result.total).toBe(3600);
    expect(result.lines.map((line) => line.pot)).toEqual([1200, 600, 600, 600, 600]);
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
