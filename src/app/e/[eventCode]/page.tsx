'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/shared/card';
import { loadSharedRoundsByRyderEventCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';
import type { HoleState, Player, RoundState } from '@/types/round';

type RyderRoundSummary = {
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

function formatLead(first: number, second: number, firstName: string, secondName: string) {
  if (first === second) return 'All square';
  return `${first > second ? firstName : secondName} leads ${Math.abs(first - second)}`;
}

function buildAutoSinglesPairings(round: RoundState, players: Player[]) {
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

function buildRyderRoundSummary(round: RoundState): RyderRoundSummary {
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

      teamOnePoints += playerPoints;
      teamTwoPoints += opponentPoints;
      return [{
        label: `${player.name} vs ${opponent.name}`,
        score: `${playerPoints} - ${opponentPoints}`,
        status: `${formatLead(playerPoints, opponentPoints, player.name, opponent.name)} through ${holesComplete}`,
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

    totalTeamOne += teamOnePoints;
    totalTeamTwo += teamTwoPoints;
    return {
      label: `Group ${groupNumber}`,
      score: `${teamOnePoints} - ${teamTwoPoints}`,
      status: `${formatLead(teamOnePoints, teamTwoPoints, teamOneName, teamTwoName)} through ${holes.length}`,
    };
  });

  return { roundCode: round.roundCode, title: round.title, day: round.ryderEventDay ?? 1, format, teamOneName, teamTwoName, teamOnePoints: totalTeamOne, teamTwoPoints: totalTeamTwo, rows };
}

export default function RyderEventPage() {
  const params = useParams<{ eventCode: string }>();
  const eventCode = params.eventCode?.toUpperCase() ?? '';
  const [rounds, setRounds] = useState<RoundState[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_found'>('loading');

  useEffect(() => {
    let cancelled = false;
    async function loadEvent() {
      setStatus('loading');
      const bundles = await loadSharedRoundsByRyderEventCode(eventCode);
      if (cancelled) return;
      setRounds(bundles.map(sharedRoundBundleToRoundState));
      setStatus(bundles.length > 0 ? 'ready' : 'not_found');
    }
    if (eventCode) void loadEvent();
    return () => {
      cancelled = true;
    };
  }, [eventCode]);

  const summaries = useMemo(() => rounds.map(buildRyderRoundSummary).sort((a, b) => a.day - b.day), [rounds]);
  const teamOneName = summaries[0]?.teamOneName ?? 'Team 1';
  const teamTwoName = summaries[0]?.teamTwoName ?? 'Team 2';
  const teamOneTotal = summaries.reduce((sum, item) => sum + item.teamOnePoints, 0);
  const teamTwoTotal = summaries.reduce((sum, item) => sum + item.teamTwoPoints, 0);

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <section className="rounded-3xl bg-[#071b12] p-5 text-white shadow-sm">
        <p className="text-sm opacity-90">Ryder Cup Event</p>
        <h1 className="mt-1 text-3xl font-bold">{eventCode}</h1>
        <p className="mt-2 text-sm">{summaries.length} linked round{summaries.length === 1 ? '' : 's'}</p>
      </section>

      {status === 'loading' ? <Card className="text-sm text-slate-600">Loading Ryder event {eventCode}...</Card> : null}
      {status === 'not_found' ? <Card className="text-sm text-slate-600">No Ryder rounds are linked to {eventCode} yet.</Card> : null}

      {status === 'ready' ? (
        <>
          <Card>
            <h2 className="mb-3 text-xl font-bold">Overall Score</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{teamOneName}</p>
                <p className="mt-1 text-3xl font-bold">{teamOneTotal}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{teamTwoName}</p>
                <p className="mt-1 text-3xl font-bold">{teamTwoTotal}</p>
              </div>
            </div>
          </Card>

          {summaries.map((summary) => (
            <Card key={summary.roundCode}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Day {summary.day}: {summary.title}</h2>
                  <p className="text-sm text-slate-500">{summary.format === 'team_match' ? 'Team Match Play' : 'Singles Match Play'}</p>
                </div>
                <Link className="text-sm font-bold text-[#0f5132]" href={`/r/${summary.roundCode}`}>
                  Open Round
                </Link>
              </div>
              <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold">
                {summary.teamOneName} {summary.teamOnePoints} - {summary.teamTwoPoints} {summary.teamTwoName}
              </div>
              <div className="space-y-2">
                {summary.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <span className="font-semibold">{row.label}</span>
                    <span className="font-semibold tabular-nums">{row.score}</span>
                    <span className="text-slate-500">{row.status}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </>
      ) : null}
    </main>
  );
}
