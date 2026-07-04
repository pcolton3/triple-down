import { describe, expect, it } from 'vitest';
import {
  createSharedRoundFromLocalRound,
  loadSharedRoundByCode,
  replaceSharedHoleMatchups,
  sharedRoundBundleToRoundState,
  updateSharedCtpResult,
  updateSharedHole,
} from '@/lib/realtime/shared-rounds';
import { useRoundStore } from '@/stores/round-store';
import type { HoleState, Player, RoundState } from '@/types/round';

const totalGroups = Number(process.env.CONCURRENCY_TEST_GROUPS ?? 6);
const groupSize = 4;
const totalHoles = Number(process.env.CONCURRENCY_TEST_HOLES ?? 3);

function requireSupabaseEnv() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local.');
  }
}

function buildPlayers(): Player[] {
  return Array.from({ length: totalGroups * groupSize }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Concurrency Player ${index + 1}`,
    handicap: (index % 18) + 1,
    bankerParticipant: true,
    skinsParticipant: true,
    ctpParticipant: true,
    lowNetParticipant: true,
  }));
}

function createLocalRound(roundCode: string) {
  useRoundStore.getState().createRound({
    roundCode,
    title: `Concurrency Test ${roundCode}`,
    courseName: 'Concurrency Test Course',
    defaultBet: 10,
    players: buildPlayers(),
    firstBankerPlayerId: 'p1',
    groupSize,
    totalHoles,
    holesConfig: Array.from({ length: totalHoles }, (_, index) => ({
      holeNumber: index + 1,
      par: (index + 1) % 3 === 0 ? 5 : (index + 1) % 2 === 0 ? 3 : 4,
      handicapIndex: index + 1,
    })),
    gameSettings: {
      bankerEnabled: true,
      skinsEnabled: true,
      skinsPot: 240,
      ctpEnabled: true,
      ctpPot: 120,
      lowNetEnabled: true,
      lowNetPot: 100,
      birdiePotEnabled: true,
      birdiePot: 100,
      eaglePotEnabled: true,
      eaglePot: 100,
      holeInOneEnabled: true,
    },
  });

  return useRoundStore.getState().round;
}

function scoreFor(groupNumber: number, holeNumber: number, playerId: string, par: number) {
  const playerNumber = Number(playerId.replace('p', ''));
  return par + ((groupNumber + holeNumber + playerNumber) % 3);
}

function completedHole(hole: HoleState) {
  return {
    ...hole,
    bankerGrossScore: scoreFor(hole.groupNumber ?? 1, hole.holeNumber, hole.bankerPlayerId, hole.par),
    bankerPressed: (hole.holeNumber + (hole.groupNumber ?? 1)) % 2 === 0,
    isSaved: true,
    ctpWinnerPlayerId: hole.par === 3 ? hole.matchups[0]?.playerId ?? hole.bankerPlayerId : null,
    matchups: hole.matchups.map((matchup) => ({
      ...matchup,
      grossScore: scoreFor(hole.groupNumber ?? 1, hole.holeNumber, matchup.playerId, hole.par),
      pressed: (hole.holeNumber + Number(matchup.playerId.replace('p', ''))) % 2 === 0,
    })),
  };
}

async function saveHole(roundId: string, hole: HoleState) {
  await updateSharedHole({
    roundId,
    groupNumber: hole.groupNumber ?? 1,
    holeNumber: hole.holeNumber,
    bankerPlayerKey: hole.bankerPlayerId,
    bankerGrossScore: hole.bankerGrossScore,
    bankerPressed: hole.bankerPressed,
    isSaved: true,
  });

  await replaceSharedHoleMatchups({
    roundId,
    groupNumber: hole.groupNumber ?? 1,
    holeNumber: hole.holeNumber,
    matchups: hole.matchups,
  });

  if (hole.par === 3) {
    await updateSharedCtpResult({
      roundId,
      groupNumber: hole.groupNumber ?? 1,
      holeNumber: hole.holeNumber,
      winnerPlayerKey: hole.ctpWinnerPlayerId ?? null,
    });
  }
}

function assertSavedScores(expectedRound: RoundState, loadedRound: RoundState) {
  const expectedSavedHoles = expectedRound.holes.filter((hole) => hole.isSaved);
  const loadedSavedHoles = loadedRound.holes.filter((hole) => hole.isSaved);

  expect(loadedSavedHoles).toHaveLength(expectedSavedHoles.length);

  expectedSavedHoles.forEach((expectedHole) => {
    const loadedHole = loadedRound.holes.find(
      (hole) => (hole.groupNumber ?? 1) === (expectedHole.groupNumber ?? 1) && hole.holeNumber === expectedHole.holeNumber
    );
    expect(loadedHole, `missing group ${expectedHole.groupNumber} hole ${expectedHole.holeNumber}`).toBeTruthy();
    expect(loadedHole?.bankerPlayerId).toBe(expectedHole.bankerPlayerId);
    expect(loadedHole?.bankerGrossScore).toBe(expectedHole.bankerGrossScore);
    expect(loadedHole?.isSaved).toBe(true);

    expectedHole.matchups.forEach((expectedMatchup) => {
      const loadedMatchup = loadedHole?.matchups.find((matchup) => matchup.playerId === expectedMatchup.playerId);
      expect(
        loadedMatchup,
        `missing matchup group ${expectedHole.groupNumber} hole ${expectedHole.holeNumber} player ${expectedMatchup.playerId}`
      ).toBeTruthy();
      expect(loadedMatchup?.grossScore).toBe(expectedMatchup.grossScore);
      expect(loadedMatchup?.pressed).toBe(expectedMatchup.pressed);
    });
  });
}

describe('Supabase multi-group scoring concurrency', () => {
  it('preserves all group scores when groups save holes at the same time', async () => {
    requireSupabaseEnv();

    const roundCode = `TT${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const initialRound = createLocalRound(roundCode);
    const savedRound = await createSharedRoundFromLocalRound(initialRound);

    const expectedHoles = initialRound.holes.map(completedHole);
    const jitteredSaves = expectedHoles.map(
      (hole) =>
        new Promise<void>((resolve, reject) => {
          const delay = ((hole.groupNumber ?? 1) * 13 + hole.holeNumber * 7) % 40;
          setTimeout(() => {
            saveHole(savedRound.id, hole).then(resolve).catch(reject);
          }, delay);
        })
    );

    await Promise.all(jitteredSaves);

    const bundle = await loadSharedRoundByCode(roundCode);
    expect(bundle).toBeTruthy();

    const loadedRound = sharedRoundBundleToRoundState(bundle!);
    const expectedRound = {
      ...initialRound,
      holes: expectedHoles,
    };

    assertSavedScores(expectedRound, loadedRound);

    const groupNumbers = new Set(loadedRound.holes.map((hole) => hole.groupNumber ?? 1));
    expect(groupNumbers.size).toBe(totalGroups);
  });
});
