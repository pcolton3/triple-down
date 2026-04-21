import { isNetBirdieOrBetter } from './birdie';
import { getPressMultiplier } from './multipliers';
import type { BankerHoleInput, BankerMatchupResult } from './types';

export function settleBankerHole(
  input: BankerHoleInput
): BankerMatchupResult[] {
  const bankerBirdie = isNetBirdieOrBetter(input.bankerNetScore, input.par);

  return input.matchups.map((matchup) => {
    const pressMultiplier = getPressMultiplier(input.par, matchup.pressCount);
    const playerBirdie = isNetBirdieOrBetter(matchup.playerNetScore, input.par);

    if (matchup.playerNetScore === input.bankerNetScore) {
      return {
        playerId: matchup.playerId,
        result: 'push',
        pressMultiplier,
        birdieMultiplier: 1,
        finalAmount: 0,
        reason: 'Same net score',
      };
    }

    if (bankerBirdie && playerBirdie) {
      return {
        playerId: matchup.playerId,
        result: 'push',
        pressMultiplier,
        birdieMultiplier: 1,
        finalAmount: 0,
        reason: 'Both banker and player made net birdie or better',
      };
    }

    const playerWins = matchup.playerNetScore < input.bankerNetScore;
    const result = playerWins ? 'player_wins' : 'banker_wins';

    let birdieMultiplier = 1;
    if (bankerBirdie || playerBirdie) {
      birdieMultiplier = 2;
    }

    return {
      playerId: matchup.playerId,
      result,
      pressMultiplier,
      birdieMultiplier,
      finalAmount: matchup.baseWager * pressMultiplier * birdieMultiplier,
      reason: bankerBirdie
        ? 'Banker net birdie or better doubled bet'
        : playerBirdie
          ? 'Player net birdie or better doubled bet'
          : 'Standard settlement',
    };
  });
}
