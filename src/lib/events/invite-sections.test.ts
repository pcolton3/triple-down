import { describe, expect, it } from 'vitest';
import { composeDescription, formatFromDays, parseDescription, sideGamesFromDays, tidyDescription } from './invite-sections';

const empty = { message: '', format: '', side_games: '', rules: '', other: '' };

describe('invite sections', () => {
  it('round-trips every keystroke, including trailing newlines', () => {
    for (const parts of [
      { ...empty, message: 'Hi all' },
      { ...empty, message: 'Hi\n', format: '- Day 1\n', rules: 'Gimmes inside the leather' },
      { ...empty, side_games: 'Skins', other: 'Dinner\n\n' },
      { ...empty, message: 'Line one\n\nLine two', format: 'A\n\nB' },
    ]) {
      expect(parseDescription(composeDescription(parts))).toEqual(parts);
    }
  });

  it('splits an existing description at its known headings and keeps unknown ones as text', () => {
    const text = 'Intro.\n\nFORMAT\n- Sat: team\n\nHANDICAPS\n- Low man\n\nSide games:\n- Skins\n\nOther activities\nDinner';
    const parts = parseDescription(text);
    expect(parts.message).toBe('Intro.');
    expect(parts.format).toBe('- Sat: team\n\nHANDICAPS\n- Low man');
    expect(parts.side_games).toBe('- Skins');
    expect(parts.other).toBe('Dinner');
    expect(tidyDescription(text)).toBe('Intro.\n\nFORMAT\n- Sat: team\n\nHANDICAPS\n- Low man\n\nSIDE GAMES\n- Skins\n\nOTHER ACTIVITIES\nDinner');
  });

  it('treats a description with no headings as the message', () => {
    expect(parseDescription('Just come play.')).toEqual({ ...empty, message: 'Just come play.' });
    expect(tidyDescription('  hi \n')).toBe('hi');
  });

  it('builds starter text from the golf days', () => {
    const days = [
      { day: 1, date: '2027-04-24', format: 'team_match' as const, course: 'Wigwam Gold', games: [{ key: 'skins', amount: 50 }] },
      { day: 2, date: '2027-04-25', format: 'singles_match' as const, games: [{ key: 'skins', amount: 50 }] },
    ];
    expect(formatFromDays(days)).toBe('- Saturday, Apr 24: Team match play · 2 vs 2 low net at Wigwam Gold\n- Sunday, Apr 25: Singles match play · 1 vs 1 net');
    expect(sideGamesFromDays(days)).toBe('- Every day: Net skins ($50 per player)');
    expect(sideGamesFromDays([{ ...days[0], games: [] }])).toBe('');
  });
});
