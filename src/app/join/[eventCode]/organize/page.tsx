'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BuyInCard, EventSchedule } from '@/components/events/event-details';
import { EventAssistant } from '@/components/events/event-assistant';
import { EventEditor, cleanDraft } from '@/components/events/event-editor';
import { ChoicesEditor, choicesSummary } from '@/components/events/signup-choices';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { formatCurrency } from '@/lib/utils/currency';
import {
  completeChoices,
  deleteGolfEvent,
  forgetSavedEvent,
  dayChoice,
  formatEventDate,
  isDayLocked,
  isTeamEvent,
  loadGolfEvent,
  playerBuyIn,
  loadSignups,
  organizerKeyStorageName as keyStorageName,
  rememberMyEvent,
  suggestedBuyIn,
  updateEvent,
  updateSignup,
  validateDraft,
  type EditableField,
  type EventDraft,
  type GolfEvent,
  type Signup,
  type SignupChoices,
  type TeamKey,
} from '@/lib/events/golf-events';

const EDITABLE: EditableField[] = ['title', 'description', 'days', 'agenda', 'team_one_name', 'team_two_name', 'buy_in', 'team_bet', 'max_players'];

function pickDraft(event: GolfEvent): EventDraft {
  return Object.fromEntries(EDITABLE.map((field) => [field, event[field]])) as EventDraft;
}

function readKey(code: string) {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('key');
  try {
    if (fromHash) {
      localStorage.setItem(keyStorageName(code), fromHash);
      // Keep the secret out of the address bar after saving it on this device.
      history.replaceState(null, '', window.location.pathname);
      return fromHash;
    }
    return localStorage.getItem(keyStorageName(code)) ?? '';
  } catch {
    return fromHash ?? '';
  }
}


/** Permanent delete, behind typing the event code. */
function DeleteEventCard({ event, organizerKey, signupCount }: { event: GolfEvent; organizerKey: string; signupCount: number }) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const rounds = event.days.filter((day) => day.roundCode?.trim()).map((day) => day.roundCode);
  const matches = typed.trim().toUpperCase() === event.code;

  async function remove() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteGolfEvent(event.code, organizerKey);
      forgetSavedEvent(event.code);
      window.location.href = '/events';
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the event.');
      setDeleting(false);
    }
  }

  return (
    <details className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer font-bold text-red-700">Delete this event</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-slate-700">
          This permanently deletes <span className="font-semibold">{event.title}</span>
          {signupCount ? ` and all ${signupCount} signup${signupCount === 1 ? '' : 's'}` : ''}. The invite link will stop working. This can&apos;t be undone.
        </p>
        {rounds.length ? (
          <p className="text-slate-700">
            Rounds already started ({rounds.join(', ')}) are kept, with their scores, side bets and settle-ups.
          </p>
        ) : null}
        <label className="block">
          <span className="mb-1 block font-medium">Type <span className="font-mono font-bold">{event.code}</span> to confirm</span>
          <input
            className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 py-3 font-mono uppercase"
            value={typed}
            autoCapitalize="characters"
            autoCorrect="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
        {error ? <p role="alert" className="text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={!matches || deleting}
          className="min-h-[48px] w-full rounded-xl bg-red-700 px-4 font-bold text-white disabled:opacity-40"
          onClick={() => void remove()}
        >
          {deleting ? 'Deleting…' : 'Delete event permanently'}
        </button>
      </div>
    </details>
  );
}

export default function OrganizeEventPage() {
  const params = useParams<{ eventCode: string }>();
  const code = params.eventCode?.toUpperCase() ?? '';
  const [key, setKey] = useState('');
  const [event, setEvent] = useState<GolfEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (organizerKey: string) => {
    const [nextEvent, nextSignups] = await Promise.all([loadGolfEvent(code), loadSignups(code, organizerKey)]);
    setEvent(nextEvent);
    setDraft((current) => current ?? (nextEvent ? pickDraft(nextEvent) : null));
    if (nextEvent) rememberMyEvent(nextEvent.code, nextEvent.title);
    setSignups(nextSignups);
  }, [code]);

  useEffect(() => {
    if (!code) return;
    const organizerKey = readKey(code);
    setKey(organizerKey);
    if (!organizerKey) {
      setError('Open this page with your private organizer link.');
      return;
    }
    refresh(organizerKey).catch((loadError: Error) => setError(loadError.message));
  }, [code, refresh]);

  const stats = useMemo(() => {
    const team = (teamKey: TeamKey) => signups.filter((signup) => signup.team === teamKey);
    const sum = (list: Signup[]) => Math.round(list.reduce((total, signup) => total + signup.handicap, 0) * 10) / 10;
    const paid = signups.filter((signup) => signup.paid).length;
    return {
      teamOne: team('team_one'),
      teamTwo: team('team_two'),
      unassigned: signups.filter((signup) => !signup.team).length,
      sumOne: sum(team('team_one')),
      sumTwo: sum(team('team_two')),
      paid,
      collected: event ? signups.filter((signup) => signup.paid).reduce((total, signup) => total + playerBuyIn(event, signup.choices), 0) : 0,
      outstanding: event ? signups.filter((signup) => !signup.paid).reduce((total, signup) => total + playerBuyIn(event, signup.choices), 0) : 0,
    };
  }, [event, signups]);
  const [editingChoices, setEditingChoices] = useState<{ id: string; value: SignupChoices } | null>(null);

  async function run(action: () => Promise<void>, success = '') {
    setBusy(true);
    setNotice('');
    try {
      await action();
      if (success) setNotice(success);
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Something went wrong.');
    } finally {
      await refresh(key).catch((refreshError: Error) => setNotice(refreshError.message));
      setBusy(false);
    }
  }

  async function copy(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(success);
    } catch {
      window.prompt('Copy this:', text);
    }
  }


  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>
      </main>
    );
  }
  if (!event || !draft) return <main className="mx-auto max-w-3xl px-4 py-8 text-slate-600" role="status">Loading organizer tools…</main>;

  const joinUrl = `${window.location.origin}/join/${event.code}`;
  const dirty = JSON.stringify(draft) !== JSON.stringify(pickDraft(event));
  const teamEvent = isTeamEvent(event);
  const preview: GolfEvent = { ...event, ...cleanDraft(draft) };

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
      <section className="rounded-3xl bg-[#071b12] p-5 text-white shadow-sm">
        <p className="text-sm text-white/80"><Link href="/events" className="underline">Your events</Link> · Organizer · {event.code}</p>
        <h1 className="mt-1 text-3xl font-bold">{event.title}</h1>
        <p className="mt-2 text-sm">
          {signups.length} signed up · {stats.paid} paid · signups {event.signups_open ? 'open' : 'closed'}
        </p>
      </section>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">Invite</h2>
        <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">{joinUrl}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void copy(joinUrl, 'Signup link copied. Paste it in your group text.')}>Copy signup link</Button>
          <Link href={`/join/${event.code}`} className="rounded-xl border border-[#c9d8c7] px-4 py-3 text-sm font-bold">Preview invite</Link>
          <Button variant="secondary" disabled={busy} onClick={() => void run(() => updateEvent(code, key, { signups_open: !event.signups_open }), event.signups_open ? 'Signups closed.' : 'Signups reopened.')}>
            {event.signups_open ? 'Close signups' : 'Reopen signups'}
          </Button>
          {signups.length ? (
            <Button variant="secondary" onClick={() => void copy(signups.map((signup) => signup.email).join(', '), 'All emails copied.')}>Copy all emails</Button>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">This organizer page is saved on this device. Keep your organizer link private; anyone with it can edit the event.</p>
      </Card>

      <EventAssistant
        mode="organizer"
        event={event}
        signups={signups}
        organizerKey={key}
        applyBlocked={dirty ? 'You have unsaved edits in the editor below. Save or undo them first, then apply.' : undefined}
        reload={async () => {
          const [freshEvent, freshSignups] = await Promise.all([loadGolfEvent(code), loadSignups(code, key)]);
          if (!freshEvent) throw new Error('This event no longer exists.');
          return { event: freshEvent, signups: freshSignups };
        }}
        onApplied={() => {
          void Promise.all([loadGolfEvent(code), loadSignups(code, key)])
            .then(([freshEvent, freshSignups]) => {
              if (!freshEvent) return;
              setEvent(freshEvent);
              setDraft(pickDraft(freshEvent));
              setSignups(freshSignups);
            })
            .catch((refreshError: Error) => setNotice(refreshError.message));
        }}
      />

      {event.days.length ? (
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Rounds</h2>
          <p className="text-sm text-slate-600">
            Start each day&apos;s scoring round from here. It fills in that day&apos;s players, the games each one chose, and suggested foursomes that keep Wolf and Vegas players together. Once a round starts, players can&apos;t change that day&apos;s games.
          </p>
          {event.days.map((day) => {
            const playing = signups.filter((signup) => dayChoice(event, signup.choices, day.day).playing).length;
            return (
              <div key={day.day} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    Day {day.day}
                    {day.date ? ` · ${formatEventDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
                    {day.course ? ` · ${day.course}` : ''}
                  </p>
                  <p className="text-sm text-slate-600">{playing} playing</p>
                </div>
                {isDayLocked(day) ? (
                  <Link href={`/r/${day.roundCode}`} className="inline-flex min-h-[44px] items-center rounded-xl border border-[#c9d8c7] bg-white px-4 text-sm font-bold text-[#0f5132]">
                    Open round {day.roundCode}
                  </Link>
                ) : dirty ? (
                  <p className="text-sm text-amber-700">Save event changes first</p>
                ) : (
                  <Link
                    href={`/rounds/new?event=${encodeURIComponent(event.code)}&day=${day.day}`}
                    className={`inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-bold ${playing ? 'bg-[#0f5132] text-white' : 'pointer-events-none bg-slate-200 text-slate-500'}`}
                    aria-disabled={!playing}
                  >
                    Start Day {day.day} round
                  </Link>
                )}
              </div>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Players ({signups.length})</h2>
          {event.buy_in ? (
            <p className="text-sm text-slate-600">
              Collected {formatCurrency(stats.collected)} · Outstanding {formatCurrency(stats.outstanding)}
            </p>
          ) : null}
        </div>
        {teamEvent ? (<>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <p className="font-bold">{event.team_one_name}</p>
            <p className="text-slate-600">{stats.teamOne.length} players · handicaps total {stats.sumOne}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <p className="font-bold">{event.team_two_name}</p>
            <p className="text-slate-600">{stats.teamTwo.length} players · handicaps total {stats.sumTwo}</p>
          </div>
        </div>
        {stats.unassigned ? <p className="mb-2 text-sm text-amber-700">{stats.unassigned} player{stats.unassigned === 1 ? '' : 's'} not on a team yet.</p> : null}
        {stats.teamOne.length !== stats.teamTwo.length && !stats.unassigned && signups.length ? (
          <p className="mb-2 text-sm text-amber-700">Teams are uneven. Match play needs the same number of players on each side.</p>
        ) : null}
        </>) : null}
        {signups.length ? (
          <ul className="divide-y divide-slate-100">
            {signups.map((signup) => (
              <li key={signup.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-semibold">{signup.name} <span className="font-normal text-slate-500">· {signup.handicap}</span></p>
                  <p className="truncate text-sm text-slate-500">{signup.email}</p>
                  {event.days.length ? (
                    <p className="mt-1 text-sm text-slate-700">
                      <span className="font-semibold">Owes {formatCurrency(playerBuyIn(event, signup.choices))}</span> · {choicesSummary(event, signup.choices)}{' '}
                      <button type="button" className="min-h-[36px] font-semibold text-[#0f5132] underline" onClick={() => setEditingChoices(editingChoices?.id === signup.id ? null : { id: signup.id, value: completeChoices(event, signup.choices) })}>
                        {editingChoices?.id === signup.id ? 'Close' : 'Edit games'}
                      </button>
                    </p>
                  ) : null}
                  {editingChoices?.id === signup.id ? (
                    <div className="mt-2 space-y-2">
                      <ChoicesEditor event={event} value={editingChoices.value} allowLocked onChange={(value) => setEditingChoices({ id: signup.id, value })} />
                      {event.days.some(isDayLocked) ? <p className="text-xs text-amber-700">Changing a day whose round has started won&apos;t change that round. Edit the round itself too.</p> : null}
                      <Button
                        disabled={busy}
                        onClick={() => void run(async () => {
                          await updateSignup(code, key, signup.id, { choices: completeChoices(event, editingChoices.value) });
                          setEditingChoices(null);
                        }, `${signup.name}'s games saved.`)}
                      >
                        Save {signup.name}&apos;s games
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {teamEvent ? (
                  <select
                    aria-label={`Team for ${signup.name}`}
                    className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-2 text-sm"
                    value={signup.team ?? ''}
                    disabled={busy}
                    onChange={(e) => void run(() => updateSignup(code, key, signup.id, { team: (e.target.value || null) as TeamKey | null }))}
                  >
                    <option value="">No team</option>
                    <option value="team_one">{event.team_one_name}</option>
                    <option value="team_two">{event.team_two_name}</option>
                  </select>
                  ) : null}
                  <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm">
                    <input type="checkbox" checked={signup.paid} disabled={busy} onChange={(e) => void run(() => updateSignup(code, key, signup.id, { paid: e.target.checked }))} />
                    Paid
                  </label>
                  <button
                    type="button"
                    className="min-h-[44px] px-2 text-sm text-red-700 underline"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remove ${signup.name} from the event?`)) void run(() => updateSignup(code, key, signup.id, { remove: true }), `${signup.name} removed.`);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No signups yet. Share the signup link to get started.</p>
        )}
      </Card>

      <Card>
        <EventEditor
          draft={draft}
          onChange={setDraft}
          autoBuyInDefault={event.buy_in === suggestedBuyIn(event)}
        />
      </Card>

      <h2 className="px-1 pt-2 text-sm font-bold uppercase tracking-wide text-slate-500">What players see</h2>
      <EventSchedule event={preview} />
      <BuyInCard event={preview} players={signups.length} />

      {notice ? <p role="status" className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">{notice}</p> : null}

      <DeleteEventCard event={event} organizerKey={key} signupCount={signups.length} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Button
            className="flex-1"
            disabled={!dirty || busy}
            onClick={() =>
              void run(async () => {
                const clean = cleanDraft(draft);
                const problems = validateDraft(clean);
                if (problems.length) throw new Error(problems.join(' '));
                await updateEvent(code, key, clean);
                setDraft(null);
                const saved = await loadGolfEvent(code);
                if (saved && (saved.buy_in !== clean.buy_in || saved.team_bet !== clean.team_bet || saved.max_players !== clean.max_players)) {
                  throw new Error('Saved, except the buy-in, team bet and player limit. Run the latest supabase-golf-events.sql in Supabase to allow editing those.');
                }
              }, 'Event details saved.')
            }
          >
            {busy ? 'Saving…' : dirty ? 'Save event details' : 'All changes saved'}
          </Button>
        </div>
      </div>
    </main>
  );
}
