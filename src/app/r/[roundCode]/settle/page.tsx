'use client';

import Link from 'next/link';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';

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
  const {
    round,
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

  const holesSaved = round.holes.filter((hole) => hole.isSaved).length;
  const roundComplete = holesSaved >= round.totalHoles * Math.max(1, round.multiFoursome?.groups.length ?? 1);

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
          <Link href={`/r/${round.roundCode}/history`}>History</Link>
          <Link href={`/r/${round.roundCode}`}>Back to Round</Link>
        </div>
      </div>

      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-bold">Final Scoring</h2>
        <ScoreTable rows={grossScores} />
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
        {settlements.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-3 py-4 text-slate-500">
            Nobody owes anything right now.
          </div>
        ) : (
          <div className="space-y-2">
            {settlements.map((item, index) => (
              <div key={`${item.fromPlayerId}-${item.toPlayerId}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                <span className="font-medium">
                  {item.fromPlayerName} pays {item.toPlayerName}
                </span>
                <span className="font-bold">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
