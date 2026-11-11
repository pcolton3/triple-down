// Live load test against the real Supabase project; deletes its round at the end.
// Skipped unless asked for: RUN_LIVE_TESTS=1 npx vitest run tests/load.live.test.ts
import { gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createSharedRoundFromLocalRound,
  loadSharedRoundByCode,
  replaceSharedHoleMatchups,
  sharedRoundBundleToRoundState,
  updateSharedCtpResult,
  updateSharedHole,
  updateSharedHoleGameData,
} from '@/lib/realtime/shared-rounds';
import { supabase } from '@/lib/supabase/client';
import { refreshSharedRoundBundle } from '@/lib/realtime/round-refresh';
import type { SharedRoundBundle } from '@/lib/realtime/shared-rounds';
import { useRoundStore } from '@/stores/round-store';
import type { HoleState, Player } from '@/types/round';

const GROUPS = Number(process.env.LOAD_GROUPS ?? 12);
const HOLES = 18;
const VIEWERS = Number(process.env.LOAD_VIEWERS ?? 40);
const roundCode = `LT${Date.now().toString(36).slice(-6).toUpperCase()}`;
let created = false;

const pct = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
};

function players(): Player[] {
  return Array.from({ length: GROUPS * 4 }, (_, index) => ({
    id: `p${index + 1}`, name: `Load Player ${index + 1}`, handicap: (index * 7) % 25,
    bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true,
  }));
}

function scored(hole: HoleState): HoleState {
  const score = (key: string) => hole.par + ((Number(key.replace('p', '')) + hole.holeNumber) % 4) - 1;
  return {
    ...hole,
    bankerGrossScore: score(hole.bankerPlayerId),
    bankerPressed: hole.holeNumber % 5 === 0,
    isSaved: true,
    ctpWinnerPlayerId: hole.par === 3 ? hole.bankerPlayerId : null,
    matchups: hole.matchups.map((m) => ({ ...m, grossScore: score(m.playerId), pressed: hole.holeNumber % 4 === 0 })),
  };
}

/** Same request sequence as sendPending() in src/lib/offline/round-sync.ts. */
async function saveLikeAPhone(roundId: string, hole: HoleState) {
  const common = { roundId, groupNumber: hole.groupNumber ?? 1, holeNumber: hole.holeNumber };
  const { error } = await supabase.from('round_groups').select('scorekeeper_device_id,current_hole').eq('round_id', roundId).eq('group_number', common.groupNumber).single();
  if (error) throw error;
  await updateSharedHole({ ...common, bankerPlayerKey: hole.bankerPlayerId, bankerGrossScore: hole.bankerGrossScore, bankerPressed: hole.bankerPressed, isSaved: false });
  await replaceSharedHoleMatchups({ ...common, matchups: hole.matchups });
  if (hole.par === 3) await updateSharedCtpResult({ ...common, winnerPlayerKey: hole.ctpWinnerPlayerId ?? null });
  await updateSharedHoleGameData({ ...common, gameData: { wolf: { partner: null } } as never });
  await updateSharedHole({ ...common, isSaved: true });
  const { error: groupError } = await supabase.from('round_groups').update({ current_hole: Math.min(HOLES, hole.holeNumber + 1) }).eq('round_id', roundId).eq('group_number', common.groupNumber);
  if (groupError) throw groupError;
}

describe.skipIf(!process.env.RUN_LIVE_TESTS)('live load', () => {
  afterAll(async () => {
    if (!created) return;
    const { error } = await supabase.rpc('delete_round', { p_round_code: roundCode, p_device_id: null });
    console.log(error ? `CLEANUP FAILED for ${roundCode}: ${error.message}` : `cleanup: deleted ${roundCode}`);
  });

  it(`${GROUPS} groups score 18 holes at once while ${VIEWERS} phones watch the leaderboard`, async () => {
    useRoundStore.getState().createRound({
      roundCode, title: `Load Test ${roundCode}`, courseName: 'Load Test Course', defaultBet: 10,
      players: players(), firstBankerPlayerId: 'p1', groupSize: 4, totalHoles: HOLES,
      holesConfig: Array.from({ length: HOLES }, (_, i) => ({ holeNumber: i + 1, par: ([4, 4, 3, 5, 4, 4, 3, 4, 5] as const)[i % 9], handicapIndex: ((i * 7) % 18) + 1 })),
      gameSettings: { bankerEnabled: true, skinsEnabled: true, skinsPot: 600, ctpEnabled: true, ctpPot: 300, lowNetEnabled: true, lowNetPot: 300 },
    });
    const local = useRoundStore.getState().round;
    const t0 = Date.now();
    const shared = await createSharedRoundFromLocalRound(local);
    created = true;
    console.log(`create round with ${GROUPS * 4} players: ${Date.now() - t0} ms`);

    const holesByGroup = new Map<number, HoleState[]>();
    for (const hole of local.holes.map(scored)) holesByGroup.set(hole.groupNumber ?? 1, [...(holesByGroup.get(hole.groupNumber ?? 1) ?? []), hole]);

    const saveTimes: number[] = [];
    const saveErrors: string[] = [];
    const pollTimes: number[] = [];
    const pollErrors: string[] = [];
    let scoring = true;

    // Each group's scorekeeper saves its holes one after another, all groups at the same time.
    const scorers = [...holesByGroup.entries()].map(async ([, holes]) => {
      for (const hole of holes.sort((a, b) => a.holeNumber - b.holeNumber)) {
        const start = Date.now();
        try { await saveLikeAPhone(shared.id, hole); saveTimes.push(Date.now() - start); } catch (error) { saveErrors.push(String((error as Error).message ?? error)); }
      }
    });
    // Leaderboard phones reload the whole round back-to-back (worse than the app's 5 s timer).
    // Viewers refresh the way the leaderboard now does: one full load, then only changed rows.
    const viewerViews: Array<SharedRoundBundle | null> = Array.from({ length: VIEWERS }, () => null);
    let incrementalBytes = 0;
    const viewers = Array.from({ length: VIEWERS }, async (_, v) => {
      let view = await loadSharedRoundByCode(roundCode);
      while (scoring) {
        const start = Date.now();
        try {
          const before = JSON.stringify(view).length;
          const refreshed = await refreshSharedRoundBundle(view!);
          if (refreshed.changed) { incrementalBytes += Math.abs(JSON.stringify(refreshed.bundle).length - before); view = refreshed.bundle; }
          pollTimes.push(Date.now() - start);
        } catch (error) { pollErrors.push(String((error as Error).message ?? error)); }
        await new Promise((r) => setTimeout(r, 500));
      }
      // One more pass after scoring stops, as the next 5-second tick would.
      await new Promise((r) => setTimeout(r, 1500));
      view = (await refreshSharedRoundBundle(view!)).bundle;
      viewerViews[v] = view;
    });
    const scoreStart = Date.now();
    await Promise.all(scorers);
    scoring = false;
    await Promise.all(viewers);
    const wall = Date.now() - scoreStart;

    const bundle = await loadSharedRoundByCode(roundCode);
    const json = JSON.stringify(bundle);
    const loaded = sharedRoundBundleToRoundState(bundle!);
    const saved = loaded.holes.filter((h) => h.isSaved).length;
    const expected = local.holes.map(scored);
    const mismatches = expected.filter((e) => {
      const got = loaded.holes.find((h) => (h.groupNumber ?? 1) === (e.groupNumber ?? 1) && h.holeNumber === e.holeNumber);
      return !got || got.bankerGrossScore !== e.bankerGrossScore || e.matchups.some((m) => got.matchups.find((x) => x.playerId === m.playerId)?.grossScore !== m.grossScore);
    });

    // Compare what a viewer would see, independent of row order.
    const norm = (b: SharedRoundBundle) => JSON.stringify(
      sharedRoundBundleToRoundState(b).holes
        .map((h) => ({ g: h.groupNumber ?? 1, n: h.holeNumber, banker: h.bankerPlayerId, bg: h.bankerGrossScore, bp: h.bankerPressed, saved: h.isSaved, ctp: h.ctpWinnerPlayerId ?? null, m: [...h.matchups].sort((a, c) => a.playerId.localeCompare(c.playerId)).map((m) => [m.playerId, m.grossScore, m.pressed]) }))
        .sort((a, c) => a.g - c.g || a.n - c.n)
    );
    const truth = norm(bundle!);
    const staleViewers = viewerViews.filter((view) => !view || norm(view) !== truth).length;
    console.log(JSON.stringify({ staleViewers, incrementalMBTotal: Math.round(incrementalBytes / 1e5) / 10 }));
    console.log(JSON.stringify({
      groups: GROUPS, viewers: VIEWERS, holeSaves: saveTimes.length, saveErrors: saveErrors.length, firstSaveErrors: saveErrors.slice(0, 3),
      saveMs: { p50: pct(saveTimes, 50), p95: pct(saveTimes, 95), max: Math.max(...saveTimes) },
      fullRoundReloads: pollTimes.length, reloadErrors: pollErrors.length, firstReloadErrors: pollErrors.slice(0, 3),
      reloadMs: { p50: pct(pollTimes, 50), p95: pct(pollTimes, 95), max: Math.max(...pollTimes) },
      wallSeconds: Math.round(wall / 1000), savedHoles: `${saved}/${expected.length}`, wrongScores: mismatches.length,
      roundPayloadKB: { raw: Math.round(json.length / 1024), gzip: Math.round(gzipSync(json).length / 1024) },
      updatedAtMoves: bundle!.holes.some((h) => (h as { updated_at?: string; created_at?: string }).updated_at !== (h as { created_at?: string }).created_at),
    }, null, 1));

    expect(saveErrors).toEqual([]);
    expect(mismatches).toHaveLength(0);
    expect(saved).toBe(expected.length);
    expect(staleViewers).toBe(0);
  }, 600_000);
});
