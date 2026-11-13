'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BuyInCard, EventSchedule, InviteDescription, eventDateRange } from '@/components/events/event-details';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { completeChoices, isTeamEvent, loadGolfEvent, loadRoster, rememberJoinedEvent, signUp, type GolfEvent, type RosterEntry, type SignupChoices } from '@/lib/events/golf-events';
import { ChoicesEditor } from '@/components/events/signup-choices';
import { ShareEventCard } from '@/components/events/share-event';
import { EventAssistant } from '@/components/events/event-assistant';
import { AnnouncementsBanner } from '@/components/events/announcements';

const inputClass = 'min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base';

function readSaved(code: string) {
  try {
    return JSON.parse(localStorage.getItem(`triple-track-signup:${code}`) ?? 'null') as { name: string; email: string; handicap: string; choices?: SignupChoices } | null;
  } catch {
    return null;
  }
}

export default function JoinEventPage() {
  const params = useParams<{ eventCode: string }>();
  const code = params.eventCode?.toUpperCase() ?? '';
  const [event, setEvent] = useState<GolfEvent | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [handicap, setHandicap] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [signedUp, setSignedUp] = useState(false);
  const [choices, setChoices] = useState<SignupChoices>({});

  const refresh = useCallback(async () => {
    const [nextEvent, nextRoster] = await Promise.all([loadGolfEvent(code), loadRoster(code)]);
    setEvent(nextEvent);
    setRoster(nextRoster);
    setStatus(nextEvent ? 'ready' : 'not_found');
    if (nextEvent && readSaved(code)) rememberJoinedEvent(nextEvent.code, nextEvent.title);
  }, [code]);

  useEffect(() => {
    if (!code) return;
    const saved = readSaved(code);
    if (saved) {
      setName(saved.name);
      setEmail(saved.email);
      setHandicap(saved.handicap);
      if (saved.choices) setChoices(saved.choices);
      setSignedUp(true);
    }
    refresh().catch((error: Error) => {
      setLoadError(error.message);
      setStatus('error');
    });
  }, [code, refresh]);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const handicapValue = Number(handicap);
    if (!handicap.trim() || !Number.isFinite(handicapValue)) {
      setMessage({ tone: 'error', text: 'Enter your handicap index (use 0 if you are not sure).' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const finalChoices = event ? completeChoices(event, choices) : undefined;
      const result = await signUp(code, name, email, handicapValue, finalChoices);
      try {
        localStorage.setItem(`triple-track-signup:${code}`, JSON.stringify({ name: name.trim(), email: email.trim(), handicap, choices: finalChoices }));
      } catch {
        /* Signup is saved on the server either way. */
      }
      setSignedUp(true);
      setMessage({ tone: 'ok', text: result === 'updated' ? 'Your details were updated.' : "You're in! See you on the first tee." });
      await refresh();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to sign up. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <main className="mx-auto max-w-lg px-4 py-8 text-slate-600" role="status">Loading event…</main>;
  if (status === 'error') return <main className="mx-auto max-w-lg px-4 py-8 text-red-700" role="alert">{loadError}</main>;
  if (status === 'not_found' || !event) {
    return <main className="mx-auto max-w-lg px-4 py-8 text-slate-600">No event was found for code {code}. Check the link you were sent.</main>;
  }

  const full = event.max_players != null && roster.length >= event.max_players;
  const canSignUp = event.signups_open && (!full || signedUp);

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <section className="rounded-3xl bg-[#071b12] p-5 text-white shadow-sm">
        <p className="text-sm text-white/80">You&apos;re invited</p>
        <h1 className="mt-1 text-3xl font-bold">{event.title}</h1>
        <p className="mt-2 text-sm font-semibold">{eventDateRange(event)}</p>
        {event.days.length ? (
          <p className="mt-1 text-sm text-white/80">
            {event.days.length} day{event.days.length === 1 ? '' : 's'} of golf
            {isTeamEvent(event) ? ` · Ryder Cup style · ${event.team_one_name} vs ${event.team_two_name}` : ''}
          </p>
        ) : null}
      </section>

      <AnnouncementsBanner scope="event" code={event.code} />

      <InviteDescription description={event.description} />

      <Card>
        <h2 className="text-xl font-bold">{signedUp ? 'Your signup' : 'Sign up'}</h2>
        {canSignUp ? (
          <form className="mt-3 space-y-3" onSubmit={(formEvent) => void handleSubmit(formEvent)}>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Name</span>
              <input className={inputClass} required minLength={2} maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Email</span>
              <input className={inputClass} required type="email" maxLength={120} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="mt-1 block text-xs text-slate-500">Only the organizer sees your email.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Handicap index</span>
              <input className={inputClass} required type="number" inputMode="decimal" step="0.1" min={-10} max={54} value={handicap} onChange={(e) => setHandicap(e.target.value)} />
              <span className="mt-1 block text-xs text-slate-500">Used for net scoring. Example: 12.4</span>
            </label>
            {event.days.length ? (
              <div>
                <p className="mb-2 text-sm font-semibold">Your days &amp; games</p>
                <ChoicesEditor event={event} value={choices} onChange={setChoices} disabled={saving} />
                {signedUp ? <p className="mt-2 text-xs text-slate-500">You can change these until that day&apos;s round starts. Tap Update my details to save.</p> : null}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving…' : signedUp ? 'Update my details' : "I'm in"}
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-slate-600">{full ? 'This event is full.' : 'Signups are closed. Contact the organizer if you need to make a change.'}</p>
        )}
        {message ? (
          <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.tone === 'ok' ? 'bg-[#e7f3e5] text-[#0f5132]' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </p>
        ) : null}
        {signedUp ? (
          <p className="mt-3 text-sm text-slate-600">
            Find this event again any time under <Link href="/events" className="font-semibold text-[#0f5132] underline">Your events</Link>.
          </p>
        ) : null}
      </Card>

      {canSignUp && !full ? <ShareEventCard event={event} dates={eventDateRange(event)} /> : null}

      <EventSchedule event={event} />
      <BuyInCard event={event} players={roster.length} roster={roster} />
      <EventAssistant mode="player" event={event} />

      <Card>
        <h2 className="mb-2 text-xl font-bold">
          Who&apos;s in ({roster.length}
          {event.max_players ? ` of ${event.max_players}` : ''})
        </h2>
        {roster.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {roster.map((entry, index) => (
              <li key={`${entry.name}-${index}`} className="flex justify-between gap-3 py-2">
                <span className="font-semibold">{entry.name}</span>
                <span className="text-slate-500">
                  {entry.team ? `${entry.team === 'team_one' ? event.team_one_name : event.team_two_name} · ` : ''}
                  {entry.handicap}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Be the first to sign up.</p>
        )}
      </Card>
    </main>
  );
}
