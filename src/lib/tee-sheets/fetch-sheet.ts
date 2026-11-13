/** Server only: fetches from booking systems and course sites. */
import {
  chronogolfNote,
  detectEngine,
  findEngineLinks,
  groupPicks,
  parseChronogolfClub,
  parseForeUpPage,
  parseForeUpTimes,
  parseQuick18,
  parseTeeItUp,
  type EngineRef,
  type TeeSheet,
} from '@/lib/tee-sheets/engines';

const UA = 'Mozilla/5.0 (compatible; TripleTrack tee-time lookup)';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const TEEITUP_API = 'https://phx-api-be-east-1b.kenna.io';
const MAX_BYTES = 1_500_000;

export class SheetError extends Error {}

async function get(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/json,*/*', ...headers },
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
    cache: 'no-store',
  });
  const text = (await response.text()).slice(0, MAX_BYTES);
  return { status: response.status, text, finalUrl: response.url };
}

/** Only public web hosts: no IPs, localhost or internal names (this fetches a page the organizer or model gave). */
function safePublicUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.port && url.port !== '443' && url.port !== '80') return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.endsWith('.local') || host.endsWith('.internal') || host === 'localhost') return null;
    return url;
  } catch {
    return null;
  }
}

function needDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new SheetError('Pick a date first.');
}

async function teeItUp(ref: Extract<EngineRef, { engine: 'teeitup' }>, date: string, players: number): Promise<TeeSheet[]> {
  const headers = { 'x-be-alias': ref.alias, 'User-Agent': UA };
  const facilities = await get(`${TEEITUP_API}/facilities`, headers);
  if (facilities.status !== 200) throw new SheetError("This course's TeeItUp tee sheet isn't open to outside apps. Use the booking link to see times.");
  const all = JSON.parse(facilities.text) as Array<{ id: number; courseId: string; name: string; timeZone?: string; isSimulator?: boolean }>;
  const chosen = all.filter((facility) => (ref.facilityIds.length ? ref.facilityIds.includes(String(facility.id)) : !facility.isSimulator)).slice(0, 6);
  if (!chosen.length) throw new SheetError('That TeeItUp link has no courses I can read.');
  const sheets = await Promise.all(
    chosen.map(async (facility) => {
      const response = await get(`${TEEITUP_API}/v2/tee-times?date=${date}&facilityIds=${facility.id}`, headers);
      const bookingUrl = `https://${ref.alias}.book.teeitup.com/?course=${facility.id}&date=${date}`;
      const times = response.status === 200 ? parseTeeItUp(JSON.parse(response.text), facility.timeZone ?? 'America/Phoenix', bookingUrl) : [];
      return {
        engine: 'teeitup' as const,
        course: facility.name,
        date,
        times,
        groupPicks: groupPicks(times, players),
        bookingUrl,
        note: response.status === 200 ? (times.length ? '' : 'No open times that day. It may be sold out or not open for booking yet.') : "Couldn't read this course's tee sheet right now.",
      };
    }),
  );
  return sheets;
}

async function quick18(ref: Extract<EngineRef, { engine: 'quick18' }>, date: string, players: number): Promise<TeeSheet[]> {
  const compact = date.replace(/-/g, '');
  const bookingUrl = `https://${ref.host}/teetimes/searchmatrix?teedate=${compact}`;
  const response = await get(bookingUrl);
  if (response.status !== 200) throw new SheetError("Couldn't read this course's Quick18 tee sheet.");
  const { course, times } = parseQuick18(response.text, ref.host);
  return [{
    engine: 'quick18',
    course,
    date,
    times,
    groupPicks: groupPicks(times, players),
    bookingUrl,
    note: times.length ? 'Shows the most players one booking allows; book each foursome separately.' : 'No open times that day. It may be sold out or not open for booking yet.',
  }];
}

async function foreUp(ref: Extract<EngineRef, { engine: 'foreup' }>, date: string, players: number): Promise<TeeSheet[]> {
  const page = await get(ref.url);
  if (page.status !== 200) throw new SheetError("Couldn't read this course's foreUP page.");
  const info = parseForeUpPage(page.text);
  const scheduleId = ref.scheduleId || info.scheduleId;
  const bookingUrl = `https://foreupsoftware.com/index.php/booking/${ref.courseId}${scheduleId ? `/${scheduleId}` : ''}`;
  if (!scheduleId || !info.bookingClass) {
    return [{ engine: 'foreup', course: info.courseName, date, times: [], groupPicks: [], bookingUrl, note: 'This course only shows tee times after you sign in to its booking site.' }];
  }
  const [year, month, day] = date.split('-');
  const query = new URLSearchParams({ time: 'all', date: `${month}-${day}-${year}`, holes: 'all', players: '0', booking_class: info.bookingClass, schedule_id: scheduleId, 'schedule_ids[]': scheduleId, specials_only: '0', api_key: 'no_limits' });
  const response = await get(`https://foreupsoftware.com/index.php/api/booking/times?${query}`, { 'x-requested-with': 'XMLHttpRequest', 'api-key': 'no_limits' });
  if (response.status === 401) {
    return [{ engine: 'foreup', course: info.courseName, date, times: [], groupPicks: [], bookingUrl, note: 'This course only shows tee times after you sign in to its booking site.' }];
  }
  if (response.status !== 200) throw new SheetError("Couldn't read this course's foreUP tee sheet.");
  const parsed = parseForeUpTimes(JSON.parse(response.text), bookingUrl);
  const times = parsed.times.filter((time) => time.spots > 0);
  return [{
    engine: 'foreup',
    course: parsed.course || info.courseName,
    date,
    times,
    groupPicks: groupPicks(times, players),
    bookingUrl,
    note: times.length ? '' : 'No open times that day. It may be sold out or not open for booking yet.',
  }];
}

function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Chronogolf: only the public club page (its tee-time feed is closed to outside apps). */
async function chronogolf(ref: Extract<EngineRef, { engine: 'chronogolf' }>, date: string): Promise<TeeSheet[]> {
  const page = await get(ref.url);
  const club = page.status === 200 ? parseChronogolfClub(page.text) : null;
  if (!club) throw new SheetError("Couldn't read this course's Chronogolf page. Use the link to check times.");
  const bookingUrl = `https://www.chronogolf.com/club/${club.slug || ref.club}`;
  return [{
    engine: 'chronogolf',
    course: club.name,
    date,
    times: [],
    groupPicks: [],
    bookingUrl,
    note: chronogolfNote(club, date, todayIn(club.timeZone)),
    liveTimes: false,
  }];
}

/** Resolves a link (a booking-system link or a course's own page that links to one) and reads that day's open tee times. */
export async function fetchTeeSheets(link: string, date: string, players: number): Promise<TeeSheet[]> {
  needDate(date);
  const direct = detectEngine(link);
  if (direct) return readSheet(direct, date, players);
  const url = safePublicUrl(link);
  if (!url) throw new SheetError("That link isn't a web page I can check.");
  const page = await get(url.toString());
  const redirected = detectEngine(page.finalUrl);
  const candidates = redirected ? [redirected] : findEngineLinks(page.text);
  if (!candidates.length) throw new SheetError("This course's booking page isn't one I can read yet (I can read TeeItUp, Quick18 and foreUP, and Chronogolf's course info). Use the link to check times.");
  let lastError: unknown = null;
  for (const ref of candidates) {
    try {
      return await readSheet(ref, date, players);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new SheetError("Couldn't read this course's tee sheet.");
}

function readSheet(ref: EngineRef, date: string, players: number) {
  if (ref.engine === 'teeitup') return teeItUp(ref, date, players);
  if (ref.engine === 'quick18') return quick18(ref, date, players);
  if (ref.engine === 'chronogolf') return chronogolf(ref, date);
  return foreUp(ref, date, players);
}
