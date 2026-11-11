import { describe, expect, it } from 'vitest';
import { buildRound, eighteen, player } from '../../../tests/helpers/simple-round';
import { eventMoney } from './event-money';
import type { GolfEvent, Signup } from './golf-events';

const event = {
  id: 'e', code: 'CUP', title: 'Cup', description: '', agenda: [], buy_in: 150, team_bet: 100, ctp_per_day: 0, skins_per_day: 0,
  team_one_name: 'Reds', team_two_name: 'Blues', signups_open: true, max_players: null,
  days: [{ day: 1, date: '2027-04-24', format: 'team_match', roundCode: 'R1', games: [{ key: 'low_net', amount: 50 }] }],
} as unknown as GolfEvent;
const signup = (name: string, team: 'team_one' | 'team_two', paid = true): Signup => ({ id: name, name: name.toUpperCase(), email: '', handicap: 0, team, paid, created_at: '' });
const signups = [signup('a', 'team_one'), signup('b', 'team_one', false), signup('c', 'team_two'), signup('d', 'team_two')];

function cupRound(scores: (hole: number) => Record<string, number>, saved = true) {
  const round = buildRound(['a', 'b', 'c', 'd'].map((id) => player(id, 0)), eighteen(scores, saved ? {} : { 18: { saved: false } }), {
    lowNetEnabled: true, lowNetPot: 200, teamMatchPlayEnabled: true, ryderCupFormat: 'team_match',
    teamAssignments: { a: 'team_one', b: 'team_one', c: 'team_two', d: 'team_two' },
  });
  return round;
}

describe('eventMoney', () => {
  it('pays pots and the team bet, and charges the unpaid buy-in', () => {
    // A wins every hole for the Reds, so Reds win the Cup and A takes low net.
    const result = eventMoney(event, signups, [{ day: 1, round: cupRound(() => ({ a: 3, b: 5, c: 4, d: 5 })) }]);
    expect(result.cup).toMatchObject({ leader: 'team_one', final: true, teamOne: 1, teamTwo: 0 });
    expect(result.teamBetPot).toBe(400);
    const row = (name: string) => result.rows.find((r) => r.name === name)!;
    expect(row('A')).toMatchObject({ buyIn: 150, potTotal: 200, teamBetWon: 200, net: 400 });
    expect(row('B')).toMatchObject({ teamBetWon: 200, net: 50 }); // won 200 but owes the 150 buy-in
    expect(row('C')).toMatchObject({ potTotal: 0, teamBetWon: 0, net: 0 });
    expect(result.totals).toMatchObject({ buyInsDue: 600, collected: 450, potsPaid: 200, teamBetPaid: 400, left: 0 });
  });

  it('holds the team bet until every team day is finished', () => {
    const result = eventMoney(event, signups, [{ day: 1, round: cupRound(() => ({ a: 3, b: 5, c: 4, d: 5 }), false) }]);
    expect(result.cup.final).toBe(false);
    expect(result.rows.every((r) => r.teamBetWon === 0)).toBe(true);
    expect(result.notes).toContain('The team bet pays out once every team day is finished.');
  });

  it('gives stakes back on a tied Cup', () => {
    const result = eventMoney(event, signups, [{ day: 1, round: cupRound(() => ({ a: 4, b: 5, c: 4, d: 5 })) }]);
    expect(result.cup.leader).toBe('tie');
    expect(result.rows.map((r) => r.teamBetWon)).toEqual([100, 100, 100, 100]);
  });
});
