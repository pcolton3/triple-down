import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
import { buildEventRoundPrefill } from './event-rounds';
import type { GolfEvent, Signup } from './golf-events';

const event = {
  id: 'e', code: 'BDAY27', title: 'Birthday Cup', description: '', agenda: [], buy_in: 0, team_bet: 100,
  ctp_per_day: 0, skins_per_day: 0, team_one_name: 'Reds', team_two_name: 'Blues', signups_open: true, max_players: null,
  days: [{ day: 1, date: '2027-04-27', format: 'team_match', course: 'Talking Rock', games: [
    { key: 'skins', amount: 20 }, { key: 'banker', amount: 5 }, { key: 'wolf', amount: 2 },
  ] }],
} as unknown as GolfEvent;

const signup = (name: string, team: 'team_one' | 'team_two', games?: string[], playing = true): Signup => ({
  id: name, name, email: `${name}@x.com`, handicap: 10, team, paid: false, created_at: '',
  ...(games || !playing ? { choices: { days: { '1': { playing, games: games ?? [] } } } } : {}),
});

describe('buildEventRoundPrefill', () => {
  it('turns signups into players with their game choices and pots sized by who is in', () => {
    const prefill = buildEventRoundPrefill(event, [
      signup('Al', 'team_one'), // everything
      signup('Bo', 'team_two', ['skins']),
      signup('Cy', 'team_one', ['banker', 'wolf']),
      signup('Di', 'team_two', [], false),
    ], 1);
    expect(prefill.title).toBe('Birthday Cup · Day 1');
    expect(prefill.courseName).toBe('Talking Rock');
    // Wolf players first (Al, Cy), then the rest; Di isn't playing.
    expect(prefill.players.map((player) => player.name)).toEqual(['Al', 'Cy', 'Bo']);
    expect(prefill.players.map((player) => [player.bankerParticipant, player.skinsParticipant])).toEqual([[true, true], [true, false], [false, true]]);
    expect(prefill.settings.skinsPot).toBe(40);
    expect(prefill.defaultBet).toBe(5);
    expect(prefill.settings.wolfUnit).toBe(2);
    expect(prefill.settings.excludedPlayers).toEqual({ wolf: ['p3'] });
    expect(prefill.teamMatch?.format).toBe('team_match');
    expect(prefill.settings.teamAssignments).toEqual({ p1: 'team_one', p2: 'team_one', p3: 'team_two' });
    expect(prefill.notes).toContain('1 signed-up player is not playing this day.');
  });
});
