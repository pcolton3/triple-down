import { collectPotWins, netDebts, type Debt } from '@/lib/offline/net-payments';
import { computeGroupGames } from '@/lib/games/group-games';
import { useRoundStore } from '@/stores/round-store';
import type { RoundState } from '@/types/round';

/**
 * Mirror of the money math in src/app/r/[roundCode]/settle/page.tsx (lines ~379-412, no saved snapshot):
 * banker settle-up + hole-in-one + group-game debts are netted per pair; pots are collected separately.
 * Keep in sync with the page if it changes.
 */
export function settlePage(round: RoundState) {
  const store = useRoundStore.getState();
  store.hydrateRound(round);
  const s = useRoundStore.getState();
  const r = s.round;
  const bankerSettlements = r.gameSettings?.bankerEnabled !== false ? s.getSettleUp() : [];
  const grossScores = s.getGrossTotals();
  const holeInOne = s.getHoleInOneSummary().payouts.filter((item) => item.amount > 0);
  const groupGameResults = computeGroupGames(r);

  const debts: Debt[] = bankerSettlements.map((item) => ({
    fromId: item.fromPlayerId, fromName: item.fromPlayerName, toId: item.toPlayerId, toName: item.toPlayerName, amount: item.amount, reason: 'Banker',
  }));
  holeInOne.forEach((winner) => {
    if (winner.payerCount <= 0 || winner.amount <= 0) return;
    const aceOptOuts = new Set(r.gameSettings.excludedPlayers?.hole_in_one ?? []);
    grossScores
      .filter((player) => player.playerId !== winner.playerId && !aceOptOuts.has(player.playerId))
      .forEach((payer) => debts.push({ fromId: payer.playerId, fromName: payer.playerName, toId: winner.playerId, toName: winner.playerName, amount: winner.amount / winner.payerCount, reason: 'Hole in one' }));
  });
  const groupDebts = groupGameResults.flatMap((result) => result.debts);
  debts.push(...groupDebts);

  const potLists = {
    Skins: s.getSkinsSummary().payouts.filter((item) => item.skins > 0),
    'Closest to the pin': s.getCtpSummary().payouts.filter((item) => item.wins > 0),
    'Low net': s.getLowNetSummary().payouts.filter((item) => item.amount > 0),
    Nassau: s.getNassauSummary().payouts.filter((item) => item.amount > 0),
    Stableford: s.getStablefordSummary().payouts.filter((item) => item.amount > 0),
    'Birdie pot': s.getBirdiePotSummary().payouts.filter((item) => item.amount > 0),
    'Eagle pot': s.getEaglePotSummary().payouts.filter((item) => item.amount > 0),
  };
  const potCollections = collectPotWins([
    ...Object.entries(potLists).flatMap(([game, winners]) => winners.map((winner) => ({ playerId: winner.playerId, playerName: winner.playerName, amount: winner.amount, game }))),
    ...groupGameResults.flatMap((result) => result.pots),
  ]);
  return {
    round: r,
    store: s,
    bankerSettlements,
    rawDebts: debts,
    transfers: netDebts(debts),
    potCollections,
    potLists,
    groupGameResults,
    runningTotals: s.getRunningTotals(),
  };
}
