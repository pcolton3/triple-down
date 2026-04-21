'use client';

import Link from 'next/link';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';

function formatAmount(value: number) {
  if (value > 0) return `Won ${formatCurrency(value)}`;
  if (value < 0) return `Lost ${formatCurrency(Math.abs(value))}`;
  return 'Push';
}

function formatPosition(value: number) {
  if (value > 0) return `Up ${formatCurrency(value)}`;
  if (value < 0) return `Down ${formatCurrency(Math.abs(value))}`;
  return 'Even';
}

export default function HistoryPage() {
  const { round, getHoleHistory } = useRoundStore();
  const history = getHoleHistory();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hole History</h1>
          <p className="mt-2 text-slate-600">Review each updated hole, the Banker, matchup net scores, and running totals after that hole.</p>
        </div>
        <Link href={`/r/${round.roundCode}`} className="text-sm font-semibold text-[#2f8df3]">
          Back to Round
        </Link>
      </div>

      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="rounded-2xl border border-[#68aef7] bg-white p-4 text-slate-500 shadow-sm">
            No holes have been updated yet.
          </div>
        ) : (
          history.map((hole) => (
            <section key={hole.holeNumber} className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Hole {hole.holeNumber}</h2>
                  <p className="text-sm text-slate-500">
                    Par {hole.par} • Handicap {hole.handicapIndex} • Banker: {hole.bankerName}
                  </p>
                </div>
                <div className="text-right text-sm text-slate-500">
                  <div>Banker gross: {hole.bankerGrossScore ?? '-'}</div>
                  <div>Banker hcp: {hole.bankerHandicap}</div>
                  <div>{hole.bankerPressed ? `Banker ${hole.pressLabel}` : `No Banker ${hole.pressLabel.toLowerCase()}`}</div>
                  <div>{hole.matchups.some((matchup) => matchup.bankerGetsStroke) ? `Banker * from ${hole.matchups.filter((matchup) => matchup.bankerGetsStroke).map((matchup) => matchup.playerName).join(', ')}` : 'Banker no stroke'}</div>
                </div>
              </div>

              <div className="space-y-2">
                {hole.matchups.map((matchup) => (
                  <div key={matchup.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{matchup.playerName}{matchup.playerGetsStroke ? ' *' : ''}</p>
                        <p className="text-sm text-slate-500">
                          Bet {formatCurrency(matchup.baseWager)} • Gross {matchup.playerGrossScore ?? '-'} vs Banker {matchup.bankerGrossScore ?? '-'}
                        </p>
                        <p className="text-sm text-slate-500">
                          Net {matchup.playerNetScore ?? '-'} vs Banker {matchup.bankerNetScore ?? '-'}
                          {matchup.playerGetsStroke ? ' • Player gets stroke' : ''}
                          {matchup.bankerGetsStroke ? ' • Banker gets stroke' : ''}
                          {matchup.playerPressed ? ` • Player ${hole.pressLabel}` : ''}
                          {hole.bankerPressed ? ` • Banker ${hole.pressLabel}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatAmount(matchup.amount)}</p>
                        <p className="text-xs text-slate-500">{matchup.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Running totals after hole {hole.holeNumber}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {hole.runningTotals.map((item) => (
                    <div key={item.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                      <span className="font-medium">{item.playerName}</span>
                      <span className="font-bold">{formatPosition(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
