'use client';

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
    getGrossTotals,
  } = useRoundStore();
  const totals = getRunningTotals().sort((a, b) => b.amount - a.amount);
  const settlements = getSettleUp();
  const skinsSummary = getSkinsSummary();
  const lowNetSummary = getLowNetSummary();
  const ctpSummary = getCtpSummary();
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
      const [bundle, snapshot] = await Promise.all([
        loadSharedRoundByCode(routeRoundCode),
        loadSettlementSnapshot(routeRoundCode),
      ]);
      if (!cancelled && bundle) {
        hydrateRound(sharedRoundBundleToRoundState(bundle));
      }
      if (!cancelled) setSettlementSnapshot(snapshot);
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
      bankerPositions: totals.map((total) => ({
        playerId: total.playerId,
        name: total.name,
        amount: total.amount,
      })),
      bankerSettlements: settlements,
    };
  }

  async function handleFinalizeSettlement() {
    try {
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
        <div className="flex gap-4 text-sm font-semibold text-[#2f8df3]">
          <a href={`/r/${routeRoundCode}/history`}>History</a>
          <a href={`/r/${routeRoundCode}`}>Back to Round</a>
        </div>
      </div>

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

      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-bold">Payouts</h2>

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
      </section>

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
    </main>
  );
}
