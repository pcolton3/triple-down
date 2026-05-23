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
    <section className="mx-auto max-w-5xl px-4 py-16 text-center md:py-24">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#2f8df3]">
        Mobile Golf Betting PWA
      </p>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
        Triple Track keeps your Banker round moving.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 md:text-lg">
        Set up the event, send golfers a round code, and let each foursome score from its own phone.
      </p>

      <form onSubmit={handleJoin} className="mx-auto mt-8 flex max-w-md flex-col gap-3 rounded-2xl border border-[#68aef7] bg-white p-3 shadow-sm sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-center font-mono text-lg font-bold uppercase"
          value={roundCode}
          placeholder="ROUND CODE"
          onChange={(event) => setRoundCode(event.target.value.toUpperCase())}
        />
        <Button type="submit">Join Round</Button>
      </form>

      <div className="mt-4 flex items-center justify-center">
        <Link href="/rounds/new">
          <Button variant="secondary">Start a Round</Button>
        </Link>
      </div>
    </section>
  );
}
