import type { HoleState, Player, RoundState } from '@/types/round';
import type { Debt } from '@/lib/offline/net-payments';
import { grossFor, netFor, roundGroups } from './group-games';

export type SideBetKind = 'low_net_18' | 'low_net_front' | 'low_net_back' | 'low_gross_18' | 'match_play_net';
export type SideBetStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type SideBet = {
  id: string;
  roundId: string;
  kind: SideBetKind;
  amount: number;
  proposerKey: string;
  opponentKey: string;
  status: SideBetStatus;
  proposerDeviceId: string | null;
  createdAt: string;
};

export const SIDE_BET_KINDS: Array<{ kind: SideBetKind; label: string; short: string }> = [
  { kind: 'low_net_18', label: 'Lower net score, 18 holes', short: 'Low net, 18' },
  { kind: 'low_net_front', label: 'Lower net score, front 9', short: 'Low net, front 9' },
  { kind: 'low_net_back', label: 'Lower net score, back 9', short: 'Low net, back 9' },
  { kind: 'low_gross_18', label: 'Lower gross score, 18 holes', short: 'Low gross, 18' },
  { kind: 'match_play_net', label: 'Net match play (win more holes)', short: 'Net match play' },
];

export function sideBetLabel(kind: SideBetKind) {
  return SIDE_BET_KINDS.find((item) => item.kind === kind)?.short ?? kind;
}

export type SideBetProgress = {
  /** Holes both golfers have finished that count toward the bet. */
  holesCompared: number;
  holesInBet: number;
  thru: [number, number];
  /** Positive: proposer ahead (fewer strokes / more holes won). */
  margin: number;
  final: boolean;
  winnerKey: string | null;
  summary: string;
};

function holesInBet(kind: SideBetKind, totalHoles: number) {
  const all = Array.from({ length: totalHoles }, (_, index) => index + 1);
  if (kind === 'low_net_front') return all.filter((hole) => hole <= 9);
  if (kind === 'low_net_back') return all.filter((hole) => hole >= 10);
  return all;
}

function playerHole(round: RoundState, groupNumber: number, holeNumber: number) {
  return round.holes.find((hole) => (hole.groupNumber ?? 1) === groupNumber && hole.holeNumber === holeNumber);
}

/** Where a side bet stands, comparing only holes both golfers have finished so it's fair across groups. */
export function sideBetProgress(round: RoundState, bet: Pick<SideBet, 'kind' | 'proposerKey' | 'opponentKey'>): SideBetProgress {
  const groups = roundGroups(round);
  const groupOf = (key: string) => groups.find((group) => group.players.some((player) => player.id === key))?.groupNumber ?? 1;
  const name = (key: string) => round.players.find((player) => player.id === key)?.name ?? 'Unknown golfer';
  const [a, b] = [bet.proposerKey, bet.opponentKey];
  const [groupA, groupB] = [groupOf(a), groupOf(b)];
  const holes = holesInBet(bet.kind, round.totalHoles);
  const score = (hole: HoleState | undefined, key: string) => {
    if (!hole?.isSaved) return null;
    return bet.kind === 'low_gross_18' ? grossFor(hole, key) : netFor(round, hole, key);
  };
  let margin = 0;
  let compared = 0;
  const thru: [number, number] = [0, 0];
  holes.forEach((holeNumber) => {
    const scoreA = score(playerHole(round, groupA, holeNumber), a);
    const scoreB = score(playerHole(round, groupB, holeNumber), b);
    if (scoreA != null) thru[0] += 1;
    if (scoreB != null) thru[1] += 1;
    if (scoreA == null || scoreB == null) return;
    compared += 1;
    if (bet.kind === 'match_play_net') margin += Math.sign(scoreB - scoreA);
    else margin += scoreB - scoreA;
  });
  const final = compared === holes.length;
  const winnerKey = final && margin !== 0 ? (margin > 0 ? a : b) : null;
  const unit = bet.kind === 'match_play_net' ? 'up' : `stroke${Math.abs(margin) === 1 ? '' : 's'}`;
  const leader = margin > 0 ? name(a) : name(b);
  const thruText = thru[0] === thru[1] ? `thru ${thru[0]}` : `${name(a)} thru ${thru[0]}, ${name(b)} thru ${thru[1]}`;
  const summary = !compared
    ? 'Not started yet'
    : final
      ? margin === 0 ? 'Tied: no money changes hands' : `${leader} wins by ${Math.abs(margin)} ${bet.kind === 'match_play_net' ? `hole${Math.abs(margin) === 1 ? '' : 's'}` : unit}`
      : margin === 0 ? `All square (${thruText})` : `${leader} ${bet.kind === 'match_play_net' ? `${Math.abs(margin)} up` : `ahead by ${Math.abs(margin)} ${unit}`} (${thruText})`;
  return { holesCompared: compared, holesInBet: holes.length, thru, margin, final, winnerKey, summary };
}

/** Debts from accepted side bets that are finished. Unfinished bets don't pay yet. */
export function sideBetDebts(round: RoundState, bets: SideBet[]): Debt[] {
  const player = (key: string): Player | undefined => round.players.find((item) => item.id === key);
  return bets.flatMap((bet) => {
    if (bet.status !== 'accepted' || !(bet.amount > 0)) return [];
    const progress = sideBetProgress(round, bet);
    if (!progress.winnerKey) return [];
    const winner = player(progress.winnerKey);
    const loser = player(progress.winnerKey === bet.proposerKey ? bet.opponentKey : bet.proposerKey);
    if (!winner || !loser) return [];
    return [{ fromId: loser.id, fromName: loser.name, toId: winner.id, toName: winner.name, amount: bet.amount, reason: 'Side bet' }];
  });
}
