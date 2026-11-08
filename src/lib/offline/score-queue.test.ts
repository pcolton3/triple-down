import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HoleState, RoundState } from '@/types/round';
import { acknowledge, overlayPending, pendingKey, putPending, readPending, type PendingHole } from './score-queue';
import { paymentKey } from './payments';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
const hole: HoleState = { groupNumber: 1, holeNumber: 1, par: 4, handicapIndex: 1, bankerPlayerId: 'p1', bankerGrossScore: 4, bankerPressed: false, matchups: [], isSaved: true };
function entry(overrides: Partial<PendingHole> = {}): PendingHole {
  return { revision: 'one', roundId: 'round-id', roundCode: 'TEST', groupNumber: 1, hole: structuredClone(hole), deviceId: 'device', ...overrides };
}
const mocks = vi.hoisted(() => ({ updateHole: vi.fn(), matchups: vi.fn(), ctp: vi.fn(), progress: vi.fn(), single: vi.fn() }));
vi.mock('@/lib/realtime/shared-rounds', () => ({ updateSharedHole: mocks.updateHole, replaceSharedHoleMatchups: mocks.matchups, updateSharedCtpResult: mocks.ctp }));
vi.mock('@/lib/realtime/group-rounds', () => ({ updateGroupCurrentHole: mocks.progress }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: mocks.single }) }) }) }) } }));
import { flushScores, sendPending } from './round-sync';

describe('durable score queue', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal('navigator', { onLine: true });
    vi.clearAllMocks();
    mocks.single.mockResolvedValue({ data: { scorekeeper_device_id: 'device', current_hole: 1 }, error: null });
    mocks.updateHole.mockResolvedValue(undefined);
    mocks.matchups.mockResolvedValue(undefined);
    mocks.ctp.mockResolvedValue(undefined);
    mocks.progress.mockResolvedValue(undefined);
  });
  it('recovers multiple groups and rounds from storage without overwriting them', () => {
    putPending(storage, entry());
    putPending(storage, entry({ groupNumber: 2 }));
    putPending(storage, entry({ roundId: 'other-round' }));
    expect(readPending(storage)).toHaveLength(3);
    const reloaded = new MemoryStorage();
    readPending(storage).forEach((item) => reloaded.setItem(pendingKey(item), JSON.stringify(item)));
    expect(readPending(reloaded)).toEqual(readPending(storage));
  });
  it('keeps a newer edit when an older save is acknowledged', () => {
    const older = entry();
    putPending(storage, older);
    putPending(storage, entry({ revision: 'two', hole: { ...hole, bankerGrossScore: 5 } }));
    acknowledge(storage, older);
    expect(readPending(storage)[0].hole.bankerGrossScore).toBe(5);
    acknowledge(storage, readPending(storage)[0]);
    expect(readPending(storage)).toEqual([]);
  });
  it('retains next-hole progress when later edits coalesce', () => {
    putPending(storage, entry({ currentHole: 2 }));
    putPending(storage, entry({ revision: 'two' }));
    expect(readPending(storage)[0].currentHole).toBe(2);
  });
  it('overlays pending scores only on their matching round and group', () => {
    const round = { id: 'round-id', holes: [hole, { ...hole, groupNumber: 2 }], multiFoursome: { enabled: true, groupSize: 4, groups: [{ groupNumber: 1, currentHole: 1 }, { groupNumber: 2, currentHole: 3 }], groupPlayers: [] } } as unknown as RoundState;
    const merged = overlayPending(round, [entry({ currentHole: 2, hole: { ...hole, bankerGrossScore: 6 } }), entry({ roundId: 'elsewhere', groupNumber: 2 })]);
    expect(merged.holes.map((item) => item.bankerGrossScore)).toEqual([6, 4]);
    expect(merged.multiFoursome?.groups.map((item) => item.currentHole)).toEqual([2, 3]);
  });
  it('leaves scores queued offline and retries failed saves on reconnect', async () => {
    putPending(storage, entry());
    vi.stubGlobal('navigator', { onLine: false });
    await flushScores();
    expect(mocks.updateHole).not.toHaveBeenCalled();
    expect(readPending(storage)).toHaveLength(1);
    vi.stubGlobal('navigator', { onLine: true });
    mocks.matchups.mockRejectedValueOnce(new Error('Connection lost'));
    await flushScores();
    expect(readPending(storage)).toHaveLength(1);
    expect(mocks.updateHole).toHaveBeenCalledTimes(1);
    expect(mocks.updateHole.mock.calls[0][0].isSaved).toBe(false);
    await flushScores();
    expect(readPending(storage)).toHaveLength(0);
    expect(mocks.updateHole.mock.lastCall?.[0].isSaved).toBe(true);
  });
  it('drains an edit entered while the previous request was in flight', async () => {
    putPending(storage, entry());
    mocks.matchups.mockImplementationOnce(async () => {
      putPending(storage, entry({ revision: 'new', hole: { ...hole, bankerGrossScore: 7 } }));
    });
    await flushScores();
    expect(readPending(storage)).toHaveLength(0);
    expect(mocks.updateHole.mock.calls.filter(([value]) => value.bankerGrossScore === 7)).toHaveLength(1);
  });
  it('does not write scores when scorekeeper ownership has changed', async () => {
    mocks.single.mockResolvedValue({ data: { scorekeeper_device_id: 'another-device', current_hole: 1 }, error: null });
    await expect(sendPending(entry())).rejects.toThrow('scorekeeper changed');
    expect(mocks.updateHole).not.toHaveBeenCalled();
  });
  it('does not move group progress backward while syncing a correction', async () => {
    mocks.single.mockResolvedValue({ data: { scorekeeper_device_id: 'device', current_hole: 12 }, error: null });
    await sendPending(entry({ currentHole: 2 }));
    expect(mocks.progress).not.toHaveBeenCalled();
  });
  it('keeps payment checkmarks specific to the round, transfer, and amount', () => {
    const line = { id: 'banker:1:p1:p2', label: 'Paul pays Joe', amount: 20 };
    expect(paymentKey('one', line)).not.toBe(paymentKey('two', line));
    expect(paymentKey('one', line)).not.toBe(paymentKey('one', { ...line, amount: 21 }));
  });
});
