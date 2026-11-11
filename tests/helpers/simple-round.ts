import type { HoleState, Player, RoundState } from '@/types/round';
import { useRoundStore } from '@/stores/round-store';

export type SimpleHole = {
  par: 3 | 4 | 5;
  index: number;
  /** Gross per player id; missing = null. */
  gross?: Record<string, number | null>;
  saved?: boolean;
  bankerId?: string;
  bankerPressed?: boolean;
  pressed?: string[];
  wager?: number;
  ctp?: string | null;
};

/** One-group round (or several via `groups`) built directly, then hydrated into the store. */
export function buildRound(players: Player[], holes: SimpleHole[], settings: Partial<RoundState['gameSettings']> = {}, groups?: string[][]): RoundState {
  const groupIds = groups ?? [players.map((p) => p.id)];
  const allHoles: HoleState[] = groupIds.flatMap((ids, g) => holes.map((hole, i) => {
    const banker = hole.bankerId && ids.includes(hole.bankerId) ? hole.bankerId : ids[0];
    return {
      groupNumber: g + 1,
      holeNumber: i + 1,
      par: hole.par,
      handicapIndex: hole.index,
      bankerPlayerId: banker,
      bankerGrossScore: hole.gross?.[banker] ?? null,
      bankerPressed: hole.bankerPressed ?? false,
      isSaved: hole.saved ?? true,
      ctpWinnerPlayerId: hole.ctp && ids.includes(hole.ctp) ? hole.ctp : null,
      matchups: ids.filter((id) => id !== banker).map((playerId) => ({
        playerId,
        baseWager: hole.wager ?? 10,
        pressed: hole.pressed?.includes(playerId) ?? false,
        grossScore: hole.gross?.[playerId] ?? null,
        bankerParticipant: true,
      })),
    };
  }));
  return {
    id: 'r', roundCode: 'RULES', title: 'Rules', courseName: 'C', currentHole: 1, totalHoles: holes.length, defaultBet: 10,
    players,
    holes: allHoles,
    multiFoursome: {
      enabled: groupIds.length > 1, groupSize: 4,
      groups: groupIds.map((_, g) => ({ groupNumber: g + 1, currentHole: 1 })),
      groupPlayers: groupIds.flatMap((ids, g) => ids.map((playerId, sortOrder) => ({ playerId, groupNumber: g + 1, sortOrder }))),
    },
    gameSettings: { bankerEnabled: true, skinsPot: 0, lowNetPot: 0, ctpPot: 0, excludedPlayers: {}, ...settings },
  } as RoundState;
}

export function load(round: RoundState) {
  useRoundStore.getState().hydrateRound(round);
  return useRoundStore.getState();
}

export const player = (id: string, handicap: number): Player => ({
  id, name: id.toUpperCase(), handicap, bankerParticipant: true, skinsParticipant: true, ctpParticipant: true, lowNetParticipant: true,
});

/** 18 holes, all par 4, stroke index = hole number unless overridden. */
export function eighteen(gross: (holeNumber: number) => Record<string, number>, overrides: Partial<Record<number, Partial<SimpleHole>>> = {}): SimpleHole[] {
  return Array.from({ length: 18 }, (_, i) => ({ par: 4 as const, index: i + 1, gross: gross(i + 1), ...overrides[i + 1] }));
}
