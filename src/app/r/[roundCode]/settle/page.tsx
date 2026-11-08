'use client';

import { collectPotWins, netDebts, type Debt } from '@/lib/offline/net-payments';
import { computeGroupGames } from '@/lib/games/group-games';
import { GroupGameStandings } from '@/components/round/group-game-inputs';

import { SettlementSummary, type PaymentLine } from '@/app/settlement-summary';
import { readPending } from '@/lib/offline/score-queue';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';
import { postHandicapScores } from '@/lib/realtime/saved-golfers';
import { calculateScoreDifferential } from '@/lib/handicap/whs';
import {
  loadSettlementSnapshot,
  loadSharedRoundByCode,
  saveSettlementSnapshot,
  sharedRoundBundleToRoundState,
  type SettlementSnapshot,
} from '@/lib/realtime/shared-rounds';

function formatPosition(amount: number) {
  if (amount > 0) return `Up ${formatCurrency(amount)}`;
  if (amount < 0) return `Down ${formatCurrency(Math.abs(amount))}`;
  return 'Even';
}

function formatHoles(holes: number[]) {
  return holes.length > 0 ? holes.join(', ') : '-';
}

function ScoreTable({
  rows,
}: {
  rows: Array<{ playerId: string; playerName: string; grossTotal: number; netTotal: number }>;
}) {
  return (
    <>
      <div className="space-y-2 sm:hidden">
        {rows.map((item, index) => (
          <div key={item.playerId} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="truncate font-bold">
              {index + 1}. {item.playerName}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gross</p>
                <p className="font-bold tabular-nums">{item.grossTotal}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net</p>
                <p className="font-bold tabular-nums">{item.netTotal}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 sm:block">
        <div className="grid grid-cols-[1fr_90px_90px] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div>Player</div>
          <div className="text-right">Gross</div>
          <div className="text-right">Net</div>
        </div>
        {rows.map((item, index) => (
          <div key={item.playerId} className="grid grid-cols-[1fr_90px_90px] border-t border-slate-200 px-3 py-3 text-sm">
            <div className="truncate font-medium">
              {index + 1}. {item.playerName}
            </div>
            <div className="text-right font-semibold tabular-nums">{item.grossTotal}</div>
            <div className="text-right font-semibold tabular-nums">{item.netTotal}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function SettlePage() {
  const params = useParams<{ roundCode: string }>();
  const {
    round,
    hydrateRound,
    getRunningTotals,
    getSettleUp,
    getSkinsSummary,
    getLowNetSummary,
    getCtpSummary,
    getNassauSummary,
    getStablefordSummary,
    getBirdiePotSummary,
    getEaglePotSummary,
    getHoleInOneSummary,
    getGrossTotals,
  } = useRoundStore();
  const totals = getRunningTotals().sort((a, b) => b.amount - a.amount);
  const settlements = getSettleUp();
  const skinsSummary = getSkinsSummary();
  const lowNetSummary = getLowNetSummary();
  const ctpSummary = getCtpSummary();
  const nassauSummary = getNassauSummary();
  const stablefordSummary = getStablefordSummary();
  const birdiePotSummary = getBirdiePotSummary();
  const eaglePotSummary = getEaglePotSummary();
  const holeInOneSummary = getHoleInOneSummary();
  const bankerGameEnabled = round.gameSettings?.bankerEnabled !== false;
  const skinsGameEnabled = round.gameSettings?.skinsEnabled === true;
  const ctpGameEnabled = round.gameSettings?.ctpEnabled === true;
  const lowNetGameEnabled = round.gameSettings?.lowNetEnabled === true;
  const nassauGameEnabled = round.gameSettings?.nassauEnabled === true;
  const stablefordGameEnabled = round.gameSettings?.stablefordEnabled === true;
  const birdiePotGameEnabled = round.gameSettings?.birdiePotEnabled === true;
  const eaglePotGameEnabled = round.gameSettings?.eaglePotEnabled === true;
  const holeInOneGameEnabled = round.gameSettings?.holeInOneEnabled === true;
  const payoutGameEnabled =
    skinsGameEnabled ||
    ctpGameEnabled ||
    lowNetGameEnabled ||
    nassauGameEnabled ||
    stablefordGameEnabled ||
    birdiePotGameEnabled ||
    eaglePotGameEnabled ||
    holeInOneGameEnabled;
  const grossScores = getGrossTotals().sort(
    (a, b) => a.grossTotal - b.grossTotal || b.holesCounted - a.holesCounted || a.playerName.localeCompare(b.playerName)
  );
  const [courseRating, setCourseRating] = useState(round.gameSettings.courseRating ? String(round.gameSettings.courseRating) : '');
  const [slopeRating, setSlopeRating] = useState(round.gameSettings.slopeRating ? String(round.gameSettings.slopeRating) : '');
  const [pcc, setPcc] = useState(String(round.gameSettings.pcc ?? 0));
  const [adjustedScores, setAdjustedScores] = useState<Record<string, string>>({});
  const [handicapPostStatus, setHandicapPostStatus] = useState('');
  const [settlementSnapshot, setSettlementSnapshot] = useState<SettlementSnapshot | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState('');
  const [loadStatus, setLoadStatus] = useState('Loading settlement…');
  const [loaded, setLoaded] = useState(false);
  const routeRoundCode = params.roundCode?.toUpperCase() || round.roundCode;
  const bankerSettlementGroups = settlements.reduce<Array<{ groupNumber: number; items: typeof settlements }>>(
    (groups, item) => {
      const group = groups.find((entry) => entry.groupNumber === item.groupNumber);
      if (group) {
        group.items.push(item);
      } else {
        groups.push({ groupNumber: item.groupNumber, items: [item] });
      }
      return groups;
    },
    []
  );

  const holesSaved = round.holes.filter((hole) => hole.isSaved).length;
  const roundComplete = holesSaved >= round.totalHoles * Math.max(1, round.multiFoursome?.groups.length ?? 1);
  const handicapPostRows = useMemo(
    () =>
      grossScores.map((score) => {
        const adjustedGrossScore = Number(adjustedScores[score.playerId] ?? score.grossTotal);
        const differential = calculateScoreDifferential({
          adjustedGrossScore,
          courseRating: Number(courseRating),
          slopeRating: Number(slopeRating),
          pcc: Number(pcc) || 0,
        });
        return { ...score, adjustedGrossScore, differential };
      }),
    [adjustedScores, courseRating, grossScores, pcc, slopeRating]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRound() {
      if (!routeRoundCode) return;
      setLoaded(false);
      try {
      const [bundle, snapshot] = await Promise.all([
        loadSharedRoundByCode(routeRoundCode),
        loadSettlementSnapshot(routeRoundCode),
      ]);
      if (!cancelled && bundle) {
        hydrateRound(sharedRoundBundleToRoundState(bundle));
      }
      if (!cancelled) {
        setSettlementSnapshot(snapshot);
        setLoaded(Boolean(bundle));
        if (!bundle) setLoadStatus('Round not found.');
      }
      } catch { if (!cancelled) setLoadStatus('Unable to load settlement. Reconnect and reload to see current payouts.'); }
    }

    void loadRound();

    return () => {
      cancelled = true;
    };
  }, [hydrateRound, routeRoundCode]);

  useEffect(() => {
    setAdjustedScores((current) => {
      const next = { ...current };
      grossScores.forEach((score) => {
        if (next[score.playerId] == null) {
          next[score.playerId] = String(score.grossTotal);
        }
      });
      return next;
    });
  }, [grossScores]);

  useEffect(() => {
    if (!courseRating && round.gameSettings.courseRating) {
      setCourseRating(String(round.gameSettings.courseRating));
    }
    if (!slopeRating && round.gameSettings.slopeRating) {
      setSlopeRating(String(round.gameSettings.slopeRating));
    }
    if (pcc === '' && round.gameSettings.pcc != null) {
      setPcc(String(round.gameSettings.pcc));
    }
  }, [courseRating, pcc, round.gameSettings.courseRating, round.gameSettings.pcc, round.gameSettings.slopeRating, slopeRating]);

  const skinWinnerRows = skinsSummary.payouts
    .filter((item) => item.skins > 0)
    .map((item) => ({
      ...item,
      holes: skinsSummary.holes
        .filter((hole) => hole.winnerPlayerId === item.playerId)
        .map((hole) => hole.holeNumber)
        .sort((a, b) => a - b),
    }));

  const ctpWinnerRows = ctpSummary.payouts
    .filter((item) => item.wins > 0)
    .map((item) => ({
      ...item,
      holes: ctpSummary.par3Holes
        .filter((hole) => hole.winnerPlayerId === item.playerId)
        .map((hole) => hole.holeNumber)
        .sort((a, b) => a - b),
    }));

  const lowNetWinnerRows = lowNetSummary.payouts.filter((item) => item.amount > 0);
  const nassauWinnerRows = nassauSummary.payouts.filter((item) => item.amount > 0);
  const stablefordWinnerRows = stablefordSummary.payouts.filter((item) => item.amount > 0);
  const birdiePotWinnerRows = birdiePotSummary.payouts.filter((item) => item.amount > 0);
  const eaglePotWinnerRows = eaglePotSummary.payouts.filter((item) => item.amount > 0);
  const holeInOneWinnerRows = holeInOneSummary.payouts.filter((item) => item.amount > 0);

  const groupGameResults = computeGroupGames(round);

  function buildSnapshot(): SettlementSnapshot {
    return {
      roundCode: routeRoundCode,
      roundTitle: round.title,
      courseName: round.courseName,
      finalizedAt: new Date().toISOString(),
      finalScoring: grossScores.map((score) => ({
        playerId: score.playerId,
        playerName: score.playerName,
        grossTotal: score.grossTotal,
        netTotal: score.netTotal,
      })),
      skins: skinWinnerRows.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        amount: item.amount,
        skins: item.skins,
        holes: item.holes,
      })),
      ctp: ctpWinnerRows.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        amount: item.amount,
        wins: item.wins,
        holes: item.holes,
      })),
      lowNet: lowNetWinnerRows.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        amount: item.amount,
        placement: item.placement,
      })),
      nassau: nassauWinnerRows.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        amount: item.amount,
        wins: item.wins,
      })),
      stableford: stablefordWinnerRows.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        amount: item.amount,
        points: item.points,
      })),
      birdiePot: birdiePotWinnerRows.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        amount: item.amount,
        birdies: item.birdies,
        holes: item.holes,
      })),
      eaglePot: eaglePotWinnerRows.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        amount: item.amount,
        eagles: item.eagles,
        holes: item.holes,
      })),
      holeInOne: holeInOneWinnerRows.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        amount: item.amount,
        aces: item.aces,
        holes: item.holes,
        payerCount: item.payerCount,
      })),
      bankerPositions: bankerGameEnabled ? totals.map((total) => ({
        playerId: total.playerId,
        name: total.name,
        amount: total.amount,
      })) : [],
      bankerSettlements: bankerGameEnabled ? settlements : [],
      groupGames: { debts: groupGameResults.flatMap((result) => result.debts), pots: groupGameResults.flatMap((result) => result.pots) },
    };
  }

  async function handleFinalizeSettlement() {
    if (!window.confirm('Finalize settlement? This saves the final payouts for everyone in the round. Check the amounts above first.')) return;
    try {
      if (readPending(localStorage).some((entry) => entry.roundId === round.id)) throw new Error('Sync all pending scores on this device before finalizing settlement.');
      setSnapshotStatus('Saving final settlement...');
      const snapshot = buildSnapshot();
      const saved = await saveSettlementSnapshot({
        roundId: round.id,
        roundCode: routeRoundCode,
        snapshot,
      });
      setSettlementSnapshot(saved);
      setSnapshotStatus('Final settlement saved.');
    } catch (error) {
      console.error('Unable to save settlement snapshot.', error);
      setSnapshotStatus(error instanceof Error ? error.message : 'Unable to save final settlement.');
    }
  }

  async function handlePostHandicapScores() {
    try {
      setHandicapPostStatus('Posting handicap scores...');
      const updates = await postHandicapScores({
        roundCode: round.roundCode,
        courseName: round.courseName,
        courseRating: Number(courseRating),
        slopeRating: Number(slopeRating),
        pcc: Number(pcc) || 0,
        scores: handicapPostRows
          .filter((score) => score.holesCounted >= round.totalHoles)
          .map((score) => ({
            playerKey: score.playerId,
            playerName: score.playerName,
            adjustedGrossScore: score.adjustedGrossScore,
          })),
      });
      const updatedCount = updates.filter((item) => item.handicap != null).length;
      const pendingCount = updates.length - updatedCount;
      setHandicapPostStatus(
        `Posted ${updates.length} score${updates.length === 1 ? '' : 's'}. ${updatedCount} handicap index${updatedCount === 1 ? '' : 'es'} updated${pendingCount ? `; ${pendingCount} need at least 3 posted rounds.` : '.'}`
      );
    } catch (error) {
      console.error('Unable to post handicap scores.', error);
      setHandicapPostStatus(error instanceof Error ? error.message : 'Unable to post handicap scores.');
    }
  }

  if (!loaded || round.roundCode.toUpperCase() !== routeRoundCode.toUpperCase()) return <main className="mx-auto max-w-3xl px-4 py-8" role="status">{loadStatus}</main>;

  const payoutSnapshot = settlementSnapshot ?? buildSnapshot();
  // Player-to-player debts (Banker, hole-in-one) are netted per pair across every group.
  const debts: Debt[] = payoutSnapshot.bankerSettlements.map((item) => ({
    fromId: item.fromPlayerId, fromName: item.fromPlayerName, toId: item.toPlayerId, toName: item.toPlayerName, amount: item.amount, reason: 'Banker',
  }));
  (payoutSnapshot.holeInOne ?? []).forEach((winner) => {
    if (winner.payerCount <= 0 || winner.amount <= 0) return;
    const aceOptOuts = new Set(round.gameSettings.excludedPlayers?.hole_in_one ?? []);
    payoutSnapshot.finalScoring
      .filter((player) => player.playerId !== winner.playerId && !aceOptOuts.has(player.playerId))
      .forEach((payer) => debts.push({ fromId: payer.playerId, fromName: payer.playerName, toId: winner.playerId, toName: winner.playerName, amount: winner.amount / winner.payerCount, reason: 'Hole in one' }));
  });
  const pots = [
    ['Skins', payoutSnapshot.skins], ['Closest to the pin', payoutSnapshot.ctp], ['Low net', payoutSnapshot.lowNet],
    ['Nassau', payoutSnapshot.nassau ?? []], ['Stableford', payoutSnapshot.stableford ?? []],
    ['Birdie pot', payoutSnapshot.birdiePot ?? []], ['Eagle pot', payoutSnapshot.eaglePot ?? []],
  ] as const;
  debts.push(...(payoutSnapshot.groupGames?.debts ?? []));
  const potCollections = collectPotWins([
    ...pots.flatMap(([game, winners]) => winners.map((winner) => ({ playerId: winner.playerId, playerName: winner.playerName, amount: winner.amount, game }))),
    ...(payoutSnapshot.groupGames?.pots ?? []),
  ]);
  const paymentLines: PaymentLine[] = [
    ...netDebts(debts).map((transfer) => ({
      id: `pair:${transfer.fromId}:${transfer.toId}`,
      label: `${transfer.fromName} pays ${transfer.toName} (${transfer.reasons.join(' + ')})`,
      amount: transfer.amount,
      payTo: transfer.toName,
    })),
    ...potCollections.map((collection) => ({
      id: `pot:${collection.playerId}`,
      label: `${collection.playerName} collects from the pot money (${collection.games.map((game) => `${game.game} ${formatCurrency(game.amount)}`).join(' · ')})`,
      amount: collection.amount,
      payTo: collection.playerName,
    })),
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Settle Up</h1>
          <p className="mt-2 text-slate-600">
            {roundComplete
              ? `Recommended payouts for ${round.title} at ${round.courseName}.`
              : `These payouts are based on ${holesSaved} group holes saved so far.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 text-sm font-semibold">
          <a className="inline-flex min-h-[44px] items-center rounded-xl border border-[#c9d8c7] px-3 text-[#0f5132]" href={`/r/${routeRoundCode}/history`}>History</a>
          <a className="inline-flex min-h-[44px] items-center rounded-xl border border-[#c9d8c7] px-3 text-[#0f5132]" href={`/r/${routeRoundCode}`}>Back to round</a>
        </div>
      </div>

      <SettlementSummary roundId={round.id} title={round.title} complete={Boolean(settlementSnapshot) || roundComplete} lines={paymentLines} />
      {snapshotStatus ? <p role="status" className="mb-4 text-sm">{snapshotStatus}</p> : null}
      {!settlementSnapshot && !roundComplete ? (
        <p className="mb-2 text-sm text-slate-600">
          You can finalize once every group finishes: {holesSaved} of {round.totalHoles * Math.max(1, round.multiFoursome?.groups.length ?? 1)} holes scored so far.
        </p>
      ) : null}
      {!settlementSnapshot ? <button type="button" disabled={!roundComplete} className="mb-4 rounded-xl bg-[#0f5132] px-4 py-3 font-semibold text-white disabled:opacity-40" onClick={() => void handleFinalizeSettlement()}>Finalize settlement</button> : null}
      <details className="rounded-2xl border border-slate-200 p-3">
      <summary className="mb-4 cursor-pointer font-bold">Game-by-game calculations and score details</summary>
      {groupGameResults.length ? (
        <div className="mb-4">
          <GroupGameStandings
            open
            results={groupGameResults.map((result) => ({ ...result, label: (round.multiFoursome?.groups.length ?? 1) > 1 ? `${result.label} · Group ${result.groupNumber}` : result.label }))}
          />
        </div>
      ) : null}
      {settlementSnapshot ? (
        <>
          <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
            <h2 className="text-xl font-bold">Final Settlement Saved</h2>
            <p className="mt-2 text-sm text-slate-600">
              Finalized {new Date(settlementSnapshot.finalizedAt).toLocaleString()} for {settlementSnapshot.roundTitle} at {settlementSnapshot.courseName}.
            </p>
          </section>

          <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-bold">Final Scoring</h2>
            <ScoreTable rows={settlementSnapshot.finalScoring} />
          </section>

          <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xl font-bold">Payouts</h2>

            <div className="mb-4">
              <h3 className="mb-2 font-semibold">Skins</h3>
              <div className="space-y-2">
                {settlementSnapshot.skins.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No skins winners.</div>
                ) : (
                  settlementSnapshot.skins.map((item) => (
                    <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} skins</span>
                        <span className="font-bold">{item.skins} skin{item.skins === 1 ? '' : 's'}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">Skin holes: {formatHoles(item.holes)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="mb-2 font-semibold">Closest to the Pin</h3>
              <div className="space-y-2">
                {settlementSnapshot.ctp.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No CTP winners.</div>
                ) : (
                  settlementSnapshot.ctp.map((item) => (
                    <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} CTP</span>
                        <span className="font-bold">{item.wins} win{item.wins === 1 ? '' : 's'}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">CTP holes: {formatHoles(item.holes)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Low Net</h3>
              <div className="space-y-2">
                {settlementSnapshot.lowNet.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No low net payouts.</div>
                ) : (
                  settlementSnapshot.lowNet.map((item) => (
                    <div key={item.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                      <span>{item.playerName} wins {formatCurrency(item.amount)} low net ({item.placement})</span>
                      <span className="font-bold">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {(settlementSnapshot.nassau?.length ?? 0) > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">Nassau</h3>
              <div className="space-y-2">
                {settlementSnapshot.nassau?.map((item) => (
                  <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} Nassau</span>
                      <span className="font-bold">{formatCurrency(item.amount)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Won: {item.wins.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
            ) : null}

            {(settlementSnapshot.stableford?.length ?? 0) > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">Stableford</h3>
              <div className="space-y-2">
                {settlementSnapshot.stableford?.map((item) => (
                  <div key={item.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                    <span>{item.playerName} wins {formatCurrency(item.amount)} Stableford</span>
                    <span className="font-bold">{item.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
            ) : null}

            {(settlementSnapshot.birdiePot?.length ?? 0) > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">Birdie Pot</h3>
              <div className="space-y-2">
                {settlementSnapshot.birdiePot?.map((item) => (
                  <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} birdie pot</span>
                      <span className="font-bold">{item.birdies} birdie{item.birdies === 1 ? '' : 's'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Birdie holes: {formatHoles(item.holes)}</p>
                  </div>
                ))}
              </div>
            </div>
            ) : null}

            {(settlementSnapshot.eaglePot?.length ?? 0) > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">Eagle Pot</h3>
              <div className="space-y-2">
                {settlementSnapshot.eaglePot?.map((item) => (
                  <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} eagle pot</span>
                      <span className="font-bold">{item.eagles} eagle{item.eagles === 1 ? '' : 's'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Eagle holes: {formatHoles(item.holes)}</p>
                  </div>
                ))}
              </div>
            </div>
            ) : null}

            {(settlementSnapshot.holeInOne?.length ?? 0) > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">Hole-in-One</h3>
              <div className="space-y-2">
                {settlementSnapshot.holeInOne?.map((item) => (
                  <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} hole-in-one</span>
                      <span className="font-bold">{item.aces} ace{item.aces === 1 ? '' : 's'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Hole-in-one holes: {formatHoles(item.holes)}. {item.payerCount} golfer{item.payerCount === 1 ? '' : 's'} pay {formatCurrency(100)} each.
                    </p>
                  </div>
                ))}
              </div>
            </div>
            ) : null}
          </section>

          <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">Banker Final Positions</h2>
            <div className="space-y-2">
              {settlementSnapshot.bankerPositions.map((total) => (
                <div key={total.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <span className="font-medium">{total.name}</span>
                  <span className="font-bold">{formatPosition(total.amount)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">Who Pays Whom - Banker Only</h2>
            {settlementSnapshot.bankerSettlements.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-4 text-slate-500">Nobody owes anything.</div>
            ) : (
              <div className="space-y-2">
                {settlementSnapshot.bankerSettlements.map((item, index) => (
                  <div key={`${item.groupNumber}-${item.fromPlayerId}-${item.toPlayerId}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                    <span className="font-medium">
                      Group {item.groupNumber}: {item.fromPlayerName} pays {item.toPlayerName}
                    </span>
                    <span className="font-bold">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>

      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-bold">Final Scoring</h2>
        <ScoreTable rows={grossScores} />
      </section>


      {payoutGameEnabled ? (
      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-bold">Payouts</h2>

        {skinsGameEnabled ? (
        <div className="mb-4">
          <h3 className="mb-2 font-semibold">Skins</h3>
          <div className="space-y-2">
            {skinWinnerRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No skins winners yet.</div>
            ) : (
              skinWinnerRows.map((item) => (
                <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} skins</span>
                    <span className="font-bold">{item.skins} skin{item.skins === 1 ? '' : 's'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Skin holes: {formatHoles(item.holes)}</p>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {ctpGameEnabled ? (
        <div className="mb-4">
          <h3 className="mb-2 font-semibold">Closest to the Pin</h3>
          <div className="space-y-2">
            {ctpWinnerRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No CTP winners yet.</div>
            ) : (
              ctpWinnerRows.map((item) => (
                <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} CTP</span>
                    <span className="font-bold">{item.wins} win{item.wins === 1 ? '' : 's'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">CTP holes: {formatHoles(item.holes)}</p>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {lowNetGameEnabled ? (
        <div>
          <h3 className="mb-2 font-semibold">Low Net</h3>
          <div className="space-y-2">
            {lowNetWinnerRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No low net payouts yet.</div>
            ) : (
              lowNetWinnerRows.map((item) => (
                <div key={item.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <span>{item.playerName} wins {formatCurrency(item.amount)} low net ({item.placement})</span>
                  <span className="font-bold">{formatCurrency(item.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {nassauGameEnabled ? (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold">Nassau</h3>
          <div className="space-y-2">
            {nassauWinnerRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No Nassau payouts yet.</div>
            ) : (
              nassauWinnerRows.map((item) => (
                <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} Nassau</span>
                    <span className="font-bold">{formatCurrency(item.amount)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Won: {item.wins.join(', ')}</p>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {stablefordGameEnabled ? (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold">Stableford</h3>
          <div className="space-y-2">
            {stablefordWinnerRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No Stableford payouts yet.</div>
            ) : (
              stablefordWinnerRows.map((item) => (
                <div key={item.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <span>{item.playerName} wins {formatCurrency(item.amount)} Stableford</span>
                  <span className="font-bold">{item.points} pts</span>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {birdiePotGameEnabled ? (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold">Birdie Pot</h3>
          <div className="space-y-2">
            {birdiePotWinnerRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No birdies yet.</div>
            ) : (
              birdiePotWinnerRows.map((item) => (
                <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} birdie pot</span>
                    <span className="font-bold">{item.birdies} birdie{item.birdies === 1 ? '' : 's'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Birdie holes: {formatHoles(item.holes)}</p>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {eaglePotGameEnabled ? (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold">Eagle Pot</h3>
          <div className="space-y-2">
            {eaglePotWinnerRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No eagles yet.</div>
            ) : (
              eaglePotWinnerRows.map((item) => (
                <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} eagle pot</span>
                    <span className="font-bold">{item.eagles} eagle{item.eagles === 1 ? '' : 's'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Eagle holes: {formatHoles(item.holes)}</p>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {holeInOneGameEnabled ? (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold">Hole-in-One</h3>
          <div className="space-y-2">
            {holeInOneWinnerRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No holes-in-one yet.</div>
            ) : (
              holeInOneWinnerRows.map((item) => (
                <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.playerName} wins {formatCurrency(item.amount)} hole-in-one</span>
                    <span className="font-bold">{item.aces} ace{item.aces === 1 ? '' : 's'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Hole-in-one holes: {formatHoles(item.holes)}. {item.payerCount} golfer{item.payerCount === 1 ? '' : 's'} pay {formatCurrency(100)} each.
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}
      </section>
      ) : null}

      {bankerGameEnabled ? (
      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Banker Final Positions</h2>
        <div className="space-y-2">
          {totals.map((total) => (
            <div key={total.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
              <span className="font-medium">{total.name}</span>
              <span className="font-bold">{formatPosition(total.amount)}</span>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {bankerGameEnabled ? (
      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Who Pays Whom - Banker Only</h2>
        {bankerSettlementGroups.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-3 py-4 text-slate-500">
            Nobody owes anything right now.
          </div>
        ) : (
          <div className="space-y-4">
            {bankerSettlementGroups.map((group) => (
              <div key={group.groupNumber}>
                <h3 className="mb-2 font-semibold">Group {group.groupNumber}</h3>
                <div className="space-y-2">
                  {group.items.map((item, index) => (
                    <div key={`${item.groupNumber}-${item.fromPlayerId}-${item.toPlayerId}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                      <span className="font-medium">
                        {item.fromPlayerName} pays {item.toPlayerName}
                      </span>
                      <span className="font-bold">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}

      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Final Settlement Snapshot</h2>
            <p className="mt-1 text-sm text-slate-500">
              Save the final settle-up page once every group is complete.
            </p>
            {snapshotStatus ? <p className="mt-2 text-sm text-slate-600">{snapshotStatus}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-xl bg-[#2f8df3] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!roundComplete || round.id.startsWith('round-')}
            onClick={() => void handleFinalizeSettlement()}
          >
            Finalize Settlement
          </button>
        </div>
      </section>
        </>
      )}
      </details>

      <details className="mt-4 rounded-2xl border border-slate-200 p-3">
        <summary className="cursor-pointer font-bold">Post scores for handicaps <span className="font-normal text-slate-500">(optional)</span></summary>
        <div className="mt-3">
      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Post Handicap Scores</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter the course rating and slope, adjust any posting scores, then save these to golfer profiles.
          </p>
          {handicapPostStatus ? <p className="mt-2 text-sm text-slate-600">{handicapPostStatus}</p> : null}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Course Rating</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={courseRating}
              placeholder="71.2"
              onChange={(event) => setCourseRating(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Slope Rating</label>
            <input
              type="number"
              inputMode="numeric"
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={slopeRating}
              placeholder="128"
              onChange={(event) => setSlopeRating(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">PCC</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={pcc}
              placeholder="0"
              onChange={(event) => setPcc(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1fr_90px_110px_110px] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <div>Player</div>
            <div className="text-right">Gross</div>
            <div className="text-right">Adjusted</div>
            <div className="text-right">Differential</div>
          </div>
          {handicapPostRows.map((score) => (
            <div key={score.playerId} className="grid grid-cols-[1fr_90px_110px_110px] border-t border-slate-200 px-3 py-3 text-sm">
              <div className="truncate font-medium">{score.playerName}</div>
              <div className="text-right font-semibold tabular-nums">{score.grossTotal}</div>
              <input
                type="number"
                inputMode="numeric"
                className="ml-auto w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-semibold tabular-nums"
                value={adjustedScores[score.playerId] ?? String(score.grossTotal)}
                onChange={(event) => setAdjustedScores((current) => ({ ...current, [score.playerId]: event.target.value }))}
              />
              <div className="text-right font-semibold tabular-nums">{score.differential ?? '-'}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-xl bg-[#2f8df3] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!roundComplete || !Number(courseRating) || !Number(slopeRating)}
            onClick={() => void handlePostHandicapScores()}
          >
            Post Handicap Scores
          </button>
        </div>
      </section>
        </div>
      </details>
    </main>
  );
}
