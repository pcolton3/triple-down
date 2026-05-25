'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settleBankerHole } from '@/domain/banker/settle-banker-hole';
import { isGrossBirdieOrBetter } from '@/domain/banker/birdie';
import { buildLedgerEntries, type LedgerEntry } from '@/domain/banker/ledger';
import type { BankerMatchupResult } from '@/domain/banker/types';
import type { CreateRoundInput, HoleConfig, HoleState, RoundState } from '@/types/round';
import { buildGroupsForPlayers } from '@/lib/groups/group-utils';

type MatchupSummary = {
  playerId: string;
  playerName: string;
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

type RoundStore = {
  round: RoundState;
  ledger: LedgerEntry[];
  createRound: (input: CreateRoundInput) => void;
  hydrateRound: (round: RoundState) => void;
  simulateFullEvent: () => void;
  resetRound: () => void;
  setBanker: (playerId: string, groupNumber?: number) => void;
  setPar: (par: 3 | 4 | 5, groupNumber?: number) => void;
  setHoleHandicap: (handicapIndex: number, groupNumber?: number) => void;
  setWager: (playerId: string, amount: number, groupNumber?: number) => void;
  togglePlayerPress: (playerId: string, groupNumber?: number) => void;
  toggleBankerPress: (groupNumber?: number) => void;
  setPlayerGrossScore: (playerId: string, score: number | null, groupNumber?: number) => void;
  setBankerGrossScore: (score: number | null, groupNumber?: number) => void;
  updateHole: (groupNumber?: number) => { ok: boolean; message?: string };
  nextHole: (groupNumber?: number) => { ok: boolean; message?: string };
  getRunningTotals: () => Array<{ playerId: string; name: string; amount: number }>;
  getGroupBankerTotals: (groupNumber?: number) => Array<{ playerId: string; name: string; amount: number }>;
  getHoleHistory: () => HoleHistoryItem[];
  getCurrentHoleSummary: (groupNumber?: number) => CurrentHoleSummary;
  getSettleUp: () => SettleUpItem[];
  setCtpWinner: (holeNumber: number, playerId: string | null, groupNumber?: number) => void;
  getGrossTotals: () => GrossTotalItem[];
  getSkinsSummary: () => SkinsSummary;
  getLowNetSummary: () => LowNetSummary;
  getCtpSummary: () => CtpSummary;
};

const defaultPlayers = [
  { id: 'p1', name: 'Player 1', handicap: 8 },
  { id: 'p2', name: 'Player 2', handicap: 10 },
  { id: 'p3', name: 'Player 3', handicap: 12 },
  { id: 'p4', name: 'Player 4', handicap: 9 },
];

function createHole(
  groupNumber: number,
  holeNumber: number,
  par: 3 | 4 | 5,
  handicapIndex: number,
  bankerPlayerId: string,
  playerIds: string[],
  defaultBet: number
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
      })),
  };
}

function createDefaultHoles(
  totalHoles: number,
  bankerPlayerId: string,
  playerIds: string[],
  defaultBet: number,
  holesConfig?: HoleConfig[],
  groupNumber = 1
) {
  const fallback = holesConfig && holesConfig.length === totalHoles
    ? holesConfig
    : Array.from({ length: totalHoles }, (_, index) => ({
        holeNumber: index + 1,
        par: 4 as const,
        handicapIndex: index + 1,
      }));

  return fallback.map((hole) =>
    createHole(groupNumber, hole.holeNumber, hole.par, hole.handicapIndex, bankerPlayerId, playerIds, defaultBet)
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
    gameSettings: { skinsPot: 0, lowNetPot: 0, ctpPot: 0 },
    players: defaultPlayers,
    multiFoursome: { enabled: false, ...multiFoursome },
    holes: createDefaultHoles(totalHoles, firstBankerPlayerId, defaultPlayers.map((p) => p.id), defaultBet),
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
    const bankerId = groupPlayerIds[0] ?? round.players[0]?.id ?? 'p1';

    holes.push(
      ...templateHoles.map((hole) =>
        createHole(group.groupNumber, hole.holeNumber, hole.par, hole.handicapIndex, bankerId, groupPlayerIds, round.defaultBet)
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

function updateGroupHole(round: RoundState, groupNumber: number, updater: (hole: HoleState) => HoleState) {
  const currentHole = activeHole(round, groupNumber);
  return {
    ...round,
    holes: round.holes.map((hole) =>
      (hole.groupNumber ?? 1) === groupNumber && hole.holeNumber === currentHole.holeNumber ? updater(hole) : hole
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

  const matchupInputs = hole.matchups.map((m) => {
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
      const bankerId = item.bankerPlayerId;
      return {
        ...item,
        matchups: getGroupPlayerIds(round, groupNumber)
          .filter((playerId) => playerId !== bankerId)
          .map((playerId) => ({
            playerId,
            baseWager: item.matchups.find((m) => m.playerId === playerId)?.baseWager ?? round.defaultBet,
            pressed: false,
            grossScore: null,
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

      if (result?.result === 'push') {
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
        reason: result?.reason ?? 'Awaiting complete scores',
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
    const groupPlayerIds = new Set(getGroupPlayerIds(round, groupNumber));
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
  const holeNumbers = Array.from(new Set(round.holes.filter((hole) => hole.isSaved).map((hole) => hole.holeNumber))).sort(
    (a, b) => a - b
  );

  const holes = holeNumbers.map((holeNumber) => {
      const groupHoles = round.holes.filter((hole) => hole.isSaved && hole.holeNumber === holeNumber);
      const scores = groupHoles.flatMap((hole) =>
        round.players
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

  const payouts = round.players.map((player) => {
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
  const totals = buildGrossTotals(round).sort((a, b) => a.netTotal - b.netTotal);
  const payouts = round.players.map((player) => ({
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
  const par3HoleNumbers = Array.from(new Set(round.holes.filter((hole) => hole.par === 3).map((hole) => hole.holeNumber))).sort(
    (a, b) => a - b
  );
  const par3Holes = par3HoleNumbers
    .map((holeNumber) => {
      const groupHoles = round.holes.filter((hole) => hole.holeNumber === holeNumber && hole.ctpWinnerPlayerId);
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

  const payouts = round.players.map((player) => {
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
            const bankerId = groupPlayerIds.includes(input.firstBankerPlayerId)
              ? input.firstBankerPlayerId
              : groupPlayerIds[0] ?? input.firstBankerPlayerId;

            return createDefaultHoles(
              totalHoles,
              bankerId,
              groupPlayerIds,
              input.defaultBet,
              input.holesConfig,
              group.groupNumber
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
                skinsPot: input.gameSettings?.skinsPot ?? 0,
                lowNetPot: input.gameSettings?.lowNetPot ?? 0,
                ctpPot: input.gameSettings?.ctpPot ?? 0,
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

      setBanker: (playerId, groupNumber = 1) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) =>
            createHole(
                groupNumber,
                hole.holeNumber,
                hole.par,
                hole.handicapIndex,
                playerId,
                getGroupPlayerIds(state.round, groupNumber),
                state.round.defaultBet
              )
          );
          return { round, ledger: recalcLedger(round) };
        }),

      setPar: (par, groupNumber = 1) =>
        set((state) => {
          const currentHole = activeHole(state.round, groupNumber).holeNumber;
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === currentHole ? { ...hole, par } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setHoleHandicap: (handicapIndex, groupNumber = 1) =>
        set((state) => {
          const normalized = Math.min(18, Math.max(1, Math.floor(handicapIndex || 1)));
          const currentHole = activeHole(state.round, groupNumber).holeNumber;
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === currentHole ? { ...hole, handicapIndex: normalized } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setWager: (playerId, amount, groupNumber = 1) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({
                    ...hole,
                    matchups: hole.matchups.map((m) =>
                      m.playerId === playerId ? { ...m, baseWager: Number.isFinite(amount) ? Math.max(0, amount) : 0 } : m
                    ),
                  }));
          return { round, ledger: recalcLedger(round) };
        }),

      togglePlayerPress: (playerId, groupNumber = 1) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({
                    ...hole,
                    matchups: hole.matchups.map((m) => (m.playerId === playerId ? { ...m, pressed: !m.pressed } : m)),
                  }));
          return { round, ledger: recalcLedger(round) };
        }),

      toggleBankerPress: (groupNumber = 1) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({ ...hole, bankerPressed: !hole.bankerPressed }));
          return { round, ledger: recalcLedger(round) };
        }),

      setPlayerGrossScore: (playerId, score, groupNumber = 1) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({
            ...hole,
            matchups: hole.matchups.map((m) => (m.playerId === playerId ? { ...m, grossScore: score } : m)),
          }));
          return { round, ledger: recalcLedger(round) };
        }),

      setBankerGrossScore: (score, groupNumber = 1) =>
        set((state) => {
          const round = updateGroupHole(state.round, groupNumber, (hole) => ({ ...hole, bankerGrossScore: score }));
          return { round, ledger: recalcLedger(round) };
        }),

      updateHole: (groupNumber = 1) => {
        const { round } = get();
        const hole = activeHole(round, groupNumber);
        if (hole.bankerGrossScore == null || hole.matchups.some((matchup) => matchup.grossScore == null)) {
          return { ok: false, message: 'Enter all gross scores before updating the hole.' };
        }

        const nextRound = updateGroupHole(round, groupNumber, (item) => ({ ...item, isSaved: true }));
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
        const groupPlayerIds = new Set(getGroupPlayerIds(round, groupNumber));
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

      getCurrentHoleSummary: (groupNumber = 1) => {
        const { round } = get();
        return buildCurrentHoleSummary(round, activeHole(round, groupNumber));
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
