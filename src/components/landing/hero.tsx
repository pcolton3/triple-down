import Link from 'next/link';
import { Button } from '@/components/shared/button';

export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 text-center md:py-24">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#2f8df3]">
        Mobile Golf Betting PWA
      </p>
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
        Triple Track keeps your Banker round moving.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 md:text-lg">
        Set up your foursome, track each hole, see who is up or down live, review hole history, sette everything at the end.
      </p>
      <div className="mt-8 flex items-center justify-center">
        <Link href="/rounds/new">
          <Button>Start a Round</Button>
        </Link>
      </div>
    </section>
  );
}
