import { describe, expect, it } from 'vitest';
import type { HoleState, Player, RoundState } from '@/types/round';
import { sideBetDebts, sideBetProgress, type SideBet } from './side-bets';

// Tim is in group 1, Joe in group 2. Joe gets 18 strokes (one a hole).
const players: Player[] = [
  { id: 'tim', name: 'Tim', handicap: 0 },
  { id: 'x', name: 'X', handicap: 0 },
  { id: 'joe', name: 'Joe', handicap: 18 },
  { id: 'y', name: 'Y', handicap: 0 },
];

function hole(group: number, number: number, scores: Record<string, number | null>, saved = true): HoleState {
  const ids = group === 1 ? ['tim', 'x'] : ['joe', 'y'];
  return {
    groupNumber: group, holeNumber: number, par: 4, handicapIndex: number, isSaved: saved,
    bankerPlayerId: ids[0], bankerGrossScore: scores[ids[0]] ?? null, bankerPressed: false,
    matchups: [{ playerId: ids[1], baseWager: 0, pressed: false, grossScore: scores[ids[1]] ?? 4 }],
  };
}

function round(timScores: number[], joeScores: number[], joeSaved = joeScores.length): RoundState {
  const holes = [
    ...Array.from({ length: 18 }, (_, i) => hole(1, i + 1, { tim: timScores[i] ?? null }, i < timScores.length)),
    ...Array.from({ length: 18 }, (_, i) => hole(2, i + 1, { joe: joeScores[i] ?? null }, i < joeSaved)),
  ];
  return {
    id: 'r', roundCode: 'R', title: 'T', courseName: 'C', currentHole: 1, totalHoles: 18, defaultBet: 0, players, holes, gameSettings: {},
    multiFoursome: {
      enabled: true, groupSize: 4, groups: [{ groupNumber: 1, currentHole: 1 }, { groupNumber: 2, currentHole: 1 }],
      groupPlayers: [{ playerId: 'tim', groupNumber: 1, sortOrder: 0 }, { playerId: 'x', groupNumber: 1, sortOrder: 1 }, { playerId: 'joe', groupNumber: 2, sortOrder: 0 }, { playerId: 'y', groupNumber: 2, sortOrder: 1 }],
    },
  } as unknown as RoundState;
}

const bet = (kind: SideBet['kind'], status: SideBet['status'] = 'accepted'): SideBet => ({
  id: 'b', roundId: 'r', kind, amount: 20, proposerKey: 'tim', opponentKey: 'joe', status, proposerDeviceId: null, createdAt: '',
});

describe('side bets', () => {
  it('compares only holes both golfers have finished, across groups', () => {
    // Tim shoots 4s; Joe shoots 5s (net 4s) through 9 but Joe's group is only through 6.
    const progress = sideBetProgress(round(Array(9).fill(4), Array(9).fill(5), 6), bet('low_net_18'));
    expect(progress.holesCompared).toBe(6);
    expect(progress.thru).toEqual([9, 6]);
    expect(progress.margin).toBe(0);
    expect(progress.summary).toBe('All square (Tim thru 9, Joe thru 6)');
    expect(progress.final).toBe(false);
  });

  it('pays the stake when an accepted bet finishes, and nothing for ties or pending bets', () => {
    // Joe nets 4 on every hole except one 6 (net 5): Tim wins by 1 stroke.
    const joe = Array(18).fill(5);
    joe[3] = 6;
    const finished = round(Array(18).fill(4), joe);
    expect(sideBetProgress(finished, bet('low_net_18')).summary).toBe('Tim wins by 1 stroke');
    expect(sideBetDebts(finished, [bet('low_net_18')])).toEqual([{ fromId: 'joe', fromName: 'Joe', toId: 'tim', toName: 'Tim', amount: 20, reason: 'Side bet' }]);
    expect(sideBetDebts(finished, [bet('low_net_18', 'pending')])).toEqual([]);
    expect(sideBetDebts(round(Array(18).fill(4), Array(18).fill(5)), [bet('low_net_18')])).toEqual([]);
  });

  it('uses gross for the gross bet and only the back 9 for the back-9 bet', () => {
    const joe = Array(18).fill(5);
    const r = round(Array(18).fill(4), joe);
    expect(sideBetProgress(r, bet('low_gross_18')).summary).toBe('Tim wins by 18 strokes');
    expect(sideBetProgress(round(Array(9).fill(4), Array(9).fill(5)), bet('low_net_back')).summary).toBe('Not started yet');
  });

  it('match play counts holes won', () => {
    const joe = Array(18).fill(5);
    joe[0] = 4; // net 3 beats Tim's 4
    joe[1] = 6; // net 5 loses
    joe[2] = 6;
    const progress = sideBetProgress(round(Array(18).fill(4), joe), bet('match_play_net'));
    expect(progress.margin).toBe(1);
    expect(progress.summary).toBe('Tim wins by 1 hole');
  });
});
