'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { eventDateRange } from '@/components/events/event-details';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import {
  formatEventDate,
  forgetSavedEvent,
  formatTime,
  hideSavedEvent,
  isTeamEvent,
  loadGolfEvent,
  localToday,
  nextGolfDay,
  readSavedEvents,
  splitUpcoming,
  type GolfEvent,
  type SavedEvent,
} from '@/lib/events/golf-events';

type Loaded = { saved: SavedEvent; event: GolfEvent };

function EventCard({ saved, event, today, onRemove }: Loaded & { today: string; onRemove: (code: string) => void }) {
  const next = nextGolfDay(event, today);
  const code = encodeURIComponent(event.code);
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">{event.title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#0f5132]">{eventDateRange(event) || 'Dates to be announced'}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1 text-xs font-bold">
          {saved.organizer ? <span className="rounded-full bg-[#f2c94c] px-2 py-1 text-[#071b12]">Organizer</span> : null}
          {saved.joined ? <span className="rounded-full bg-[#e7f3e5] px-2 py-1 text-[#0f5132]">Signed up</span> : null}
        </div>
      </div>
      <p className="text-sm text-slate-600">
        {event.days.length} day{event.days.length === 1 ? '' : 's'} of golf
        {isTeamEvent(event) ? ` · ${event.team_one_name} vs ${event.team_two_name}` : ''}
        {next ? ` · Next: ${formatEventDate(next.date, { weekday: 'short', month: 'short', day: 'numeric' })}${next.teeTime ? ` ${formatTime(next.teeTime)}` : ''}${next.course ? ` at ${next.course}` : ''}` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/join/${code}`} className="flex-1 rounded-xl border border-[#c9d8c7] px-4 py-3 text-center text-sm font-bold">
          {saved.joined ? 'View event & my signup' : 'View event'}
        </Link>
        {saved.organizer ? (
          <Link href={`/join/${code}/organize`} className="flex-1 rounded-xl bg-[#0f5132] px-4 py-3 text-center text-sm font-bold text-white">
            Manage & edit
          </Link>
        ) : null}
      </div>
      <button
        type="button"
        className="min-h-[40px] text-xs font-semibold text-slate-500 underline"
        onClick={() => {
          if (window.confirm(`Remove ${event.title} from your list on this phone? It isn't deleted, and opening its link again brings it back.${saved.organizer ? ' Keep your organizer link so you can still manage it.' : ''}`)) onRemove(event.code);
        }}
      >
        Remove from my list
      </button>
    </Card>
  );
}

export default function YourEventsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Loaded[] | null>(null);
  const [failed, setFailed] = useState(0);
  const [code, setCode] = useState('');
  const [showPast, setShowPast] = useState(false);
  const today = localToday();

  useEffect(() => {
    const saved = readSavedEvents();
    Promise.allSettled(saved.map((entry) => loadGolfEvent(entry.code))).then((results) => {
      const loaded: Loaded[] = [];
      let errors = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value) loaded.push({ saved: saved[index], event: result.value });
          else forgetSavedEvent(saved[index].code); // Deleted by its organizer.
        } else {
          errors += 1;
        }
      });
      setItems(loaded);
      setFailed(errors);
    });
  }, []);

  function openCode(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const value = code.trim().toUpperCase();
    if (value) router.push(`/join/${encodeURIComponent(value)}`);
  }

  const { upcoming, past } = splitUpcoming(items ?? [], today);
  function removeFromList(code: string) {
    hideSavedEvent(code);
    setItems((current) => (current ?? []).filter((item) => item.event.code !== code));
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-24">
      <section className="rounded-3xl bg-[#071b12] p-5 text-white shadow-sm">
        <h1 className="text-3xl font-bold">Your events</h1>
        <p className="mt-1 text-sm text-white/80">Events you&apos;ve signed up for or organize on this device.</p>
      </section>

      {items === null ? (
        <p className="px-1 text-slate-600" role="status">Loading your events…</p>
      ) : (
        <>
          {failed ? (
            <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {failed} event{failed === 1 ? '' : 's'} couldn&apos;t load. Check your connection and refresh.
            </p>
          ) : null}

          <h2 className="px-1 pt-2 text-sm font-bold uppercase tracking-wide text-slate-500">Upcoming</h2>
          {upcoming.length ? (
            upcoming.map((item) => <EventCard key={item.event.code} {...item} today={today} onRemove={removeFromList} />)
          ) : (
            <Card>
              <p className="text-slate-700">No upcoming events on this device yet.</p>
              <p className="mt-1 text-sm text-slate-500">
                Open an invite link and sign up, or plan your own event, and it will show up here. Joined on another phone? Open the invite link once on this one.
              </p>
            </Card>
          )}

          {past.length ? (
            <section className="space-y-3">
              <button type="button" className="px-1 pt-2 text-sm font-bold uppercase tracking-wide text-slate-500 underline" onClick={() => setShowPast(!showPast)}>
                {showPast ? 'Hide' : 'Show'} past events ({past.length})
              </button>
              {showPast ? past.map((item) => <EventCard key={item.event.code} {...item} today={today} onRemove={removeFromList} />) : null}
            </section>
          ) : null}
        </>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Have an event code?</h2>
        <form onSubmit={openCode} className="flex gap-2">
          <input
            className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-center font-mono text-lg font-black uppercase"
            placeholder="BDAY27"
            aria-label="Event code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button type="submit">Open</Button>
        </form>
      </Card>

      <Link href="/events/new" className="block">
        <Button variant="secondary" className="w-full py-4">Plan an Event or Golf Trip</Button>
      </Link>
    </main>
  );
}
