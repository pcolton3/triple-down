import { FORMAT_LABELS, formatEventDate, gameDefinition, type EventDay } from '@/lib/events/golf-events';
import { formatCurrency } from '@/lib/utils/currency';

/**
 * The event description is one text field in the database. The event form splits it into a
 * message plus these sections, each stored under its own heading line (e.g. "FORMAT"), so the
 * invite page, emails and the assistant all read the same text with no schema change.
 */
export const INVITE_SECTIONS = [
  { key: 'format', heading: 'FORMAT', title: 'Format', placeholder: 'How each day is played, how the teams score, what wins the Cup.' },
  { key: 'side_games', heading: 'SIDE GAMES', title: 'Side games', placeholder: 'Skins, closest to the pin, Banker… amounts and how each one pays.' },
  { key: 'rules', heading: 'RULES', title: 'Rules', placeholder: 'Handicaps, tees, gimmes, drops, pick-up rule.' },
  { key: 'other', heading: 'OTHER ACTIVITIES', title: 'Other activities', placeholder: 'Dinners, where you’re staying, travel, awards.' },
] as const;

export type InviteSectionKey = (typeof INVITE_SECTIONS)[number]['key'];
export type InviteParts = { message: string } & Record<InviteSectionKey, string>;

function headingKey(line: string): InviteSectionKey | null {
  const text = line.trim().replace(/:$/, '').trim().toUpperCase();
  return INVITE_SECTIONS.find((section) => section.heading === text)?.key ?? null;
}

/** Drops the blank line composeDescription puts before a heading (the line break itself went with the split). */
function stripSeparator(text: string) {
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}

export function parseDescription(description: string): InviteParts {
  const parts: InviteParts = { message: '', format: '', side_games: '', rules: '', other: '' };
  let current: keyof InviteParts = 'message';
  let buffer: string[] = [];
  const flush = (beforeHeading: boolean) => {
    const joined = buffer.join('\n');
    const text = beforeHeading ? stripSeparator(joined) : joined;
    // A heading that appears twice keeps both bodies.
    parts[current] = parts[current] ? `${parts[current]}\n\n${text}` : text;
  };
  const lines = (description ?? '').replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const key = headingKey(line);
    if (key) {
      flush(true);
      current = key;
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  flush(false);
  return parts;
}

/** Inverse of parseDescription; empty sections are left out. */
export function composeDescription(parts: InviteParts, { tidy = false } = {}): string {
  const clean = (text: string) => (tidy ? text.trim() : text);
  const blocks: string[] = [];
  if (clean(parts.message)) blocks.push(clean(parts.message));
  for (const section of INVITE_SECTIONS) {
    const body = clean(parts[section.key]);
    if (body) blocks.push(`${section.heading}\n${body}`);
  }
  return blocks.join('\n\n');
}

/** Trims every part and drops empty sections; used when saving. */
export function tidyDescription(description: string) {
  return composeDescription(parseDescription(description), { tidy: true });
}

function dayLabel(day: EventDay) {
  return day.date ? formatEventDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' }) : `Day ${day.day}`;
}

/** Starter text for the Format box, from each golf day's format. */
export function formatFromDays(days: EventDay[]) {
  return days.map((day) => `- ${dayLabel(day)}: ${FORMAT_LABELS[day.format] ?? day.format}${day.course ? ` at ${day.course}` : ''}`).join('\n');
}

/** Starter text for the Side games box, from each golf day's games. */
export function sideGamesFromDays(days: EventDay[]) {
  const describe = (day: EventDay) =>
    (day.games ?? [])
      .map((game) => {
        const definition = gameDefinition(game.key);
        const amount = game.amount ? ` (${formatCurrency(game.amount)} ${definition.kind === 'pot' ? 'per player' : 'per bet'})` : '';
        return `${definition.label}${amount}`;
      })
      .join(', ');
  const lines = days.filter((day) => day.games?.length).map((day) => ({ label: dayLabel(day), games: describe(day) }));
  if (!lines.length) return '';
  if (lines.every((line) => line.games === lines[0].games)) return `- Every day: ${lines[0].games}`;
  return lines.map((line) => `- ${line.label}: ${line.games}`).join('\n');
}
