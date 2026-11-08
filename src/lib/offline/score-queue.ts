import type { HoleState, RoundState } from '@/types/round';

export type PendingHole = {
  revision: string;
  roundId: string;
  roundCode: string;
  groupNumber: number;
  hole: HoleState;
  currentHole?: number;
  deviceId: string;
};
const PREFIX = 'triple-track-pending:';
export const QUEUE_EVENT = 'triple-track-queue';
export function pendingKey(entry: Pick<PendingHole, 'roundId' | 'groupNumber' | 'hole'>) {
  return `${PREFIX}${entry.roundId}:${entry.groupNumber}:${entry.hole.holeNumber}`;
}
export function readPending(storage: Storage): PendingHole[] {
  const entries: PendingHole[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) {
      const value = storage.getItem(key);
      if (value) entries.push(JSON.parse(value) as PendingHole);
    }
  }
  return entries.sort((a, b) => a.hole.holeNumber - b.hole.holeNumber);
}
export function putPending(storage: Storage, entry: PendingHole) {
  const key = pendingKey(entry);
  const previous = storage.getItem(key);
  const currentHole = previous ? (JSON.parse(previous) as PendingHole).currentHole : undefined;
  storage.setItem(key, JSON.stringify({ ...entry, currentHole: entry.currentHole ?? currentHole }));
}
// Never acknowledge a newer edit when an older request completes.
export function acknowledge(storage: Storage, sent: PendingHole) {
  const key = pendingKey(sent);
  const value = storage.getItem(key);
  if (value && (JSON.parse(value) as PendingHole).revision === sent.revision) storage.removeItem(key);
}
export function overlayPending(round: RoundState, entries: PendingHole[]): RoundState {
  const pending = entries.filter((entry) => entry.roundId === round.id);
  return {
    ...round,
    holes: round.holes.map((hole) => pending.find((entry) => entry.groupNumber === (hole.groupNumber ?? 1) && entry.hole.holeNumber === hole.holeNumber)?.hole ?? hole),
    multiFoursome: round.multiFoursome ? {
      ...round.multiFoursome,
      groups: round.multiFoursome.groups.map((group) => ({ ...group, currentHole: Math.max(group.currentHole ?? 1, ...pending.filter((entry) => entry.groupNumber === group.groupNumber).map((entry) => entry.currentHole ?? 1)) })),
    } : undefined,
  };
}

/** Unsent holes for one group on this device. */
export function pendingForGroup(storage: Storage, roundId: string, groupNumber: number) {
  return readPending(storage).filter((entry) => entry.roundId === roundId && entry.groupNumber === groupNumber);
}

/** Drops this device's unsent holes for a group (after scoring moved to another phone). */
export function discardPendingForGroup(storage: Storage, roundId: string, groupNumber: number) {
  pendingForGroup(storage, roundId, groupNumber).forEach((entry) => storage.removeItem(pendingKey(entry)));
}
