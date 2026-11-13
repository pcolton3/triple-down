import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectEngine, findEngineLink, groupPicks, parseForeUpPage, parseForeUpTimes, parseQuick18, parseTeeItUp, type SheetTime } from './engines';

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const t = (time: string, spots: number): SheetTime => ({ time, spots, rates: [], holes: '', bookUrl: '' });

describe('booking-system links', () => {
  it('recognizes TeeItUp, Quick18 and foreUP links', () => {
    expect(detectEngine('https://city-of-phoenix-golf-courses.book.teeitup.com/?course=288')).toMatchObject({ engine: 'teeitup', alias: 'city-of-phoenix-golf-courses', facilityIds: ['288'] });
    expect(detectEngine('https://trilogyvistancia.quick18.com/')).toMatchObject({ engine: 'quick18', host: 'trilogyvistancia.quick18.com' });
    expect(detectEngine('https://foreupsoftware.com/index.php/booking/22389/10640#teetimes')).toMatchObject({ engine: 'foreup', courseId: '22389', scheduleId: '10640' });
    expect(detectEngine('https://foreupsoftware.com/index.php/booking/index/19035')).toMatchObject({ engine: 'foreup', courseId: '19035', scheduleId: '' });
    expect(detectEngine('https://www.golfnow.com/tee-times/facility/116')).toBeNull();
    expect(detectEngine('javascript:alert(1)')).toBeNull();
  });

  it("finds the booking link on a course's own page", () => {
    const html = '<a href="/about">About</a><a class="btn" href="https://dovevalley.book.teeitup.com/?course=1234&amp;date=2026-11-21">Book a tee time</a>';
    expect(findEngineLink(html)).toMatchObject({ engine: 'teeitup', alias: 'dovevalley', facilityIds: ['1234'] });
    expect(findEngineLink('<a href="https://example.com">x</a>')).toBeNull();
  });
});

describe('tee-sheet parsing (saved real responses)', () => {
  it('TeeItUp: UTC to course time, open spots, cents to dollars', () => {
    const times = parseTeeItUp(JSON.parse(fixture('teeitup-times.json')), 'America/Phoenix', 'https://x.book.teeitup.com/');
    expect(times[0]).toMatchObject({ time: '12:40', spots: 1, rates: [{ label: '18 Holes', price: 83 }], holes: '18' });
    expect(times[1]).toMatchObject({ time: '13:44', spots: 4, rates: [{ price: 68 }] });
  });

  it('Quick18: course name, rate columns and the booking link per time', () => {
    const { course, times } = parseQuick18(fixture('quick18-matrix.html'), 'trilogyvistancia.quick18.com');
    expect(course).toBe('Trilogy at Vistancia');
    expect(times[0]).toMatchObject({
      time: '12:00',
      spots: 1,
      rates: [{ label: 'Out of State', price: 146 }, { label: 'Arizona Residents', price: 135 }],
      bookUrl: 'https://trilogyvistancia.quick18.com/teetimes/course/1078/teetime/202611151200?psid=6008&p=0',
    });
    expect(times.at(-1)).toMatchObject({ time: '16:57', spots: 4 });
  });

  it('foreUP: picks the public booking class, reads times and fees', () => {
    expect(parseForeUpPage(fixture('foreup-page.html'))).toEqual({ scheduleId: '10640', courseName: 'Tot Hill Farm Golf Club', bookingClass: '48653' });
    const { course, times } = parseForeUpTimes(JSON.parse(fixture('foreup-times.json')), 'https://foreupsoftware.com/index.php/booking/22389/10640');
    expect(course).toBe('Tot Hill Farm Golf Club');
    expect(times[0]).toMatchObject({ time: '08:00', spots: 1, rates: [{ label: 'With cart', price: 180 }] });
  });
});

describe('back-to-back picks for a group', () => {
  it('finds the earliest run with room for everyone', () => {
    const sheet = [t('07:00', 2), t('07:10', 4), t('07:20', 4), t('07:30', 4)];
    expect(groupPicks(sheet, 8)).toEqual(['07:10', '07:20']);
    expect(groupPicks(sheet, 6)).toEqual(['07:00', '07:10']);
    expect(groupPicks(sheet, 4)).toEqual(['07:10']);
    expect(groupPicks(sheet, 12)).toEqual(['07:10', '07:20', '07:30']);
  });

  it('skips runs with a big gap or not enough room', () => {
    expect(groupPicks([t('07:00', 4), t('08:00', 4)], 8)).toEqual([]);
    expect(groupPicks([t('07:00', 4), t('07:10', 1), t('07:20', 4), t('07:30', 4)], 8)).toEqual(['07:20', '07:30']);
  });
});
