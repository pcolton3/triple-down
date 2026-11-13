import { describe, expect, it } from 'vitest';
import { cleanTeeTimeResult, keepCheckedCourses, parseTeeTimes, teeTimeRequestText, type TeeTimeOption } from './tee-times';

describe('tee-time finder', () => {
  it('puts the course first and never trusts a marketplace labeled as the course', () => {
    const result = cleanTeeTimeResult({
      reply: 'Book direct.',
      course: { name: 'Wigwam', website: 'https://www.wigwamarizona.com', phone: '623-935-3811', email: 'not an email', contact: '' },
      bookable_now: 'maybe',
      booking_window: '',
      group_policy: '',
      options: [
        { title: 'GolfNow', url: 'https://www.golfnow.com/tee-times/facility/116', source: 'course', price: '', notes: '' },
        { title: 'Supreme', url: 'https://supremegolf.com/x', source: 'third_party', price: '', notes: '' },
        { title: 'Book online', url: 'https://wigwam.book.teeitup.com', source: 'course', price: '$139', notes: '' },
        { title: 'Dup', url: 'https://wigwam.book.teeitup.com', source: 'course', price: '', notes: '' },
        { title: 'Bad', url: 'javascript:alert(1)', source: 'course', price: '', notes: '' },
      ],
      email: { to: '', subject: 'Tee times', body: 'Hi' },
      call_notes: '',
    });
    expect(result.options.map((option) => [option.title, option.source])).toEqual([
      ['Book online', 'course'],
      ['GolfNow', 'third_party'],
      ['Supreme', 'third_party'],
    ]);
    expect(result.bookable_now).toBe('unknown');
    expect(result.course.email).toBe('');
  });

  it('adds the course website when no direct option came back', () => {
    const result = cleanTeeTimeResult({ course: { website: 'https://course.example' }, options: [{ title: 'GolfNow', url: 'https://golfnow.com/a', source: 'third_party' }] });
    expect(result.options[0]).toMatchObject({ url: 'https://course.example', source: 'course' });
    expect(cleanTeeTimeResult(null).options).toEqual([]);
  });

  it('uses the course email for the request when the draft has none', () => {
    expect(cleanTeeTimeResult({ course: { email: 'golf@course.com' }, email: { to: '' } }).email.to).toBe('golf@course.com');
  });

  it('reads booked times the way people type them', () => {
    expect(parseTeeTimes('7:48, 7:30,7:39')).toEqual(['07:30', '07:39', '07:48']);
    expect(parseTeeTimes('1:20, 12:50pm, 7 am')).toEqual(['07:00', '12:50', '13:20']);
    expect(parseTeeTimes('')).toEqual([]);
    expect(parseTeeTimes('soon')).toBeNull();
  });

  it('writes the request with the group size and tee-time count', () => {
    const text = teeTimeRequestText({ day: 1, date: '2027-04-24', course: 'Wigwam Gold', players: 12, teeTimes: 3, earliest: '07:30' });
    expect(text).toContain('12 players, so 3 tee times back to back, first one around 07:30');
  });
});

describe('planner: only courses with open times seen', () => {
  const option = (url: string): TeeTimeOption => ({ title: url, url, source: 'course', price: '', notes: '' });
  const links = [
    option('https://www.cavecreekgolf.com/tee-times'),
    option('https://city-of-phoenix-golf-courses.book.teeitup.com/?course=288'),
    option('https://www.chronogolf.com/club/wigwam-resort'),
    option('https://www.dovevalleyranch.com/'),
  ];

  it('drops courses whose tee sheet showed no open times', () => {
    const seen = ['https://cavecreekgolf.com/', 'https://city-of-phoenix-golf-courses.book.teeitup.com/?course=288&date=2026-11-14'];
    expect(keepCheckedCourses(links, seen).map((link) => link.url)).toEqual([
      'https://www.cavecreekgolf.com/tee-times',
      'https://city-of-phoenix-golf-courses.book.teeitup.com/?course=288',
    ]);
  });

  it('leaves links alone when no tee sheet showed times (e.g. planning a trip a year out)', () => {
    expect(keepCheckedCourses(links, [])).toEqual(links);
  });
});
