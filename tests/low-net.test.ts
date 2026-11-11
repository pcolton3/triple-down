import { describe, expect, it } from 'vitest';
import { buildRound, eighteen, load, player } from './helpers/simple-round';

// House rule: low net winner takes the whole pot; a tie for first splits it.
describe('low net pot', () => {
  it('a sole winner takes the whole pot', () => {
    const s = load(buildRound([player('a', 0), player('b', 0), player('c', 0)], eighteen(() => ({ a: 4, b: 5, c: 6 })), { lowNetEnabled: true, lowNetPot: 100 }));
    const pay = Object.fromEntries(s.getLowNetSummary().payouts.map((p) => [p.playerId, p.amount]));
    expect(pay).toEqual({ a: 100, b: 0, c: 0 });
  });

  it('a tie for first splits the pot', () => {
    const s = load(buildRound([player('a', 0), player('b', 0), player('c', 0)], eighteen(() => ({ a: 4, b: 4, c: 6 })), { lowNetEnabled: true, lowNetPot: 100 }));
    const pay = Object.fromEntries(s.getLowNetSummary().payouts.map((p) => [p.playerId, p.amount]));
    expect(pay).toEqual({ a: 50, b: 50, c: 0 });
  });
});
