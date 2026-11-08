import { supabase } from '@/lib/supabase/client';
import { replaceSharedHoleMatchups, updateSharedCtpResult, updateSharedHole } from '@/lib/realtime/shared-rounds';
import { updateGroupCurrentHole } from '@/lib/realtime/group-rounds';
import { acknowledge, pendingKey, putPending, QUEUE_EVENT, readPending, type PendingHole } from './score-queue';
import type { HoleState, RoundState } from '@/types/round';
import { cacheRound } from './local-rounds';

let running: Promise<void> | null = null;
let lastError = '';
const storageErrors = new Map<string, string>();
export function storageError(roundId: string, group: number) { return storageErrors.get(`${roundId}:${group}`) ?? ''; }
export function syncError() { return lastError; }
export function announceQueue() { window.dispatchEvent(new Event(QUEUE_EVENT)); }
export function queueHole(round: RoundState, groupNumber: number, hole: HoleState, currentHole?: number) {
  const scope = `${round.id}:${groupNumber}`;
  try {
  const deviceId = localStorage.getItem('triple-track-device-id');
  if (!deviceId) throw new Error('Claim scorekeeper before saving.');
  putPending(localStorage, { revision: crypto.randomUUID(), roundId: round.id, roundCode: round.roundCode, groupNumber, hole: structuredClone(hole), currentHole, deviceId });
  storageErrors.delete(scope);
  try { cacheRound(round); } catch { storageErrors.set(scope, 'Scores are queued, but this round could not be cached for offline reopening. Keep this page open.'); }
  announceQueue();
  } catch (error) {
    storageErrors.set(scope, 'Unable to save on this device. Keep this page open, free device storage, and retry.');
    announceQueue();
    throw error;
  }
}
export async function sendPending(entry: PendingHole) {
  const { data: group, error } = await supabase.from('round_groups').select('scorekeeper_device_id,current_hole').eq('round_id', entry.roundId).eq('group_number', entry.groupNumber).single();
  if (error) throw error;
  if (group.scorekeeper_device_id !== entry.deviceId) throw new Error(`Group ${entry.groupNumber} scorekeeper changed. Pending scores remain on this device; ask the organizer to resolve ownership.`);
  const common = { roundId: entry.roundId, groupNumber: entry.groupNumber, holeNumber: entry.hole.holeNumber };
  await updateSharedHole({ ...common, bankerPlayerKey: entry.hole.bankerPlayerId, bankerGrossScore: entry.hole.bankerGrossScore, bankerPressed: entry.hole.bankerPressed, isSaved: false });
  await replaceSharedHoleMatchups({ ...common, matchups: entry.hole.matchups });
  if (entry.hole.par === 3) await updateSharedCtpResult({ ...common, winnerPlayerKey: entry.hole.ctpWinnerPlayerId ?? null });
  // Mark the hole complete only after every score write succeeds.
  await updateSharedHole({ ...common, isSaved: entry.hole.isSaved });
  if (entry.currentHole != null && entry.currentHole > group.current_hole) {
    await updateGroupCurrentHole({ roundId: entry.roundId, groupNumber: entry.groupNumber, currentHole: entry.currentHole });
  }
}
async function drain() {
  if (!navigator.onLine) { announceQueue(); return; }
  lastError = '';
  const failed = new Set<string>();
  while (true) {
    const entry = readPending(localStorage).find((item) => !failed.has(pendingKey(item)));
    if (!entry) break;
    try { await sendPending(entry); acknowledge(localStorage, entry); }
    catch (error) {
      lastError = error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'Unable to sync. Will retry automatically.';
      failed.add(pendingKey(entry));
    }
    announceQueue();
  }
  announceQueue();
}
export function flushScores(): Promise<void> {
  if (running) return running;
  const work = async () => {
    if (navigator.locks) await navigator.locks.request('triple-track-score-sync', drain);
    else await drain();
  };
  running = work().catch((error) => {
    lastError = error instanceof Error ? error.message : 'Unable to access saved scores.';
  }).finally(() => { running = null; announceQueue(); });
  return running;
}
