/**
 * Reading public tee sheets from the booking systems courses use (TeeItUp, Quick18, foreUP).
 * Chronogolf blocks outside apps from its tee-time feed, so for it we read only the public club page
 * (courses, how far ahead it books, phone) and send the organizer to its booking page.
 * These are the same public data feeds the courses' own booking pages read; they are not
 * official APIs and can change. Pure parsing lives here so it can be tested with saved responses.
 */

export type TeeSheetEngine = 'teeitup' | 'quick18' | 'foreup' | 'chronogolf';

export type EngineRef =
  | { engine: 'teeitup'; alias: string; facilityIds: string[]; url: string }
  | { engine: 'quick18'; host: string; url: string }
  | { engine: 'foreup'; courseId: string; scheduleId: string; url: string }
  | { engine: 'chronogolf'; club: string; url: string };

export type SheetRate = { label: string; price: number };
export type SheetTime = { time: string; spots: number; rates: SheetRate[]; holes: string; bookUrl: string };
export type TeeSheet = {
  engine: TeeSheetEngine;
  course: string;
  date: string;
  times: SheetTime[];
  /** Earliest back-to-back times that fit the whole group, if any. */
  groupPicks: string[];
  bookingUrl: string;
  note: string;
  /** False when the booking system doesn't let us see its open times (Chronogolf). */
  liveTimes?: boolean;
};

export const ENGINE_LABELS: Record<TeeSheetEngine, string> = { teeitup: 'TeeItUp', quick18: 'Quick18', foreup: 'foreUP', chronogolf: 'Chronogolf' };

function parseUrl(raw: string) {
  try {
    const url = new URL(raw.trim().replace(/&amp;/g, '&'));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

/** Which booking system a link points at, or null. */
export function detectEngine(raw: string): EngineRef | null {
  const url = parseUrl(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const teeItUp = host.match(/^([a-z0-9-]+)\.book\.teeitup\.(?:com|golf)$/);
  if (teeItUp) {
    const facilityIds = (url.searchParams.get('course') ?? '').split(',').map((id) => id.trim()).filter((id) => /^\d+$/.test(id));
    return { engine: 'teeitup', alias: teeItUp[1], facilityIds, url: `https://${host}/${facilityIds.length ? `?course=${facilityIds.join(',')}` : ''}` };
  }
  const quick18 = host.match(/^([a-z0-9-]+)\.quick18\.com$/);
  if (quick18 && quick18[1] !== 'www') return { engine: 'quick18', host, url: `https://${host}/teetimes/searchmatrix` };
  if (host === 'foreupsoftware.com' || host === 'www.foreupsoftware.com') {
    const match = url.pathname.match(/\/index\.php\/booking\/(?:index\/)?(\d+)(?:\/(\d+))?/);
    if (match) return { engine: 'foreup', courseId: match[1], scheduleId: match[2] ?? '', url: `https://foreupsoftware.com/index.php/booking/${match[1]}${match[2] ? `/${match[2]}` : ''}` };
  }
  if (/^(?:www\.)?chronogolf\.(?:com|ca)$/.test(host)) {
    // /club/<slug-or-id>, /fr/club/..., /club/<id>/widget
    const club = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?club\/([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    if (club) return { engine: 'chronogolf', club, url: `https://www.chronogolf.com/club/${club}` };
  }
  return null;
}

/** Booking-system links on a course's own web page (its "Book a tee time" buttons), best first. */
export function findEngineLinks(html: string): EngineRef[] {
  const pattern = /https?:\/\/[^"'\s<>\\]*(?:book\.teeitup\.(?:com|golf)|quick18\.com|foreupsoftware\.com\/index\.php\/booking|chronogolf\.(?:com|ca)\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?club\/)[^"'\s<>\\]*/gi;
  const found: EngineRef[] = [];
  for (const match of html.matchAll(pattern)) {
    const ref = detectEngine(match[0].replace(/&amp;/g, '&'));
    if (ref && !found.some((other) => other.url === ref.url)) found.push(ref);
  }
  // Gift-card stores and members-only sheets are rarely what a visiting group wants.
  // Chronogolf goes last: its open times can't be read, so a readable engine on the same page wins.
  const rank = (ref: EngineRef) => (/store|member|gift/i.test(ref.url) ? 1 : 0) + (ref.engine === 'chronogolf' ? 2 : 0);
  return found.sort((a, b) => rank(a) - rank(b)).slice(0, 4);
}

export function findEngineLink(html: string): EngineRef | null {
  return findEngineLinks(html)[0] ?? null;
}

/** "HH:MM" in the course's own time zone. */
export function localTime(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'America/Phoenix', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

function minutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

/** Earliest run of consecutive tee times (each within 20 minutes of the last) with room for everyone. */
export function groupPicks(times: SheetTime[], players: number): string[] {
  const group = Math.max(1, Math.round(players) || 1);
  const needed = Math.ceil(group / 4);
  const open = times.filter((time) => time.spots > 0);
  for (let start = 0; start + needed <= open.length; start += 1) {
    const run = open.slice(start, start + needed);
    const gapsOk = run.every((time, index) => index === 0 || minutes(time.time) - minutes(run[index - 1].time) <= 20);
    const room = run.reduce((sum, time) => sum + Math.min(4, time.spots), 0);
    // Each tee time needs at least 2 of the group unless the group is that small.
    const fair = run.every((time) => time.spots >= Math.min(2, group));
    if (gapsOk && fair && room >= group) return run.map((time) => time.time);
  }
  return [];
}

/** Narrows a sheet to the requested start window ("HH:MM", either may be "") and re-picks back-to-back times there. */
export function fitToWindow(sheet: TeeSheet, players: number, startAfter: string, startBefore: string): TeeSheet {
  const valid = (value: string) => (/^\d{2}:\d{2}$/.test(value) ? value : '');
  const after = valid(startAfter);
  const before = valid(startBefore);
  if (!after && !before) return sheet;
  const times = sheet.times.filter((time) => (!after || time.time >= after) && (!before || time.time < before));
  return { ...sheet, times, groupPicks: groupPicks(times, players) };
}

function sortTimes(times: SheetTime[]) {
  return times.filter((time) => time.time).sort((a, b) => a.time.localeCompare(b.time));
}

type TeeItUpRate = { name?: string; holes?: number; greenFeeCart?: number; greenFeeWalking?: number };
type TeeItUpTime = { teetime?: string; maxPlayers?: number; rates?: TeeItUpRate[] };
type TeeItUpCourse = { courseId?: string; teetimes?: TeeItUpTime[] };

/** TeeItUp: /v2/tee-times returns one block per course; prices are in cents and times in UTC. */
export function parseTeeItUp(blocks: unknown, timeZone: string, bookUrl: string): SheetTime[] {
  const list = (Array.isArray(blocks) ? blocks : []) as TeeItUpCourse[];
  const times: SheetTime[] = [];
  for (const block of list) {
    for (const item of block.teetimes ?? []) {
      const rates = (item.rates ?? [])
        .map((rate) => ({ label: rate.name ?? '', price: (rate.greenFeeCart ?? rate.greenFeeWalking ?? 0) / 100 }))
        .filter((rate) => rate.price > 0);
      times.push({
        time: localTime(item.teetime ?? '', timeZone),
        spots: Math.max(0, Number(item.maxPlayers) || 0),
        rates: rates.filter((rate, index) => rates.findIndex((other) => other.label === rate.label) === index),
        holes: String(item.rates?.[0]?.holes ?? ''),
        bookUrl,
      });
    }
  }
  return sortTimes(times);
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function to24(text: string) {
  const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '';
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

/** Quick18: the search matrix is a server-rendered table, one price column per rate type. */
export function parseQuick18(html: string, host: string): { course: string; times: SheetTime[] } {
  const course = stripTags(html.match(/id="be_coursename"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
  const table = html.match(/<table class="matrixTable"[\s\S]*?<\/table>/)?.[0] ?? '';
  const labels = [...table.matchAll(/<th class="matrixHdrSched"[^>]*>([\s\S]*?)<\/th>/g)].map((match) => stripTags(match[1]).replace(/\s*\(\d+-\d+\)$/, ''));
  const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  const times: SheetTime[] = [];
  for (const row of body.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const time = to24(stripTags(row.match(/class="mtrxTeeTimes"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? ''));
    const playersText = stripTags(row.match(/class="matrixPlayers"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? '');
    const spots = Math.max(0, ...(playersText.match(/\d+/g) ?? ['0']).map(Number));
    const cells = [...row.matchAll(/<td class="matrixsched[^"]*"[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    const rates: SheetRate[] = [];
    let bookUrl = '';
    cells.forEach((cell, index) => {
      const price = Number(stripTags(cell.match(/class="mtrxPrice"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').replace(/[^\d.]/g, ''));
      const href = cell.match(/href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
      if (price > 0) rates.push({ label: labels[index] ?? '', price });
      if (!bookUrl && href) bookUrl = href.startsWith('http') ? href : `https://${host}${href.startsWith('/') ? '' : '/'}${href}`;
    });
    if (time && (rates.length || bookUrl)) times.push({ time, spots, rates, holes: '', bookUrl: bookUrl || `https://${host}/teetimes/searchmatrix` });
  }
  return { course, times: sortTimes(times) };
}

/** foreUP booking page: the schedule and the public booking class (others need a member login). */
export function parseForeUpPage(html: string): { scheduleId: string; courseName: string; bookingClass: string } {
  let scheduleId = '';
  const filter = html.match(/DEFAULT_FILTER\s*=\s*(\{[^;]*?\});/)?.[1];
  if (filter) {
    try { scheduleId = String((JSON.parse(filter) as { schedule_id?: number }).schedule_id ?? ''); } catch { /* fall through */ }
  }
  const courseName = html.match(/"course_name":"([^"]*)"/)?.[1]?.replace(/\\\//g, '/') ?? '';
  let bookingClass = '';
  for (const match of html.matchAll(/"booking_class_id":"(\d+)"([\s\S]{0,600})/g)) {
    const isProtected = match[2].match(/"online_booking_protected":"?(\d)/)?.[1] === '1';
    if (!isProtected) { bookingClass = match[1]; break; }
  }
  return { scheduleId, courseName, bookingClass };
}

type ForeUpTime = { time?: string; available_spots?: number; green_fee_18?: number; green_fee?: number; cart_fee_18?: number; cart_fee?: number; rate_type?: string; teesheet_holes?: number; course_name?: string };

/** foreUP /api/booking/times: local "YYYY-MM-DD HH:MM", prices in dollars. */
export function parseForeUpTimes(rows: unknown, bookUrl: string): { course: string; times: SheetTime[] } {
  const list = (Array.isArray(rows) ? rows : []) as ForeUpTime[];
  const times = list.map((row) => {
    const green = Number(row.green_fee_18 ?? row.green_fee) || 0;
    const cart = Number(row.cart_fee_18 ?? row.cart_fee) || 0;
    const price = Math.round((green + cart) * 100) / 100;
    return {
      time: row.time?.match(/(\d{2}:\d{2})$/)?.[1] ?? '',
      spots: Math.max(0, Number(row.available_spots) || 0),
      rates: price > 0 ? [{ label: row.rate_type === 'riding' ? 'With cart' : row.rate_type === 'walking' ? 'Walking' : '', price }] : [],
      holes: String(row.teesheet_holes ?? ''),
      bookUrl,
    };
  });
  return { course: list[0]?.course_name ?? '', times: sortTimes(times) };
}

export type ChronogolfClub = {
  name: string;
  slug: string;
  courses: string[];
  phone: string;
  timeZone: string;
  onlineBooking: boolean;
  /** Days ahead the public can book, if the club says. */
  bookingRange: number | null;
  singlePlayerRule: boolean;
};

/** Chronogolf club page: the club record in its Next.js page data. */
export function parseChronogolfClub(html: string): ChronogolfClub | null {
  const data = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!data) return null;
  type Club = {
    name?: string; slug?: string; phone?: string; timezone?: string;
    courses?: Array<{ name?: string }>;
    features?: { onlineBookingEnabled?: boolean; defaultPublicBookingRange?: number; singlePlayerRestrictionActivated?: boolean };
  };
  let club: Club | undefined;
  try {
    club = (JSON.parse(data) as { props?: { pageProps?: { club?: Club } } }).props?.pageProps?.club;
  } catch {
    return null;
  }
  if (!club?.name) return null;
  const range = Number(club.features?.defaultPublicBookingRange);
  return {
    name: club.name.trim(),
    slug: club.slug ?? '',
    courses: (club.courses ?? []).map((course) => (course.name ?? '').trim()).filter(Boolean),
    phone: club.phone ?? '',
    timeZone: club.timezone || 'America/Phoenix',
    onlineBooking: club.features?.onlineBookingEnabled !== false,
    bookingRange: Number.isFinite(range) && range > 0 ? range : null,
    singlePlayerRule: Boolean(club.features?.singlePlayerRestrictionActivated),
  };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** What we can tell the organizer about a Chronogolf course for that date, without its tee sheet. */
export function chronogolfNote(club: ChronogolfClub, date: string, today: string) {
  const parts = ["Chronogolf doesn't let outside apps see its open times, so check them on its booking page."];
  if (club.courses.length > 1) parts.push(`Courses: ${club.courses.join(', ')}.`);
  if (!club.onlineBooking) parts.push('This club has online booking turned off; call to book.');
  else if (club.bookingRange) {
    const opens = addDays(date, -club.bookingRange);
    parts.push(
      opens > today
        ? `The public can book ${club.bookingRange} days ahead, so ${longDate(date)} opens for booking on ${longDate(opens)}.`
        : `The public can book ${club.bookingRange} days ahead, so this date is open for booking now.`,
    );
  }
  if (club.singlePlayerRule) parts.push('It needs at least 2 players to book an empty tee time.');
  if (club.phone) parts.push(`Golf shop: ${club.phone}.`);
  return parts.join(' ');
}

/** A short text version for the assistant to read. */
export function sheetSummary(sheet: TeeSheet, limit = 40) {
  const shown = sheet.times.slice(0, limit).map((time) => `${time.time} ${time.spots} spot${time.spots === 1 ? '' : 's'}${time.rates.length ? ` ${time.rates.map((rate) => `$${rate.price}${rate.label ? ` ${rate.label}` : ''}`).join(' / ')}` : ''}`);
  return [
    sheet.liveTimes === false
      ? `${sheet.course || 'Course'} (${ENGINE_LABELS[sheet.engine]}), ${sheet.date}: open times can't be read.`
      : `${sheet.course || 'Course'} (${ENGINE_LABELS[sheet.engine]}), ${sheet.date}: ${sheet.times.length} open tee times${sheet.times.length > limit ? ` (first ${limit} shown)` : ''}.`,
    shown.join('; '),
    sheet.groupPicks.length ? `Back-to-back for the group: ${sheet.groupPicks.join(', ')}.` : sheet.times.length ? 'No back-to-back run fits the whole group.' : '',
    sheet.note,
    `Book at ${sheet.bookingUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
}
