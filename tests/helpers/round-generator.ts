import type { HoleState, Player, RoundState } from '@/types/round';
import type { GroupGameKey } from '@/lib/games/group-games';

/** Small deterministic PRNG (mulberry32) so failures are reproducible from the seed. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

export const PARS_18: Array<3 | 4 | 5> = [4, 5, 3, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
export const INDEX_18 = [7, 1, 15, 11, 3, 17, 9, 5, 13, 8, 16, 2, 12, 4, 18, 10, 6, 14];

export type GenOptions = {
  groupSizes: number[];
  totalHoles?: number;
  /** Fraction of holes saved per group (1 = complete round). */
  savedFraction?: number;
  /** Allow one-decimal handicaps (like a WHS index). */
  decimalHandicaps?: boolean;
  games?: Partial<Record<GroupGameKey, number>>;
  pots?: Partial<{ skins: number; ctp: number; lowNet: number; nassau: number; stableford: number; birdie: number; eagle: number }>;
  holeInOne?: boolean;
};

export function generateRound(seed: number, opts: GenOptions): RoundState {
  const r = rng(seed);
  const totalHoles = opts.totalHoles ?? 18;
  const pars = PARS_18.slice(0, totalHoles);
  const indexes = totalHoles === 18 ? INDEX_18 : Array.from({ length: totalHoles }, (_, i) => i + 1).sort(() => r.next() - 0.5);
  const players: Player[] = [];
  const groupPlayers: Array<{ playerId: string; groupNumber: number; sortOrder: number }> = [];
  opts.groupSizes.forEach((size, g) => {
    for (let i = 0; i < size; i += 1) {
      const id = `g${g + 1}p${i + 1}`;
      const handicap = opts.decimalHandicaps ? r.int(0, 300) / 10 : r.int(0, 30);
      players.push({ id, name: `G${g + 1}P${i + 1}`, handicap, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true });
      groupPlayers.push({ playerId: id, groupNumber: g + 1, sortOrder: i });
    }
  });

  const holes: HoleState[] = [];
  opts.groupSizes.forEach((size, g) => {
    const groupNumber = g + 1;
    const ids = groupPlayers.filter((item) => item.groupNumber === groupNumber).map((item) => item.playerId);
    const savedCount = Math.round(totalHoles * (opts.savedFraction ?? 1));
    for (let h = 1; h <= totalHoles; h += 1) {
      const par = pars[h - 1];
      const banker = r.pick(ids);
      const saved = h <= savedCount;
      const gross = () => (saved ? (par === 3 && r.chance(0.02) ? 1 : r.int(par - 1, par + 4) - (r.chance(0.04) ? 1 : 0)) : null);
      const hole: HoleState = {
        groupNumber,
        holeNumber: h,
        par,
        handicapIndex: indexes[h - 1],
        bankerPlayerId: banker,
        bankerGrossScore: gross(),
        bankerPressed: r.chance(0.2),
        isSaved: saved,
        ctpWinnerPlayerId: par === 3 && saved && r.chance(0.8) ? r.pick(ids) : null,
        matchups: ids.filter((id) => id !== banker).map((playerId) => ({
          playerId,
          baseWager: r.pick([1, 2, 2.5, 5, 10]),
          pressed: r.chance(0.25),
          grossScore: gross(),
          bankerParticipant: true,
        })),
        gameData: {
          wolfChoice: r.chance(0.2) ? 'lone' : r.pick(ids),
          bingoPlayerId: r.pick(ids),
          bangoPlayerId: r.pick(ids),
          bongoPlayerId: r.pick(ids),
        },
      };
      holes.push(hole);
    }
  });

  const games = opts.games ?? {};
  const core = ['wolf', 'vegas', 'bingo_bango_bongo', 'match_play'];
  const pots = opts.pots ?? {};
  return {
    id: `round-${seed}`,
    roundCode: `GEN${seed}`,
    title: 'Generated',
    courseName: 'Course',
    currentHole: 1,
    totalHoles,
    defaultBet: 5,
    players,
    holes,
    multiFoursome: {
      enabled: opts.groupSizes.length > 1,
      groupSize: 4,
      groups: opts.groupSizes.map((_, g) => ({ groupNumber: g + 1, currentHole: 1 })),
      groupPlayers,
    },
    gameSettings: {
      bankerEnabled: true,
      skinsEnabled: pots.skins != null, skinsPot: pots.skins ?? 0,
      ctpEnabled: pots.ctp != null, ctpPot: pots.ctp ?? 0,
      lowNetEnabled: pots.lowNet != null, lowNetPot: pots.lowNet ?? 0,
      nassauEnabled: pots.nassau != null, nassauPot: pots.nassau ?? 0,
      stablefordEnabled: pots.stableford != null, stablefordPot: pots.stableford ?? 0,
      birdiePotEnabled: pots.birdie != null, birdiePot: pots.birdie ?? 0,
      eaglePotEnabled: pots.eagle != null, eaglePot: pots.eagle ?? 0,
      holeInOneEnabled: opts.holeInOne === true,
      wolfEnabled: 'wolf' in games, wolfUnit: games.wolf,
      vegasEnabled: 'vegas' in games, vegasUnit: games.vegas,
      bingoBangoBongoEnabled: 'bingo_bango_bongo' in games, bingoBangoBongoUnit: games.bingo_bango_bongo,
      matchPlayEnabled: 'match_play' in games, matchPlayUnit: games.match_play,
      extraGames: Object.fromEntries(Object.keys(games).filter((key) => !core.includes(key)).map((key) => [key, true])),
      extraGameUnits: Object.fromEntries(Object.entries(games).filter(([key]) => !core.includes(key))),
      excludedPlayers: {},
    },
  } as RoundState;
}

export const cents = (value: number) => Math.round(value * 100);
