import type { Player, HoleState } from '@/types/round';

export type PlayerHoleScore = {
  playerId: string;
  holeNumber: number;
  grossScore: number | null;
  netScore: number | null;
};

export function getGrossScoreForPlayerOnHole(hole: HoleState, playerId: string) {
  if (hole.bankerPlayerId === playerId) return hole.bankerGrossScore;
  return hole.matchups.find((matchup) => matchup.playerId === playerId)?.grossScore ?? null;
}

export function calculateEventGrossTotals(players: Player[], holes: HoleState[]) {
  return players.map((player) => {
    let grossTotal = 0;
    let holesCounted = 0;

    holes.forEach((hole) => {
      if (!hole.isSaved) return;
      const gross = getGrossScoreForPlayerOnHole(hole, player.id);
      if (gross == null) return;

      grossTotal += gross;
      holesCounted += 1;
    });

    return {
      playerId: player.id,
      playerName: player.name,
      grossTotal,
      holesCounted,
    };
  });
}

export function calculateSoloLowNetSkin(params: {
  playerScores: PlayerHoleScore[];
}) {
  const validScores = params.playerScores.filter(
    (score): score is PlayerHoleScore & { netScore: number } => score.netScore != null
  );

  if (validScores.length === 0) {
    return {
      winnerPlayerId: null,
      winningNetScore: null,
      isTie: false,
    };
  }

  const lowNet = Math.min(...validScores.map((score) => score.netScore));
  const winners = validScores.filter((score) => score.netScore === lowNet);

  if (winners.length !== 1) {
    return {
      winnerPlayerId: null,
      winningNetScore: lowNet,
      isTie: true,
    };
  }

  return {
    winnerPlayerId: winners[0].playerId,
    winningNetScore: lowNet,
    isTie: false,
  };
}
