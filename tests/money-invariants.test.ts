import { describe, expect, it } from 'vitest';
import { generateRound, rng, type GenOptions } from './helpers/round-generator';
import { settlePage } from './helpers/settle-lines';
import { computeGroupGames, isPotGame, type GroupGameKey } from '@/lib/games/group-games';
import { netDebts, type Debt } from '@/lib/offline/net-payments';
import { useRoundStore } from '@/stores/round-store';

/**
 * Property tests over seeded random rounds. These assert invariants that hold for the current
 * code (transfers are zero-sum, netting preserves balances, nothing is NaN). Exact-cent pot
 * distribution and the rule disagreements live in tests/money-known-bugs.test.ts.
 */

const ALL_GROUP_GAMES: Partial<Record<GroupGameKey, number>> = {
  wolf: 2, vegas: 0.25, bingo_bango_bongo: 1, match_play: 5, best_ball: 5, better_ball: 5, four_ball: 5, sixes: 2,
  medal_play: 1, medal_play_group: 40, skins_group: 30, stableford_group: 20, nines: 1, quota: 1, rabbit: 5, aces_and_deuces: 1,
};
const POTS = { skins: 100, ctp: 80, lowNet: 100, nassau: 90, stableford: 60, birdie: 50, eagle: 40 };

function scenarios(): Array<{ seed: number; opts: GenOptions }> {
  const shapes = [[2], [3], [4], [5], [4, 4], [4, 3], [5, 4, 2], [3, 3, 3], [4, 4, 4, 4]];
  const list: Array<{ seed: number; opts: GenOptions }> = [];
  for (let seed = 1; seed <= 180; seed += 1) {
    const r = rng(seed * 7919);
    list.push({
      seed,
      opts: {
        groupSizes: shapes[seed % shapes.length],
        savedFraction: r.pick([1, 1, 1, 0.5, 0.3, 0]),
        decimalHandicaps: r.chance(0.3),
        games: ALL_GROUP_GAMES,
        pots: POTS,
        holeInOne: true,
      },
    });
  }
  return list;
}

const finite = (value: number) => Number.isFinite(value);
const balance = (debts: Array<Pick<Debt, 'fromId' | 'toId' | 'amount'>>) => {
  const map = new Map<string, number>();
  debts.forEach((debt) => {
    map.set(debt.fromId, (map.get(debt.fromId) ?? 0) - debt.amount);
    map.set(debt.toId, (map.get(debt.toId) ?? 0) + debt.amount);
  });
  return map;
};

describe('money invariants over generated rounds', () => {
  const cases = scenarios();

  it.each(cases)('seed $seed: banker ledger is zero-sum and settle-up preserves each player\'s balance', ({ seed, opts }) => {
    const { runningTotals, bankerSettlements, round } = settlePage(generateRound(seed, opts));
    runningTotals.forEach((item) => expect(finite(item.amount)).toBe(true));
    expect(Math.abs(runningTotals.reduce((sum, item) => sum + item.amount, 0))).toBeLessThan(1e-6);

    const settled = balance(bankerSettlements.map((item) => ({ fromId: item.fromPlayerId, toId: item.toPlayerId, amount: item.amount })));
    runningTotals.forEach((item) => expect(settled.get(item.playerId) ?? 0).toBeCloseTo(item.amount, 6));

    // Greedy settle-up uses at most (players in group − 1) transfers per group.
    const groups = round.multiFoursome!.groups.map((group) => group.groupNumber);
    groups.forEach((groupNumber) => {
      const size = round.multiFoursome!.groupPlayers.filter((item) => item.groupNumber === groupNumber).length;
      expect(bankerSettlements.filter((item) => item.groupNumber === groupNumber).length).toBeLessThanOrEqual(Math.max(0, size - 1));
    });
    bankerSettlements.forEach((item) => expect(item.amount).toBeGreaterThan(0));
  });

  it.each(cases)('seed $seed: every group game is zero-sum apart from its pot, with no NaN', ({ seed, opts }) => {
    const round = generateRound(seed, opts);
    const results = computeGroupGames(round);
    results.forEach((result) => {
      const standingsTotal = result.standings.reduce((sum, item) => sum + item.amount, 0);
      const potTotal = result.pots.reduce((sum, item) => sum + item.amount, 0);
      result.standings.forEach((item) => expect(finite(item.amount)).toBe(true));
      result.debts.forEach((debt) => {
        expect(finite(debt.amount)).toBe(true);
        expect(debt.amount).toBeGreaterThan(0);
        expect(debt.fromId).not.toBe(debt.toId);
      });
      // standings are rounded per player, so allow half a cent per player.
      expect(Math.abs(standingsTotal - potTotal)).toBeLessThanOrEqual(0.005 * result.standings.length + 1e-9);
      if (isPotGame(result.key)) {
        expect(result.debts).toEqual([]);
        // A pot game pays out its whole pot when anyone wins (within 1 cent per winner of rounding).
        if (result.pots.length) expect(Math.abs(potTotal - (ALL_GROUP_GAMES[result.key] ?? 0))).toBeLessThanOrEqual(0.01 * result.pots.length);
      } else {
        expect(result.pots).toEqual([]);
      }
    });
  });

  it.each(cases)('seed $seed: round-wide pots pay out the whole pot when there is a winner', ({ seed, opts }) => {
    const { potLists } = settlePage(generateRound(seed, opts));
    const check = (list: Array<{ amount: number }>, pot: number) => {
      list.forEach((item) => expect(finite(item.amount)).toBe(true));
      const total = list.reduce((sum, item) => sum + item.amount, 0);
      if (list.length) expect(total).toBeCloseTo(pot, 6);
    };
    check(potLists.Skins, POTS.skins);
    check(potLists['Closest to the pin'], POTS.ctp);
    check(potLists['Low net'], POTS.lowNet);
    check(potLists.Stableford, POTS.stableford);
    check(potLists['Birdie pot'], POTS.birdie);
    check(potLists['Eagle pot'], POTS.eagle);
    // Nassau is checked only on 18-hole rounds where all three contests can be decided.
    const done = opts.savedFraction === 1;
    if (done && potLists.Nassau.length) check(potLists.Nassau, POTS.nassau);
  });

  it.each(cases)('seed $seed: netted "who pays whom" equals the sum of every game ledger (to the cent)', ({ seed, opts }) => {
    const { rawDebts, transfers, runningTotals, groupGameResults } = settlePage(generateRound(seed, opts));
    const raw = balance(rawDebts);
    const netted = balance(transfers);
    const people = new Set([...raw.keys(), ...netted.keys()]);
    const pairs = transfers.length;
    people.forEach((id) => {
      // netDebts rounds each pair line to cents: at most ½ cent drift per line touching the player.
      expect(Math.abs((netted.get(id) ?? 0) - (raw.get(id) ?? 0))).toBeLessThanOrEqual(0.005 * Math.max(1, pairs) + 1e-9);
    });
    // Raw debts: banker settle-up must carry exactly the banker running totals.
    const banker = new Map(runningTotals.map((item) => [item.playerId, item.amount]));
    const groupOnly = balance(groupGameResults.flatMap((result) => result.debts));
    people.forEach((id) => {
      const aces = rawDebts.filter((debt) => debt.reason === 'Hole in one');
      const aceBal = balance(aces).get(id) ?? 0;
      expect(raw.get(id) ?? 0).toBeCloseTo((banker.get(id) ?? 0) + (groupOnly.get(id) ?? 0) + aceBal, 6);
    });
    // One line per pair, never both directions, never zero.
    const keys = transfers.map((t) => [t.fromId, t.toId].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    transfers.forEach((t) => expect(t.amount).toBeGreaterThanOrEqual(0.01));
  });

  it.each(cases.filter(({ opts }) => opts.savedFraction !== 1))('seed $seed: unsaved holes never move money', ({ seed, opts }) => {
    const round = generateRound(seed, opts);
    const before = settlePage(round);
    // Scribble scores, presses and CTP picks on every unsaved hole: nothing should change.
    const scribbled = {
      ...round,
      holes: round.holes.map((hole) => (hole.isSaved ? hole : {
        ...hole,
        bankerGrossScore: 2,
        bankerPressed: true,
        ctpWinnerPlayerId: null,
        matchups: hole.matchups.map((m) => ({ ...m, grossScore: 9, pressed: true })),
      })),
    };
    const after = settlePage(scribbled);
    expect(after.transfers).toEqual(before.transfers);
    expect(after.potCollections).toEqual(before.potCollections);
  });
});

describe('netDebts', () => {
  it('preserves every player\'s balance on random debt sets', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const r = rng(seed);
      const ids = Array.from({ length: r.int(2, 8) }, (_, i) => `p${i}`);
      const debts: Debt[] = Array.from({ length: r.int(1, 30) }, () => {
        const fromId = r.pick(ids);
        const toId = r.pick(ids);
        return { fromId, fromName: fromId, toId, toName: toId, amount: r.int(1, 4000) / 100, reason: r.pick(['Banker', 'Wolf', 'Side bet']) };
      });
      const raw = balance(debts.filter((d) => d.fromId !== d.toId));
      const netted = balance(netDebts(debts));
      ids.forEach((id) => expect(netted.get(id) ?? 0).toBeCloseTo(raw.get(id) ?? 0, 6));
    }
  });
});

describe('partial rounds', () => {
  it('a round with nothing saved pays nothing and does not throw', () => {
    const { transfers, potCollections, runningTotals } = settlePage(generateRound(42, { groupSizes: [4, 4], savedFraction: 0, games: ALL_GROUP_GAMES, pots: POTS, holeInOne: true }));
    expect(transfers).toEqual([]);
    expect(runningTotals.every((item) => item.amount === 0)).toBe(true);
    // CTP picks are only generated on saved holes, so no pot money should move either — except Low net,
    // which splits its pot among everyone at 0 (see money-known-bugs.test.ts).
    expect(potCollections.filter((c) => c.games.some((g) => g.game !== 'Low net'))).toEqual([]);
  });

  it('store getters survive a hole marked saved with a missing score', () => {
    const round = generateRound(7, { groupSizes: [4], pots: POTS, games: ALL_GROUP_GAMES });
    round.holes[0].matchups[0].grossScore = null;
    expect(() => settlePage(round)).not.toThrow();
    const s = useRoundStore.getState();
    s.getGrossTotals().forEach((item) => expect(finite(item.netTotal)).toBe(true));
  });
});
