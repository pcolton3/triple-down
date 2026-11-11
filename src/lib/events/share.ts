/** The public signup link and message a player sends to friends. Never includes the organizer key. */
export function eventInvite(origin: string, event: { code: string; title: string }, dates: string) {
  const url = `${origin}/join/${event.code}`;
  const text = `You're invited to ${event.title}${dates ? ` (${dates})` : ''}. See the details and sign up here:`;
  return { url, text };
}
