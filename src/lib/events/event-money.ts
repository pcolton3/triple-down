import {
  buildBirdiePotSummary, buildCtpSummary, buildEaglePotSummary, buildLowNetSummary, buildNassauSummary, buildSkinsSummary, buildStablefordSummary,
} from '@/stores/round-store';
import { splitCents } from '@/lib/utils/currency';
import type { RoundState } from '@/types/round';
import { playerBuyIn, playerTeamBet, TEAM_FORMATS, type GolfEvent, type Signup, type TeamKey } from './golf-events';
import { buildRyderRoundSummary } from './ryder';

/**
 * The whole event's money, for the organizer: who won the Cup, the team bet, every pot each
 * player won across all days, and what the organizer owes or is owed from the buy-ins they hold.
 * Banker and in-group games (Wolf, Vegas…) are settled player-to-player on each round's page.
 */

export type DayRound = { day: number; round: RoundState | null };
export type PotWin = { day: number; game: string; amount: number };
export type EventMoneyRow = {
  signupId: string;
  name: string;
  team: TeamKey | null;
  buyIn: number;
  paid: boolean;
  pots: PotWin[];
  potTotal: number;
  teamBetStake: number;
  teamBetWon: number;
  /** Positive: the organizer pays the player. Negative: the player owes the organizer. */
  net: number;
};
export type EventMoney = {
  cup: { teamOne: number; teamTwo: number; leader: TeamKey | 'tie' | null; final: boolean; daysScored: number; teamDays: number };
  teamBetPot: number;
  rows: EventMoneyRow[];
  totals: { buyInsDue: number; collected: number; unpaid: number; potsPaid: number; teamBetPaid: number; left: number };
  unmatched: string[];
  notes: string[];
};

const cents = (value: number) => Math.round(value * 100) / 100;
const key = (name: string) => name.trim().toLowerCase();
const complete = (round: RoundState) => round.holes.length > 0 && round.holes.every((hole) => hole.isSaved);

/** Pot games paid out of the buy-in for one round (group games settle inside each group). */
export function roundPotWins(round: RoundState) {
  const lists: Array<[string, Array<{ playerName: string; amount: number }>]> = [
    ['Skins', buildSkinsSummary(round).payouts],
    ['Closest to the pin', buildCtpSummary(round).payouts],
    ['Low net', buildLowNetSummary(round).payouts],
    ['Nassau', buildNassauSummary(round).payouts],
    ['Stableford', buildStablefordSummary(round).payouts],
    ['Birdie pot', buildBirdiePotSummary(round).payouts],
    ['Eagle pot', buildEaglePotSummary(round).payouts],
  ];
  return lists.flatMap(([game, payouts]) => payouts.filter((item) => item.amount > 0).map((item) => ({ name: item.playerName, game, amount: item.amount })));
}

export function eventMoney(event: GolfEvent, signups: Signup[], dayRounds: DayRound[]): EventMoney {
  const notes: string[] = [];
  const bySignup = new Map(signups.map((signup) => [key(signup.name), signup]));
  const pots = new Map<string, PotWin[]>(signups.map((signup) => [signup.id, []]));
  const unmatched = new Set<string>();

  // Ryder Cup points from every team-format day that has a round.
  const teamDays = event.days.filter((day) => TEAM_FORMATS.includes(day.format));
  let teamOne = 0;
  let teamTwo = 0;
  let daysScored = 0;
  for (const day of teamDays) {
    const round = dayRounds.find((item) => item.day === day.day)?.round;
    if (!round) continue;
    const summary = buildRyderRoundSummary(round);
    teamOne += summary.teamOnePoints;
    teamTwo += summary.teamTwoPoints;
    if (complete(round)) daysScored += 1;
  }
  const final = teamDays.length > 0 && daysScored === teamDays.length;
  const leader: EventMoney['cup']['leader'] = teamDays.length === 0 ? null : teamOne === teamTwo ? 'tie' : teamOne > teamTwo ? 'team_one' : 'team_two';

  // Pots each player won, from each day's round, matched to signups by name.
  for (const { day, round } of dayRounds) {
    if (!round) continue;
    if (!complete(round)) notes.push(`Day ${day} isn't finished, so its pots are still provisional.`);
    for (const win of roundPotWins(round)) {
      const signup = bySignup.get(key(win.name));
      if (!signup) { unmatched.add(win.name); continue; }
      pots.get(signup.id)!.push({ day, game: win.game, amount: win.amount });
    }
  }

  // Team bet: each player's stake is their share for the team days they play. Once every team day
  // is finished, the winning team splits the whole pot in proportion to their stakes; a tied Cup
  // gives everyone their stake back.
  const stakes = signups.map((signup) => playerTeamBet(event, signup.choices));
  const teamBetPot = cents(stakes.reduce((sum, stake) => sum + stake, 0));
  let teamBetWon = signups.map(() => 0);
  if (final && teamBetPot > 0) {
    if (leader === 'tie') {
      teamBetWon = stakes;
      notes.push('The Cup is tied, so everyone gets their team bet back.');
    } else {
      const winners = signups.map((signup, index) => (signup.team === leader ? stakes[index] : 0));
      teamBetWon = splitCents(teamBetPot, winners);
      if (signups.some((signup) => !signup.team && stakes[signups.indexOf(signup)] > 0)) notes.push('Some players have no team; their team bet goes to the winners.');
    }
  } else if (teamBetPot > 0) {
    notes.push('The team bet pays out once every team day is finished.');
  }

  const rows: EventMoneyRow[] = signups.map((signup, index) => {
    const won = pots.get(signup.id) ?? [];
    const potTotal = cents(won.reduce((sum, win) => sum + win.amount, 0));
    const buyIn = playerBuyIn(event, signup.choices);
    return {
      signupId: signup.id,
      name: signup.name,
      team: signup.team,
      buyIn,
      paid: signup.paid,
      pots: won,
      potTotal,
      teamBetStake: stakes[index],
      teamBetWon: cents(teamBetWon[index]),
      net: cents(potTotal + teamBetWon[index] - (signup.paid ? 0 : buyIn)),
    };
  });

  const buyInsDue = cents(rows.reduce((sum, row) => sum + row.buyIn, 0));
  const collected = cents(rows.filter((row) => row.paid).reduce((sum, row) => sum + row.buyIn, 0));
  const potsPaid = cents(rows.reduce((sum, row) => sum + row.potTotal, 0));
  const teamBetPaid = cents(rows.reduce((sum, row) => sum + row.teamBetWon, 0));
  if (unmatched.size) notes.push(`Not matched to a signup (name changed in the round?): ${[...unmatched].join(', ')}. Their winnings aren't included.`);

  return {
    cup: { teamOne, teamTwo, leader, final, daysScored, teamDays: teamDays.length },
    teamBetPot,
    rows,
    totals: { buyInsDue, collected, unpaid: cents(buyInsDue - collected), potsPaid, teamBetPaid, left: cents(buyInsDue - potsPaid - teamBetPaid) },
    unmatched: [...unmatched],
    notes,
  };
}
