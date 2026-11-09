import { isGrossBirdieOrBetter } from './birdie';
import { getPressMultiplier } from './multipliers';
import type { BankerHoleInput, BankerMatchupResult } from './types';

export function settleBankerHole(
  input: BankerHoleInput
): BankerMatchupResult[] {
  const bankerBirdie = isGrossBirdieOrBetter(input.bankerGrossScore, input.par);

  return input.matchups.map((matchup) => {
    const pressMultiplier = getPressMultiplier(input.par, matchup.pressCount);
    const playerBirdie = isGrossBirdieOrBetter(matchup.playerGrossScore, input.par);

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

    const playerWins = matchup.playerNetScore < input.bankerNetScore;
    const result = playerWins ? 'player_wins' : 'banker_wins';

    let birdieMultiplier = 1;
    // Only one side's gross birdie doubles the bet. If both birdie, the automatic doubles cancel
    // out, but presses still count and the lower net score still wins (user, 2026-11-08).
    if (bankerBirdie !== playerBirdie) {
      birdieMultiplier = 2;
    }

    return {
      playerId: matchup.playerId,
      result,
      pressMultiplier,
      birdieMultiplier,
      finalAmount: matchup.baseWager * pressMultiplier * birdieMultiplier,
      reason: bankerBirdie && playerBirdie
        ? 'Both made gross birdie; no automatic double, lower net wins'
        : bankerBirdie
        ? 'Banker gross birdie or better doubled bet'
        : playerBirdie
          ? 'Player gross birdie or better doubled bet'
          : 'Standard settlement',
    };
  });
}
