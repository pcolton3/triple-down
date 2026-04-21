import type { BankerMatchupResult } from './types';

export type LedgerEntry = {
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
  reason: string;
};

export function buildLedgerEntries(
  bankerPlayerId: string,
  results: BankerMatchupResult[]
): LedgerEntry[] {
  return results
    .filter((result) => result.result !== 'push' && result.finalAmount > 0)
    .map((result) => {
      if (result.result === 'player_wins') {
        return {
          fromPlayerId: bankerPlayerId,
          toPlayerId: result.playerId,
          amount: result.finalAmount,
          reason: result.reason,
        };
      }

      return {
        fromPlayerId: result.playerId,
        toPlayerId: bankerPlayerId,
        amount: result.finalAmount,
        reason: result.reason,
      };
    });
}
