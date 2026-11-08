'use client';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils/currency';

import { paymentKey, type PaymentLine } from '@/lib/offline/payments';
export type { PaymentLine } from '@/lib/offline/payments';

export function SettlementSummary({ roundId, title, complete, lines }: { roundId: string; title: string; complete: boolean; lines: PaymentLine[] }) {
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const signature = lines.map((line) => paymentKey(roundId, line)).join('|');
  useEffect(() => {
    const load = () => {
      try {
        const values: Record<string, boolean> = {};
        lines.forEach((line) => { const key = paymentKey(roundId, line); values[key] = localStorage.getItem(key) === 'true'; });
        setPaid(values);
      } catch { setMessage('Payment tracking is unavailable in this browser.'); }
    };
    load(); window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, signature]);
  async function share() {
    const text = `${title} — ${complete ? 'Settle up' : 'Provisional settle up'}\n${lines.map((line) => `${line.label}: ${formatCurrency(line.amount)}${paid[paymentKey(roundId, line)] ? ' (paid)' : ''}`).join('\n')}\n${window.location.href}`;
    try {
      if (navigator.share) await navigator.share({ title: `${title} — Settle up`, text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); setMessage('Summary copied.'); }
      else { setMessage(text); }
    } catch (error) { if ((error as Error).name !== 'AbortError') setMessage('Could not share. Please try again.'); }
  }
  function toggle(line: PaymentLine) {
    const key = paymentKey(roundId, line);
    try { localStorage.setItem(key, String(!paid[key])); setPaid((previous) => ({ ...previous, [key]: !previous[key] })); }
    catch { setMessage('Could not save payment status on this device.'); }
  }
  return <section className="mb-4 rounded-2xl border border-[#c9d8c7] bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Who pays whom</h2><button type="button" className="rounded-xl bg-[#0f5132] px-4 py-3 text-sm font-bold text-white" onClick={() => void share()}>Share summary</button></div>
    <p className="mt-2 text-sm text-slate-500">{complete ? 'Final payouts.' : 'Provisional payouts — scores are still being entered.'} Each pair of players has one line, with everything between them netted. Pot winnings come out of the money collected before the round. Tick payments off as they happen; ticks are kept on this phone.</p>
    {lines.length ? <ul className="mt-3 space-y-2">{lines.map((line) => <li key={line.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="font-semibold">{line.label}</p><p className="font-bold">{formatCurrency(line.amount)}</p></div><label className="flex min-h-[48px] cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={paid[paymentKey(roundId, line)] ?? false} onChange={() => toggle(line)} />{paid[paymentKey(roundId, line)] ? 'Paid' : 'Unpaid'}</label></li>)}</ul> : <p className="mt-3 text-slate-500">No payments due yet.</p>}
    {message ? <p role="status" className="mt-3 whitespace-pre-line text-sm">{message}</p> : null}
  </section>;
}
