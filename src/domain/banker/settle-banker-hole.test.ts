import { describe, expect, it } from 'vitest';
import { settleBankerHole } from './settle-banker-hole';

const hole = (bankerGross: number, bankerNet: number, playerGross: number, playerNet: number) =>
  settleBankerHole({
    par: 4,
    bankerPlayerId: 'b',
    bankerGrossScore: bankerGross,
    bankerNetScore: bankerNet,
    matchups: [{ playerId: 'p', baseWager: 5, pressCount: 0, playerGrossScore: playerGross, playerNetScore: playerNet }],
  })[0];

describe('settleBankerHole', () => {
  it('lower net wins with no automatic double when both make a gross birdie', () => {
    const result = hole(3, 3, 3, 2); // player had a pop: net 2 vs net 3
    expect(result.result).toBe('player_wins');
    expect(result.birdieMultiplier).toBe(1);
    expect(result.finalAmount).toBe(5);
  });

  it('presses still count when both birdie', () => {
    const [result] = settleBankerHole({
      par: 4, bankerPlayerId: 'b', bankerGrossScore: 3, bankerNetScore: 3,
      matchups: [{ playerId: 'p', baseWager: 5, pressCount: 2, playerGrossScore: 3, playerNetScore: 2 }],
    });
    expect(result.birdieMultiplier).toBe(1);
    expect(result.finalAmount).toBe(5 * result.pressMultiplier);
    expect(result.pressMultiplier).toBeGreaterThan(1);
  });

  it('one gross birdie doubles the bet', () => {
    const result = hole(4, 4, 3, 3);
    expect(result.birdieMultiplier).toBe(2);
  });

  it('still pushes on the same net score', () => {
    expect(hole(3, 3, 3, 3).result).toBe('push');
  });
});
