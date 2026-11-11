import { describe, expect, it } from 'vitest';
import { collectPotWins } from '@/lib/offline/net-payments';
import { computeGroupGames } from '@/lib/games/group-games';
import type { RoundState } from '@/types/round';
import { buildRound, eighteen, load, player } from './helpers/simple-round';

/** Regression tests for scoring bugs fixed before the Birthday Cup (house rules / src/lib/games/help.ts). */

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

describe('Low net: winner takes all', () => {
  // round-store.ts buildLowNetSummary ~L887-907. House rule + help.ts:37: "The winner takes the pot; ties split it."
  it('a sole low-net winner takes the whole pot', () => {
    const s = load(buildRound([player('a', 0), player('b', 0), player('c', 0)], eighteen(() => ({ a: 4, b: 5, c: 6 })), { lowNetEnabled: true, lowNetPot: 100 }));
    const pay = Object.fromEntries(s.getLowNetSummary().payouts.map((p) => [p.playerId, p.amount]));
    expect(pay).toEqual({ a: 100, b: 0, c: 0 });
  });
});

describe('Low net waits until everyone has the same holes in', () => {
  // round-store.ts buildLowNetSummary ~L858-886 sums saved holes only, with no "holes counted" check.
  it('pays nobody before any hole is saved', () => {
    const s = load(buildRound([player('a', 0), player('b', 0)], eighteen(() => ({ a: 4, b: 4 }), Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, { saved: false }]))), { lowNetEnabled: true, lowNetPot: 100 }));
    expect(s.getLowNetSummary().payouts.filter((p) => p.amount > 0)).toEqual([]);
  });

  it('does not rank a player through 9 against a player through 18 (multi-group)', () => {
    // Group 1 (a) finished 18 holes at even par; group 2 (b) is through 9 at +9 — still "leads" on 45 vs 72.
    const holes = eighteen(() => ({ a: 4, b: 5 }));
    const round = buildRound([player('a', 0), player('b', 0)], holes, { lowNetEnabled: true, lowNetPot: 100 }, [['a'], ['b']]);
    round.holes.forEach((hole) => { if (hole.groupNumber === 2 && hole.holeNumber > 9) hole.isSaved = false; });
    const s = load(round);
    const pay = Object.fromEntries(s.getLowNetSummary().payouts.map((p) => [p.playerId, p.amount]));
    expect(pay.b).toBe(0);
  });
});

describe('Banker pops with decimal handicaps', () => {
  // round-store.ts getMatchupNetScores L480-485: Math.abs(8.2 - 0.2) === 7.999999999999999, so `diff >= 8` is false.
  // Decimal handicaps reach the store from saved golfers (WHS index, toFixed(1)) and event prefill.
  it('8.2 vs 0.2 is a difference of 8: the player gets a pop on stroke index 8', () => {
    const s = load(buildRound([player('b', 0.2), player('p', 8.2)], [{ par: 4, index: 8, gross: { b: 4, p: 5 } }]));
    const m = s.getCurrentHoleSummary(1, 1).matchups[0];
    expect(m.playerGetsStroke).toBe(true);
    expect(s.getRunningTotals().find((t) => t.playerId === 'p')!.amount).toBe(0);
  });
});

describe('No birdie auto double label when both sides birdie', () => {
  // round-store.ts buildModifierLabels L511-517 adds the label if EITHER birdied; settleBankerHole correctly uses 1×.
  // Shown on the group scoring page (group/[groupNumber]/page.tsx:919).
  it('no auto-double label when banker and player both make gross birdie', () => {
    const s = load(buildRound([player('b', 0), player('p', 10)], [{ par: 4, index: 1, gross: { b: 3, p: 3 } }]));
    const m = s.getCurrentHoleSummary(1, 1).matchups[0];
    expect(m.totalMultiplier).toBe(1);
    expect(m.modifiers).not.toContain('birdie auto double');
  });
});

describe('Pot splits pay out every cent', () => {
  // Shares are split in whole cents (splitCents), so $100 three ways is 33.34 + 33.33 + 33.33.
  it('skins $100 over 3 skins pays out $100.00 on the settle-up lines', () => {
    const holes = eighteen(() => ({ a: 4, b: 4, c: 4 }), { 1: { gross: { a: 3, b: 4, c: 4 } }, 2: { gross: { a: 4, b: 3, c: 4 } }, 3: { gross: { a: 4, b: 4, c: 3 } } });
    const s = load(buildRound([player('a', 0), player('b', 0), player('c', 0)], holes, { bankerEnabled: false, skinsEnabled: true, skinsPot: 100 }));
    const lines = collectPotWins(s.getSkinsSummary().payouts.map((p) => ({ playerId: p.playerId, playerName: p.playerName, amount: p.amount, game: 'Skins' })));
    expect(sum(lines.map((l) => l.amount))).toBe(100);
  });

  it('low net 3-way tie on $100 pays out $100.00', () => {
    const s = load(buildRound([player('a', 0), player('b', 0), player('c', 0)], eighteen(() => ({ a: 4, b: 4, c: 4 })), { bankerEnabled: false, lowNetEnabled: true, lowNetPot: 100 }));
    const lines = collectPotWins(s.getLowNetSummary().payouts.map((p) => ({ ...p, game: 'Low net' })));
    expect(sum(lines.map((l) => l.amount))).toBe(100);
  });

  it('Medal Play Group pot of $10 with a 3-way tie pays out $10.00', () => {
    // group-games.ts:332 cents(unit / winners.length)
    const round = buildRound([player('a', 0), player('b', 0), player('c', 0)], eighteen(() => ({ a: 4, b: 4, c: 4 })), {
      bankerEnabled: false, extraGames: { medal_play_group: true }, extraGameUnits: { medal_play_group: 10 },
    } as Partial<RoundState['gameSettings']>);
    const result = computeGroupGames(round).find((r) => r.key === 'medal_play_group')!;
    expect(sum(result.pots.map((p) => p.amount))).toBe(10);
  });
});

describe('CTP across groups: the most recent mark wins', () => {
  // Groups only mark when they beat the current mark (the on-course process), so the latest mark is the closest.
  const twoGroups = (marks: Record<number, { ctp: string; at: number }>) => {
    const round = buildRound(
      [player('a', 0), player('b', 0), player('c', 0), player('d', 0)],
      [{ par: 3, index: 1, gross: { a: 3, b: 3, c: 3, d: 3 } }],
      { ctpEnabled: true, ctpPot: 100 },
      [['a', 'b'], ['c', 'd']]
    );
    round.holes = round.holes.map((hole) => {
      const mark = marks[hole.groupNumber ?? 1];
      return mark ? { ...hole, ctpWinnerPlayerId: mark.ctp, gameData: { ctpMarkedAt: mark.at } } : hole;
    });
    return Object.fromEntries(load(round).getCtpSummary().payouts.map((p) => [p.playerId, p.amount]));
  };

  it('a later group that beat the mark wins', () => {
    expect(twoGroups({ 1: { ctp: 'a', at: 1000 }, 2: { ctp: 'c', at: 2000 } })).toMatchObject({ a: 0, c: 100 });
  });

  it('an earlier group syncing late does not take it back', () => {
    // Group 2 marked later on the course; group 1's phone was offline and its save arrives last.
    expect(twoGroups({ 2: { ctp: 'c', at: 2000 }, 1: { ctp: 'a', at: 1000 } })).toMatchObject({ a: 0, c: 100 });
    expect(twoGroups({ 1: { ctp: 'a', at: 3000 }, 2: { ctp: 'c', at: 2000 } })).toMatchObject({ a: 100, c: 0 });
  });
});
