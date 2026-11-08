'use client';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { displayHandle, hasHandles, PAY_APPS, payLink, type PaymentHandles } from '@/lib/payments/pay-links';
import { loadPaymentHandles, normalizedName, savePaymentHandles } from '@/lib/realtime/saved-golfers';

import { paymentKey, type PaymentLine } from '@/lib/offline/payments';
export type { PaymentLine } from '@/lib/offline/payments';

function HandleEditor({ name, initial, onSave, onCancel }: { name: string; initial: PaymentHandles; onSave: (handles: PaymentHandles) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<PaymentHandles>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setSaving(true);
    setError('');
    try { await onSave(draft); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save. Try again.'); }
    finally { setSaving(false); }
  }
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold">How does {name} get paid?</p>
      {PAY_APPS.map((app) => (
        <label key={app.key} className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">{app.hint}</span>
          <input
            className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder={app.placeholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={draft[app.key] ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, [app.key]: event.target.value }))}
          />
        </label>
      ))}
      <p className="text-xs text-slate-500">Saved for {name}&apos;s future rounds too. Usernames are visible to anyone using the app.</p>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={saving} className="min-h-[44px] flex-1 rounded-xl bg-[#0f5132] px-4 text-sm font-bold text-white disabled:opacity-50" onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function SettlementSummary({ roundId, title, complete, lines }: { roundId: string; title: string; complete: boolean; lines: PaymentLine[] }) {
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [handles, setHandles] = useState<Record<string, PaymentHandles>>({});
  const [editing, setEditing] = useState<string | null>(null);
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
  useEffect(() => {
    loadPaymentHandles().then(setHandles).catch(() => { /* Pay buttons are optional; the list still works without them. */ });
  }, []);

  const handlesFor = (name?: string) => (name ? handles[normalizedName(name)] : undefined);
  const note = `Triple Track · ${title}`;

  async function share() {
    const text = `${title} — ${complete ? 'Settle up' : 'Provisional settle up'}\n${lines.map((line) => {
      const payee = handlesFor(line.payTo);
      const apps = payee ? PAY_APPS.filter((app) => payee[app.key]).map((app) => `${app.label} ${displayHandle(app.key, payee[app.key]!)}`).join(', ') : '';
      return `${line.label}: ${formatCurrency(line.amount)}${apps ? ` · ${apps}` : ''}${paid[paymentKey(roundId, line)] ? ' (paid)' : ''}`;
    }).join('\n')}\n${window.location.href}`;
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
  async function saveHandles(name: string, next: PaymentHandles) {
    const saved = await savePaymentHandles(name, next);
    setHandles((current) => ({ ...current, [normalizedName(name)]: saved }));
    setEditing(null);
  }

  return <section className="mb-4 rounded-2xl border border-[#c9d8c7] bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Who pays whom</h2><button type="button" className="min-h-[44px] rounded-xl bg-[#0f5132] px-4 text-sm font-bold text-white" onClick={() => void share()}>Share summary</button></div>
    <p className="mt-2 text-sm text-slate-500">{complete ? 'Final payouts.' : 'Provisional payouts — scores are still being entered.'} Each pair of players has one line, with everything between them netted. Pot winnings come out of the money collected before the round. Pay buttons open the app with the amount filled in; you confirm there. Tick payments off as they happen; ticks are kept on this phone.</p>
    {lines.length ? <ul className="mt-3 space-y-2">{lines.map((line) => {
      const key = paymentKey(roundId, line);
      const payee = handlesFor(line.payTo);
      const isEditing = editing === line.id && line.payTo;
      return <li key={line.id} className="rounded-xl bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-semibold">{line.label}</p><p className="font-bold">{formatCurrency(line.amount)}</p></div>
          <label className="flex min-h-[48px] shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={paid[key] ?? false} onChange={() => toggle(line)} />{paid[key] ? 'Paid' : 'Unpaid'}</label>
        </div>
        {line.payTo && !paid[key] && !isEditing ? (
          hasHandles(payee) ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {PAY_APPS.filter((app) => payee?.[app.key]).map((app) => (
                <a
                  key={app.key}
                  href={payLink(app.key, payee![app.key]!, line.amount, note)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0f5132] px-4 text-sm font-bold text-white"
                  aria-label={`Pay ${line.payTo} ${formatCurrency(line.amount)} with ${app.label} (${displayHandle(app.key, payee![app.key]!)})`}
                >
                  Pay with {app.label}
                </a>
              ))}
              <button type="button" className="min-h-[44px] px-1 text-xs font-semibold text-slate-600 underline" onClick={() => setEditing(line.id)}>Edit</button>
            </div>
          ) : (
            <button type="button" className="mt-1 min-h-[44px] text-sm font-semibold text-[#0f5132] underline" onClick={() => setEditing(line.id)}>
              + Add {line.payTo}&apos;s Venmo or Cash App
            </button>
          )
        ) : null}
        {isEditing ? <HandleEditor name={line.payTo!} initial={payee ?? {}} onSave={(next) => saveHandles(line.payTo!, next)} onCancel={() => setEditing(null)} /> : null}
      </li>;
    })}</ul> : <p className="mt-3 text-slate-500">No payments due yet.</p>}
    {message ? <p role="status" className="mt-3 whitespace-pre-line text-sm">{message}</p> : null}
  </section>;
}
