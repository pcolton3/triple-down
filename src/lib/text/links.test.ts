import { describe, expect, it } from 'vitest';
import { splitLinks } from './links';

describe('splitLinks', () => {
  it('finds web addresses and leaves sentence punctuation outside', () => {
    expect(splitLinks('Book at https://www.chronogolf.com/club/wigwam-resort. Or www.wigwamgolf.com, then call.')).toEqual([
      { text: 'Book at ' },
      { text: 'https://www.chronogolf.com/club/wigwam-resort', href: 'https://www.chronogolf.com/club/wigwam-resort' },
      { text: '.' },
      { text: ' Or ' },
      { text: 'www.wigwamgolf.com', href: 'https://www.wigwamgolf.com' },
      { text: ',' },
      { text: ' then call.' },
    ]);
  });

  it('keeps query strings and leaves plain text alone', () => {
    expect(splitLinks('(see https://x.book.teeitup.com/?course=1&date=2026-11-21)')).toEqual([
      { text: '(see ' },
      { text: 'https://x.book.teeitup.com/?course=1&date=2026-11-21', href: 'https://x.book.teeitup.com/?course=1&date=2026-11-21' },
      { text: ')' },
    ]);
    expect(splitLinks('Tee off at 7:30.')).toEqual([{ text: 'Tee off at 7:30.' }]);
  });
});
