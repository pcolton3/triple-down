import type { HoleState, Player, RoundState } from '@/types/round';
import { scoreMatch } from '@/lib/events/match-play';

/** Ryder Cup points for one round (moved from the event page so it can be tested). */
export type RyderRoundSummary = {
  roundCode: string;
  title: string;
  day: number;
  format: 'team_match' | 'singles_match';
  teamOneName: string;
  teamTwoName: string;
  teamOnePoints: number;
  teamTwoPoints: number;
  rows: Array<{ label: string; score: string; status: string }>;
};

function getPlayerGrossForHole(hole: HoleState, playerId: string) {
  if (!hole.isSaved) return null;
  if (hole.bankerPlayerId === playerId) return hole.bankerGrossScore;
  return hole.matchups.find((matchup) => matchup.playerId === playerId)?.grossScore ?? null;
}

function getPlayerNetForHole(round: RoundState, hole: HoleState, playerId: string) {
  const gross = getPlayerGrossForHole(hole, playerId);
  if (gross == null) return null;
  const player = round.players.find((item) => item.id === playerId);
  if (!player) return gross;
  const fullRoundStrokes = Math.floor(Math.max(0, player.handicap) / round.totalHoles);
  const extraStrokes = Math.max(0, player.handicap) % round.totalHoles;
  const strokesOnHole = fullRoundStrokes + (hole.handicapIndex <= extraStrokes ? 1 : 0);
  return gross - strokesOnHole;
}

function getTeamForPlayer(round: RoundState, playerId: string, fallbackIndex = 0): 'team_one' | 'team_two' {
  return round.gameSettings.teamAssignments?.[playerId] ?? (fallbackIndex % 2 === 0 ? 'team_one' : 'team_two');
}

export function buildAutoSinglesPairings(round: RoundState, players: Player[]) {
  const pairings = { ...(round.gameSettings.singlesPairings ?? {}) };
  const teamOneIds = players.filter((player, index) => getTeamForPlayer(round, player.id, index) === 'team_one').map((player) => player.id);
  const teamTwoIds = players.filter((player, index) => getTeamForPlayer(round, player.id, index) === 'team_two').map((player) => player.id);
  teamOneIds.forEach((playerId, index) => {
    if (pairings[playerId]) return;
    const opponentId = teamTwoIds[index];
    if (!opponentId) return;
    pairings[playerId] = opponentId;
    pairings[opponentId] = playerId;
  });
  return pairings;
}

export function buildRyderRoundSummary(round: RoundState): RyderRoundSummary {
  const teamOneName = round.gameSettings.teamOneName || 'Team 1';
  const teamTwoName = round.gameSettings.teamTwoName || 'Team 2';
  const format = round.gameSettings.ryderCupFormat ?? 'team_match';
  const groupSize = round.multiFoursome?.groupSize ?? 4;
  const groupAssignments = round.multiFoursome?.groupPlayers ?? round.players.map((player, index) => ({
    playerId: player.id,
    groupNumber: Math.floor(index / groupSize) + 1,
    sortOrder: index % groupSize,
  }));

  if (format === 'singles_match') {
    const pairings = buildAutoSinglesPairings(round, round.players);
    const seen = new Set<string>();
    let teamOnePoints = 0;
    let teamTwoPoints = 0;
    const rows = round.players.flatMap((player, index) => {
      if (getTeamForPlayer(round, player.id, index) !== 'team_one') return [];
      const opponent = round.players.find((item) => item.id === pairings[player.id]);
      if (!opponent) return [];
      const key = [player.id, opponent.id].sort().join(':');
      if (seen.has(key)) return [];
      seen.add(key);

      let playerPoints = 0;
      let opponentPoints = 0;
      let holesComplete = 0;
      round.holes.filter((hole) => hole.isSaved).forEach((hole) => {
        const playerNet = getPlayerNetForHole(round, hole, player.id);
        const opponentNet = getPlayerNetForHole(round, hole, opponent.id);
        if (playerNet == null || opponentNet == null) return;
        holesComplete += 1;
        if (playerNet < opponentNet) playerPoints += 1;
        else if (opponentNet < playerNet) opponentPoints += 1;
        else {
          playerPoints += 0.5;
          opponentPoints += 0.5;
        }
      });

      const match = scoreMatch(playerPoints, opponentPoints, holesComplete, round.totalHoles, player.name, opponent.name);
      teamOnePoints += match.firstPoints;
      teamTwoPoints += match.secondPoints;
      return [{
        label: `${player.name} vs ${opponent.name}`,
        score: `${match.firstPoints} - ${match.secondPoints}`,
        status: match.status,
      }];
    });

    return { roundCode: round.roundCode, title: round.title, day: round.ryderEventDay ?? 1, format, teamOneName, teamTwoName, teamOnePoints, teamTwoPoints, rows };
  }

  const groups = [...new Set(groupAssignments.map((assignment) => assignment.groupNumber))].sort((a, b) => a - b);
  let totalTeamOne = 0;
  let totalTeamTwo = 0;
  const rows = groups.map((groupNumber) => {
    const playerIds = groupAssignments
      .filter((assignment) => assignment.groupNumber === groupNumber)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((assignment) => assignment.playerId);
    let teamOnePoints = 0;
    let teamTwoPoints = 0;
    const holes = round.holes.filter((hole) => (hole.groupNumber ?? 1) === groupNumber && hole.isSaved);

    holes.forEach((hole) => {
      const scores = playerIds
        .map((playerId, index) => ({ team: getTeamForPlayer(round, playerId, index), net: getPlayerNetForHole(round, hole, playerId) }))
        .filter((score): score is { team: 'team_one' | 'team_two'; net: number } => score.net != null);
      if (scores.length === 0) return;
      const lowNet = Math.min(...scores.map((score) => score.net));
      const winningTeams = new Set(scores.filter((score) => score.net === lowNet).map((score) => score.team));
      if (winningTeams.size > 1) {
        teamOnePoints += 0.5;
        teamTwoPoints += 0.5;
      } else if (winningTeams.has('team_one')) teamOnePoints += 1;
      else if (winningTeams.has('team_two')) teamTwoPoints += 1;
    });

    const match = scoreMatch(teamOnePoints, teamTwoPoints, holes.length, round.totalHoles, teamOneName, teamTwoName);
    totalTeamOne += match.firstPoints;
    totalTeamTwo += match.secondPoints;
    return {
      label: `Group ${groupNumber}`,
      score: `${match.firstPoints} - ${match.secondPoints}`,
      status: match.status,
    };
  });

  return { roundCode: round.roundCode, title: round.title, day: round.ryderEventDay ?? 1, format, teamOneName, teamTwoName, teamOnePoints: totalTeamOne, teamTwoPoints: totalTeamTwo, rows };
}
