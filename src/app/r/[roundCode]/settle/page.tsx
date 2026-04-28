'use client';

import Link from 'next/link';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';

function formatPosition(amount: number) {
  if (amount > 0) return `Up ${formatCurrency(amount)}`;
  if (amount < 0) return `Down ${formatCurrency(Math.abs(amount))}`;
  return 'Even';
}

export default function SettlePage() {
  const { round, getRunningTotals, getSettleUp } = useRoundStore();
  const totals = getRunningTotals().sort((a, b) => b.amount - a.amount);
  const settlements = getSettleUp();

  const holesSaved = round.holes.filter((hole) => hole.isSaved).length;
  const roundComplete = holesSaved >= round.totalHoles;

  // ✅ NEW: Calculate gross scores
  const grossScores = round.players.map((player) => {
    let total = 0;
    let holesCounted = 0;

    round.holes.forEach((hole) => {
      if (!hole.isSaved) return;

      // Banker score
      if (hole.bankerPlayerId === player.id) {
        if (hole.bankerGrossScore != null) {
          total += hole.bankerGrossScore;
          holesCounted++;
        }
      }

      // Non-banker score
      const matchup = hole.matchups.find((m) => m.playerId === player.id);
      if (matchup && matchup.grossScore != null) {
        total += matchup.grossScore;
        holesCounted++;
      }
    });

    return {
      playerId: player.id,
      name: player.name,
      total,
      holesCounted,
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Settle Up</h1>
          <p className="mt-2 text-slate-600">
            {roundComplete
              ? `Recommended payouts for ${round.title} at ${round.courseName}.`
              : `These payouts are based on ${holesSaved} of ${round.totalHoles} holes saved so far.`}
          </p>
        </div>
        <div className="flex gap-4 text-sm font-semibold text-[#2f8df3]">
          <Link href={`/r/${round.roundCode}/history`}>History</Link>
          <Link href={`/r/${round.roundCode}`}>Back to Round</Link>
        </div>
      </div>

      {/* ✅ NEW SECTION */}
      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Gross Scores</h2>
        <div className="space-y-2">
          {grossScores.map((player) => (
            <div key={player.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
              <span className="font-medium">{player.name}</span>
              <span className="font-bold">
                {roundComplete
                  ? player.total
                  : `${player.total} through ${player.holesCounted}`}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Final Positions</h2>
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
        <h2 className="mb-3 text-lg font-bold">Who Pays Whom</h2>
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