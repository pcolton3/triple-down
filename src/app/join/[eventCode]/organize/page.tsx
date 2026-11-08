'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BuyInCard, EventSchedule } from '@/components/events/event-details';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { formatCurrency } from '@/lib/utils/currency';
import {
  FORMAT_LABELS,
  loadGolfEvent,
  loadSignups,
  updateEvent,
  updateSignup,
  type AgendaItem,
  type EventDay,
  type GolfEvent,
  type RyderFormat,
  type Signup,
  type TeamKey,
} from '@/lib/events/golf-events';

const input = 'min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const label = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

function keyStorageName(code: string) {
  return `triple-track-organizer:${code}`;
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

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={label}>{title}</span>
      {children}
    </label>
  );
}

export default function OrganizeEventPage() {
  const params = useParams<{ eventCode: string }>();
  const code = params.eventCode?.toUpperCase() ?? '';
  const [key, setKey] = useState('');
  const [event, setEvent] = useState<GolfEvent | null>(null);
  const [draft, setDraft] = useState<GolfEvent | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (organizerKey: string) => {
    const [nextEvent, nextSignups] = await Promise.all([loadGolfEvent(code), loadSignups(code, organizerKey)]);
    setEvent(nextEvent);
    setDraft((current) => current ?? nextEvent);
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
      collected: paid * (event?.buy_in ?? 0),
      outstanding: (signups.length - paid) * (event?.buy_in ?? 0),
    };
  }, [event?.buy_in, signups]);

  async function run(action: () => Promise<void>, success = '') {
    setBusy(true);
    setNotice('');
    try {
      await action();
      await refresh(key);
      if (success) setNotice(success);
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Something went wrong.');
    } finally {
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

  function setDay(index: number, patch: Partial<EventDay>) {
    setDraft((current) => current && { ...current, days: current.days.map((day, i) => (i === index ? { ...day, ...patch } : day)) });
  }

  function setAgenda(id: string, patch: Partial<AgendaItem>) {
    setDraft((current) => current && { ...current, agenda: current.agenda.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
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
  const dirty = JSON.stringify(draft) !== JSON.stringify(event);

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
      <section className="rounded-3xl bg-[#071b12] p-5 text-white shadow-sm">
        <p className="text-sm text-white/80">Organizer · {event.code}</p>
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

      <Card>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Players ({signups.length})</h2>
          {event.buy_in ? (
            <p className="text-sm text-slate-600">
              Collected {formatCurrency(stats.collected)} · Outstanding {formatCurrency(stats.outstanding)}
            </p>
          ) : null}
        </div>
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
        {signups.length ? (
          <ul className="divide-y divide-slate-100">
            {signups.map((signup) => (
              <li key={signup.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-semibold">{signup.name} <span className="font-normal text-slate-500">· {signup.handicap}</span></p>
                  <p className="truncate text-sm text-slate-500">{signup.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Event details</h2>
        <Field title="Event name">
          <input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field title="Message to players">
          <textarea className={`${input} min-h-[96px]`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field title="Team 1 name">
            <input className={input} value={draft.team_one_name} onChange={(e) => setDraft({ ...draft, team_one_name: e.target.value })} />
          </Field>
          <Field title="Team 2 name">
            <input className={input} value={draft.team_two_name} onChange={(e) => setDraft({ ...draft, team_two_name: e.target.value })} />
          </Field>
        </div>

        {draft.days.map((day, index) => (
          <section key={day.day} className="space-y-3 rounded-xl border border-[#c9d8c7] p-3">
            <h3 className="font-bold">Golf day {day.day}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field title="Date"><input type="date" className={input} value={day.date} onChange={(e) => setDay(index, { date: e.target.value })} /></Field>
              <Field title="First tee time"><input type="time" className={input} value={day.teeTime ?? ''} onChange={(e) => setDay(index, { teeTime: e.target.value })} /></Field>
              <Field title="Format">
                <select className={input} value={day.format} onChange={(e) => setDay(index, { format: e.target.value as RyderFormat })}>
                  {Object.entries(FORMAT_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field title="Course"><input className={input} value={day.course ?? ''} onChange={(e) => setDay(index, { course: e.target.value })} /></Field>
              <Field title="Address"><input className={input} value={day.address ?? ''} onChange={(e) => setDay(index, { address: e.target.value })} /></Field>
            </div>
            <Field title="Course website"><input className={input} inputMode="url" value={day.website ?? ''} onChange={(e) => setDay(index, { website: e.target.value })} /></Field>
            <Field title="Course notes (dress code, range, carts…)">
              <textarea className={`${input} min-h-[72px]`} value={day.notes ?? ''} onChange={(e) => setDay(index, { notes: e.target.value })} />
            </Field>
          </section>
        ))}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Agenda (dinners, activities…)</h3>
            <Button
              variant="secondary"
              onClick={() =>
                setDraft({
                  ...draft,
                  agenda: [...draft.agenda, { id: crypto.randomUUID(), date: draft.days[0]?.date ?? '', time: '18:00', title: '' }],
                })
              }
            >
              Add item
            </Button>
          </div>
          {draft.agenda.map((item) => (
            <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field title="What"><input className={input} placeholder="Birthday dinner" value={item.title} onChange={(e) => setAgenda(item.id, { title: e.target.value })} /></Field>
                <Field title="Date"><input type="date" className={input} value={item.date} onChange={(e) => setAgenda(item.id, { date: e.target.value })} /></Field>
                <Field title="Time"><input type="time" className={input} value={item.time ?? ''} onChange={(e) => setAgenda(item.id, { time: e.target.value })} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field title="Place"><input className={input} value={item.location ?? ''} onChange={(e) => setAgenda(item.id, { location: e.target.value })} /></Field>
                <Field title="Address"><input className={input} value={item.address ?? ''} onChange={(e) => setAgenda(item.id, { address: e.target.value })} /></Field>
              </div>
              <Field title="Link (reservation, menu…)"><input className={input} inputMode="url" value={item.link ?? ''} onChange={(e) => setAgenda(item.id, { link: e.target.value })} /></Field>
              <Field title="Notes"><textarea className={`${input} min-h-[60px]`} value={item.notes ?? ''} onChange={(e) => setAgenda(item.id, { notes: e.target.value })} /></Field>
              <button type="button" className="text-sm text-red-700 underline" onClick={() => setDraft({ ...draft, agenda: draft.agenda.filter((entry) => entry.id !== item.id) })}>
                Remove item
              </button>
            </div>
          ))}
        </section>
      </Card>

      <h2 className="px-1 pt-2 text-sm font-bold uppercase tracking-wide text-slate-500">What players see</h2>
      <EventSchedule event={draft} />
      <BuyInCard event={draft} players={signups.length} />

      {notice ? <p role="status" className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">{notice}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Button
            className="flex-1"
            disabled={!dirty || busy}
            onClick={() =>
              void run(async () => {
                const agenda = draft.agenda.filter((item) => item.title.trim());
                await updateEvent(code, key, {
                  title: draft.title,
                  description: draft.description,
                  team_one_name: draft.team_one_name,
                  team_two_name: draft.team_two_name,
                  days: draft.days,
                  agenda,
                });
                setDraft(null);
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
