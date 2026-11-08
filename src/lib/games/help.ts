import { BEEZER_EXTRA_GAMES } from '@/lib/games/catalog';

export type GameHelp = { label: string; scored: boolean; summary: string; money?: string };

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
      'Each player sets a bet against the banker. A player can press to double the bet on a hole (triple on a par 3), and the banker can press every bet at once.',
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
    scored: false,
    summary: 'Head-to-head, hole by hole. Win more holes than your opponent to win the match.',
  },
  Wolf: {
    label: 'Wolf',
    scored: false,
    summary: 'The wolf rotates each hole and picks a partner after seeing tee shots, or goes alone for double.',
  },
  'Bingo Bango Bongo': {
    label: 'Bingo Bango Bongo',
    scored: false,
    summary: 'Three points per hole: first on the green, closest to the pin once everyone is on, and first in the hole.',
  },
  Vegas: {
    label: 'Vegas',
    scored: false,
    summary: 'Two-person teams combine their scores into a two-digit number (a 4 and a 5 make 45). Low number wins the difference.',
  },
  ...Object.fromEntries(
    BEEZER_EXTRA_GAMES.map((game) => [game.label, { label: game.label, scored: false, summary: 'Recorded with the round so everyone knows it was on.' }])
  ),
};

export function gameHelp(label: string): GameHelp {
  return GAME_HELP[label] ?? { label, scored: false, summary: '' };
}
