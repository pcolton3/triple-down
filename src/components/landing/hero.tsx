'use client';

import { loadGolfEvent, readSavedEvents, type SavedEvent } from '@/lib/events/golf-events';
import { readRecent, type RecentRound } from '@/lib/offline/local-rounds';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { InstallAppButton } from '@/components/pwa/install-app-button';
import { Button } from '@/components/shared/button';

export function Hero() {
  const router = useRouter();
  const [roundCode, setRoundCode] = useState('');

  const [recent, setRecent] = useState<RecentRound | null>(null);
  useEffect(() => { try { setRecent(readRecent()); } catch { /* Joining still works if storage is unavailable. */ } }, []);
  const [myEvents, setMyEvents] = useState<SavedEvent[]>([]);
  useEffect(() => setMyEvents(readSavedEvents()), []);

  const [joining, setJoining] = useState(false);

  // One box for both kinds of code: events (trip invites) and rounds (live scoring).
  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = roundCode.trim();
    // A pasted organizer link. On iPhone, links open in Safari, not the home-screen app, so pasting
    // here is how the installed app becomes an organizer. The key is case-sensitive, so read it raw.
    const organizer = raw.match(/join\/([A-Za-z0-9]+)\/organize#key=([0-9a-fA-F]+)/);
    if (organizer) {
      window.location.assign(`/join/${organizer[1].toUpperCase()}/organize#key=${organizer[2]}`);
      return;
    }
    // Any other pasted app link (/join/CODE or /r/CODE): use just its code.
    const linked = raw.match(/\/(?:join|r)\/([A-Za-z0-9]+)/);
    const code = (linked ? linked[1] : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || joining) return;
    setJoining(true);
    let isEvent = false;
    try {
      if (navigator.onLine) isEvent = Boolean(await loadGolfEvent(code));
    } catch {
      /* Offline or events not set up: rounds still open from this device's cache. */
    }
    router.push(isEvent ? `/join/${code}` : `/r/${code}`);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 md:py-16">
      <div className="mx-auto max-w-3xl text-center">
      <p className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-[#0f5132]">
        Live golf scoring and games
      </p>
      <h1 className="text-5xl font-black tracking-tight text-[#071b12] md:text-7xl">
        Golf without the scorecard chaos.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base font-medium text-[#52635a] md:text-lg">
        Live group scoring, leaderboards, side games, match play, and settle-up without passing scorecards around.
      </p>
      </div>

      <form onSubmit={handleJoin} className="mx-auto mt-8 flex max-w-md flex-col gap-3 rounded-2xl border border-[#c9d8c7] bg-white p-3 shadow-sm sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-xl border border-[#c9d8c7] px-3 py-3 text-center font-mono text-lg font-black uppercase text-[#071b12]"
          value={roundCode}
          placeholder="ENTER CODE"
          aria-label="Round or event code, or a pasted link"
          autoCapitalize="characters"
          autoCorrect="off"
          onChange={(event) => setRoundCode(event.target.value)}
        />
        <Button type="submit" disabled={joining}>{joining ? 'Opening…' : 'Join'}</Button>
      </form>
      <p className="mx-auto mt-2 max-w-md text-center text-xs text-slate-500">Got a code from a friend? Round codes open live scoring; event codes open the trip invite. Organizers can paste their organizer link here.</p>

      <div className="mx-auto mt-4 flex max-w-md items-center justify-center">
        <Link href="/rounds/new" className="w-full">
          <Button
            variant="secondary"
            className="w-full border-[#d7aa2f] bg-[#f2c94c] py-4 text-[#071b12] hover:border-[#b78f20] hover:bg-[#e4b936]"
          >
            Start a Round
          </Button>
        </Link>
      </div>

      <div className="mx-auto mt-3 flex max-w-md items-center justify-center">
        <Link href="/events/new" className="w-full">
          <Button variant="secondary" className="w-full py-4">
            Plan an Event or Golf Trip
          </Button>
        </Link>
      </div>

      {myEvents.length ? (
        <Link href="/events" className="mx-auto mt-5 block max-w-md rounded-2xl border border-[#c9d8c7] bg-white p-4 shadow-sm">
          <span className="block font-bold text-[#0f5132]">Your events →</span>
          <span className="mt-1 block truncate text-sm text-slate-600">
            {myEvents.slice(0, 3).map((entry) => entry.title || entry.code).join(' · ')}
            {myEvents.length > 3 ? ` + ${myEvents.length - 3} more` : ''}
          </span>
        </Link>
      ) : null}

      {recent ? (
        <a href={`/r/${encodeURIComponent(recent.code)}/group/${recent.group}`} className="mx-auto mt-5 block max-w-md rounded-2xl border border-[#c9d8c7] bg-white p-4 shadow-sm">
          <span className="block font-bold text-[#0f5132]">Resume your round →</span>
          <span className="mt-1 block text-sm text-slate-600">{recent.title} · {recent.course}</span>
          <span className="mt-1 block text-sm font-semibold">Group {recent.group} · Hole {recent.hole}</span>
        </a>
      ) : null}
      <InstallAppButton />

      <div className="mt-10 grid gap-3 md:grid-cols-3">
        {[
          ['Multi-group scoring', 'Each foursome keeps its own hole and scores while the event leaderboard updates.'],
          ['Side games', 'Skins, CTP, low net, birdie and eagle pots, Banker, and more can be selected per round.'],
          ['Ryder Cup events', 'Link multiple days together with team match play, singles matches, and an overall event score.'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-[#c9d8c7] bg-white p-4 text-left shadow-sm">
            <h2 className="font-black text-[#071b12]">{title}</h2>
            <p className="mt-2 text-sm font-medium text-[#52635a]">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
