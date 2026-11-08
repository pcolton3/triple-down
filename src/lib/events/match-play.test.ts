import { describe, expect, it } from 'vitest';
import { scoreMatch } from './match-play';

describe('scoreMatch', () => {
  it('awards nothing while a match is undecided', () => {
    expect(scoreMatch(3, 1, 9, 18, 'A', 'B')).toEqual({ firstPoints: 0, secondPoints: 0, status: 'A 2 up thru 9' });
    expect(scoreMatch(2, 2, 6, 18, 'A', 'B').status).toBe('All square thru 6');
    expect(scoreMatch(0, 0, 0, 18, 'A', 'B').status).toBe('Not started');
  });
  it('awards 1 point once the lead exceeds holes remaining', () => {
    expect(scoreMatch(6, 1, 14, 18, 'A', 'B')).toEqual({ firstPoints: 1, secondPoints: 0, status: 'A wins 5 & 4' });
    expect(scoreMatch(2, 5, 16, 18, 'A', 'B')).toEqual({ firstPoints: 0, secondPoints: 1, status: 'B wins 3 & 2' });
  });
  it('flags dormie and settles on the last hole', () => {
    expect(scoreMatch(4, 2, 16, 18, 'A', 'B').status).toBe('A 2 up thru 16 (dormie)');
    expect(scoreMatch(5, 4, 18, 18, 'A', 'B')).toEqual({ firstPoints: 1, secondPoints: 0, status: 'A wins 1 up' });
  });
  it('splits a halved match', () => {
    expect(scoreMatch(4.5, 4.5, 18, 18, 'A', 'B')).toEqual({ firstPoints: 0.5, secondPoints: 0.5, status: 'Halved' });
  });
});
