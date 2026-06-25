'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/shared/card';
import { useRoundStore } from '@/stores/round-store';
import { loadSharedRoundByCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';
import type { HoleState, Player, RoundState } from '@/types/round';

function ScoreTable({
  rows,
  showSkins,
  showCtp,
}: {
  rows: Array<{
    playerId: string;
    playerName: string;
    grossTotal: number;
    netTotal: number;
    holesCounted: number;
    naturalBirdies: number;
    naturalEagles: number;
    skins: number;
    ctpWins: number;
  }>;
  showSkins: boolean;
  showCtp: boolean;
}) {
  const gameColumnCount = Number(showSkins) + Number(showCtp);
  const gridTemplateColumns = `minmax(180px,1fr) 70px 70px 70px 80px 80px${showSkins ? ' 70px' : ''}${showCtp ? ' 70px' : ''}`;
  const minWidth = gameColumnCount === 0 ? 620 : gameColumnCount === 1 ? 690 : 760;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <div style={{ minWidth }}>
        <div className="grid bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns }}>
          <div className="truncate">Player</div>
          <div className="text-right tabular-nums">Holes</div>
          <div className="text-right tabular-nums">Gross</div>
          <div className="text-right tabular-nums">Net</div>
          <div className="text-right tabular-nums">Birdies</div>
          <div className="text-right tabular-nums">Eagles</div>
          {showSkins ? <div className="text-right tabular-nums">Skins</div> : null}
          {showCtp ? <div className="text-right tabular-nums">CTP</div> : null}
        </div>
        {rows.map((item, index) => (
          <div key={item.playerId} className="grid border-t border-slate-200 px-3 py-3 text-sm" style={{ gridTemplateColumns }}>
            <div className="truncate font-medium">
              {index + 1}. {item.playerName}
            </div>
            <div className="text-right font-semibold tabular-nums">{item.holesCounted}</div>
            <div className="text-right font-semibold tabular-nums">{item.grossTotal}</div>
            <div className="text-right font-semibold tabular-nums">{item.netTotal}</div>
            <div className="text-right font-semibold tabular-nums">{item.naturalBirdies}</div>
            <div className="text-right font-semibold tabular-nums">{item.naturalEagles}</div>
            {showSkins ? <div className="text-right font-semibold tabular-nums">{item.skins}</div> : null}
            {showCtp ? <div className="text-right font-semibold tabular-nums">{item.ctpWins}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function getPlayerGrossForHole(hole: HoleState, playerId: string) {
  if (!hole.isSaved) return null;
  if (hole.bankerPlayerId === playerId) return hole.bankerGrossScore;
  return hole.matchups.find((matchup) => matchup.playerId === playerId)?.grossScore ?? null;
}

function getScorecardHoles(round: RoundState) {
  const byHoleNumber = new Map<number, HoleState>();
  round.holes.forEach((hole) => {
    if (!byHoleNumber.has(hole.holeNumber)) {
      byHoleNumber.set(hole.holeNumber, hole);
    }
  });
  return [...byHoleNumber.values()].sort((a, b) => a.holeNumber - b.holeNumber);
}

function getPlayerHoleScore(round: RoundState, playerId: string, holeNumber: number) {
  return (
    round.holes
      .filter((hole) => hole.holeNumber === holeNumber)
      .map((hole) => getPlayerGrossForHole(hole, playerId))
      .find((score) => score != null) ?? null
  );
}

function sumScores(scores: Array<number | null>) {
  const entered = scores.filter((score): score is number => score != null);
  return entered.length > 0 ? entered.reduce((sum, score) => sum + score, 0) : null;
}

function ScorecardTable({ round, players }: { round: RoundState; players: Player[] }) {
  const holes = getScorecardHoles(round);
  const frontHoles = holes.filter((hole) => hole.holeNumber <= 9);
  const backHoles = holes.filter((hole) => hole.holeNumber > 9);
  const parOut = frontHoles.reduce((sum, hole) => sum + hole.par, 0);
  const parIn = backHoles.reduce((sum, hole) => sum + hole.par, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="sticky left-0 z-10 w-44 bg-slate-50 px-3 py-2 text-left">Player</th>
            {frontHoles.map((hole) => (
              <th key={hole.holeNumber} className="w-11 px-2 py-2 text-right tabular-nums">{hole.holeNumber}</th>
            ))}
            <th className="w-14 px-2 py-2 text-right tabular-nums">Out</th>
            {backHoles.map((hole) => (
              <th key={hole.holeNumber} className="w-11 px-2 py-2 text-right tabular-nums">{hole.holeNumber}</th>
            ))}
            <th className="w-14 px-2 py-2 text-right tabular-nums">In</th>
            <th className="w-16 px-2 py-2 text-right tabular-nums">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-200 bg-white text-slate-500">
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Par</th>
            {frontHoles.map((hole) => (
              <td key={hole.holeNumber} className="px-2 py-2 text-right tabular-nums">{hole.par}</td>
            ))}
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{parOut || '-'}</td>
            {backHoles.map((hole) => (
              <td key={hole.holeNumber} className="px-2 py-2 text-right tabular-nums">{hole.par}</td>
            ))}
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{parIn || '-'}</td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{parOut + parIn || '-'}</td>
          </tr>
          <tr className="border-t border-slate-200 bg-slate-50 text-slate-500">
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Hole HCP</th>
            {frontHoles.map((hole) => (
              <td key={hole.holeNumber} className="px-2 py-2 text-right tabular-nums">{hole.handicapIndex}</td>
            ))}
            <td className="px-2 py-2 text-right tabular-nums">-</td>
            {backHoles.map((hole) => (
              <td key={hole.holeNumber} className="px-2 py-2 text-right tabular-nums">{hole.handicapIndex}</td>
            ))}
            <td className="px-2 py-2 text-right tabular-nums">-</td>
            <td className="px-2 py-2 text-right tabular-nums">-</td>
          </tr>
          {players.map((player) => {
            const frontScores = frontHoles.map((hole) => getPlayerHoleScore(round, player.id, hole.holeNumber));
            const backScores = backHoles.map((hole) => getPlayerHoleScore(round, player.id, hole.holeNumber));
            const outTotal = sumScores(frontScores);
            const inTotal = sumScores(backScores);
            const total = sumScores([...frontScores, ...backScores]);

            return (
              <tr key={player.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50/50">
                <th className="sticky left-0 z-10 max-w-44 bg-inherit px-3 py-2 text-left font-semibold">
                  <span className="block truncate">{player.name}</span>
                </th>
                {frontScores.map((score, index) => (
                  <td key={`${player.id}-front-${index}`} className="px-2 py-2 text-right tabular-nums">{score ?? '-'}</td>
                ))}
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{outTotal ?? '-'}</td>
                {backScores.map((score, index) => (
                  <td key={`${player.id}-back-${index}`} className="px-2 py-2 text-right tabular-nums">{score ?? '-'}</td>
                ))}
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{inTotal ?? '-'}</td>
                <td className="px-2 py-2 text-right font-bold tabular-nums">{total ?? '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamMatchPlayCard({ round, players }: { round: RoundState; players: Player[] }) {
  const teamOneName = round.gameSettings.teamOneName || 'Team 1';
  const teamTwoName = round.gameSettings.teamTwoName || 'Team 2';
  const assignments = round.gameSettings.teamAssignments ?? {};
  const teamOnePlayers = players.filter((player, index) => (assignments[player.id] ?? (index % 2 === 0 ? 'team_one' : 'team_two')) === 'team_one');
  const teamTwoPlayers = players.filter((player, index) => (assignments[player.id] ?? (index % 2 === 0 ? 'team_one' : 'team_two')) === 'team_two');

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Team Match Play</h2>
          <p className="text-sm text-slate-500">Ryder Cup teams for this event.</p>
        </div>
        {round.gameSettings.teamMatchPlayUnit ? (
          <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold">${round.gameSettings.teamMatchPlayUnit} unit</span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-bold">{teamOneName}</h3>
          <p className="mt-2 text-sm text-slate-600">{teamOnePlayers.map((player) => player.name).join(', ') || 'No players assigned'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-bold">{teamTwoName}</h3>
          <p className="mt-2 text-sm text-slate-600">{teamTwoPlayers.map((player) => player.name).join(', ') || 'No players assigned'}</p>
        </div>
      </div>
    </Card>
  );
}

export default function EventLeaderboardPage() {
  const params = useParams<{ roundCode: string }>();
  const { round, hydrateRound, getGrossTotals, getSkinsSummary, getCtpSummary } = useRoundStore();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'not_found' | 'ready'>('idle');

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | null = null;

    async function loadRound(showLoading = false) {
      const requestedCode = params.roundCode?.toUpperCase();
      if (!requestedCode) return;

      if (showLoading) setLoadStatus('loading');
      const bundle = await loadSharedRoundByCode(requestedCode);
      if (cancelled) return;

      if (!bundle) {
        if (showLoading) setLoadStatus('not_found');
        return;
      }

      hydrateRound(sharedRoundBundleToRoundState(bundle));
      setLoadStatus('ready');
    }

    void loadRound(true);
    refreshTimer = window.setInterval(() => {
      void loadRound(false);
    }, 5000);

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearInterval(refreshTimer);
    };
  }, [hydrateRound, params.roundCode]);
  const roundPlayers = useMemo(() => (Array.isArray(round.players) ? round.players : []), [round.players]);
  const roundHoles = Array.isArray(round.holes) ? round.holes : [];
  const roundGroups = Array.isArray(round.multiFoursome?.groups) ? round.multiFoursome.groups : [];
  const roundGroupPlayers = Array.isArray(round.multiFoursome?.groupPlayers) ? round.multiFoursome.groupPlayers : [];
  const groupSize = round.multiFoursome?.groupSize ?? 4;
  const grossTotals = getGrossTotals();
  const skinsSummary = getSkinsSummary();
  const ctpSummary = getCtpSummary();
  const skinsGameEnabled = round.gameSettings?.skinsEnabled === true;
  const ctpGameEnabled = round.gameSettings?.ctpEnabled === true;

  const fallbackGroups = Array.from({ length: Math.max(1, Math.ceil(roundPlayers.length / groupSize)) }, (_, index) => ({
    groupNumber: index + 1,
    groupName: `Group ${index + 1}`,
    currentHole: round.currentHole,
  }));
  const groups = roundGroups.length ? roundGroups : fallbackGroups;
  const groupPlayers = roundGroupPlayers.length ? roundGroupPlayers : roundPlayers.map((player, index) => ({
    playerId: player.id,
    groupNumber: Math.floor(index / groupSize) + 1,
    sortOrder: index % groupSize,
  }));

  const eventLeaderboard = useMemo(
    () =>
      grossTotals
        .map((item) => {
          const skins = skinsSummary.payouts.find((skin) => skin.playerId === item.playerId)?.skins ?? 0;
          const ctpWins = ctpSummary.payouts.find((ctp) => ctp.playerId === item.playerId)?.wins ?? 0;

          return { ...item, skins, ctpWins };
        })
        .sort((a, b) => a.netTotal - b.netTotal || a.grossTotal - b.grossTotal || a.playerName.localeCompare(b.playerName)),
    [ctpSummary.payouts, grossTotals, skinsSummary.payouts]
  );

  const savedByGroup = groups.map((group) => ({
    ...group,
    saved: roundHoles.filter((hole) => (hole.groupNumber ?? 1) === group.groupNumber && hole.isSaved).length,
  }));
  const totalSaved = roundHoles.filter((hole) => hole.isSaved).length;
  const totalPossible = groups.length * round.totalHoles;
  const eventPath = `/r/${round.roundCode}`;

  async function copyLink(path: string, label: string) {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    await navigator.clipboard?.writeText(`${origin}${path}`);
    setCopiedLink(label);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <section className="rounded-3xl bg-[#2f8df3] p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm opacity-90">{round.courseName}</p>
            <h1 className="mt-1 text-3xl font-bold">{round.title}</h1>
            <p className="mt-2 text-sm">
              Event leaderboard - {roundPlayers.length} golfers - {totalSaved} of {totalPossible} group holes saved
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white px-3 py-2 font-mono text-lg font-bold text-[#1f2937]">
                {round.roundCode}
              </span>
              <button
                type="button"
                className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold"
                onClick={() => void copyLink(eventPath, 'event')}
              >
                {copiedLink === 'event' ? 'Copied' : 'Copy Event Link'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold" href={`/r/${round.roundCode}/settle`}>
              Settle Up
            </Link>
            <Link className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold" href={`/r/${round.roundCode}/history`}>
              History
            </Link>
            <Link className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold" href={`/r/${round.roundCode}/setup`}>
              Edit Setup
            </Link>
          </div>
        </div>
      </section>

      {loadStatus === 'loading' ? (
        <Card className="text-sm text-slate-600">Loading round {params.roundCode}...</Card>
      ) : null}
      {loadStatus === 'not_found' ? (
        <Card className="text-sm text-slate-600">No round was found for code {params.roundCode}.</Card>
      ) : null}

      <Card>
        <div className="mb-3">
          <h2 className="text-xl font-bold">Choose Your Group</h2>
          <p className="text-sm text-slate-500">Open the event link, pick your foursome, then claim scorekeeper if you are entering scores.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {savedByGroup.map((group) => {
            const names = groupPlayers
              .filter((item) => item.groupNumber === group.groupNumber)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => roundPlayers.find((player) => player.id === item.playerId)?.name)
              .filter(Boolean)
              .join(', ');

            return (
              <Link
                key={group.groupNumber}
                href={`/r/${round.roundCode}/group/${group.groupNumber}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">Enter Group {group.groupNumber}</span>
                  <span className="text-sm font-semibold text-[#2f8df3]">Hole {group.currentHole}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{names}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.saved} of {round.totalHoles} saved
                </p>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-bold">Leaderboard</h2>
        <ScoreTable rows={eventLeaderboard} showSkins={skinsGameEnabled} showCtp={ctpGameEnabled} />
      </Card>

      {round.gameSettings.teamMatchPlayEnabled ? <TeamMatchPlayCard round={round} players={roundPlayers} /> : null}

      <Card>
        <h2 className="mb-3 text-xl font-bold">Scorecard</h2>
        <ScorecardTable round={round} players={roundPlayers} />
      </Card>

    </main>
  );
}
