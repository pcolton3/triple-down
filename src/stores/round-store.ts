'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settleBankerHole } from '@/domain/banker/settle-banker-hole';
import { buildLedgerEntries, type LedgerEntry } from '@/domain/banker/ledger';
import type { BankerMatchupResult } from '@/domain/banker/types';
import type { CreateRoundInput, HoleConfig, HoleState, RoundState } from '@/types/round';

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
  amount: number;
  reason: string;
};

type HoleHistoryItem = {
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
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  amount: number;
};

type RoundStore = {
  round: RoundState;
  ledger: LedgerEntry[];
  createRound: (input: CreateRoundInput) => void;
  resetRound: () => void;
  setBanker: (playerId: string) => void;
  setPar: (par: 3 | 4 | 5) => void;
  setHoleHandicap: (handicapIndex: number) => void;
  setWager: (playerId: string, amount: number) => void;
  togglePlayerPress: (playerId: string) => void;
  toggleBankerPress: () => void;
  setPlayerGrossScore: (playerId: string, score: number | null) => void;
  setBankerGrossScore: (score: number | null) => void;
  updateHole: () => { ok: boolean; message?: string };
  nextHole: () => { ok: boolean; message?: string };
  getRunningTotals: () => Array<{ playerId: string; name: string; amount: number }>;
  getHoleHistory: () => HoleHistoryItem[];
  getCurrentHoleSummary: () => CurrentHoleSummary;
  getSettleUp: () => SettleUpItem[];
};

const defaultPlayers = [
  { id: 'p1', name: 'Player 1', handicap: 8 },
  { id: 'p2', name: 'Player 2', handicap: 10 },
  { id: 'p3', name: 'Player 3', handicap: 12 },
  { id: 'p4', name: 'Player 4', handicap: 9 },
];

function createHole(
  holeNumber: number,
  par: 3 | 4 | 5,
  handicapIndex: number,
  bankerPlayerId: string,
  playerIds: string[],
  defaultBet: number
): HoleState {
  return {
    holeNumber,
    par,
    handicapIndex,
    bankerPlayerId,
    bankerGrossScore: null,
    bankerPressed: false,
    isSaved: false,
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

function createDefaultHoles(totalHoles: number, bankerPlayerId: string, playerIds: string[], defaultBet: number, holesConfig?: HoleConfig[]) {
  const fallback = holesConfig && holesConfig.length === totalHoles
    ? holesConfig
    : Array.from({ length: totalHoles }, (_, index) => ({
        holeNumber: index + 1,
        par: 4 as const,
        handicapIndex: index + 1,
      }));

  return fallback.map((hole) =>
    createHole(hole.holeNumber, hole.par, hole.handicapIndex, bankerPlayerId, playerIds, defaultBet)
  );
}

function createDefaultRound(): RoundState {
  const roundCode = 'BANK01';
  const defaultBet = 5;
  const totalHoles = 18;
  const firstBankerPlayerId = defaultPlayers[0].id;
  return {
    id: 'demo-round',
    roundCode,
    title: 'Saturday Group',
    courseName: 'Papago Golf Club',
    selectedCourseId: 'papago-golf-club',
    currentHole: 1,
    totalHoles,
    defaultBet,
    players: defaultPlayers,
    holes: createDefaultHoles(totalHoles, firstBankerPlayerId, defaultPlayers.map((p) => p.id), defaultBet),
  };
}

function activeHole(round: RoundState) {
  return round.holes.find((hole) => hole.holeNumber === round.currentHole) ?? round.holes[0];
}

function getStrokeHoleNumbers(round: RoundState, playerId: string) {
  const player = round.players.find((item) => item.id === playerId);
  if (!player) return new Set<number>();

  const lowestHandicap = Math.min(...round.players.map((item) => Math.floor(item.handicap)));
  const strokesToAllocate = Math.max(0, Math.floor(player.handicap) - lowestHandicap);
  if (strokesToAllocate <= 0) return new Set<number>();

  const eligibleHoles = [...round.holes]
    .filter((hole) => hole.par !== 3)
    .sort((a, b) => a.handicapIndex - b.handicapIndex || a.holeNumber - b.holeNumber);

  return new Set(eligibleHoles.slice(0, strokesToAllocate).map((hole) => hole.holeNumber));
}

function getMatchupNetScores(
  round: RoundState,
  hole: HoleState,
  bankerHandicap: number,
  playerHandicap: number,
  bankerGrossScore: number | null,
  playerGrossScore: number | null,
  bankerPlayerId: string,
  playerId: string
) {
  const playerGets = getStrokeHoleNumbers(round, playerId).has(hole.holeNumber) && playerHandicap > bankerHandicap;
  const bankerGets = getStrokeHoleNumbers(round, bankerPlayerId).has(hole.holeNumber) && bankerHandicap > playerHandicap;

  return {
    bankerNetScore: bankerGrossScore == null ? null : bankerGrossScore - (bankerGets ? 1 : 0),
    playerNetScore: playerGrossScore == null ? null : playerGrossScore - (playerGets ? 1 : 0),
    playerGetsStroke: playerGets,
    bankerGetsStroke: bankerGets,
  };
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
      hole.bankerPlayerId,
      m.playerId
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

function buildNextHole(round: RoundState, nextHoleNumber: number): RoundState {
  if (nextHoleNumber > round.totalHoles) return round;
  return {
    ...round,
    currentHole: nextHoleNumber,
    holes: round.holes.map((item) => {
      if (item.holeNumber !== nextHoleNumber || item.isSaved) return item;
      const bankerId = item.bankerPlayerId;
      return {
        ...item,
        matchups: round.players
          .filter((player) => player.id !== bankerId)
          .map((player) => ({
            playerId: player.id,
            baseWager: item.matchups.find((m) => m.playerId === player.id)?.baseWager ?? round.defaultBet,
            pressed: false,
            grossScore: null,
          })),
        bankerPressed: false,
        bankerGrossScore: null,
      };
    }),
  };
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
          hole.bankerPlayerId,
          matchup.playerId
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
        hole.bankerPlayerId,
        matchup.playerId
      );
      const result = results.find((item) => item.playerId === matchup.playerId);

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
        amount:
          result?.result === 'player_wins'
            ? result.finalAmount
            : result?.result === 'banker_wins'
              ? -result.finalAmount
              : 0,
        reason: result?.reason ?? 'Awaiting complete scores',
      };
    }),
  };
}


function buildSettleUp(round: RoundState, ledger: LedgerEntry[]): SettleUpItem[] {
  const totals = buildRunningTotalsFromLedger(round, ledger);
  const debtors = totals
    .filter((item) => item.amount < 0)
    .map((item) => ({ ...item, remaining: Math.abs(item.amount) }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = totals
    .filter((item) => item.amount > 0)
    .map((item) => ({ ...item, remaining: item.amount }))
    .sort((a, b) => b.remaining - a.remaining);

  const settlements: SettleUpItem[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.remaining, creditor.remaining);

    if (amount > 0) {
      settlements.push({
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

  return settlements;
}

export const useRoundStore = create<RoundStore>()(
  persist(
    (set, get) => ({
      round: createDefaultRound(),
      ledger: [],

      createRound: (input) =>
        set(() => {
          const totalHoles = input.totalHoles ?? 18;
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
              players: input.players,
              holes: createDefaultHoles(totalHoles, input.firstBankerPlayerId, input.players.map((p) => p.id), input.defaultBet, input.holesConfig),
            },
          };
        }),

      resetRound: () => set({ round: createDefaultRound(), ledger: [] }),

      setBanker: (playerId) =>
        set((state) => {
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) => {
              if (hole.holeNumber !== state.round.currentHole) return hole;
              return createHole(
                hole.holeNumber,
                hole.par,
                hole.handicapIndex,
                playerId,
                state.round.players.map((p) => p.id),
                state.round.defaultBet
              );
            }),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setPar: (par) =>
        set((state) => {
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === state.round.currentHole ? { ...hole, par } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setHoleHandicap: (handicapIndex) =>
        set((state) => {
          const normalized = Math.min(18, Math.max(1, Math.floor(handicapIndex || 1)));
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === state.round.currentHole ? { ...hole, handicapIndex: normalized } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setWager: (playerId, amount) =>
        set((state) => {
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === state.round.currentHole
                ? {
                    ...hole,
                    matchups: hole.matchups.map((m) =>
                      m.playerId === playerId ? { ...m, baseWager: Number.isFinite(amount) ? Math.max(0, amount) : 0 } : m
                    ),
                  }
                : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      togglePlayerPress: (playerId) =>
        set((state) => {
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === state.round.currentHole
                ? {
                    ...hole,
                    matchups: hole.matchups.map((m) => (m.playerId === playerId ? { ...m, pressed: !m.pressed } : m)),
                  }
                : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      toggleBankerPress: () =>
        set((state) => {
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === state.round.currentHole ? { ...hole, bankerPressed: !hole.bankerPressed } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setPlayerGrossScore: (playerId, score) =>
        set((state) => {
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === state.round.currentHole
                ? { ...hole, matchups: hole.matchups.map((m) => (m.playerId === playerId ? { ...m, grossScore: score } : m)) }
                : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      setBankerGrossScore: (score) =>
        set((state) => {
          const round = {
            ...state.round,
            holes: state.round.holes.map((hole) =>
              hole.holeNumber === state.round.currentHole ? { ...hole, bankerGrossScore: score } : hole
            ),
          };
          return { round, ledger: recalcLedger(round) };
        }),

      updateHole: () => {
        const { round } = get();
        const hole = activeHole(round);
        if (hole.bankerGrossScore == null || hole.matchups.some((matchup) => matchup.grossScore == null)) {
          return { ok: false, message: 'Enter all gross scores before updating the hole.' };
        }

        const nextRound = {
          ...round,
          holes: round.holes.map((item) => (item.holeNumber === hole.holeNumber ? { ...item, isSaved: true } : item)),
        };
        set({ round: nextRound, ledger: recalcLedger(nextRound) });
        return { ok: true, message: `Hole ${hole.holeNumber} updated.` };
      },

      nextHole: () => {
        const { round } = get();
        const hole = activeHole(round);
        if (hole.bankerGrossScore == null || hole.matchups.some((matchup) => matchup.grossScore == null)) {
          return { ok: false, message: 'Enter all gross scores before moving to the next hole.' };
        }

        let nextRound = {
          ...round,
          holes: round.holes.map((item) => (item.holeNumber === hole.holeNumber ? { ...item, isSaved: true } : item)),
        };

        if (round.currentHole < round.totalHoles) {
          nextRound = buildNextHole(nextRound, round.currentHole + 1);
        }
        set({ round: nextRound, ledger: recalcLedger(nextRound) });

        if (round.currentHole >= round.totalHoles) {
          return { ok: true, message: 'Hole 18 updated. Round complete.' };
        }
        return { ok: true, message: `Moved to Hole ${round.currentHole + 1}.` };
      },

      getRunningTotals: () => {
        const { round } = get();
        return buildRunningTotalsFromLedger(round, recalcLedger(round)).map((item) => ({
          playerId: item.playerId,
          name: item.playerName,
          amount: item.amount,
        }));
      },

      getCurrentHoleSummary: () => {
        const { round } = get();
        return buildCurrentHoleSummary(round, activeHole(round));
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
          .sort((a, b) => a.holeNumber - b.holeNumber)
          .map((hole) => {
            const summary = buildCurrentHoleSummary(round, hole);
            runningLedger = [...runningLedger, ...buildLedgerEntries(hole.bankerPlayerId, getHoleResults(round, hole))];
            return {
              holeNumber: hole.holeNumber,
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
