'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/shared/card';
import { Button } from '@/components/shared/button';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';
import { createSharedRoundFromLocalRound, loadSharedRoundByCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';

function formatPosition(amount: number) {
  if (amount > 0) return `Up ${formatCurrency(amount)}`;
  if (amount < 0) return `Down ${formatCurrency(Math.abs(amount))}`;
  return 'Even';
}

function ScoreTable({
  rows,
}: {
  rows: Array<{ playerId: string; playerName: string; grossTotal: number; netTotal: number }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[1fr_90px_90px] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <div>Player</div>
        <div className="text-right">Gross</div>
        <div className="text-right">Net</div>
      </div>
      {rows.map((item, index) => (
        <div key={item.playerId} className="grid grid-cols-[1fr_90px_90px] border-t border-slate-200 px-3 py-3 text-sm">
          <div className="font-medium">
            {index + 1}. {item.playerName}
          </div>
          <div className="text-right font-semibold">{item.grossTotal}</div>
          <div className="text-right font-semibold">{item.netTotal}</div>
        </div>
      ))}
    </div>
  );
}

export default function EventLeaderboardPage() {
  const params = useParams<{ roundCode: string }>();
  const { round, hydrateRound, simulateFullEvent, getRunningTotals, getGrossTotals, getSkinsSummary, getCtpSummary } = useRoundStore();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'not_found' | 'ready'>('idle');
  const [simulateStatus, setSimulateStatus] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadRound() {
      const requestedCode = params.roundCode?.toUpperCase();
      if (!requestedCode || round.roundCode === requestedCode) return;

      setLoadStatus('loading');
      const bundle = await loadSharedRoundByCode(requestedCode);
      if (cancelled) return;

      if (!bundle) {
        setLoadStatus('not_found');
        return;
      }

      hydrateRound(sharedRoundBundleToRoundState(bundle));
      setLoadStatus('ready');
    }

    void loadRound();

    return () => {
      cancelled = true;
    };
  }, [hydrateRound, params.roundCode, round.roundCode]);
  const roundPlayers = Array.isArray(round.players) ? round.players : [];
  const roundHoles = Array.isArray(round.holes) ? round.holes : [];
  const roundGroups = Array.isArray(round.multiFoursome?.groups) ? round.multiFoursome.groups : [];
  const roundGroupPlayers = Array.isArray(round.multiFoursome?.groupPlayers) ? round.multiFoursome.groupPlayers : [];
  const totals = getRunningTotals();
  const grossTotals = getGrossTotals();
  const skinsSummary = getSkinsSummary();
  const ctpSummary = getCtpSummary();

  const fallbackGroups = Array.from({ length: Math.max(1, Math.ceil(roundPlayers.length / 4)) }, (_, index) => ({
    groupNumber: index + 1,
    groupName: `Group ${index + 1}`,
    currentHole: round.currentHole,
  }));
  const groups = roundGroups.length ? roundGroups : fallbackGroups;
  const groupPlayers = roundGroupPlayers.length ? roundGroupPlayers : roundPlayers.map((player, index) => ({
    playerId: player.id,
    groupNumber: Math.floor(index / 4) + 1,
    sortOrder: index % 4,
  }));

  const eventLeaderboard = useMemo(
    () =>
      grossTotals
        .map((item) => {
          const skins = skinsSummary.payouts.find((skin) => skin.playerId === item.playerId)?.skins ?? 0;
          const ctpWins = ctpSummary.payouts.find((ctp) => ctp.playerId === item.playerId)?.wins ?? 0;
          const position = totals.find((total) => total.playerId === item.playerId)?.amount ?? 0;

          return { ...item, skins, ctpWins, position };
        })
        .sort((a, b) => a.netTotal - b.netTotal || a.grossTotal - b.grossTotal || a.playerName.localeCompare(b.playerName)),
    [ctpSummary.payouts, grossTotals, skinsSummary.payouts, totals]
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

  async function handleSimulateEvent() {
    try {
      setSimulateStatus('Simulating event...');
      simulateFullEvent();
      await createSharedRoundFromLocalRound(useRoundStore.getState().round);
      setSimulateStatus('Simulated 18 holes for every group.');
    } catch (error) {
      setSimulateStatus(error instanceof Error ? error.message : 'Unable to save simulated event.');
    }
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
          </div>
        </div>
      </section>

      {loadStatus === 'loading' ? (
        <Card className="text-sm text-slate-600">Loading round {params.roundCode}...</Card>
      ) : null}
      {loadStatus === 'not_found' ? (
        <Card className="text-sm text-slate-600">No round was found for code {params.roundCode}.</Card>
      ) : null}

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Test Tools</h2>
          <p className="text-sm text-slate-500">Fill all groups with simulated gross scores and event-wide CTP winners.</p>
          {simulateStatus ? <p className="mt-2 text-sm text-slate-600">{simulateStatus}</p> : null}
        </div>
        <Button type="button" onClick={() => void handleSimulateEvent()}>
          Simulate Full Event
        </Button>
      </Card>

      <Card>
        <div className="mb-3">
          <h2 className="text-xl font-bold">Group Scoring Links</h2>
          <p className="text-sm text-slate-500">Each foursome keeps its own current hole and enters only its own scores.</p>
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
                  <span className="font-bold">Group {group.groupNumber}</span>
                  <span className="text-sm font-semibold text-[#2f8df3]">Hole {group.currentHole}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{names}</p>
                <p className="mt-2 break-all font-mono text-xs text-slate-500">
                  /r/{round.roundCode}/group/{group.groupNumber}
                </p>
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
        <ScoreTable rows={eventLeaderboard} />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {eventLeaderboard.map((item) => (
            <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3 text-sm">
              <div className="font-semibold">{item.playerName}</div>
              <div className="mt-1 text-slate-600">
                Holes {item.holesCounted} | Skins {item.skins} | CTP {item.ctpWins} | Banker {formatPosition(item.position)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
