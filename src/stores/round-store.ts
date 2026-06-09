'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settleBankerHole } from '@/domain/banker/settle-banker-hole';
import { isGrossBirdieOrBetter } from '@/domain/banker/birdie';
import { buildLedgerEntries, type LedgerEntry } from '@/domain/banker/ledger';
import type { BankerMatchupResult } from '@/domain/banker/types';
import type { CreateRoundInput, HoleConfig, HoleState, Player, RoundState } from '@/types/round';
import { buildGroupsForPlayers } from '@/lib/groups/group-utils';

type MatchupSummary = {
  playerId: string;
  playerName: string;
  bankerParticipant: boolean;
  playerGrossScore: number | null;
  bankerGrossScore: number | null;
  playerNetScore: number | null;
  bankerNetScore: number | null;
  playerGetsStroke: boolean;
  bankerGetsStroke: boolean;
  baseWager: number;
  playerPressed: boolean;
  bankerPressed: boolean;
  amount: number;
  reason: string;
  modifiers: string[];
  totalMultiplier: number;
  resultLabel: string;
  payoutText: string;
};

type HoleHistoryItem = {
  groupNumber: number;
  holeNumber: number;
  par: 3 | 4 | 5;
  handicapIndex: number;
  bankerName: string;
  bankerGrossScore: number | null;
  bankerHandicap: number;
  bankerPressed: boolean;
  pressLabel: string;
  matchups: MatchupSummary[];
  runningTotals: Array<{
    playerId: string;
    playerName: string;
    amount: number;
  }>;
};

type CurrentHoleSummary = {
  bankerName: string;
  bankerGrossScore: number | null;
  bankerHandicap: number;
  bankerPressed: boolean;
  pressLabel: string;
  bankerGetsStrokeFromNames: string[];
  matchups: MatchupSummary[];
};

type SettleUpItem = {
  groupNumber: number;
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  amount: number;
};

type GrossTotalItem = {
  playerId: string;
  playerName: string;
  grossTotal: number;
  netTotal: number;
  holesCounted: number;
  naturalBirdies: number;
  naturalEagles: number;
};

type SkinsHoleResult = {
  holeNumber: number;
  winnerPlayerId: string | null;
  winnerName: string | null;
  winningNetScore: number | null;
  isTie: boolean;
};

type SkinsSummary = {
  pot: number;
  skinsWon: number;
  valuePerSkin: number;
  holes: SkinsHoleResult[];
  payouts: Array<{ playerId: string; playerName: string; skins: number; amount: number }>;
};

type LowNetSummary = {
  pot: number;
  totals: GrossTotalItem[];
  payouts: Array<{ playerId: string; playerName: string; placement: string; amount: number }>;
};

type CtpSummary = {
  pot: number;
  par3Holes: Array<{ holeNumber: number; winnerPlayerId: string | null; winnerName: string | null }>;
  payouts: Array<{ playerId: string; playerName: string; wins: number; amount: number }>;
};

type NassauSegment = {
  label: string;
  holes: number[];
  winners: Array<{ playerId: string; playerName: string; netTotal: number; amount: number }>;
};

type NassauSummary = {
  pot: number;
  segments: NassauSegment[];
  payouts: Array<{ playerId: string; playerName: string; amount: number; wins: string[] }>;
};

type StablefordSummary = {
  pot: number;
  standings: Array<{ playerId: string; playerName: string; points: number; amount: number }>;
  payouts: Array<{ playerId: string; playerName: string; points: number; amount: number }>;
};

type BirdiePotSummary = {
  pot: number;
  valuePerBirdie: number;
  payouts: Array<{ playerId: string; playerName: string; birdies: number; amount: number; holes: number[] }>;
};

type EaglePotSummary = {
  pot: number;
  valuePerEagle: number;
  payouts: Array<{ playerId: string; playerName: string; eagles: number; amount: number; holes: number[] }>;
};

type HoleInOneSummary = {
  aceValue: number;
  payouts: Array<{ playerId: string; playerName: string; amount: number; holes: number[]; aces: number; payerCount: number }>;
};

type RoundStore = {
  round: RoundState;
  ledger: LedgerEntry[];
  createRound: (input: CreateRoundInput) => void;
  hydrateRound: (round: RoundState) => void;
  simulateFullEvent: () => void;
  resetRound: () => void;
  setPlayerHandicap: (playerId: string, handicap: number) => void;
  setBanker: (playerId: string, groupNumber?: number, holeNumber?: number) => void;
  setPar: (par: 3 | 4 | 5, groupNumber?: number, holeNumber?: number) => void;
  setHoleHandicap: (handicapIndex: number, groupNumber?: number, holeNumber?: number) => void;
  setWager: (playerId: string, amount: number, groupNumber?: number, holeNumber?: number) => void;
  togglePlayerPress: (playerId: string, groupNumber?: number, holeNumber?: number) => void;
  toggleBankerPress: (groupNumber?: number, holeNumber?: number) => void;
  setPlayerGrossScore: (playerId: string, score: number | null, groupNumber?: number, holeNumber?: number) => void;
  setBankerGrossScore: (score: number | null, groupNumber?: number, holeNumber?: number) => void;
  updateHole: (groupNumber?: number, holeNumber?: number) => { ok: boolean; message?: string };
  nextHole: (groupNumber?: number) => { ok: boolean; message?: string };
  getRunningTotals: () => Array<{ playerId: string; name: string; amount: number }>;
  getGroupBankerTotals: (groupNumber?: number) => Array<{ playerId: string; name: string; amount: number }>;
  getGroupBankerPreviewTotals: (groupNumber?: number, holeNumber?: number) => Array<{ playerId: string; name: string; amount: number }>;
  getHoleHistory: () => HoleHistoryItem[];
  getCurrentHoleSummary: (groupNumber?: number, holeNumber?: number) => CurrentHoleSummary;
  getSettleUp: () => SettleUpItem[];
  setCtpWinner: (holeNumber: number, playerId: string | null, groupNumber?: number) => void;
  getGrossTotals: () => GrossTotalItem[];
  getSkinsSummary: () => SkinsSummary;
  getLowNetSummary: () => LowNetSummary;
  getCtpSummary: () => CtpSummary;
  getNassauSummary: () => NassauSummary;
  getStablefordSummary: () => StablefordSummary;
  getBirdiePotSummary: () => BirdiePotSummary;
  getEaglePotSummary: () => EaglePotSummary;
  getHoleInOneSummary: () => HoleInOneSummary;
};

const defaultPlayers = [
  { id: 'p1', name: 'Player 1', handicap: 8, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p2', name: 'Player 2', handicap: 10, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p3', name: 'Player 3', handicap: 12, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
  { id: 'p4', name: 'Player 4', handicap: 9, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true },
];

function createHole(
  groupNumber: number,
  holeNumber: number,
  par: 3 | 4 | 5,
  handicapIndex: number,
  bankerPlayerId: string,
  playerIds: string[],
  defaultBet: number,
  players: Player[] = []
): HoleState {
  return {
    groupNumber,
    holeNumber,
    par,
    handicapIndex,
    bankerPlayerId,
    bankerGrossScore: null,
    bankerPressed: false,
    isSaved: false,
    ctpWinnerPlayerId: null,
    matchups: playerIds
      .filter((id) => id !== bankerPlayerId)
      .map((playerId) => ({
        playerId,
        baseWager: defaultBet,
        pressed: false,
        grossScore: null,
        bankerParticipant: players.find((player) => player.id === playerId)?.bankerParticipant !== false,
      })),
  };
}

function createDefaultHoles(
  totalHoles: number,
  bankerPlayerId: string,
  playerIds: string[],
  defaultBet: number,
  holesConfig?: HoleConfig[],
  groupNumber = 1,
  players: Player[] = []
) {
  const fallback = holesConfig && holesConfig.length === totalHoles
    ? holesConfig
    : Array.from({ length: totalHoles }, (_, index) => ({
        holeNumber: index + 1,
        par: 4 as const,
        handicapIndex: index + 1,
      }));

  return fallback.map((hole) =>
    createHole(groupNumber, hole.holeNumber, hole.par, hole.handicapIndex, bankerPlayerId, playerIds, defaultBet, players)
  );
}

function createDefaultRound(): RoundState {
  const roundCode = 'BANK01';
  const defaultBet = 5;
  const totalHoles = 18;
  const firstBankerPlayerId = defaultPlayers[0].id;
  const multiFoursome = buildGroupsForPlayers(defaultPlayers);
  return {
    id: 'demo-round',
    roundCode,
    title: 'Saturday Group',
    courseName: 'Papago Golf Club',
    selectedCourseId: 'papago-golf-club',
    currentHole: 1,
    totalHoles,
    defaultBet,
    gameSettings: {
      bankerEnabled: true,
      skinsEnabled: false,
      lowNetEnabled: false,
      ctpEnabled: false,
      nassauEnabled: false,
      stablefordEnabled: false,
      birdiePotEnabled: false,
      eaglePotEnabled: false,
      holeInOneEnabled: false,
      skinsPot: 0,
      lowNetPot: 0,
      ctpPot: 0,
      nassauPot: 0,
      stablefordPot: 0,
      birdiePot: 0,
      eaglePot: 0,
      courseRating: null,
      slopeRating: null,
      pcc: 0,
    },
    players: defaultPlayers,
    multiFoursome: { enabled: false, ...multiFoursome },
    holes: createDefaultHoles(totalHoles, firstBankerPlayerId, defaultPlayers.map((p) => p.id), defaultBet, undefined, 1, defaultPlayers),
  };
}

function getGroupCurrentHole(round: RoundState, groupNumber = 1) {
  return round.multiFoursome?.groups.find((group) => group.groupNumber === groupNumber)?.currentHole ?? round.currentHole;
}

function activeHole(round: RoundState, groupNumber = 1) {
  const currentHole = getGroupCurrentHole(round, groupNumber);
  return (
    round.holes.find((hole) => (hole.groupNumber ?? 1) === groupNumber && hole.holeNumber === currentHole) ??
    round.holes.find((hole) => hole.holeNumber === currentHole) ??
    round.holes[0]
  );
}

function getGroupPlayerIds(round: RoundState, groupNumber: number) {
  const groupSize = round.multiFoursome?.groupSize ?? 4;
  const assigned = round.multiFoursome?.groupPlayers
    .filter((item) => item.groupNumber === groupNumber)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.playerId);

  if (assigned && assigned.length > 0) return assigned;
  if (round.multiFoursome?.groups.length && round.multiFoursome.groups.length > 1) {
    return round.players.slice((groupNumber - 1) * groupSize, groupNumber * groupSize).map((player) => player.id);
  }
  return round.players.map((player) => player.id);
}

function getBankerParticipantIds(players: Player[], playerIds: string[]) {
  return playerIds.filter((playerId) => players.find((player) => player.id === playerId)?.bankerParticipant !== false);
}

function playerParticipatesInSkins(player?: Player) {
  return player?.skinsParticipant !== false;
}

function playerParticipatesInCtp(player?: Player) {
  return player?.ctpParticipant !== false;
}

function playerParticipatesInLowNet(player?: Player) {
  return player?.lowNetParticipant !== false;
}

function bankerEnabled(round: RoundState) {
  return round.gameSettings?.bankerEnabled !== false;
}

function skinsEnabled(round: RoundState) {
  return round.gameSettings?.skinsEnabled === true;
}

function lowNetEnabled(round: RoundState) {
  return round.gameSettings?.lowNetEnabled === true;
}

function ctpEnabled(round: RoundState) {
  return round.gameSettings?.ctpEnabled === true;
}

function nassauEnabled(round: RoundState) {
  return round.gameSettings?.nassauEnabled === true;
}

function stablefordEnabled(round: RoundState) {
  return round.gameSettings?.stablefordEnabled === true;
}

function birdiePotEnabled(round: RoundState) {
  return round.gameSettings?.birdiePotEnabled === true;
}

function eaglePotEnabled(round: RoundState) {
  return round.gameSettings?.eaglePotEnabled === true;
}

function holeInOneEnabled(round: RoundState) {
  return round.gameSettings?.holeInOneEnabled === true;
}

function ensureMultiFoursomeRound(round: RoundState): RoundState {
  const multiFoursome = round.multiFoursome ?? { enabled: round.players.length > 4, ...buildGroupsForPlayers(round.players) };
  const groupSize = multiFoursome.groupSize ?? 4;
  const existingGroups = multiFoursome.groups.length > 0 ? multiFoursome.groups : buildGroupsForPlayers(round.players, groupSize).groups;
  const existingGroupPlayers =
    multiFoursome.groupPlayers.length > 0 ? multiFoursome.groupPlayers : buildGroupsForPlayers(round.players, groupSize).groupPlayers;
  const holes: HoleState[] = [];

  existingGroups.forEach((group) => {
    const groupHoles = round.holes.filter((hole) => (hole.groupNumber ?? 1) === group.groupNumber);
    if (groupHoles.length > 0) {
      holes.push(...groupHoles.map((hole) => ({ ...hole, groupNumber: group.groupNumber })));
      return;
    }

    const groupPlayerIds = existingGroupPlayers
      .filter((assignment) => assignment.groupNumber === group.groupNumber)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((assignment) => assignment.playerId);
    const templateHoles = round.holes.filter((hole) => (hole.groupNumber ?? 1) === 1);
    const bankerId = getBankerParticipantIds(round.players, groupPlayerIds)[0] ?? groupPlayerIds[0] ?? round.players[0]?.id ?? 'p1';

    holes.push(
      ...templateHoles.map((hole) =>
        createHole(group.groupNumber, hole.holeNumber, hole.par, hole.handicapIndex, bankerId, groupPlayerIds, round.defaultBet, round.players)
      )
    );
  });

  return {
    ...round,
    holes: holes.length > 0 ? holes : round.holes,
    multiFoursome: {
      enabled: round.players.length > 4,
      groupSize,
      groups: existingGroups,
      groupPlayers: existingGroupPlayers,
    },
  };
}

function getGroupHole(round: RoundState, groupNumber: number, holeNumber?: number) {
  return holeNumber == null
    ? activeHole(round, groupNumber)
    : round.holes.find((hole) => (hole.groupNumber ?? 1) === groupNumber && hole.holeNumber === holeNumber) ??
        activeHole(round, groupNumber);
}

function updateGroupHole(round: RoundState, groupNumber: number, updater: (hole: HoleState) => HoleState, holeNumber?: number) {
  const targetHole = getGroupHole(round, groupNumber, holeNumber);
  return {
    ...round,
    holes: round.holes.map((hole) =>
      (hole.groupNumber ?? 1) === groupNumber && hole.holeNumber === targetHole.holeNumber ? updater(hole) : hole
    ),
  };
}

function updateGroupCurrentHole(round: RoundState, groupNumber: number, currentHole: number) {
  return {
    ...round,
    currentHole: groupNumber === 1 ? currentHole : round.currentHole,
    multiFoursome: round.multiFoursome
      ? {
          ...round.multiFoursome,
          groups: round.multiFoursome.groups.map((group) =>
            group.groupNumber === groupNumber ? { ...group, currentHole } : group
          ),
        }
      : round.multiFoursome,
  };
}

function getMatchupNetScores(
  round: RoundState,
  hole: HoleState,
  bankerHandicap: number,
  playerHandicap: number,
  bankerGrossScore: number | null,
  playerGrossScore: number | null
) {
  if (hole.par === 3) {
    return {
      bankerNetScore: bankerGrossScore,
      playerNetScore: playerGrossScore,
      playerGetsStroke: false,
      bankerGetsStroke: false,
    };
  }

  const diff = Math.abs(playerHandicap - bankerHandicap);

  let playerGets = false;
  let bankerGets = false;

  if (diff >= hole.handicapIndex) {
    if (playerHandicap > bankerHandicap) {
      playerGets = true;
    } else if (bankerHandicap > playerHandicap) {
      bankerGets = true;
    }
  }

  return {
    bankerNetScore: bankerGrossScore == null ? null : bankerGrossScore - (bankerGets ? 1 : 0),
    playerNetScore: playerGrossScore == null ? null : playerGrossScore - (playerGets ? 1 : 0),
    playerGetsStroke: playerGets,
    bankerGetsStroke: bankerGets,
  };
}

function buildModifierLabels(
  hole: HoleState,
  playerPressed: boolean,
  playerGrossScore: number | null,
  bankerGrossScore: number | null
) {
  const modifiers: string[] = [];
  const pressWord = hole.par === 3 ? 'tripled' : 'doubled';
  if (playerPressed) modifiers.push(pressWord);
  if (hole.bankerPressed) modifiers.push(`banker ${pressWord}`);
  if (
    playerGrossScore != null &&
    bankerGrossScore != null &&
    (isGrossBirdieOrBetter(playerGrossScore, hole.par) || isGrossBirdieOrBetter(bankerGrossScore, hole.par))
  ) {
    modifiers.push('birdie auto double');
  }
  return modifiers;
}

function getHoleResults(round: RoundState, hole: HoleState): BankerMatchupResult[] {
  const banker = round.players.find((player) => player.id === hole.bankerPlayerId);
  if (!banker || hole.bankerGrossScore == null) return [];

  const matchupInputs = hole.matchups.filter((m) => m.bankerParticipant !== false).map((m) => {
    const player = round.players.find((p) => p.id === m.playerId);
    const netScores = getMatchupNetScores(
      round,
      hole,
      banker.handicap,
      player?.handicap ?? 0,
      hole.bankerGrossScore,
      m.grossScore,
    );

    return {
      playerId: m.playerId,
      baseWager: m.baseWager,
      pressCount: Number(m.pressed) + Number(hole.bankerPressed),
      playerGrossScore: m.grossScore,
      playerNetScore: netScores.playerNetScore,
      bankerGrossScore: hole.bankerGrossScore,
      bankerNetScore: netScores.bankerNetScore,
    };
  });

  if (matchupInputs.some((m) => m.playerNetScore == null || m.bankerNetScore == null)) return [];

  return matchupInputs.map((m) =>
    settleBankerHole({
      par: hole.par,
      bankerPlayerId: hole.bankerPlayerId,
      bankerGrossScore: m.bankerGrossScore as number,
      bankerNetScore: m.bankerNetScore as number,
      matchups: [
        {
          playerId: m.playerId,
          baseWager: m.baseWager,
          pressCount: m.pressCount,
          playerGrossScore: m.playerGrossScore as number,
          playerNetScore: m.playerNetScore as number,
        },
      ],
    })[0]
  );
}

function recalcLedger(round: RoundState): LedgerEntry[] {
  if (!bankerEnabled(round)) return [];
  return round.holes.flatMap((hole) => {
    if (!hole.isSaved) return [];
    return buildLedgerEntries(hole.bankerPlayerId, getHoleResults(round, hole));
  });
}

function buildNextHole(round: RoundState, groupNumber: number, nextHoleNumber: number): RoundState {
  if (nextHoleNumber > round.totalHoles) return round;
  return updateGroupCurrentHole({
    ...round,
    holes: round.holes.map((item) => {
      if ((item.groupNumber ?? 1) !== groupNumber || item.holeNumber !== nextHoleNumber || item.isSaved) return item;
      const groupPlayerIds = getGroupPlayerIds(round, groupNumber);
      const bankerParticipantIds = getBankerParticipantIds(round.players, groupPlayerIds);
      const bankerId = bankerParticipantIds.includes(item.bankerPlayerId)
        ? item.bankerPlayerId
        : bankerParticipantIds[0] ?? groupPlayerIds[0] ?? item.bankerPlayerId;
      return {
        ...item,
        bankerPlayerId: bankerId,
        matchups: groupPlayerIds
          .filter((playerId) => playerId !== bankerId)
          .map((playerId) => ({
            playerId,
            baseWager: item.matchups.find((m) => m.playerId === playerId)?.baseWager ?? round.defaultBet,
            pressed: false,
            grossScore: null,
            bankerParticipant: round.players.find((player) => player.id === playerId)?.bankerParticipant !== false,
          })),
        bankerPressed: false,
        bankerGrossScore: null,
      };
    }),
  }, groupNumber, nextHoleNumber);
}

function buildRunningTotalsFromLedger(round: RoundState, ledger: LedgerEntry[]) {
  return round.players.map((player) => {
    const incoming = ledger.filter((entry) => entry.toPlayerId === player.id).reduce((sum, entry) => sum + entry.amount, 0);
    const outgoing = ledger.filter((entry) => entry.fromPlayerId === player.id).reduce((sum, entry) => sum + entry.amount, 0);
    return { playerId: player.id, playerName: player.name, amount: incoming - outgoing };
  });
}

function buildCurrentHoleSummary(round: RoundState, hole: HoleState): CurrentHoleSummary {
  const banker = round.players.find((player) => player.id === hole.bankerPlayerId) ?? round.players[0];
  const results = getHoleResults(round, hole);

  return {
    bankerName: banker.name,
    bankerGrossScore: hole.bankerGrossScore,
    bankerHandicap: banker.handicap,
    bankerPressed: hole.bankerPressed,
    pressLabel: hole.par === 3 ? 'Triple' : 'Double',
    bankerGetsStrokeFromNames: hole.matchups
      .filter((matchup) => matchup.bankerParticipant !== false)
      .map((matchup) => {
        const player = round.players.find((p) => p.id === matchup.playerId);
        const netScores = getMatchupNetScores(
          round,
          hole,
          banker.handicap,
          player?.handicap ?? 0,
          hole.bankerGrossScore,
          matchup.grossScore,
        );
        return netScores.bankerGetsStroke ? player?.name ?? 'Player' : null;
      })
      .filter((name): name is string => Boolean(name)),
    matchups: hole.matchups.map((matchup) => {
      const player = round.players.find((p) => p.id === matchup.playerId);
      const netScores = getMatchupNetScores(
        round,
        hole,
        banker.handicap,
        player?.handicap ?? 0,
        hole.bankerGrossScore,
        matchup.grossScore,
      );
      const result = results.find((item) => item.playerId === matchup.playerId);
      const amount =
        result?.result === 'player_wins'
          ? result.finalAmount
          : result?.result === 'banker_wins'
            ? -result.finalAmount
            : 0;
      const modifiers = buildModifierLabels(hole, matchup.pressed, matchup.grossScore, hole.bankerGrossScore);
      const totalMultiplier = result ? result.pressMultiplier * result.birdieMultiplier : 1;

      let payoutText = 'Awaiting complete scores';
      let resultLabel = 'Awaiting complete scores';

      if (matchup.bankerParticipant === false) {
        payoutText = 'Score only';
        resultLabel = 'Not playing Banker';
      } else if (result?.result === 'push') {
        payoutText = 'Push ($0)';
        resultLabel = 'Push';
      } else if (result?.result === 'player_wins') {
        payoutText = `${player?.name ?? 'Player'} wins $${result.finalAmount}`;
        resultLabel = `${player?.name ?? 'Player'} wins`;
      } else if (result?.result === 'banker_wins') {
        payoutText = `${banker.name} wins $${result.finalAmount}`;
        resultLabel = `${banker.name} wins`;
      }

      return {
        playerId: matchup.playerId,
        playerName: player?.name ?? 'Player',
        bankerParticipant: matchup.bankerParticipant !== false,
        playerGrossScore: matchup.grossScore,
        bankerGrossScore: hole.bankerGrossScore,
        playerNetScore: netScores.playerNetScore,
        bankerNetScore: netScores.bankerNetScore,
        playerGetsStroke: netScores.playerGetsStroke,
        bankerGetsStroke: netScores.bankerGetsStroke,
        baseWager: matchup.baseWager,
        playerPressed: matchup.pressed,
        bankerPressed: hole.bankerPressed,
        amount,
        reason: matchup.bankerParticipant === false ? 'Not playing Banker' : result?.reason ?? 'Awaiting complete scores',
        modifiers,
        totalMultiplier,
        resultLabel,
        payoutText,
      };
    }),
  };
}

function buildSettleUp(round: RoundState, ledger: LedgerEntry[]): SettleUpItem[] {
  const settlements: SettleUpItem[] = [];
  const groupNumbers = round.multiFoursome?.groups.length
    ? round.multiFoursome.groups.map((group) => group.groupNumber)
    : [1];

  groupNumbers.forEach((groupNumber) => {
    const groupPlayerIds = new Set(getBankerParticipantIds(round.players, getGroupPlayerIds(round, groupNumber)));
    const groupLedger = ledger.filter(
      (entry) => groupPlayerIds.has(entry.fromPlayerId) && groupPlayerIds.has(entry.toPlayerId)
    );
    const totals = buildRunningTotalsFromLedger(round, groupLedger).filter((item) => groupPlayerIds.has(item.playerId));
    const debtors = totals
      .filter((item) => item.amount < 0)
      .map((item) => ({ ...item, remaining: Math.abs(item.amount) }))
      .sort((a, b) => b.remaining - a.remaining);
    const creditors = totals
      .filter((item) => item.amount > 0)
      .map((item) => ({ ...item, remaining: item.amount }))
      .sort((a, b) => b.remaining - a.remaining);

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.remaining, creditor.remaining);

      if (amount > 0) {
        settlements.push({
          groupNumber,
          fromPlayerId: debtor.playerId,
          fromPlayerName: debtor.playerName,
          toPlayerId: creditor.playerId,
          toPlayerName: creditor.playerName,
          amount,
        });
      }

      debtor.remaining -= amount;
      creditor.remaining -= amount;

      if (debtor.remaining <= 0.0001) i += 1;
      if (creditor.remaining <= 0.0001) j += 1;
    }
  });

  return settlements;
}


function getPlayerGrossForHole(hole: HoleState, playerId: string) {
  if (hole.bankerPlayerId === playerId) return hole.bankerGrossScore;
  return hole.matchups.find((matchup) => matchup.playerId === playerId)?.grossScore ?? null;
}

function getPlayerNetForHole(round: RoundState, hole: HoleState, playerId: string) {
  const gross = getPlayerGrossForHole(hole, playerId);
  if (gross == null) return null;

  const player = round.players.find((item) => item.id === playerId);
  if (!player) return gross;

  const fullRoundStrokes = Math.floor(Math.max(0, player.handicap) / round.totalHoles);
  const extraStrokes = Math.max(0, player.handicap) % round.totalHoles;
  const strokesOnHole = fullRoundStrokes + (hole.handicapIndex <= extraStrokes ? 1 : 0);

  return gross - strokesOnHole;
}

function buildGrossTotals(round: RoundState): GrossTotalItem[] {
  return round.players.map((player) => {
    let grossTotal = 0;
    let netTotal = 0;
    let holesCounted = 0;
    let naturalBirdies = 0;
    let naturalEagles = 0;

    round.holes.forEach((hole) => {
      if (!hole.isSaved) return;
      const gross = getPlayerGrossForHole(hole, player.id);
      const net = getPlayerNetForHole(round, hole, player.id);
      if (gross == null || net == null) return;
      grossTotal += gross;
      netTotal += net;
      holesCounted += 1;
      if (gross === hole.par - 1) naturalBirdies += 1;
      if (gross === hole.par - 2) naturalEagles += 1;
    });

    return {
      playerId: player.id,
      playerName: player.name,
      grossTotal,
      netTotal,
      holesCounted,
      naturalBirdies,
      naturalEagles,
    };
  });
}

function buildSkinsSummary(round: RoundState): SkinsSummary {
  const pot = round.gameSettings?.skinsPot ?? 0;
  if (!skinsEnabled(round)) return { pot, skinsWon: 0, valuePerSkin: 0, holes: [], payouts: [] };
  const holeNumbers = Array.from(new Set(round.holes.filter((hole) => hole.isSaved).map((hole) => hole.holeNumber))).sort(
    (a, b) => a - b
  );

  const holes = holeNumbers.map((holeNumber) => {
      const groupHoles = round.holes.filter((hole) => hole.isSaved && hole.holeNumber === holeNumber);
      const scores = groupHoles.flatMap((hole) =>
        round.players
          .filter(playerParticipatesInSkins)
          .map((player) => ({
            player,
            net: getPlayerNetForHole(round, hole, player.id),
          }))
          .filter((item): item is { player: typeof round.players[number]; net: number } => item.net != null)
      );

      if (scores.length === 0) {
        return { holeNumber, winnerPlayerId: null, winnerName: null, winningNetScore: null, isTie: false };
      }

      const low = Math.min(...scores.map((item) => item.net));
      const winners = scores.filter((item) => item.net === low);

      if (winners.length !== 1) {
        return { holeNumber, winnerPlayerId: null, winnerName: null, winningNetScore: low, isTie: true };
      }

      return {
        holeNumber,
        winnerPlayerId: winners[0].player.id,
        winnerName: winners[0].player.name,
        winningNetScore: low,
        isTie: false,
      };
    });

  const wonHoles = holes.filter((hole) => hole.winnerPlayerId);
  const valuePerSkin = wonHoles.length > 0 ? pot / wonHoles.length : 0;

  const payouts = round.players.filter(playerParticipatesInSkins).map((player) => {
    const skins = wonHoles.filter((hole) => hole.winnerPlayerId === player.id).length;
    return {
      playerId: player.id,
      playerName: player.name,
      skins,
      amount: skins * valuePerSkin,
    };
  });

  return { pot, skinsWon: wonHoles.length, valuePerSkin, holes, payouts };
}

function buildLowNetSummary(round: RoundState): LowNetSummary {
  const pot = round.gameSettings?.lowNetPot ?? 0;
  if (!lowNetEnabled(round)) return { pot, totals: [], payouts: [] };
  const lowNetPlayerIds = new Set(round.players.filter(playerParticipatesInLowNet).map((player) => player.id));
  const totals = buildGrossTotals(round)
    .filter((item) => lowNetPlayerIds.has(item.playerId))
    .sort((a, b) => a.netTotal - b.netTotal);
  const payouts = round.players.filter(playerParticipatesInLowNet).map((player) => ({
    playerId: player.id,
    playerName: player.name,
    placement: 'Other',
    amount: 0,
  }));

  if (pot <= 0 || totals.length === 0) return { pot, totals, payouts };

  const lowScore = totals[0]?.netTotal;
  const firstPlace = totals.filter((item) => item.netTotal === lowScore);

  if (firstPlace.length > 1) {
    firstPlace.forEach((item) => {
      const payout = payouts.find((p) => p.playerId === item.playerId);
      if (payout) {
        payout.placement = 'Tied 1st';
        payout.amount = pot / firstPlace.length;
      }
    });
    return { pot, totals, payouts };
  }

  const first = firstPlace[0];
  const secondScore = totals.find((item) => item.netTotal > first.netTotal)?.netTotal;
  const secondPlace = secondScore == null ? [] : totals.filter((item) => item.netTotal === secondScore);
  const secondPot = secondPlace.length > 0 ? pot * 0.2 : 0;
  const firstPot = pot - secondPot;

  const firstPayout = payouts.find((p) => p.playerId === first.playerId);
  if (firstPayout) {
    firstPayout.placement = '1st';
    firstPayout.amount = firstPot;
  }

  secondPlace.forEach((item) => {
    const payout = payouts.find((p) => p.playerId === item.playerId);
    if (payout) {
      payout.placement = secondPlace.length > 1 ? 'Tied 2nd' : '2nd';
      payout.amount = secondPot / secondPlace.length;
    }
  });

  return { pot, totals, payouts };
}

function buildCtpSummary(round: RoundState): CtpSummary {
  const pot = round.gameSettings?.ctpPot ?? 0;
  if (!ctpEnabled(round)) return { pot, par3Holes: [], payouts: [] };
  const par3HoleNumbers = Array.from(new Set(round.holes.filter((hole) => hole.par === 3).map((hole) => hole.holeNumber))).sort(
    (a, b) => a - b
  );
  const par3Holes = par3HoleNumbers
    .map((holeNumber) => {
      const groupHoles = round.holes.filter((hole) => {
        const winner = round.players.find((player) => player.id === hole.ctpWinnerPlayerId);
        return hole.holeNumber === holeNumber && hole.ctpWinnerPlayerId && playerParticipatesInCtp(winner);
      });
      const winningPlayerId = groupHoles[groupHoles.length - 1]?.ctpWinnerPlayerId ?? null;
      const winner = round.players.find((player) => player.id === winningPlayerId);
      return {
        holeNumber,
        winnerPlayerId: winningPlayerId,
        winnerName: winner?.name ?? null,
      };
    });

  const won = par3Holes.filter((item) => item.winnerPlayerId);
  const valuePerWin = won.length > 0 ? pot / won.length : 0;

  const payouts = round.players.filter(playerParticipatesInCtp).map((player) => {
    const wins = won.filter((item) => item.winnerPlayerId === player.id).length;
    return {
      playerId: player.id,
      playerName: player.name,
      wins,
      amount: wins * valuePerWin,
    };
  });

  return { pot, par3Holes, payouts };
}

function buildNassauSummary(round: RoundState): NassauSummary {
  const pot = round.gameSettings?.nassauPot ?? 0;
  if (!nassauEnabled(round)) return { pot, segments: [], payouts: [] };

  const segmentConfigs = [
    { label: 'Front 9', holes: Array.from({ length: 9 }, (_, index) => index + 1) },
    { label: 'Back 9', holes: Array.from({ length: 9 }, (_, index) => index + 10) },
    { label: 'Total', holes: Array.from({ length: round.totalHoles }, (_, index) => index + 1) },
  ];
  const segmentPot = pot / segmentConfigs.length;
  const payouts = new Map(round.players.map((player) => [
    player.id,
    { playerId: player.id, playerName: player.name, amount: 0, wins: [] as string[] },
  ]));

  const segments = segmentConfigs.map((segment) => {
    const totals = round.players
      .map((player) => {
        let netTotal = 0;
        let holesCounted = 0;
        round.holes.forEach((hole) => {
          if (!hole.isSaved || !segment.holes.includes(hole.holeNumber)) return;
          const net = getPlayerNetForHole(round, hole, player.id);
          if (net == null) return;
          netTotal += net;
          holesCounted += 1;
        });
        return { player, netTotal, holesCounted };
      })
      .filter((item) => item.holesCounted === segment.holes.length);

    if (totals.length === 0) return { label: segment.label, holes: segment.holes, winners: [] };

    const lowNet = Math.min(...totals.map((item) => item.netTotal));
    const winners = totals
      .filter((item) => item.netTotal === lowNet)
      .map((item) => {
        const amount = segmentPot / totals.filter((total) => total.netTotal === lowNet).length;
        const payout = payouts.get(item.player.id);
        if (payout) {
          payout.amount += amount;
          payout.wins.push(segment.label);
        }
        return { playerId: item.player.id, playerName: item.player.name, netTotal: item.netTotal, amount };
      });

    return { label: segment.label, holes: segment.holes, winners };
  });

  return {
    pot,
    segments,
    payouts: Array.from(payouts.values()).filter((item) => item.amount > 0),
  };
}

function stablefordPoints(netScore: number, par: number) {
  const relativeToPar = netScore - par;
  if (relativeToPar <= -3) return 5;
  if (relativeToPar === -2) return 4;
  if (relativeToPar === -1) return 3;
  if (relativeToPar === 0) return 2;
  if (relativeToPar === 1) return 1;
  return 0;
}

function buildStablefordSummary(round: RoundState): StablefordSummary {
  const pot = round.gameSettings?.stablefordPot ?? 0;
  if (!stablefordEnabled(round)) return { pot, standings: [], payouts: [] };

  const standings = round.players
    .map((player) => {
      const points = round.holes.reduce((sum, hole) => {
        if (!hole.isSaved) return sum;
        const net = getPlayerNetForHole(round, hole, player.id);
        return net == null ? sum : sum + stablefordPoints(net, hole.par);
      }, 0);
      return { playerId: player.id, playerName: player.name, points, amount: 0 };
    })
    .sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName));

  if (pot <= 0 || standings.length === 0) return { pot, standings, payouts: [] };

  const topScore = standings[0]?.points ?? 0;
  const winners = standings.filter((item) => item.points === topScore && topScore > 0);
  const payouts = winners.map((item) => ({ ...item, amount: pot / winners.length }));
  const payoutByPlayer = new Map(payouts.map((item) => [item.playerId, item.amount]));

  return {
    pot,
    standings: standings.map((item) => ({ ...item, amount: payoutByPlayer.get(item.playerId) ?? 0 })),
    payouts,
  };
}

function buildBirdiePotSummary(round: RoundState): BirdiePotSummary {
  const pot = round.gameSettings?.birdiePot ?? 0;
  if (!birdiePotEnabled(round)) return { pot, valuePerBirdie: 0, payouts: [] };

  const birdiesByPlayer = new Map(round.players.map((player) => [
    player.id,
    { playerId: player.id, playerName: player.name, birdies: 0, amount: 0, holes: [] as number[] },
  ]));

  round.holes.forEach((hole) => {
    if (!hole.isSaved) return;
    round.players.forEach((player) => {
      const gross = getPlayerGrossForHole(hole, player.id);
      if (gross !== hole.par - 1) return;
      const entry = birdiesByPlayer.get(player.id);
      if (!entry) return;
      entry.birdies += 1;
      entry.holes.push(hole.holeNumber);
    });
  });

  const totalBirdies = Array.from(birdiesByPlayer.values()).reduce((sum, item) => sum + item.birdies, 0);
  const valuePerBirdie = totalBirdies > 0 ? pot / totalBirdies : 0;
  const payouts = Array.from(birdiesByPlayer.values())
    .filter((item) => item.birdies > 0)
    .map((item) => ({ ...item, amount: item.birdies * valuePerBirdie }));

  return { pot, valuePerBirdie, payouts };
}

function buildEaglePotSummary(round: RoundState): EaglePotSummary {
  const pot = round.gameSettings?.eaglePot ?? 0;
  if (!eaglePotEnabled(round)) return { pot, valuePerEagle: 0, payouts: [] };

  const eaglesByPlayer = new Map(round.players.map((player) => [
    player.id,
    { playerId: player.id, playerName: player.name, eagles: 0, amount: 0, holes: [] as number[] },
  ]));

  round.holes.forEach((hole) => {
    if (!hole.isSaved) return;
    round.players.forEach((player) => {
      const gross = getPlayerGrossForHole(hole, player.id);
      if (gross !== hole.par - 2) return;
      const entry = eaglesByPlayer.get(player.id);
      if (!entry) return;
      entry.eagles += 1;
      entry.holes.push(hole.holeNumber);
    });
  });

  const totalEagles = Array.from(eaglesByPlayer.values()).reduce((sum, item) => sum + item.eagles, 0);
  const valuePerEagle = totalEagles > 0 ? pot / totalEagles : 0;
  const payouts = Array.from(eaglesByPlayer.values())
    .filter((item) => item.eagles > 0)
    .map((item) => ({ ...item, amount: item.eagles * valuePerEagle }));

  return { pot, valuePerEagle, payouts };
}

function buildHoleInOneSummary(round: RoundState): HoleInOneSummary {
  const aceValue = 100;
  if (!holeInOneEnabled(round)) return { aceValue, payouts: [] };

  const acesByPlayer = new Map(round.players.map((player) => [
    player.id,
    { playerId: player.id, playerName: player.name, amount: 0, holes: [] as number[], aces: 0, payerCount: Math.max(0, round.players.length - 1) },
  ]));

  round.holes.forEach((hole) => {
    if (!hole.isSaved) return;
    round.players.forEach((player) => {
      const gross = getPlayerGrossForHole(hole, player.id);
      if (gross !== 1) return;
      const entry = acesByPlayer.get(player.id);
      if (!entry) return;
      entry.aces += 1;
      entry.holes.push(hole.holeNumber);
      entry.amount += entry.payerCount * aceValue;
    });
  });

  return {
    aceValue,
    payouts: Array.from(acesByPlayer.values()).filter((item) => item.aces > 0),
  };
}

function simulationTargetScore(coursePar: number, handicap: number, playerIndex: number, groupNumber: number) {
  const dayVariance = ((playerIndex * 2 + groupNumber) % 5) - 1;
  return Math.max(coursePar - 4, Math.round(coursePar + Math.max(0, handicap) + dayVariance + 2));
}

function addStrokeToHardestAvailableHole(holes: HoleState[], scores: Map<number, number>, avoidHoleNumbers = new Set<number>()) {
  const targetHole = [...holes]
    .filter((hole) => !avoidHoleNumbers.has(hole.holeNumber))
    .sort((a, b) => a.handicapIndex - b.handicapIndex || a.holeNumber - b.holeNumber)
    .find((hole) => (scores.get(hole.holeNumber) ?? hole.par) < hole.par + 3);

  if (!targetHole) return;
  scores.set(targetHole.holeNumber, (scores.get(targetHole.holeNumber) ?? targetHole.par) + 1);
}

function buildSimulatedGrossScores(round: RoundState, groupNumber: number, playerId: string) {
  const groupHoles = round.holes
    .filter((hole) => (hole.groupNumber ?? 1) === groupNumber)
    .sort((a, b) => a.holeNumber - b.holeNumber);
  const player = round.players.find((item) => item.id === playerId);
  const groupPlayerIds = getGroupPlayerIds(round, groupNumber);
  const playerIndex = Math.max(0, groupPlayerIds.indexOf(playerId));
  const coursePar = groupHoles.reduce((sum, hole) => sum + hole.par, 0);
  const targetScore = simulationTargetScore(coursePar, player?.handicap ?? 0, playerIndex, groupNumber);
  const scores = new Map<number, number>(groupHoles.map((hole) => [hole.holeNumber, hole.par]));

  let overParBudget = Math.max(0, targetScore - coursePar);
  const holesByDifficulty = [...groupHoles].sort((a, b) => a.handicapIndex - b.handicapIndex || a.holeNumber - b.holeNumber);
  let pass = 0;

  while (overParBudget > 0 && pass < 4) {
    holesByDifficulty.forEach((hole) => {
      if (overParBudget <= 0) return;
      const current = scores.get(hole.holeNumber) ?? hole.par;
      const extraLimit = hole.par === 3 ? 2 : 3;
      if (current - hole.par < extraLimit) {
        scores.set(hole.holeNumber, current + 1);
        overParBudget -= 1;
      }
    });
    pass += 1;
  }

  const birdieCount = player?.handicap == null
    ? 1
    : player.handicap <= 5
      ? 3
      : player.handicap <= 10
        ? 2
        : player.handicap <= 18
          ? 1
          : 0;
  const birdieHoles = [...groupHoles]
    .sort((a, b) => b.handicapIndex - a.handicapIndex || a.holeNumber - b.holeNumber)
    .filter((hole, index) => hole.par > 3 || index % 2 === 0)
    .slice(0, birdieCount);

  birdieHoles.forEach((hole) => {
    const current = scores.get(hole.holeNumber) ?? hole.par;
    const adjustment = current - (hole.par - 1);
    if (adjustment <= 0) return;
    scores.set(hole.holeNumber, hole.par - 1);
    for (let count = 0; count < adjustment; count += 1) {
      addStrokeToHardestAvailableHole(groupHoles, scores, new Set([hole.holeNumber]));
    }
  });

  return scores;
}

function simulateRound(round: RoundState): RoundState {
  const groups = round.multiFoursome?.groups.length ? round.multiFoursome.groups : buildGroupsForPlayers(round.players).groups;
  const par3WinnersByHole = new Map<number, string>();
  const simulatedScores = new Map<string, Map<number, number>>();

  groups.forEach((group) => {
    const groupPlayerIds = getGroupPlayerIds(round, group.groupNumber);
    round.holes
      .filter((hole) => (hole.groupNumber ?? 1) === group.groupNumber && hole.par === 3)
      .forEach((hole) => {
        if (!par3WinnersByHole.has(hole.holeNumber)) {
          const winnerIndex = (hole.holeNumber + group.groupNumber) % Math.max(1, groupPlayerIds.length);
          par3WinnersByHole.set(hole.holeNumber, groupPlayerIds[winnerIndex]);
        }
      });
  });

  const holes = round.holes.map((hole) => {
    const groupNumber = hole.groupNumber ?? 1;
    const groupPlayerIds = getGroupPlayerIds(round, groupNumber);
    groupPlayerIds.forEach((playerId) => {
      const key = `${groupNumber}:${playerId}`;
      if (!simulatedScores.has(key)) {
        simulatedScores.set(key, buildSimulatedGrossScores(round, groupNumber, playerId));
      }
    });
    const bankerGrossScore = simulatedScores.get(`${groupNumber}:${hole.bankerPlayerId}`)?.get(hole.holeNumber) ?? hole.par;
    const ctpWinner = hole.par === 3 ? par3WinnersByHole.get(hole.holeNumber) ?? null : null;

    return {
      ...hole,
      bankerGrossScore,
      bankerPressed: (hole.holeNumber + groupNumber) % 7 === 0,
      isSaved: true,
      ctpWinnerPlayerId: ctpWinner && groupPlayerIds.includes(ctpWinner) ? ctpWinner : null,
      matchups: hole.matchups.map((matchup) => {
        const playerIndex = Math.max(0, groupPlayerIds.indexOf(matchup.playerId));
        return {
          ...matchup,
          grossScore: simulatedScores.get(`${groupNumber}:${matchup.playerId}`)?.get(hole.holeNumber) ?? hole.par,
          pressed: (hole.holeNumber + playerIndex + groupNumber) % 9 === 0,
        };
      }),
    };
  });

  return {
    ...round,
    currentHole: round.totalHoles,
    holes,
    multiFoursome: round.multiFoursome
      ? {
          ...round.multiFoursome,
          groups: round.multiFoursome.groups.map((group) => ({
            ...group,
            currentHole: round.totalHoles,
          })),
        }
      : round.multiFoursome,
  };
}

export const useRoundStore = create<RoundStore>()(
  persist(
    (set, get) => ({
      round: createDefaultRound(),
      ledger: [],

      createRound: (input) =>
        set(() => {
          const totalHoles = input.totalHoles ?? 18;
          const groupSize = input.groupSize ?? 4;
          const builtGroups = buildGroupsForPlayers(input.players, groupSize);
          const assignedGroupNumbers = Array.from(
            new Set((input.groupPlayers ?? builtGroups.groupPlayers).map((assignment) => assignment.groupNumber))
          ).sort((a, b) => a - b);
          const multiFoursome = {
            groupSize,
            groups: assignedGroupNumbers.map(
              (groupNumber) =>
                builtGroups.groups.find((group) => group.groupNumber === groupNumber) ?? {
                  groupNumber,
                  groupName: `Group ${groupNumber}`,
                  teeTime: null,
                  scorekeeperName: null,
                  scorekeeperDeviceId: null,
                  currentHole: 1,
                }
            ),
            groupPlayers: input.groupPlayers ?? builtGroups.groupPlayers,
          };
          const groupedHoles = multiFoursome.groups.flatMap((group) => {
            const groupPlayerIds = multiFoursome.groupPlayers
              .filter((item) => item.groupNumber === group.groupNumber)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => item.playerId);
            const bankerParticipantIds = getBankerParticipantIds(input.players, groupPlayerIds);
            const bankerId = bankerParticipantIds.includes(input.firstBankerPlayerId)
              ? input.firstBankerPlayerId
              : bankerParticipantIds[0] ?? groupPlayerIds[0] ?? input.firstBankerPlayerId;

            return createDefaultHoles(
              totalHoles,
              bankerId,
              groupPlayerIds,
              input.defaultBet,
              input.holesConfig,
              group.groupNumber,
              input.players
            );
          });

          return {
            ledger: [],
            round: {
              id: `round-${input.roundCode}`,
              roundCode: input.roundCode,
              title: input.title,
              courseName: input.courseName,
              selectedCourseId: input.selectedCourseId ?? null,
              currentHole: 1,
              totalHoles,
              defaultBet: input.defaultBet,
              gameSettings: {
                bankerEnabled: input.gameSettings?.bankerEnabled ?? true,
                skinsEnabled: input.gameSettings?.skinsEnabled ?? false,
                lowNetEnabled: input.gameSettings?.lowNetEnabled ?? false,
                ctpEnabled: input.gameSettings?.ctpEnabled ?? false,
                nassauEnabled: input.gameSettings?.nassauEnabled ?? false,
                stablefordEnabled: input.gameSettings?.stablefordEnabled ?? false,
                birdiePotEnabled: input.gameSettings?.birdiePotEnabled ?? false,
                eaglePotEnabled: input.gameSettings?.eaglePotEnabled ?? false,
                holeInOneEnabled: input.gameSettings?.holeInOneEnabled ?? false,
                skinsPot: input.gameSettings?.skinsPot ?? 0,
                lowNetPot: input.gameSettings?.lowNetPot ?? 0,
                ctpPot: input.gameSettings?.ctpPot ?? 0,
                nassauPot: input.gameSettings?.nassauPot ?? 0,
                stablefordPot: input.gameSettings?.stablefordPot ?? 0,
                birdiePot: input.gameSettings?.birdiePot ?? 0,
                eaglePot: input.gameSettings?.eaglePot ?? 0,
                courseRating: input.gameSettings?.courseRating ?? null,
                slopeRating: input.gameSettings?.slopeRating ?? null,
                pcc: input.gameSettings?.pcc ?? 0,
              },
              players: input.players,
              multiFoursome: { enabled: input.players.length > groupSize, ...multiFoursome },
              holes: groupedHoles,
            },
          };
        }),

      hydrateRound: (round) => {
        const hydratedRound = ensureMultiFoursomeRound(round);
        set({ round: hydratedRound, ledger: recalcLedger(hydratedRound) });
      },

      simulateFullEvent: () =>
        set((state) => {
          const round = simulateRound(ensureMultiFoursomeRound(state.round));
          return { round, ledger: recalcLedger(round) };
        }),

      resetRound: () => set({ round: createDefaultRound(), ledger: [] }),

      setPlayerHandicap: (playerId, handicap) =>
        set((state) => {
          const normalized = Number.isFinite(handicap) ? Math.max(0, Math.floor(handicap)) : 0;
          const round = {
            ...state.round,
            players: state.round.players.map((player) =>
              player.id === playerId ? { ...player, handicap: normalized } : player
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setBanker: (playerId, groupNumber = 1, holeNumber) =>
        set((state) => {
          const round = updateGroupHole(
            state.round,
            groupNumber,
            (hole) =>
              createHole(
                groupNumber,
                hole.holeNumber,
                hole.par,
                hole.handicapIndex,
                playerId,
                getGroupPlayerIds(state.round, groupNumber),
                state.round.defaultBet,
                state.round.players
              ),
            holeNumber
          );
          return { round, ledger: recalcLedger(round) };
        }),

      setPar: (par, groupNumber = 1, holeNumber) =>
        set((state) => {
          const currentHole = getGroupHole(state.round, groupNumber, holeNumber).holeNumber;
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              (hole.groupNumber ?? 1) === groupNumber && hole.holeNumber === currentHole ? { ...hole, par } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setHoleHandicap: (handicapIndex, groupNumber = 1, holeNumber) =>
        set((state) => {
          const normalized = Math.min(18, Math.max(1, Math.floor(handicapIndex || 1)));
          const currentHole = getGroupHole(state.round, groupNumber, holeNumber).holeNumber;
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              (hole.groupNumber ?? 1) === groupNumber && hole.holeNumber === currentHole ? { ...hole, handicapIndex: normalized } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setWager: (playerId, amount, groupNumber = 1, holeNumber) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({
                    ...hole,
                    matchups: hole.matchups.map((m) =>
                      m.playerId === playerId ? { ...m, baseWager: Number.isFinite(amount) ? Math.max(0, amount) : 0 } : m
                    ),
                  }), holeNumber);
          return { round, ledger: recalcLedger(round) };
        }),

      togglePlayerPress: (playerId, groupNumber = 1, holeNumber) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({
                    ...hole,
                    matchups: hole.matchups.map((m) => (m.playerId === playerId ? { ...m, pressed: !m.pressed } : m)),
                  }), holeNumber);
          return { round, ledger: recalcLedger(round) };
        }),

      toggleBankerPress: (groupNumber = 1, holeNumber) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({ ...hole, bankerPressed: !hole.bankerPressed }), holeNumber);
          return { round, ledger: recalcLedger(round) };
        }),

      setPlayerGrossScore: (playerId, score, groupNumber = 1, holeNumber) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({
            ...hole,
            matchups: hole.matchups.map((m) => (m.playerId === playerId ? { ...m, grossScore: score } : m)),
          }), holeNumber);
          return { round, ledger: recalcLedger(round) };
        }),

      setBankerGrossScore: (score, groupNumber = 1, holeNumber) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({ ...hole, bankerGrossScore: score }), holeNumber);
          return { round, ledger: recalcLedger(round) };
        }),

      updateHole: (groupNumber = 1, holeNumber) => {
        const { round } = get();
        const hole = getGroupHole(round, groupNumber, holeNumber);
        if (hole.bankerGrossScore == null || hole.matchups.some((matchup) => matchup.grossScore == null)) {
          return { ok: false, message: 'Enter all gross scores before updating the hole.' };
        }

        const nextRound = updateGroupHole(round, groupNumber, (item) => ({ ...item, isSaved: true }), holeNumber);
        set({ round: nextRound, ledger: recalcLedger(nextRound) });
        return { ok: true, message: `Group ${groupNumber} hole ${hole.holeNumber} updated.` };
      },

      nextHole: (groupNumber = 1) => {
        const { round } = get();
        const hole = activeHole(round, groupNumber);
        if (hole.bankerGrossScore == null || hole.matchups.some((matchup) => matchup.grossScore == null)) {
          return { ok: false, message: 'Enter all gross scores before moving to the next hole.' };
        }

        let nextRound = updateGroupHole(round, groupNumber, (item) => ({ ...item, isSaved: true }));

        if (hole.holeNumber < round.totalHoles) {
          nextRound = buildNextHole(nextRound, groupNumber, hole.holeNumber + 1);
        }
        set({ round: nextRound, ledger: recalcLedger(nextRound) });

        if (hole.holeNumber >= round.totalHoles) {
          return { ok: true, message: `Group ${groupNumber} round complete.` };
        }
        return { ok: true, message: `Group ${groupNumber} moved to Hole ${hole.holeNumber + 1}.` };
      },

      setCtpWinner: (holeNumber, playerId, groupNumber = 1) =>
        set((state) => {
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === holeNumber && (hole.groupNumber ?? 1) === groupNumber ? { ...hole, ctpWinnerPlayerId: playerId } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      getGrossTotals: () => buildGrossTotals(get().round),

      getSkinsSummary: () => buildSkinsSummary(get().round),

      getLowNetSummary: () => buildLowNetSummary(get().round),

      getCtpSummary: () => buildCtpSummary(get().round),

      getNassauSummary: () => buildNassauSummary(get().round),

      getStablefordSummary: () => buildStablefordSummary(get().round),

      getBirdiePotSummary: () => buildBirdiePotSummary(get().round),

      getEaglePotSummary: () => buildEaglePotSummary(get().round),

      getHoleInOneSummary: () => buildHoleInOneSummary(get().round),

      getRunningTotals: () => {
        const { round } = get();
        return buildRunningTotalsFromLedger(round, recalcLedger(round)).map((item) => ({
          playerId: item.playerId,
          name: item.playerName,
          amount: item.amount,
        }));
      },

      getGroupBankerTotals: (groupNumber = 1) => {
        const { round } = get();
        const groupPlayerIds = new Set(getBankerParticipantIds(round.players, getGroupPlayerIds(round, groupNumber)));
        const groupLedger = recalcLedger(round).filter(
          (entry) => groupPlayerIds.has(entry.fromPlayerId) && groupPlayerIds.has(entry.toPlayerId)
        );
        return buildRunningTotalsFromLedger(round, groupLedger)
          .filter((item) => groupPlayerIds.has(item.playerId))
          .map((item) => ({
            playerId: item.playerId,
            name: item.playerName,
            amount: item.amount,
          }));
      },

      getGroupBankerPreviewTotals: (groupNumber = 1, holeNumber) => {
        const { round } = get();
        if (!bankerEnabled(round)) return [];
        const groupPlayerIds = new Set(getBankerParticipantIds(round.players, getGroupPlayerIds(round, groupNumber)));
        const targetHole = getGroupHole(round, groupNumber, holeNumber);
        const previewLedger =
          targetHole && !targetHole.isSaved ? buildLedgerEntries(targetHole.bankerPlayerId, getHoleResults(round, targetHole)) : [];
        const groupLedger = [...recalcLedger(round), ...previewLedger].filter(
          (entry) => groupPlayerIds.has(entry.fromPlayerId) && groupPlayerIds.has(entry.toPlayerId)
        );

        return buildRunningTotalsFromLedger(round, groupLedger)
          .filter((item) => groupPlayerIds.has(item.playerId))
          .map((item) => ({
            playerId: item.playerId,
            name: item.playerName,
            amount: item.amount,
          }));
      },

      getCurrentHoleSummary: (groupNumber = 1, holeNumber) => {
        const { round } = get();
        return buildCurrentHoleSummary(round, getGroupHole(round, groupNumber, holeNumber));
      },

      getSettleUp: () => {
        const { round } = get();
        return buildSettleUp(round, recalcLedger(round));
      },

      getHoleHistory: () => {
        const { round } = get();
        let runningLedger: LedgerEntry[] = [];
        return round.holes
          .filter((hole) => hole.isSaved)
          .sort((a, b) => (a.groupNumber ?? 1) - (b.groupNumber ?? 1) || a.holeNumber - b.holeNumber)
          .map((hole) => {
            const summary = buildCurrentHoleSummary(round, hole);
            runningLedger = [...runningLedger, ...buildLedgerEntries(hole.bankerPlayerId, getHoleResults(round, hole))];
            return {
              holeNumber: hole.holeNumber,
              groupNumber: hole.groupNumber ?? 1,
              par: hole.par,
              handicapIndex: hole.handicapIndex,
              bankerName: summary.bankerName,
              bankerGrossScore: summary.bankerGrossScore,
              bankerHandicap: summary.bankerHandicap,
              bankerPressed: summary.bankerPressed,
              pressLabel: summary.pressLabel,
              matchups: summary.matchups,
              runningTotals: buildRunningTotalsFromLedger(round, runningLedger),
            };
          });
      },
    }),
    {
      name: 'triple-down-store',
      partialize: (state) => ({ round: state.round, ledger: state.ledger }),
    }
  )
);
