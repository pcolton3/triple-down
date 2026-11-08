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
export function SaveStatus({ roundId, group, dirty = false, onRetry }: { roundId: string; group: number; dirty?: boolean; onRetry?: () => void }) {
  const [status, setStatus] = useState('Checking saved scores…');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const update = () => {
      try {
        const count = readPending(localStorage).filter((entry) => entry.roundId === roundId && entry.groupNumber === group).length;
        setPending(count > 0 || Boolean(storageError(roundId, group)));
        if (storageError(roundId, group)) { setStatus(storageError(roundId, group)); return; }
        setStatus(count ? !navigator.onLine ? `Offline · ${count} hole${count === 1 ? '' : 's'} saved on this device` : syncError() ? `Needs retry · ${syncError()}` : `Saving… ${count} hole${count === 1 ? '' : 's'} pending` : 'Saved · all changes synced');
      } catch { setStatus('Device storage unavailable. Keep this page open and retry saving.'); }
    };
    update();
    window.addEventListener(QUEUE_EVENT, update); window.addEventListener('online', update); window.addEventListener('offline', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener(QUEUE_EVENT, update); window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('storage', update); };
  }, [roundId, group]);
  return <div role="status" aria-live="polite" className="mb-2 text-sm font-semibold text-slate-700">{dirty ? "Unsaved correction · press Save Correction" : status}{pending ? <button type="button" className="ml-3 underline" onClick={() => { if (onRetry) onRetry(); else void flushScores(); }}>Retry now</button> : null}</div>;
}
