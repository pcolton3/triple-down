'use client';

import Link from 'next/link';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';

function formatPosition(amount: number) {
  if (amount > 0) return `Up ${formatCurrency(amount)}`;
  if (amount < 0) return `Down ${formatCurrency(Math.abs(amount))}`;
  return 'Even';
}

export default function SummaryPage() {
  const { round, getRunningTotals } = useRoundStore();
  const totals = getRunningTotals().sort((a, b) => b.amount - a.amount);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Round Summary</h1>
          <p className="mt-2 text-slate-600">Final running totals for {round.title} at {round.courseName}.</p>
        </div>
        <div className="flex gap-4 text-sm font-semibold text-[#2f8df3]">
          <Link href={`/r/${round.roundCode}/history`}>History</Link>
          <Link href={`/r/${round.roundCode}/settle`}>Settle Up</Link>
          <Link href={`/r/${round.roundCode}`}>Back to Round</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="space-y-2">
          {totals.map((total) => (
            <div key={total.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
              <span className="font-medium">{total.name}</span>
              <span className="font-bold">{formatPosition(total.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
