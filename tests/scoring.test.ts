import { beforeEach, describe, expect, it } from 'vitest';
import { settleBankerHole } from '@/domain/banker/settle-banker-hole';
import { useRoundStore } from '@/stores/round-store';
import type { CreateRoundInput, Player } from '@/types/round';

const players: Player[] = [
  { id: 'p1', name: 'Paul', handicap: 8, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p2', name: 'Mckay', handicap: 10, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p3', name: 'Joe', handicap: 12, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p4', name: 'Tim', handicap: 15, bankerParticipant: false, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p5', name: 'Duane', handicap: 18, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p6', name: 'Lane', handicap: 6, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p7', name: 'Dave', handicap: 13, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p8', name: 'Brian', handicap: 9, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
];

function createTestRound(overrides: Partial<CreateRoundInput> = {}) {
  useRoundStore.getState().createRound({
    roundCode: 'TEST01',
    title: 'Test Round',
    courseName: 'Test Course',
    defaultBet: 10,
    players,
    firstBankerPlayerId: 'p1',
    groupSize: 4,
    totalHoles: 3,
    holesConfig: [
      { holeNumber: 1, par: 4, handicapIndex: 1 },
      { holeNumber: 2, par: 3, handicapIndex: 17 },
      { holeNumber: 3, par: 5, handicapIndex: 9 },
    ],
    gameSettings: {
      bankerEnabled: true,
      skinsEnabled: true,
      skinsPot: 120,
      ctpEnabled: true,
      ctpPot: 80,
      lowNetEnabled: true,
      lowNetPot: 100,
      birdiePotEnabled: true,
      birdiePot: 40,
      eaglePotEnabled: true,
      eaglePot: 60,
      holeInOneEnabled: true,
    },
    ...overrides,
  });
}

function enterGroupHoleScores(groupNumber: number, holeNumber: number, scoresByPlayer: Record<string, number>) {
  const store = useRoundStore.getState();
  const round = store.round;
  const hole = round.holes.find((item) => (item.groupNumber ?? 1) === groupNumber && item.holeNumber === holeNumber);
  if (!hole) throw new Error(`Missing group ${groupNumber} hole ${holeNumber}`);

  store.setBankerGrossScore(scoresByPlayer[hole.bankerPlayerId], groupNumber, holeNumber);
  hole.matchups.forEach((matchup) => {
    store.setPlayerGrossScore(matchup.playerId, scoresByPlayer[matchup.playerId], groupNumber, holeNumber);
  });
  const result = store.updateHole(groupNumber, holeNumber);
  if (!result.ok) throw new Error(result.message);
}

describe('Banker scoring', () => {
  it('settles banker with presses and birdie multiplier', () => {
    const [result] = settleBankerHole({
      par: 4,
      bankerPlayerId: 'p1',
      bankerGrossScore: 3,
      bankerNetScore: 3,
      matchups: [
        {
          playerId: 'p2',
          baseWager: 10,
          pressCount: 1,
          playerGrossScore: 5,
          playerNetScore: 5,
        },
      ],
    });

    expect(result).toMatchObject({
      playerId: 'p2',
      result: 'banker_wins',
      pressMultiplier: 2,
      birdieMultiplier: 2,
      finalAmount: 40,
    });
  });

  it('keeps banker payouts inside the group and excludes banker opt-outs', () => {
    createTestRound();

    enterGroupHoleScores(1, 1, { p1: 4, p2: 5, p3: 5, p4: 3 });
    enterGroupHoleScores(2, 1, { p5: 4, p6: 5, p7: 5, p8: 5 });

    const groupOneTotals = useRoundStore.getState().getGroupBankerTotals(1);
    const groupTwoTotals = useRoundStore.getState().getGroupBankerTotals(2);
    const settlements = useRoundStore.getState().getSettleUp();

    expect(groupOneTotals.map((item) => item.playerId).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(groupTwoTotals.map((item) => item.playerId).sort()).toEqual(['p5', 'p6', 'p7', 'p8']);
    expect(settlements.every((item) => item.groupNumber === 1 || item.groupNumber === 2)).toBe(true);
    expect(settlements.some((item) => item.fromPlayerId === 'p4' || item.toPlayerId === 'p4')).toBe(false);
    expect(settlements.some((item) => ['p1', 'p2', 'p3', 'p4'].includes(item.fromPlayerId) && ['p5', 'p6', 'p7', 'p8'].includes(item.toPlayerId))).toBe(false);
  });
});

describe('Event-wide side games', () => {
  beforeEach(() => {
    createTestRound();
  });

  it('calculates skins across all groups for the same hole number', () => {
    enterGroupHoleScores(1, 1, { p1: 4, p2: 4, p3: 5, p4: 5 });
    enterGroupHoleScores(2, 1, { p5: 4, p6: 5, p7: 5, p8: 5 });

    const skins = useRoundStore.getState().getSkinsSummary();
    const holeOne = skins.holes.find((hole) => hole.holeNumber === 1);

    expect(holeOne).toMatchObject({
      holeNumber: 1,
      winnerPlayerId: 'p5',
      isTie: false,
    });
    expect(skins.payouts.find((payout) => payout.playerId === 'p5')).toMatchObject({
      skins: 1,
      amount: 120,
    });
  });

  it('uses the latest group CTP winner for each par 3 and pays only winners', () => {
    useRoundStore.getState().setCtpWinner(2, 'p2', 1);
    useRoundStore.getState().setCtpWinner(2, 'p6', 2);

    const ctp = useRoundStore.getState().getCtpSummary();

    expect(ctp.par3Holes).toContainEqual({
      holeNumber: 2,
      winnerPlayerId: 'p6',
      winnerName: 'Lane',
    });
    expect(ctp.payouts.find((payout) => payout.playerId === 'p6')).toMatchObject({
      wins: 1,
      amount: 80,
    });
    expect(ctp.payouts.find((payout) => payout.playerId === 'p2')).toMatchObject({
      wins: 0,
      amount: 0,
    });
  });

  it('tracks gross birdies, eagles, and hole-in-one pots from saved scores', () => {
    enterGroupHoleScores(1, 2, { p1: 1, p2: 2, p3: 3, p4: 3 });

    const grossTotals = useRoundStore.getState().getGrossTotals();
    const birdiePot = useRoundStore.getState().getBirdiePotSummary();
    const eaglePot = useRoundStore.getState().getEaglePotSummary();
    const holeInOne = useRoundStore.getState().getHoleInOneSummary();

    expect(grossTotals.find((item) => item.playerId === 'p2')).toMatchObject({ naturalBirdies: 1, naturalEagles: 0 });
    expect(grossTotals.find((item) => item.playerId === 'p1')).toMatchObject({ naturalBirdies: 0, naturalEagles: 1 });
    expect(birdiePot.payouts.find((item) => item.playerId === 'p2')).toMatchObject({ birdies: 1, holes: [2], amount: 40 });
    expect(eaglePot.payouts.find((item) => item.playerId === 'p1')).toMatchObject({ eagles: 1, holes: [2], amount: 60 });
    expect(holeInOne.payouts.find((item) => item.playerId === 'p1')).toMatchObject({
      aces: 1,
      holes: [2],
      payerCount: 7,
      amount: 700,
    });
  });
});
