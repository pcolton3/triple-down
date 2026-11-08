import { describe, expect, it } from 'vitest';
import { collectPotWins, netDebts } from './net-payments';

const debt = (fromId: string, toId: string, amount: number, reason = 'Banker') => ({
  fromId, fromName: fromId.toUpperCase(), toId, toName: toId.toUpperCase(), amount, reason,
});

describe('netDebts', () => {
  it('collapses debts in both directions into one line per pair', () => {
    const result = netDebts([debt('mike', 'jim', 20), debt('jim', 'mike', 5, 'Hole in one'), debt('mike', 'jim', 10)]);
    expect(result).toEqual([{ fromId: 'mike', fromName: 'MIKE', toId: 'jim', toName: 'JIM', amount: 25, reasons: ['Banker', 'Hole in one'] }]);
  });

  it('drops pairs that cancel out and ignores zero or self debts', () => {
    expect(netDebts([debt('a', 'b', 10), debt('b', 'a', 10), debt('c', 'c', 5), debt('a', 'c', 0)])).toEqual([]);
  });

  it('keeps separate pairs separate, largest first, rounded to cents', () => {
    const result = netDebts([debt('a', 'b', 1 / 3), debt('c', 'b', 40)]);
    expect(result.map((item) => [item.fromId, item.toId, item.amount])).toEqual([['c', 'b', 40], ['a', 'b', 0.33]]);
  });
});

describe('collectPotWins', () => {
  it('sums every pot a player won into one line', () => {
    const result = collectPotWins([
      { playerId: 'jim', playerName: 'Jim', amount: 30, game: 'Skins' },
      { playerId: 'jim', playerName: 'Jim', amount: 25, game: 'Nassau' },
      { playerId: 'amy', playerName: 'Amy', amount: 10, game: 'Skins' },
      { playerId: 'amy', playerName: 'Amy', amount: 0, game: 'Low net' },
    ]);
    expect(result).toEqual([
      { playerId: 'jim', playerName: 'Jim', amount: 55, games: [{ game: 'Skins', amount: 30 }, { game: 'Nassau', amount: 25 }] },
      { playerId: 'amy', playerName: 'Amy', amount: 10, games: [{ game: 'Skins', amount: 10 }] },
    ]);
  });
});
