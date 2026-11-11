import { describe, expect, it } from 'vitest';
import { checkFoursomes, groupSizes, suggestFoursomes, type PlanPlayer } from './foursomes';

const field = (count: number): PlanPlayer[] =>
  Array.from({ length: count }, (_, index) => ({ id: `s${index}`, name: `P${index}`, handicap: index * 1.5, team: index % 2 === 0 ? 'team_one' : 'team_two' }));

describe('groupSizes', () => {
  it('uses as many foursomes as possible and never a group under 3', () => {
    expect(groupSizes(16)).toEqual([4, 4, 4, 4]);
    expect(groupSizes(15)).toEqual([4, 4, 4, 3]);
    expect(groupSizes(13)).toEqual([4, 3, 3, 3]);
    expect(groupSizes(5)).toEqual([5]);
    expect(groupSizes(9)).toEqual([3, 3, 3]);
  });
});

describe('suggestFoursomes', () => {
  it('team match: every foursome is 2 v 2 and the plan checks out', () => {
    const players = field(16);
    const plan = suggestFoursomes('team_match', players);
    expect(plan.groups).toHaveLength(4);
    expect(checkFoursomes('team_match', players, plan)).toEqual({ problems: [], warnings: [] });
  });

  it('singles: opponents share a foursome and are matched by handicap rank', () => {
    const players = field(16);
    const plan = suggestFoursomes('singles_match', players);
    expect(plan.pairings).toHaveLength(8);
    expect(plan.pairings[0]).toEqual(['s0', 's1']); // the two lowest handicaps on each team
    expect(checkFoursomes('singles_match', players, plan)).toEqual({ problems: [], warnings: [] });
  });

  it('singles with an odd player: everyone placed, the odd one flagged without an opponent', () => {
    const players = field(15);
    const plan = suggestFoursomes('singles_match', players);
    expect(plan.groups.flat().sort()).toEqual(players.map((p) => p.id).sort());
    const check = checkFoursomes('singles_match', players, plan);
    expect(check.problems).toEqual([]);
    expect(check.warnings).toEqual(['No singles opponent: P14 (they still play the other games).']);
  });

  it('team match with uneven teams: the unbalanced group is called out', () => {
    const players = field(15);
    const check = checkFoursomes('team_match', players, suggestFoursomes('team_match', players));
    expect(check.problems.some((problem) => /2 v 1|1 v 2|3 v 2|2 v 3/.test(problem))).toBe(true);
  });
});

describe('checkFoursomes', () => {
  const players = field(8);
  it('catches missing players, lopsided groups, split opponents and same-team pairs', () => {
    const check = checkFoursomes('singles_match', players, {
      groups: [['s0', 's2', 's4', 's6'], ['s1', 's3', 's5']],
      pairings: [['s0', 's1'], ['s2', 's4']],
    });
    expect(check.problems).toEqual(expect.arrayContaining([
      'Not in a group yet: P7.',
      'P0 and P1 are matched but in different groups, so they won\'t play each other.',
      'P2 and P4 are on the same team.',
    ]));
  });

  it('flags 3 v 1 in a team match', () => {
    const check = checkFoursomes('team_match', players, { groups: [['s0', 's2', 's4', 's1'], ['s6', 's3', 's5', 's7']], pairings: [] });
    expect(check.problems).toContain('Group 1 is 3 v 1; a team match needs the same number from each team.');
  });
});
