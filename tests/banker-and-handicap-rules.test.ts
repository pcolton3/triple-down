import { describe, expect, it } from 'vitest';
import { settleBankerHole } from '@/domain/banker/settle-banker-hole';
import { netFor } from '@/lib/games/group-games';
import { buildEventRoundPrefill } from '@/lib/events/event-rounds';
import type { GolfEvent, Signup } from '@/lib/events/golf-events';
import type { HoleState } from '@/types/round';
import { buildRound, eighteen, load, player } from './helpers/simple-round';

/** House rules for Banker, checked through the store (the code path settle-up uses). */
describe('Banker house rules', () => {
  const one = (bankerHcp: number, playerHcp: number, hole: { par: 3 | 4 | 5; index: number; b: number; p: number; pressed?: boolean; bankerPressed?: boolean }) => {
    const s = load(buildRound([player('b', bankerHcp), player('p', playerHcp)], [{
      par: hole.par, index: hole.index, gross: { b: hole.b, p: hole.p }, pressed: hole.pressed ? ['p'] : [], bankerPressed: hole.bankerPressed,
    }]));
    return { summary: s.getCurrentHoleSummary(1, 1).matchups[0], totals: Object.fromEntries(s.getRunningTotals().map((t) => [t.playerId, t.amount])) };
  };

  it('gives the higher handicap one pop on holes whose index <= the difference', () => {
    expect(one(5, 13, { par: 4, index: 8, b: 4, p: 5 }).summary.playerNetScore).toBe(4); // diff 8, index 8: pop -> push
    expect(one(5, 13, { par: 4, index: 8, b: 4, p: 5 }).totals.p).toBe(0);
    expect(one(5, 13, { par: 4, index: 9, b: 4, p: 5 }).summary.playerGetsStroke).toBe(false);
    expect(one(13, 5, { par: 4, index: 3, b: 5, p: 4 }).summary.bankerGetsStroke).toBe(true);
  });

  it('max one pop per hole even when the difference exceeds 18', () => {
    const { summary } = one(0, 30, { par: 4, index: 1, b: 4, p: 6 });
    expect(summary.playerNetScore).toBe(5);
    expect(one(0, 30, { par: 4, index: 1, b: 4, p: 6 }).totals.p).toBe(-10);
  });

  it('no pops on par 3s, even on the hardest index', () => {
    const { summary, totals } = one(0, 30, { par: 3, index: 1, b: 3, p: 4 });
    expect(summary.playerGetsStroke).toBe(false);
    expect(totals.p).toBe(-10);
  });

  it('one-sided gross birdie doubles; player press doubles on par 4 and triples on par 3', () => {
    expect(one(0, 0, { par: 4, index: 1, b: 5, p: 3 }).totals.p).toBe(20);
    expect(one(0, 0, { par: 4, index: 1, b: 5, p: 3, pressed: true }).totals.p).toBe(40);
    expect(one(0, 0, { par: 3, index: 1, b: 4, p: 3 }).totals.p).toBe(10); // par 3: 3 is par, no birdie
    expect(one(0, 0, { par: 3, index: 1, b: 4, p: 2, pressed: true }).totals.p).toBe(60); // triple × birdie double
    expect(one(0, 0, { par: 3, index: 1, b: 4, p: 3, pressed: true, bankerPressed: true }).totals.p).toBe(90); // 3 × 3
  });

  it('both gross birdie: no automatic double, lower net wins, presses still multiply', () => {
    // Player gets a pop on index 1 (diff 10): gross 3 / net 2 beats banker gross 3 / net 3.
    expect(one(0, 10, { par: 4, index: 1, b: 3, p: 3 }).totals.p).toBe(10);
    expect(one(0, 10, { par: 4, index: 1, b: 3, p: 3, pressed: true }).totals.p).toBe(20);
    expect(one(0, 10, { par: 4, index: 1, b: 3, p: 3, pressed: true, bankerPressed: true }).totals.p).toBe(40);
    // Banker eagle vs player birdie: both birdie-or-better, banker lower net.
    expect(one(0, 0, { par: 5, index: 1, b: 3, p: 4 }).totals.p).toBe(-10);
  });

  it('same net is a push regardless of birdies or presses', () => {
    expect(one(0, 10, { par: 4, index: 1, b: 3, p: 4, pressed: true, bankerPressed: true }).totals.p).toBe(0);
    expect(settleBankerHole({ par: 4, bankerPlayerId: 'b', bankerGrossScore: 3, bankerNetScore: 3, matchups: [{ playerId: 'p', baseWager: 5, pressCount: 2, playerGrossScore: 4, playerNetScore: 3 }] })[0].finalAmount).toBe(0);
  });

  it('one birdie plus a press on a par 4 is 4×', () => {
    expect(one(0, 0, { par: 4, index: 1, b: 3, p: 5, pressed: true }).totals.p).toBe(-40);
  });

  it('pops over a full 18 equal the difference minus the par-3 holes in range (current behaviour)', () => {
    // Indexes 1..18; holes 3 and 6 are par 3. Diff 8 -> pops on indexes 1,2,4,5,7,8 = 6 pops.
    const holes = eighteen(() => ({ b: 4, p: 5 }), { 3: { par: 3, gross: { b: 3, p: 4 } }, 6: { par: 3, gross: { b: 3, p: 4 } } });
    const s = load(buildRound([player('b', 0), player('p', 8)], holes));
    const pops = s.getHoleHistory().filter((h) => h.matchups[0].playerGetsStroke).map((h) => h.holeNumber);
    expect(pops).toEqual([1, 2, 4, 5, 7, 8]);
  });
});

describe('full-handicap stroke allocation (netFor and the store share it)', () => {
  const hole = (index: number): HoleState => ({ holeNumber: index, par: 4, handicapIndex: index, bankerPlayerId: 'x', bankerGrossScore: 10, bankerPressed: false, isSaved: true, matchups: [] });
  const strokes = (handicap: number, totalHoles = 18) =>
    Array.from({ length: totalHoles }, (_, i) => 10 - netFor({ players: [{ id: 'x', name: 'X', handicap }], totalHoles }, hole(i + 1), 'x')!);

  it('allocates by stroke index for 0, 1, 17, 18', () => {
    expect(strokes(0).every((s) => s === 0)).toBe(true);
    expect(strokes(1)).toEqual([1, ...Array(17).fill(0)]);
    expect(strokes(17)).toEqual([...Array(17).fill(1), 0]);
    expect(strokes(18).every((s) => s === 1)).toBe(true);
  });

  it('gives two strokes on the hardest holes above 18, three above 36', () => {
    expect(strokes(20)).toEqual([2, 2, ...Array(16).fill(1)]);
    expect(strokes(36).every((s) => s === 2)).toBe(true);
    expect(strokes(40)).toEqual([3, 3, 3, 3, ...Array(14).fill(2)]);
    expect(strokes(27).reduce((a, b) => a + b, 0)).toBe(27);
  });

  it('total strokes over the round equal the integer handicap for every handicap 0-54', () => {
    for (let h = 0; h <= 54; h += 1) expect(strokes(h).reduce((a, b) => a + b, 0)).toBe(h);
  });

  it('9-hole round with indexes 1-9 allocates by the 9-hole scale', () => {
    expect(strokes(5, 9)).toEqual([1, 1, 1, 1, 1, 0, 0, 0, 0]);
    expect(strokes(11, 9)).toEqual([2, 2, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('decimal handicaps truncate (12.6 plays as 12) and plus handicaps play as scratch (current behaviour)', () => {
    expect(strokes(12.6).reduce((a, b) => a + b, 0)).toBe(12);
    expect(strokes(-2).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('event rounds play off the event low', () => {
  it('subtracts the lowest handicap of everyone signed up, from every player', () => {
    const event = {
      code: 'EV', title: 'Cup', team_one_name: 'A', team_two_name: 'B', team_bet: 0,
      days: [{ day: 1, date: '2027-01-01', format: 'stroke_play', games: [{ key: 'skins', amount: 20 }] }, { day: 2, date: '2027-01-02', format: 'stroke_play', games: [] }],
    } as unknown as GolfEvent;
    const signups = [
      { name: 'Low', handicap: 3.2, choices: { days: { '1': { playing: false, games: [] }, '2': { playing: true, games: [] } } } },
      { name: 'Mid', handicap: 11.4 },
      { name: 'High', handicap: 24 },
    ] as unknown as Signup[];
    const prefill = buildEventRoundPrefill(event, signups, 1);
    expect(Object.fromEntries(prefill.players.map((p) => [p.name, p.handicap]))).toEqual({ Mid: 8, High: 21 }); // 8.2 and 20.8, rounded to whole strokes
    expect(prefill.settings.skinsPot).toBe(40);
  });
});
