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
  rows: Array<{
    playerId: string;
    playerName: string;
    grossTotal: number;
    netTotal: number;
    naturalBirdies: number;
    naturalEagles: number;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[minmax(180px,1fr)_80px_80px_80px_80px] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div className="truncate">Player</div>
          <div className="text-right tabular-nums">Gross</div>
          <div className="text-right tabular-nums">Net</div>
          <div className="text-right tabular-nums">Birdies</div>
          <div className="text-right tabular-nums">Eagles</div>
        </div>
        {rows.map((item, index) => (
          <div key={item.playerId} className="grid grid-cols-[minmax(180px,1fr)_80px_80px_80px_80px] border-t border-slate-200 px-3 py-3 text-sm">
            <div className="truncate font-medium">
              {index + 1}. {item.playerName}
            </div>
            <div className="text-right font-semibold tabular-nums">{item.grossTotal}</div>
            <div className="text-right font-semibold tabular-nums">{item.netTotal}</div>
            <div className="text-right font-semibold tabular-nums">{item.naturalBirdies}</div>
            <div className="text-right font-semibold tabular-nums">{item.naturalEagles}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventLeaderboardPage() {
  const params = useParams<{ roundCode: string }>();
  const { round, hydrateRound, setPlayerHandicap, getRunningTotals, getGrossTotals, getSkinsSummary, getCtpSummary } = useRoundStore();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'not_found' | 'ready'>('idle');
  const [handicapDrafts, setHandicapDrafts] = useState<Record<string, string>>({});
  const [handicapStatus, setHandicapStatus] = useState('');
  const [isEditingHandicaps, setIsEditingHandicaps] = useState(false);

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
  const totals = getRunningTotals();
  const grossTotals = getGrossTotals();
  const skinsSummary = getSkinsSummary();
  const ctpSummary = getCtpSummary();

  useEffect(() => {
    if (isEditingHandicaps) return;
    setHandicapDrafts(
      Object.fromEntries(roundPlayers.map((player) => [player.id, String(player.handicap ?? 0)]))
    );
  }, [isEditingHandicaps, roundPlayers]);

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

  async function handleSaveHandicaps() {
    try {
      setHandicapStatus('Saving handicaps...');
      roundPlayers.forEach((player) => {
        const value = Number(handicapDrafts[player.id]);
        setPlayerHandicap(player.id, Number.isFinite(value) ? value : 0);
      });
      await createSharedRoundFromLocalRound(useRoundStore.getState().round);
      const bundle = await loadSharedRoundByCode(round.roundCode);
      if (bundle) {
        hydrateRound(sharedRoundBundleToRoundState(bundle));
      }
      setIsEditingHandicaps(false);
      setHandicapStatus('Handicaps updated.');
    } catch (error) {
      setHandicapStatus(error instanceof Error ? error.message : 'Unable to save handicaps.');
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Handicaps</h2>
            <p className="text-sm text-slate-500">Correct a starting handicap and save to recalculate net scores and Banker strokes.</p>
            {handicapStatus ? <p className="mt-2 text-sm text-slate-600">{handicapStatus}</p> : null}
          </div>
          <Button type="button" onClick={() => void handleSaveHandicaps()}>
            Save Handicaps
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roundPlayers.map((player) => (
            <label key={player.id} className="block rounded-xl bg-slate-50 px-3 py-3">
              <span className="block truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{player.name}</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-[#2f8df3] focus:ring-2 focus:ring-[#2f8df3]/20"
                value={handicapDrafts[player.id] ?? String(player.handicap ?? 0)}
                onChange={(event) => {
                  setIsEditingHandicaps(true);
                  setHandicapDrafts((current) => ({ ...current, [player.id]: event.target.value }));
                }}
              />
            </label>
          ))}
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
