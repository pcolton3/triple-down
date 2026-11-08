import type { HoleState, Player, RoundState } from '@/types/round';
import type { Debt, PotWin } from '@/lib/offline/net-payments';

/**
 * Scoring for games played inside each group: Wolf, Vegas, Bingo Bango Bongo, Match Play and the
 * score-based extras. Every game turns into player-to-player debts (unit games) or pot wins (group
 * pots), which settle-up nets alongside Banker. Net scores use the same full-handicap stroke
 * allocation as the rest of the app.
 */

export type GroupGameKey =
  | 'wolf' | 'vegas' | 'bingo_bango_bongo' | 'match_play'
  | 'best_ball' | 'better_ball' | 'four_ball' | 'sixes'
  | 'medal_play' | 'medal_play_group' | 'skins_group' | 'stableford_group'
  | 'nines' | 'quota' | 'rabbit' | 'aces_and_deuces';

export type GroupGameResult = {
  key: GroupGameKey;
  label: string;
  groupNumber: number;
  /** Money each player is up (+) or down (−) in this game. */
  standings: Array<{ playerId: string; name: string; amount: number }>;
  debts: Debt[];
  pots: PotWin[];
  /** Plain-English notes, e.g. a hole missing the wolf's pick. */
  notes: string[];
};

export const GROUP_GAME_LABELS: Record<GroupGameKey, string> = {
  wolf: 'Wolf',
  vegas: 'Vegas',
  bingo_bango_bongo: 'Bingo Bango Bongo',
  match_play: 'Match Play',
  best_ball: 'Best Ball',
  better_ball: 'Better Ball',
  four_ball: 'Four Ball',
  sixes: 'Sixes',
  medal_play: 'Medal Play',
  medal_play_group: 'Medal Play Group',
  skins_group: 'Skins Group',
  stableford_group: 'Stableford Group',
  nines: 'Nines',
  quota: 'Quota',
  rabbit: 'Rabbit',
  aces_and_deuces: 'Aces and Deuces',
};

const TEAM_GAMES: GroupGameKey[] = ['vegas', 'best_ball', 'better_ball', 'four_ball'];
const POT_GAMES: GroupGameKey[] = ['medal_play_group', 'skins_group', 'stableford_group'];

const cents = (value: number) => Math.round(value * 100) / 100;

export function grossFor(hole: HoleState, playerId: string) {
  if (hole.bankerPlayerId === playerId) return hole.bankerGrossScore;
  return hole.matchups.find((matchup) => matchup.playerId === playerId)?.grossScore ?? null;
}

/** Same allocation as the store: full handicap, extra strokes on the hardest holes. */
export function netFor(round: Pick<RoundState, 'players' | 'totalHoles'>, hole: HoleState, playerId: string) {
  const gross = grossFor(hole, playerId);
  if (gross == null) return null;
  const player = round.players.find((item) => item.id === playerId);
  if (!player) return gross;
  const totalHoles = Math.max(1, round.totalHoles);
  const handicap = Math.max(0, player.handicap);
  const strokes = Math.floor(handicap / totalHoles) + (hole.handicapIndex <= handicap % totalHoles ? 1 : 0);
  return gross - strokes;
}

export function roundGroups(round: RoundState): Array<{ groupNumber: number; players: Player[] }> {
  const assignments = round.multiFoursome?.groupPlayers ?? [];
  const numbers = round.multiFoursome?.groups.length
    ? round.multiFoursome.groups.map((group) => group.groupNumber)
    : [...new Set(round.holes.map((hole) => hole.groupNumber ?? 1))];
  const size = round.multiFoursome?.groupSize ?? 4;
  return numbers.sort((a, b) => a - b).map((groupNumber) => {
    const ids = assignments.filter((item) => item.groupNumber === groupNumber).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.playerId);
    const players = ids.length
      ? ids.map((id) => round.players.find((player) => player.id === id)).filter((player): player is Player => Boolean(player))
      : numbers.length === 1 ? round.players : round.players.slice((groupNumber - 1) * size, groupNumber * size);
    return { groupNumber, players };
  });
}

function groupHoles(round: RoundState, groupNumber: number) {
  return round.holes.filter((hole) => (hole.groupNumber ?? 1) === groupNumber).sort((a, b) => a.holeNumber - b.holeNumber);
}

function complete(hole: HoleState, players: Player[]) {
  return hole.isSaved && players.every((player) => grossFor(hole, player.id) != null);
}

export function gameEnabled(round: RoundState, key: GroupGameKey) {
  const settings = round.gameSettings ?? {};
  if (key === 'wolf') return settings.wolfEnabled === true;
  if (key === 'vegas') return settings.vegasEnabled === true;
  if (key === 'bingo_bango_bongo') return settings.bingoBangoBongoEnabled === true;
  if (key === 'match_play') return settings.matchPlayEnabled === true;
  return settings.extraGames?.[key] === true;
}

export function gameUnit(round: RoundState, key: GroupGameKey) {
  const settings = round.gameSettings ?? {};
  const value =
    key === 'wolf' ? settings.wolfUnit
      : key === 'vegas' ? settings.vegasUnit
        : key === 'bingo_bango_bongo' ? settings.bingoBangoBongoUnit
          : key === 'match_play' ? settings.matchPlayUnit
            : settings.extraGameUnits?.[key];
  return Math.max(0, Number(value) || 0);
}

/** Who partners the group's first player in team games. Defaults to the second listed golfer. */
export function teamsFor(round: RoundState, groupNumber: number, players: Player[]): [Player[], Player[]] | null {
  if (players.length !== 4) return null;
  const chosen = groupHoles(round, groupNumber).find((hole) => hole.holeNumber === 1)?.gameData?.teamPartnerOfFirst;
  const partner = players.find((player) => player.id === chosen && player.id !== players[0].id) ?? players[1];
  const teamOne = [players[0], partner];
  return [teamOne, players.filter((player) => !teamOne.includes(player))];
}

type Ledger = { debts: Debt[]; add: (from: Player, to: Player, amount: number, reason: string) => void };
function ledger(): Ledger {
  const debts: Debt[] = [];
  return {
    debts,
    add(from, to, amount, reason) {
      if (amount > 0 && from.id !== to.id) debts.push({ fromId: from.id, fromName: from.name, toId: to.id, toName: to.name, amount: cents(amount), reason });
    },
  };
}

/** Each loser pays each winner `amount`. */
function teamPays(book: Ledger, winners: Player[], losers: Player[], amount: number, reason: string) {
  losers.forEach((loser) => winners.forEach((winner) => book.add(loser, winner, amount, reason)));
}

/** Every pair settles the difference in points × unit. */
function pairwise(book: Ledger, players: Player[], points: Map<string, number>, unit: number, reason: string) {
  players.forEach((a, i) => players.slice(i + 1).forEach((b) => {
    const diff = (points.get(a.id) ?? 0) - (points.get(b.id) ?? 0);
    if (diff > 0) book.add(b, a, diff * unit, reason);
    else if (diff < 0) book.add(a, b, -diff * unit, reason);
  }));
}

function bestNet(round: RoundState, hole: HoleState, team: Player[]) {
  return Math.min(...team.map((player) => netFor(round, hole, player.id) ?? Infinity));
}

/** Team best-ball match over a set of holes: returns +1 if team A won more holes, −1 if B, 0 if tied. */
function bestBallMatch(round: RoundState, holes: HoleState[], a: Player[], b: Player[]) {
  let margin = 0;
  holes.forEach((hole) => {
    const diff = bestNet(round, hole, a) - bestNet(round, hole, b);
    if (diff < 0) margin += 1;
    else if (diff > 0) margin -= 1;
  });
  return Math.sign(margin);
}

function stablefordPoints(net: number, par: number) {
  const toPar = net - par;
  if (toPar <= -3) return 5;
  if (toPar === -2) return 4;
  if (toPar === -1) return 3;
  if (toPar === 0) return 2;
  if (toPar === 1) return 1;
  return 0;
}

function quotaPoints(gross: number, par: number) {
  const toPar = gross - par;
  if (toPar <= -2) return 8;
  if (toPar === -1) return 4;
  if (toPar === 0) return 2;
  if (toPar === 1) return 1;
  return 0;
}

/** The wolf for each hole: rotates through the foursome, and on 17–18 whoever is losing most at Wolf. */
export function wolfOrder(round: RoundState, groupNumber: number, players: Player[]) {
  const unit = gameUnit(round, 'wolf');
  const running = new Map(players.map((player) => [player.id, 0]));
  const wolves = new Map<number, Player>();
  const book = ledger();
  const notes: string[] = [];
  groupHoles(round, groupNumber).forEach((hole) => {
    const rotation = players[(hole.holeNumber - 1) % players.length];
    let wolf = rotation;
    if (round.totalHoles === 18 && hole.holeNumber >= 17) {
      const lowest = Math.min(...players.map((player) => running.get(player.id) ?? 0));
      wolf = [rotation, ...players].find((player) => (running.get(player.id) ?? 0) === lowest) ?? rotation;
    }
    wolves.set(hole.holeNumber, wolf);
    if (!complete(hole, players)) return;
    const choice = hole.gameData?.wolfChoice;
    const others = players.filter((player) => player.id !== wolf.id);
    // `points` per winner from each loser; standings for 17–18 count points so they work even at $0.
    const settle = (winners: Player[], losers: Player[], points: number) => {
      teamPays(book, winners, losers, points * unit, 'Wolf');
      losers.forEach((loser) => running.set(loser.id, (running.get(loser.id) ?? 0) - points * winners.length));
      winners.forEach((winner) => running.set(winner.id, (running.get(winner.id) ?? 0) + points * losers.length));
    };
    if (choice === 'lone') {
      const diff = (netFor(round, hole, wolf.id) ?? Infinity) - bestNet(round, hole, others);
      if (diff < 0) settle([wolf], others, 2);
      else if (diff > 0) settle(others, [wolf], 2);
      return;
    }
    const partner = others.find((player) => player.id === choice);
    if (!partner) {
      notes.push(`Hole ${hole.holeNumber}: the wolf's pick wasn't entered, so it doesn't count.`);
      return;
    }
    const teamA = [wolf, partner];
    const teamB = others.filter((player) => player.id !== partner.id);
    const diff = bestNet(round, hole, teamA) - bestNet(round, hole, teamB);
    if (diff < 0) settle(teamA, teamB, 1);
    else if (diff > 0) settle(teamB, teamA, 1);
  });
  return { wolves, debts: book.debts, notes };
}

/** Vegas team number for one hole: digits low-to-high, flipped high-first if the other side made a net birdie. */
export function vegasNumber(nets: number[], flipped: boolean) {
  const digits = nets.map((net) => Math.max(1, net)).sort((a, b) => (flipped ? b - a : a - b));
  return Number(digits.join(''));
}

function scoreGame(round: RoundState, key: GroupGameKey, groupNumber: number, players: Player[]): Omit<GroupGameResult, 'standings' | 'label' | 'key' | 'groupNumber'> {
  const unit = gameUnit(round, key);
  const book = ledger();
  const pots: PotWin[] = [];
  const notes: string[] = [];
  const label = GROUP_GAME_LABELS[key];
  const holes = groupHoles(round, groupNumber);
  const done = holes.filter((hole) => complete(hole, players));
  const needs = (count: number) => {
    notes.push(`${label} needs a group of ${count}; Group ${groupNumber} has ${players.length}.`);
    return { debts: [], pots: [], notes };
  };

  if (key === 'wolf') {
    if (players.length !== 4) return needs(4);
    const result = wolfOrder(round, groupNumber, players);
    return { debts: result.debts, pots, notes: result.notes };
  }

  if (TEAM_GAMES.includes(key)) {
    const teams = teamsFor(round, groupNumber, players);
    if (!teams) return needs(4);
    const [a, b] = teams;
    if (key === 'vegas') {
      let margin = 0; // points team A is ahead
      done.forEach((hole) => {
        const netsA = a.map((player) => netFor(round, hole, player.id)!);
        const netsB = b.map((player) => netFor(round, hole, player.id)!);
        const birdieA = netsA.some((net) => net < hole.par);
        const birdieB = netsB.some((net) => net < hole.par);
        margin += vegasNumber(netsB, birdieA && !birdieB) - vegasNumber(netsA, birdieB && !birdieA);
      });
      // Each player on the losing team is down `margin × unit`.
      if (margin > 0) teamPays(book, a, b, (margin * unit) / 2, label);
      if (margin < 0) teamPays(book, b, a, (-margin * unit) / 2, label);
    } else {
      const winner = bestBallMatch(round, done, a, b);
      if (winner > 0) teamPays(book, a, b, unit, label);
      if (winner < 0) teamPays(book, b, a, unit, label);
    }
    return { debts: book.debts, pots, notes };
  }

  if (key === 'sixes') {
    if (players.length !== 4) return needs(4);
    const [p0, p1, p2, p3] = players;
    const segments: Array<[number, number, Player[], Player[]]> = [
      [1, 6, [p0, p1], [p2, p3]],
      [7, 12, [p0, p2], [p1, p3]],
      [13, 18, [p0, p3], [p1, p2]],
    ];
    segments.forEach(([from, to, a, b]) => {
      const winner = bestBallMatch(round, done.filter((hole) => hole.holeNumber >= from && hole.holeNumber <= to), a, b);
      if (winner > 0) teamPays(book, a, b, unit, label);
      if (winner < 0) teamPays(book, b, a, unit, label);
    });
    return { debts: book.debts, pots, notes };
  }

  if (key === 'bingo_bango_bongo') {
    const points = new Map(players.map((player) => [player.id, 0]));
    let missing = 0;
    holes.filter((hole) => hole.isSaved).forEach((hole) => {
      const picks = [hole.gameData?.bingoPlayerId, hole.gameData?.bangoPlayerId, hole.gameData?.bongoPlayerId];
      if (picks.every((pick) => !pick)) missing += 1;
      picks.forEach((pick) => { if (pick && points.has(pick)) points.set(pick, (points.get(pick) ?? 0) + 1); });
    });
    if (missing) notes.push(`${missing} saved hole${missing === 1 ? ' has' : 's have'} no Bingo Bango Bongo points entered.`);
    pairwise(book, players, points, unit, label);
    return { debts: book.debts, pots, notes };
  }

  if (key === 'match_play') {
    players.forEach((a, i) => players.slice(i + 1).forEach((b) => {
      const winner = bestBallMatch(round, done, [a], [b]);
      if (winner > 0) book.add(b, a, unit, label);
      if (winner < 0) book.add(a, b, unit, label);
    }));
    return { debts: book.debts, pots, notes };
  }

  if (key === 'medal_play' || key === 'medal_play_group' || key === 'stableford_group') {
    const totals = new Map(players.map((player) => [player.id, 0]));
    done.forEach((hole) => players.forEach((player) => {
      const net = netFor(round, hole, player.id)!;
      totals.set(player.id, (totals.get(player.id) ?? 0) + (key === 'stableford_group' ? stablefordPoints(net, hole.par) : net));
    }));
    if (key === 'medal_play') {
      // Fewer strokes is better, so flip the sign before settling stroke differences.
      pairwise(book, players, new Map([...totals].map(([id, total]) => [id, -total])), unit, label);
      return { debts: book.debts, pots, notes };
    }
    if (!done.length || unit <= 0) return { debts: [], pots, notes };
    const best = key === 'stableford_group' ? Math.max(...totals.values()) : Math.min(...totals.values());
    const winners = players.filter((player) => totals.get(player.id) === best);
    winners.forEach((player) => pots.push({ playerId: player.id, playerName: player.name, amount: cents(unit / winners.length), game: `${label} · Group ${groupNumber}` }));
    return { debts: [], pots, notes };
  }

  if (key === 'skins_group') {
    const skins = new Map(players.map((player) => [player.id, 0]));
    done.forEach((hole) => {
      const nets = players.map((player) => ({ player, net: netFor(round, hole, player.id)! }));
      const low = Math.min(...nets.map((item) => item.net));
      const winners = nets.filter((item) => item.net === low);
      if (winners.length === 1) skins.set(winners[0].player.id, (skins.get(winners[0].player.id) ?? 0) + 1);
    });
    const won = [...skins.values()].reduce((sum, count) => sum + count, 0);
    if (won && unit > 0) players.forEach((player) => {
      const count = skins.get(player.id) ?? 0;
      if (count) pots.push({ playerId: player.id, playerName: player.name, amount: cents((unit * count) / won), game: `${label} · Group ${groupNumber}` });
    });
    return { debts: [], pots, notes };
  }

  if (key === 'nines') {
    if (players.length !== 3) return needs(3);
    const points = new Map(players.map((player) => [player.id, 0]));
    done.forEach((hole) => {
      const ranked = players.map((player) => ({ player, net: netFor(round, hole, player.id)! })).sort((x, y) => x.net - y.net);
      const awards = [5, 3, 1];
      let index = 0;
      while (index < ranked.length) {
        const tied = ranked.filter((item) => item.net === ranked[index].net);
        const share = awards.slice(index, index + tied.length).reduce((sum, value) => sum + value, 0) / tied.length;
        tied.forEach((item) => points.set(item.player.id, (points.get(item.player.id) ?? 0) + share));
        index += tied.length;
      }
    });
    pairwise(book, players, points, unit, label);
    return { debts: book.debts, pots, notes };
  }

  if (key === 'quota') {
    // Quota already builds in handicap (36 − handicap), so points use gross scores.
    const overQuota = new Map(players.map((player) => [player.id, -(36 - Math.round(Math.max(0, player.handicap)))]));
    done.forEach((hole) => players.forEach((player) => overQuota.set(player.id, (overQuota.get(player.id) ?? 0) + quotaPoints(grossFor(hole, player.id)!, hole.par))));
    if (done.length < round.totalHoles) notes.push('Quota compares each golfer to a full-round target, so it settles once all holes are in.');
    else pairwise(book, players, overQuota, unit, label);
    return { debts: book.debts, pots, notes };
  }

  if (key === 'rabbit') {
    [[1, 9], [10, 18]].forEach(([from, to]) => {
      const segment = holes.filter((hole) => hole.holeNumber >= from && hole.holeNumber <= to);
      if (!segment.length || !segment.every((hole) => complete(hole, players))) return;
      let holder: Player | null = null;
      segment.forEach((hole) => {
        const nets = players.map((player) => ({ player, net: netFor(round, hole, player.id)! }));
        const low = Math.min(...nets.map((item) => item.net));
        const winners = nets.filter((item) => item.net === low);
        if (winners.length !== 1) return;
        holder = holder == null ? winners[0].player : holder.id === winners[0].player.id ? holder : null;
      });
      const caught = holder as Player | null;
      if (caught) players.filter((player) => player.id !== caught.id).forEach((player) => book.add(player, caught, unit, `${label} (${from === 1 ? 'front' : 'back'} 9)`));
    });
    return { debts: book.debts, pots, notes };
  }

  // aces_and_deuces
  if (players.length < 3) return needs(3);
  done.forEach((hole) => {
    const nets = players.map((player) => ({ player, net: netFor(round, hole, player.id)! }));
    const low = Math.min(...nets.map((item) => item.net));
    const high = Math.max(...nets.map((item) => item.net));
    const lows = nets.filter((item) => item.net === low);
    const highs = nets.filter((item) => item.net === high);
    if (lows.length === 1) nets.forEach((item) => book.add(item.player, lows[0].player, unit, label));
    if (highs.length === 1 && high !== low) nets.forEach((item) => book.add(highs[0].player, item.player, unit, label));
  });
  return { debts: book.debts, pots, notes };
}

export const SCORED_GROUP_GAMES = Object.keys(GROUP_GAME_LABELS) as GroupGameKey[];

/** Every enabled group game, for every group. */
export function computeGroupGames(round: RoundState): GroupGameResult[] {
  const results: GroupGameResult[] = [];
  const groups = roundGroups(round);
  SCORED_GROUP_GAMES.filter((key) => gameEnabled(round, key)).forEach((key) => {
    groups.forEach(({ groupNumber, players }) => {
      if (!players.length) return;
      const { debts, pots, notes } = scoreGame(round, key, groupNumber, players);
      const amounts = new Map(players.map((player) => [player.id, 0]));
      debts.forEach((debt) => {
        amounts.set(debt.fromId, (amounts.get(debt.fromId) ?? 0) - debt.amount);
        amounts.set(debt.toId, (amounts.get(debt.toId) ?? 0) + debt.amount);
      });
      pots.forEach((win) => amounts.set(win.playerId, (amounts.get(win.playerId) ?? 0) + win.amount));
      if (gameUnit(round, key) <= 0) notes.push(`${GROUP_GAME_LABELS[key]} has no dollar amount set, so it shows $0.`);
      results.push({
        key,
        label: GROUP_GAME_LABELS[key],
        groupNumber,
        standings: players.map((player) => ({ playerId: player.id, name: player.name, amount: cents(amounts.get(player.id) ?? 0) })),
        debts,
        pots,
        notes,
      });
    });
  });
  return results;
}

export function isPotGame(key: GroupGameKey) {
  return POT_GAMES.includes(key);
}

export function usesTeams(key: GroupGameKey) {
  return TEAM_GAMES.includes(key);
}
