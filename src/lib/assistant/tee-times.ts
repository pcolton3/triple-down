/**
 * Tee-time finder: the organizer picks a golf day, the assistant searches the web (course's own
 * site first), and returns booking options, a request email to the golf shop and call notes.
 * Nothing is booked or sent by the app; the organizer books, emails or calls themselves.
 */

export type TeeTimeSource = 'course' | 'third_party';
export type TeeTimeOption = { title: string; url: string; source: TeeTimeSource; price: string; notes: string };
export type TeeTimeResult = {
  reply: string;
  course: { name: string; website: string; phone: string; email: string; contact: string };
  bookable_now: 'yes' | 'no' | 'unknown';
  booking_window: string;
  group_policy: string;
  options: TeeTimeOption[];
  email: { to: string; subject: string; body: string };
  call_notes: string;
};

const str = (description: string) => ({ type: 'string', description });

/** One way to book: a link the model actually saw. */
export const BOOKING_OPTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'url', 'source', 'price', 'notes'],
  properties: {
    title: str('Short label, e.g. "Book on the course website" or "GolfNow".'),
    url: str('A URL you actually saw in search results or a fetched page.'),
    source: { type: 'string', enum: ['course', 'third_party'], description: "course = the course's own site or the booking engine it links to; third_party = a marketplace." },
    price: str('Price or range only if a page showed it (say which season), else "".'),
    notes: str('One line: player cap, prepay, cancellation, etc. "" if nothing.'),
  },
} as const;

/** Structured output for the finder. No nullable fields: "" means not found. */
export const TEE_TIME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'course', 'bookable_now', 'booking_window', 'group_policy', 'options', 'email', 'call_notes'],
  properties: {
    reply: str('Two to four sentences for the organizer: the best way to book this, cheapest first, and anything to watch for.'),
    course: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'website', 'phone', 'email', 'contact'],
      properties: {
        name: str('Course name as the course writes it.'),
        website: str("The course's own official website, or \"\"."),
        phone: str('Golf shop or group booking phone, or "".'),
        email: str('Golf shop or group/outing email, or "". Only an address you saw on a page.'),
        contact: str('Name and role of the group/outing contact if a page gives one, or "".'),
      },
    },
    bookable_now: { type: 'string', enum: ['yes', 'no', 'unknown'], description: 'Whether tee times for this date can be booked today.' },
    booking_window: str('How far ahead tee times open, and the date that means for this round (e.g. "30 days ahead: opens Mar 25, 2027"), or "".'),
    group_policy: str('What the course says about groups or outings (online booking cap, group minimum, deposits), or "".'),
    options: {
      type: 'array',
      description: "Ways to book, the course's own booking first. At most 6.",
      items: BOOKING_OPTION_SCHEMA,
    },
    email: {
      type: 'object',
      additionalProperties: false,
      required: ['to', 'subject', 'body'],
      properties: {
        to: str('The course email from above, or "".'),
        subject: str('Subject line.'),
        body: str('Plain-text tee-time request to the golf shop.'),
      },
    },
    call_notes: str('If calling: the number and 3-5 short things to ask, as "- " lines.'),
  },
} as const;

export const TEE_TIME_ROLE = `You find and line up tee times for one golf day of a Triple Track event. You don't book anything; the organizer books, emails or calls. You can see live open times only through check_tee_sheet.

Where to look, in this order:
1. The course's own official website. Search for it, then fetch its tee-times / book-online page and its group or outing page. Many courses book through an engine on another domain that the course site links to (foreUP, Chronogolf, TeeItUp, Club Caddie, EZLinks, Lightspeed, GolfBack and similar); that counts as the course's own booking, source "course". Booking direct is usually cheapest, so lead with it.
2. Only after that, third-party marketplaces (GolfNow, TeeOff, Supreme Golf, Golfscape and similar), source "third_party", and only if they list this course. Say they may cost more or add fees.

Live tee sheets: once you have a course's booking link (or its own tee-times page), call check_tee_sheet with the round's date and the group size. It reads TeeItUp, Quick18 and foreUP booking systems and returns the real open times, spots and prices, plus back-to-back times that fit the group. For Chronogolf it can't see times but says how far ahead the course books, whether the date is open yet, and the shop phone; pass that on. Report those in "reply" (the best back-to-back times first) and use the price it returns. If it says a site can't be read, give the link and move on; don't retry the same site.

Find: how far ahead public tee times open (and the date that means for this round, given today), whether this date is bookable today, the max players per online booking, what the course says about groups and outings (minimums, deposits, who to contact), the golf shop phone and email, and rates for that season if a page shows them. Never invent phone numbers, emails, prices, times or URLs; leave a field "" when you didn't see it. Groups of more than 4 need several tee times in a row (usually 8-10 minutes apart); for big groups, or before online booking opens, the golf shop is the way in, so say so.

The request email: from the organizer to the golf shop. Say the date, the course (and which course if it has several), how many players and tee times, the preferred first tee time and that the times should be back to back, carts if the organizer didn't say otherwise, and ask for rates, deposit and cancellation policy and how to confirm. Short, friendly, plain text, no placeholders like [Your name]: end with "Thanks," and no name. Use only facts from the event data and the organizer's request.`;

const MARKETPLACES = ['golfnow.com', 'teeoff.com', 'supremegolf.com', 'golfscape.com', 'golfpass.com', 'groupon.com', 'golfhub.com', 'golfadvisor.com', 'hotdealsgolf.com'];

function host(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isMarketplace(url: string) {
  const name = host(url);
  return MARKETPLACES.some((domain) => name === domain || name.endsWith(`.${domain}`));
}

const text = (value: unknown, max = 600) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const link = (value: unknown) => {
  const url = text(value, 500);
  return /^https?:\/\//i.test(url) && host(url) ? url : '';
};

/** Booking links from the model: valid URLs only, marketplaces always third-party, course-direct first. */
export function cleanBookingOptions(raw: unknown): TeeTimeOption[] {
  return (Array.isArray(raw) ? (raw as Array<Record<string, unknown> | null>) : [])
    .map((option) => {
      const url = link(option?.url);
      const source: TeeTimeSource = isMarketplace(url) ? 'third_party' : option?.source === 'third_party' ? 'third_party' : 'course';
      return { title: text(option?.title, 120) || host(url), url, source, price: text(option?.price, 200), notes: text(option?.notes, 300) };
    })
    .filter((option: TeeTimeOption) => option.url)
    .filter((option: TeeTimeOption, index: number, list: TeeTimeOption[]) => list.findIndex((other) => other.url === option.url) === index)
    .sort((a: TeeTimeOption, b: TeeTimeOption) => (a.source === b.source ? 0 : a.source === 'course' ? -1 : 1))
    .slice(0, 8);
}

function sameSite(a: string, b: string) {
  const one = host(a);
  return Boolean(one) && one === host(b);
}

/**
 * Planner rule: once a tee sheet showed open times this turn, only courses whose open times were seen get links.
 * `seen` holds the links behind those sheets (what was checked, its booking page and each time's link).
 */
export function keepCheckedCourses(options: TeeTimeOption[], seen: string[]): TeeTimeOption[] {
  if (!seen.length) return options;
  return options.filter((option) => seen.some((url) => sameSite(option.url, url)));
}

/** Cleans what the model returned: known marketplaces are always third-party, and the course's own options come first. */
export function cleanTeeTimeResult(raw: unknown): TeeTimeResult {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const course = (value.course && typeof value.course === 'object' ? value.course : {}) as Record<string, unknown>;
  const email = (value.email && typeof value.email === 'object' ? value.email : {}) as Record<string, unknown>;
  const website = link(course.website);
  const options = cleanBookingOptions(value.options);
  // If the model found the course site but listed no direct option, still lead with it.
  if (website && !options.some((option) => option.source === 'course')) {
    options.unshift({ title: 'Course website', url: website, source: 'course', price: '', notes: 'Check here first; booking direct is usually cheapest.' });
  }
  const courseEmail = text(course.email, 120);
  const validEmail = (address: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : '');
  return {
    reply: text(value.reply, 1500),
    course: { name: text(course.name, 120), website, phone: text(course.phone, 40), email: validEmail(courseEmail), contact: text(course.contact, 120) },
    bookable_now: value.bookable_now === 'yes' || value.bookable_now === 'no' ? value.bookable_now : 'unknown',
    booking_window: text(value.booking_window, 300),
    group_policy: text(value.group_policy, 500),
    options,
    email: { to: validEmail(text(email.to, 120)) || validEmail(courseEmail), subject: text(email.subject, 200), body: text(email.body, 5000) },
    call_notes: text(value.call_notes, 1500),
  };
}

/** The organizer's request, as the model reads it. */
export function teeTimeRequestText(input: {
  day: number;
  date: string;
  course: string;
  address?: string;
  website?: string;
  players: number;
  teeTimes: number;
  earliest: string;
  notes?: string;
}) {
  return [
    `Find tee times for golf day ${input.day}${input.date ? ` on ${input.date}` : ' (date not set yet)'}.`,
    `Course: ${input.course}${input.address ? `, ${input.address}` : ''}${input.website ? ` (website on file: ${input.website})` : ''}.`,
    `Group: ${input.players} players, so ${input.teeTimes} tee time${input.teeTimes === 1 ? '' : 's'} back to back, first one around ${input.earliest || 'morning'}.`,
    input.notes?.trim() ? `Organizer's notes: ${input.notes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "7:30, 7:39 am, 15:48" -> ["07:30", "07:39", "15:48"]; null when something isn't a time. */
export function parseTeeTimes(value: string): string[] | null {
  const parts = value.split(/[,\n;]+/).map((part) => part.trim()).filter(Boolean);
  const times: string[] = [];
  for (const part of parts) {
    const match = part.toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? '0');
    const half = match[3]?.[0];
    if (half === 'p' && hour < 12) hour += 12;
    if (half === 'a' && hour === 12) hour = 0;
    // Nobody tees off at 1-5 AM: "1:20" means the afternoon.
    if (!half && hour >= 1 && hour <= 5) hour += 12;
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (!TIME.test(time)) return null;
    times.push(time);
  }
  return [...new Set(times)].sort();
}
