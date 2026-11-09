import { BEEZER_EXTRA_GAMES } from '@/lib/games/catalog';

const SCORED_EXTRA_LABELS = ['Best Ball', 'Better Ball', 'Four Ball', 'Sixes', 'Medal Play', 'Medal Play Group', 'Skins Group', 'Stableford Group', 'Nines', 'Quota', 'Rabbit', 'Aces and Deuces'];

export type GameHelp = { label: string; scored: boolean; summary: string; money?: string; /** What the dollar field means, e.g. '$ per point'. */ unit?: string };

/**
 * Plain-English explanations for every game a round can turn on. `scored` means the app
 * calculates and settles it; the rest are recorded with the round but settled by the players.
 * Keyed by the label shown in round setup.
 */
export const GAME_HELP: Record<string, GameHelp> = {
  Banker: {
    label: 'Banker',
    scored: true,
    summary:
      'One player in each group is the banker and plays every other player in the group on each hole, using net scores. The banker can change from hole to hole.',
    money:
      'Each player sets a bet against the banker. A player can press to double the bet on a hole (triple on a par 3), and the banker can press every bet at once. A gross birdie or better doubles that bet automatically. If both make a gross birdie, there is no automatic double: the lower net score wins, and any presses still count.',
  },
  Skins: {
    label: 'Skins',
    scored: true,
    summary: 'Lowest net score on a hole across all groups wins a skin. If two or more players tie for low, nobody wins that hole.',
    money: 'The pot is split evenly by the number of skins won.',
  },
  CTP: {
    label: 'Closest to the pin',
    scored: true,
    summary: 'On every par 3 the scorekeeper picks who finished closest to the hole.',
    money: 'The pot is split across the par 3s that have a winner.',
  },
  'Low Net': {
    label: 'Low net',
    scored: true,
    summary: 'Best total net score for the round (gross minus handicap strokes).',
    money: 'The winner takes the pot; ties split it.',
  },
  Nassau: {
    label: 'Nassau',
    scored: true,
    summary: 'Three contests in one: best net score on the front 9, the back 9, and all 18.',
    money: 'The pot is split into thirds, one for each contest; ties split their third.',
  },
  Stableford: {
    label: 'Stableford',
    scored: true,
    summary: 'Points per hole instead of strokes, using net scores: bogey 1, par 2, birdie 3, eagle 4, albatross 5. Most points wins.',
    money: 'The winner takes the pot; ties split it.',
  },
  'Birdie Pot': {
    label: 'Birdie pot',
    scored: true,
    summary: 'Every gross birdie made earns a share.',
    money: 'The pot is split evenly across all birdies made.',
  },
  'Eagle Pot': {
    label: 'Eagle pot',
    scored: true,
    summary: 'Every gross eagle made earns a share.',
    money: 'The pot is split evenly across all eagles made.',
  },
  'Hole-in-One': {
    label: 'Hole-in-one',
    scored: true,
    summary: 'Pays only if someone makes an ace.',
    money: 'Every other golfer pays $100 to the player who made it.',
  },
  'Team Match Play / Ryder Cup': {
    label: 'Team match play (Ryder Cup)',
    scored: true,
    summary:
      'Two teams play net match play, as 2-vs-2 (each side\'s lower net score counts) or 1-vs-1 singles. Each match is worth a point, and points add up across days on the Ryder Cup event page.',
  },
  'Match Play': {
    label: 'Match play',
    scored: true,
    summary: 'Every pair in a group plays its own net match, hole by hole. Win more holes than the other player to win the match.',
    money: 'The winner of each match collects the amount from the loser; a halved match pays nothing.',
    unit: '$ per match',
  },
  Wolf: {
    label: 'Wolf',
    scored: true,
    summary:
      'Foursomes only. The wolf rotates each hole and, after the tee shots, picks a partner or goes lone wolf. Best net ball wins the hole. On 17 and 18 the player losing most is the wolf. The scorekeeper taps the pick each hole.',
    money: 'Each winner collects one unit from each loser. Lone wolf wins or loses double. Ties pay nothing.',
    unit: '$ per point',
  },
  'Bingo Bango Bongo': {
    label: 'Bingo Bango Bongo',
    scored: true,
    summary: 'Three points per hole: first on the green, closest to the pin once everyone is on, and first in the hole. The scorekeeper taps who got each one.',
    money: 'Every pair settles the difference in points.',
    unit: '$ per point',
  },
  Vegas: {
    label: 'Vegas',
    scored: true,
    summary:
      'Foursomes only, two teams of two. Each team puts its net scores together low digit first (a 4 and a 5 make 45). If a team makes a net birdie, the other team flips high digit first (54).',
    money: 'The team with the lower number wins the difference in points; each player on the losing team is down that many units.',
    unit: '$ per point',
  },
  'Best Ball': {
    label: 'Best Ball',
    scored: true,
    summary: 'Foursomes only, two teams of two. Each team counts its best net score per hole, played as an 18-hole match.',
    money: 'Each player on the winning team collects one unit from each loser.',
    unit: '$ per unit',
  },
  'Better Ball': {
    label: 'Better Ball',
    scored: true,
    summary: 'Same as Best Ball: two teams of two, the better net score counts each hole, 18-hole match.',
    money: 'Each player on the winning team collects one unit from each loser.',
    unit: '$ per unit',
  },
  'Four Ball': {
    label: 'Four Ball',
    scored: true,
    summary: 'Two teams of two in match play, each counting its better net ball per hole.',
    money: 'Each player on the winning team collects one unit from each loser.',
    unit: '$ per unit',
  },
  Sixes: {
    label: 'Sixes',
    scored: true,
    summary:
      'Foursomes only. Partners change every 6 holes (1st & 2nd vs 3rd & 4th, then 1st & 3rd, then 1st & 4th). Each 6-hole stretch is a best-net-ball match.',
    money: 'Each 6-hole match: each winner collects one unit from each loser.',
    unit: '$ per match',
  },
  'Medal Play': {
    label: 'Medal Play',
    scored: true,
    summary: 'Total net strokes for the round, compared within each group.',
    money: 'Every pair settles the stroke difference.',
    unit: '$ per stroke',
  },
  'Medal Play Group': {
    label: 'Medal Play Group',
    scored: true,
    summary: 'Lowest total net score in each group wins that group\'s pot.',
    money: 'Ties split the pot.',
    unit: 'pot per group (total $)',
  },
  'Skins Group': {
    label: 'Skins Group',
    scored: true,
    summary: 'Skins played inside each group: lowest net score on a hole wins a skin; ties win nothing.',
    money: 'Each group\'s pot splits by skins won.',
    unit: 'pot per group (total $)',
  },
  'Stableford Group': {
    label: 'Stableford Group',
    scored: true,
    summary: 'Net Stableford points (bogey 1, par 2, birdie 3, eagle 4, albatross 5) inside each group.',
    money: 'Most points wins the group\'s pot; ties split.',
    unit: 'pot per group (total $)',
  },
  Nines: {
    label: 'Nines',
    scored: true,
    summary: 'Threesomes only. 9 points per hole by net score: 5 for best, 3 for second, 1 for third; ties split the points.',
    money: 'Every pair settles the difference in points.',
    unit: '$ per point',
  },
  Quota: {
    label: 'Quota',
    scored: true,
    summary:
      'Each golfer\'s target is 36 minus their handicap. Points from gross scores: bogey 1, par 2, birdie 4, eagle 8. Beat your quota by the most to win. Settles once all 18 holes are in.',
    money: 'Every pair settles the difference in points over quota.',
    unit: '$ per point',
  },
  Rabbit: {
    label: 'Rabbit',
    scored: true,
    summary:
      'Win a hole outright (lowest net, no tie) to catch the rabbit; the next outright winner sets it free. Whoever holds it after 9 and after 18 wins.',
    money: 'The holder collects one unit from each other player, on the front and the back.',
    unit: '$ per nine',
  },
  'Aces and Deuces': {
    label: 'Aces and Deuces',
    scored: true,
    summary: 'Each hole, the outright lowest net score is the ace and the outright highest is the deuce.',
    money: 'The ace collects one unit from everyone; the deuce pays one unit to everyone.',
    unit: '$ per unit',
  },
  ...Object.fromEntries(
    BEEZER_EXTRA_GAMES.filter((game) => !SCORED_EXTRA_LABELS.includes(game.label)).map((game) => [game.label, { label: game.label, scored: false, summary: 'Recorded with the round so everyone knows it was on.' }])
  ),
};

export function gameHelp(label: string): GameHelp {
  return GAME_HELP[label] ?? { label, scored: false, summary: '' };
}

/** Label for a game's dollar field in setup, e.g. "Wolf $ per point". */
export function moneyLabel(label: string) {
  const help = gameHelp(label);
  return help.scored ? `${label} ${help.unit ?? '$'}` : `${label} $ (for reference)`;
}
