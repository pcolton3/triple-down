import { describe, expect, it } from 'vitest';
import type { HoleGameData, HoleState, Player, RoundState } from '@/types/round';
import { computeGroupGames, netFor, vegasNumber, wolfOrder, type GroupGameKey } from './group-games';
import { netDebts } from '@/lib/offline/net-payments';

const players: Player[] = [
  { id: 'a', name: 'Al', handicap: 0 },
  { id: 'b', name: 'Bo', handicap: 0 },
  { id: 'c', name: 'Cy', handicap: 0 },
  { id: 'd', name: 'Di', handicap: 0 },
];

/** scores[h] = gross for a, b, c, d on hole h+1 (all par 4, stroke index = hole number). */
function makeRound(scores: number[][], opts: { games?: Partial<Record<GroupGameKey, number>>; data?: Record<number, HoleGameData>; roster?: Player[] } = {}): RoundState {
  const roster = opts.roster ?? players;
  const holes: HoleState[] = scores.map((row, index) => ({
    groupNumber: 1,
    holeNumber: index + 1,
    par: 4,
    handicapIndex: index + 1,
    bankerPlayerId: roster[0].id,
    bankerGrossScore: row[0],
    bankerPressed: false,
    isSaved: true,
    matchups: roster.slice(1).map((player, i) => ({ playerId: player.id, baseWager: 0, pressed: false, grossScore: row[i + 1] })),
    ...(opts.data?.[index + 1] ? { gameData: opts.data[index + 1] } : {}),
  }));
  const games = opts.games ?? {};
  const core = ['wolf', 'vegas', 'bingo_bango_bongo', 'match_play'];
  return {
    id: 'r', roundCode: 'TEST', title: 'Test', courseName: 'Course', currentHole: 1, totalHoles: 18, defaultBet: 0,
    players: roster,
    holes,
    multiFoursome: { enabled: true, groupSize: 4, groups: [{ groupNumber: 1, currentHole: 1 }], groupPlayers: roster.map((player, sortOrder) => ({ playerId: player.id, groupNumber: 1, sortOrder })) },
    gameSettings: {
      wolfEnabled: 'wolf' in games, wolfUnit: games.wolf,
      vegasEnabled: 'vegas' in games, vegasUnit: games.vegas,
      bingoBangoBongoEnabled: 'bingo_bango_bongo' in games, bingoBangoBongoUnit: games.bingo_bango_bongo,
      matchPlayEnabled: 'match_play' in games, matchPlayUnit: games.match_play,
      extraGames: Object.fromEntries(Object.keys(games).filter((key) => !core.includes(key)).map((key) => [key, true])),
      extraGameUnits: Object.fromEntries(Object.entries(games).filter(([key]) => !core.includes(key))),
    },
  } as unknown as RoundState;
}

const standing = (round: RoundState, key: GroupGameKey) =>
  Object.fromEntries(computeGroupGames(round).find((result) => result.key === key)!.standings.map((item) => [item.playerId, item.amount]));

describe('net scores', () => {
  it('gives strokes on the hardest holes, matching the rest of the app', () => {
    const round = makeRound([[5, 5, 5, 5]], { roster: [{ ...players[0], handicap: 20 }, ...players.slice(1)] });
    // 20 strokes over 18 holes: 1 everywhere plus a 2nd on stroke index 1–2.
    expect(netFor(round, round.holes[0], 'a')).toBe(3);
  });
});

describe('Wolf', () => {
  it('wolf and partner each collect 1 unit from each loser; lone wolf is double', () => {
    // Hole 1: Al is wolf, picks Bo; Bo makes 3 → Al & Bo win. Hole 2: Bo is wolf, goes alone and loses to Cy's 3.
    const round = makeRound([[4, 3, 4, 4], [4, 4, 3, 4]], { games: { wolf: 1 }, data: { 1: { wolfChoice: 'b' }, 2: { wolfChoice: 'lone' } } });
    // Hole 1: Al +2, Bo +2, Cy −2, Di −2. Hole 2: Bo pays 2 to each of Al, Cy, Di → Bo −6.
    expect(standing(round, 'wolf')).toEqual({ a: 4, b: -4, c: 0, d: 0 });
  });

  it('skips holes with no pick and makes the biggest loser wolf on 17–18', () => {
    const scores = Array.from({ length: 18 }, () => [4, 4, 4, 4]);
    scores[0] = [3, 4, 4, 4]; // Al wins hole 1 alone → Bo, Cy, Di each −2
    scores[1] = [4, 4, 4, 5]; // Bo is wolf with Al; Di's 5 doesn't matter, best balls tie → no money
    const round = makeRound(scores, { games: { wolf: 5 }, data: { 1: { wolfChoice: 'lone' } } });
    const result = wolfOrder(round, 1, players);
    expect(result.notes.some((note) => note.startsWith('Hole 2:'))).toBe(true);
    // After hole 1, Bo, Cy and Di are tied for losing most; the normal rotation for 17 (Al) isn't among them, so Bo is first in order.
    expect(result.wolves.get(17)?.id).toBe('b');
    expect(netDebts(result.debts).reduce((sum, debt) => sum + debt.amount, 0)).toBe(30);
  });
});

describe('Vegas', () => {
  it('builds team numbers low digit first and flips on a birdie', () => {
    expect(vegasNumber([5, 4], false)).toBe(45);
    expect(vegasNumber([5, 4], true)).toBe(54);
    expect(vegasNumber([4, 10], false)).toBe(410);
  });

  it('settles the point difference, each player on the losing team down margin × unit', () => {
    // Teams: Al & Bo vs Cy & Di. Hole 1: 44 vs 45 → +1 for Al/Bo. Hole 2: Al birdies (3,4 = 34) so Cy/Di flip 4,5 → 54: +20.
    const round = makeRound([[4, 4, 4, 5], [3, 4, 4, 5]], { games: { vegas: 1 } });
    expect(standing(round, 'vegas')).toEqual({ a: 21, b: 21, c: -21, d: -21 });
  });

  it('uses the partner chosen on hole 1', () => {
    const round = makeRound([[4, 4, 4, 5]], { games: { vegas: 1 }, data: { 1: { teamPartnerOfFirst: 'd' } } });
    // Al & Di: 4,5 = 45 vs Bo & Cy: 44 → Bo/Cy +1 each.
    expect(standing(round, 'vegas')).toEqual({ a: -1, b: 1, c: 1, d: -1 });
  });
});

describe('Bingo Bango Bongo and match play', () => {
  it('settles point differences between every pair', () => {
    const round = makeRound([[4, 4, 4, 4]], { games: { bingo_bango_bongo: 2 }, data: { 1: { bingoPlayerId: 'a', bangoPlayerId: 'a', bongoPlayerId: 'b' } } });
    // Points a2 b1 c0 d0 → a collects 1·2 from b, 2·2 from c, 2·2 from d; b collects 1·2 from c and d.
    expect(standing(round, 'bingo_bango_bongo')).toEqual({ a: 10, b: 2, c: -6, d: -6 });
  });

  it('round-robin match play pays one unit per match won', () => {
    const round = makeRound([[3, 4, 4, 4], [4, 4, 4, 5]], { games: { match_play: 10 } });
    // Al beats everyone (1 up); Di loses to everyone; Bo vs Cy halved.
    expect(standing(round, 'match_play')).toEqual({ a: 30, b: 0, c: 0, d: -30 });
  });
});

describe('score-only extras', () => {
  it('best ball pays each winner one unit from each loser', () => {
    const round = makeRound([[3, 5, 4, 4]], { games: { best_ball: 5 } });
    expect(standing(round, 'best_ball')).toEqual({ a: 10, b: 10, c: -10, d: -10 });
  });

  it('skins group splits the group pot by skins, ties win nothing', () => {
    const round = makeRound([[3, 4, 4, 4], [4, 4, 4, 4], [4, 3, 4, 4]], { games: { skins_group: 60 } });
    expect(standing(round, 'skins_group')).toEqual({ a: 30, b: 30, c: 0, d: 0 });
  });

  it('medal play settles stroke differences per pair', () => {
    const round = makeRound([[4, 5, 6, 4]], { games: { medal_play: 1 } });
    // a vs b 1, a vs c 2, b vs c 1, d ties a; d vs b 1, d vs c 2.
    expect(standing(round, 'medal_play')).toEqual({ a: 3, b: -1, c: -5, d: 3 });
  });

  it('rabbit is caught by an outright winner, freed by the next, and pays out at the turn', () => {
    const scores = Array.from({ length: 9 }, () => [4, 4, 4, 4]);
    scores[0] = [3, 4, 4, 4]; // Al catches it
    scores[3] = [4, 3, 4, 4]; // Bo frees it
    scores[6] = [4, 4, 3, 4]; // Cy catches it and holds through 9
    const round = makeRound(scores, { games: { rabbit: 5 } });
    expect(standing(round, 'rabbit')).toEqual({ a: -5, b: -5, c: 15, d: -5 });
  });

  it('aces and deuces: outright low collects, outright high pays', () => {
    const round = makeRound([[3, 4, 4, 6]], { games: { aces_and_deuces: 1 } });
    expect(standing(round, 'aces_and_deuces')).toEqual({ a: 4, b: 0, c: 0, d: -4 });
  });

  it('notes when a game needs a different group size', () => {
    const round = makeRound([[4, 4, 4]], { games: { wolf: 1, nines: 1 }, roster: players.slice(0, 3) });
    const results = computeGroupGames(round);
    expect(results.find((result) => result.key === 'wolf')!.notes[0]).toContain('needs 4 players in the game');
    // Nines works for three: 3 beats 4,4 → 5 vs 2 and 2 points.
    const nines = makeRound([[3, 4, 4]], { games: { nines: 1 }, roster: players.slice(0, 3) });
    expect(standing(nines, 'nines')).toEqual({ a: 6, b: -3, c: -3 });
  });
});

describe('opt-outs', () => {
  it('leaves opted-out players out of a game and skips four-player games that drop below 4', () => {
    const round = makeRound([[3, 4, 4, 4], [4, 4, 4, 5]], { games: { match_play: 10, wolf: 1 } });
    round.gameSettings.excludedPlayers = { match_play: ['d'], wolf: ['d'] };
    const match = computeGroupGames(round).find((result) => result.key === 'match_play')!;
    // Di sat out, so only Al, Bo and Cy play each other: Al beats both, Bo and Cy halve.
    expect(Object.fromEntries(match.standings.map((item) => [item.playerId, item.amount]))).toEqual({ a: 20, b: -10, c: -10 });
    const wolf = computeGroupGames(round).find((result) => result.key === 'wolf')!;
    expect(wolf.notes[0]).toContain('Group 1 has 3 playing it');
    expect(wolf.debts).toEqual([]);
  });
});
