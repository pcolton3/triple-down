'use client';
import { useEffect, useState } from 'react';
import { flushScores, syncError, storageError } from '@/lib/offline/round-sync';
import { QUEUE_EVENT, readPending } from '@/lib/offline/score-queue';

export function ScoreSync() {
  useEffect(() => {
    const timer = window.setInterval(() => void flushScores(), 15000);
    let debounce: number | undefined;
    let observed = '';
    const changed = () => {
      try {
        const entries = readPending(localStorage);
        const signature = entries.map((entry) => entry.revision).join(':');
        if (signature === observed) return;
        observed = signature;
        window.clearTimeout(debounce);
        if (entries.length) debounce = window.setTimeout(() => void flushScores(), 700);
      } catch { /* The scoring screen displays storage errors. */ }
    };
    const online = () => void flushScores();
    window.addEventListener(QUEUE_EVENT, changed);
    window.addEventListener('storage', changed);
    window.addEventListener('online', online);
    changed();
    void flushScores();
    return () => { window.clearInterval(timer); window.clearTimeout(debounce); window.removeEventListener(QUEUE_EVENT, changed); window.removeEventListener('storage', changed); window.removeEventListener('online', online); };
  }, []);
  return null;
}
type Tone = 'ok' | 'pending' | 'error';
const DOT: Record<Tone, string> = { ok: 'bg-green-600', pending: 'bg-amber-500', error: 'bg-red-600' };

export function SaveStatus({ roundId, group, dirty = false, onRetry }: { roundId: string; group: number; dirty?: boolean; onRetry?: () => void }) {
  const [status, setStatus] = useState<{ tone: Tone; text: string }>({ tone: 'pending', text: 'Checking saved scores…' });
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const update = () => {
      try {
        const count = readPending(localStorage).filter((entry) => entry.roundId === roundId && entry.groupNumber === group).length;
        const holes = `${count} hole${count === 1 ? '' : 's'}`;
        const stored = storageError(roundId, group);
        setPending(count > 0 || Boolean(stored));
        if (stored) setStatus({ tone: 'error', text: stored });
        else if (!count) setStatus({ tone: 'ok', text: 'All scores saved' });
        else if (!navigator.onLine) setStatus({ tone: 'pending', text: `No signal · ${holes} kept on this phone, will send automatically` });
        else if (syncError()) setStatus({ tone: 'error', text: `Couldn't send ${holes} yet · ${syncError()}` });
        else setStatus({ tone: 'pending', text: `Sending ${holes}…` });
      } catch { setStatus({ tone: 'error', text: 'Phone storage is unavailable. Keep this page open until scores send.' }); }
    };
    update();
    window.addEventListener(QUEUE_EVENT, update); window.addEventListener('online', update); window.addEventListener('offline', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener(QUEUE_EVENT, update); window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('storage', update); };
  }, [roundId, group]);
  const shown = dirty ? { tone: 'pending' as Tone, text: 'Unsaved correction · tap Save Correction' } : status;
  return (
    <div role="status" aria-live="polite" className="mb-2 flex min-h-[28px] items-center gap-2 text-sm font-semibold text-slate-700">
      <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[shown.tone]}`} />
      <span className="min-w-0 flex-1">{shown.text}</span>
      {pending && !dirty ? (
        <button type="button" className="min-h-[36px] shrink-0 rounded-lg border border-slate-300 px-3 text-xs font-bold" onClick={() => { if (onRetry) onRetry(); else void flushScores(); }}>
          Retry now
        </button>
      ) : null}
    </div>
  );
}
