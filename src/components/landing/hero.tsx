'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/shared/button';

export function Hero() {
  const router = useRouter();
  const [roundCode, setRoundCode] = useState('');

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = roundCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/r/${code}`);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 md:py-20">
      <div className="mx-auto max-w-3xl text-center">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#0f5132]">
        Live golf scoring and games
      </p>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
        Run the whole golf event from everyone&apos;s phone.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 md:text-lg">
        Track multiple groups, live leaderboards, skins, CTP, low net, Banker, and Ryder Cup style matches without passing one scorecard around.
      </p>
      </div>

      <form onSubmit={handleJoin} className="mx-auto mt-8 flex max-w-md flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-center font-mono text-lg font-bold uppercase"
          value={roundCode}
          placeholder="EVENT CODE"
          onChange={(event) => setRoundCode(event.target.value.toUpperCase())}
        />
        <Button type="submit">Join Round</Button>
      </form>

      <div className="mt-4 flex items-center justify-center">
        <Link href="/rounds/new">
          <Button variant="secondary">Start a Round</Button>
        </Link>
      </div>

      <div className="mt-10 grid gap-3 md:grid-cols-3">
        {[
          ['Multi-group scoring', 'Each foursome keeps its own hole and scores while the event leaderboard updates.'],
          ['Side games', 'Skins, CTP, low net, birdie and eagle pots, Banker, and more can be selected per round.'],
          ['Ryder Cup events', 'Link multiple days together with team match play, singles matches, and an overall event score.'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
            <h2 className="font-bold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
