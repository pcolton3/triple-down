/** A debt from one player to another, e.g. a banker result or a hole-in-one payment. */
export type Debt = { fromId: string; fromName: string; toId: string; toName: string; amount: number; reason: string };

export type NetTransfer = { fromId: string; fromName: string; toId: string; toName: string; amount: number; reasons: string[] };

export type PotWin = { playerId: string; playerName: string; amount: number; game: string };

export type PotCollection = { playerId: string; playerName: string; amount: number; games: Array<{ game: string; amount: number }> };

const cents = (value: number) => Math.round(value * 100) / 100;

/**
 * Nets debts between each pair of players, so two people only ever see one line between them
 * (Mike owes Jim $20 in Banker, Jim owes Mike $5 for an ace → "Mike pays Jim $15").
 */
export function netDebts(debts: Debt[]): NetTransfer[] {
  const pairs = new Map<string, { a: { id: string; name: string }; b: { id: string; name: string }; balance: number; reasons: Set<string> }>();
  debts.forEach((debt) => {
    if (!(debt.amount > 0) || debt.fromId === debt.toId) return;
    const [first, second] = [debt.fromId, debt.toId].sort();
    const key = `${first}|${second}`;
    const entry =
      pairs.get(key) ??
      (debt.fromId === first
        ? { a: { id: debt.fromId, name: debt.fromName }, b: { id: debt.toId, name: debt.toName }, balance: 0, reasons: new Set<string>() }
        : { a: { id: debt.toId, name: debt.toName }, b: { id: debt.fromId, name: debt.fromName }, balance: 0, reasons: new Set<string>() });
    // Positive balance: a owes b.
    entry.balance += debt.fromId === entry.a.id ? debt.amount : -debt.amount;
    entry.reasons.add(debt.reason);
    pairs.set(key, entry);
  });
  return [...pairs.values()]
    .map(({ a, b, balance, reasons }) => {
      const amount = cents(Math.abs(balance));
      const [from, to] = balance > 0 ? [a, b] : [b, a];
      return { fromId: from.id, fromName: from.name, toId: to.id, toName: to.name, amount, reasons: [...reasons] };
    })
    .filter((transfer) => transfer.amount >= 0.01)
    .sort((x, y) => y.amount - x.amount || x.fromName.localeCompare(y.fromName));
}

/** One line per winner covering every pot they won. */
export function collectPotWins(wins: PotWin[]): PotCollection[] {
  const byPlayer = new Map<string, PotCollection>();
  wins.forEach((win) => {
    if (!(win.amount > 0)) return;
    const entry = byPlayer.get(win.playerId) ?? { playerId: win.playerId, playerName: win.playerName, amount: 0, games: [] };
    entry.amount = cents(entry.amount + win.amount);
    const game = entry.games.find((item) => item.game === win.game);
    if (game) game.amount = cents(game.amount + win.amount);
    else entry.games.push({ game: win.game, amount: cents(win.amount) });
    byPlayer.set(win.playerId, entry);
  });
  return [...byPlayer.values()].sort((x, y) => y.amount - x.amount || x.playerName.localeCompare(y.playerName));
}
