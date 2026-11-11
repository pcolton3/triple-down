'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/shared/card';
import { loadSharedRoundsByRyderEventCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';
import type { RoundState } from '@/types/round';
import { buildRyderRoundSummary } from '@/lib/events/ryder';

export default function RyderEventPage() {
  const params = useParams<{ eventCode: string }>();
  const eventCode = params.eventCode?.toUpperCase() ?? '';
  const [rounds, setRounds] = useState<RoundState[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_found'>('loading');

  useEffect(() => {
    let cancelled = false;
    async function loadEvent() {
      setStatus('loading');
      const bundles = await loadSharedRoundsByRyderEventCode(eventCode);
      if (cancelled) return;
      setRounds(bundles.map(sharedRoundBundleToRoundState));
      setStatus(bundles.length > 0 ? 'ready' : 'not_found');
    }
    if (eventCode) void loadEvent();
    return () => {
      cancelled = true;
    };
  }, [eventCode]);

  const summaries = useMemo(() => rounds.map(buildRyderRoundSummary).sort((a, b) => a.day - b.day), [rounds]);
  const teamOneName = summaries[0]?.teamOneName ?? 'Team 1';
  const teamTwoName = summaries[0]?.teamTwoName ?? 'Team 2';
  const teamOneTotal = summaries.reduce((sum, item) => sum + item.teamOnePoints, 0);
  const teamTwoTotal = summaries.reduce((sum, item) => sum + item.teamTwoPoints, 0);

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <section className="rounded-3xl bg-[#071b12] p-5 text-white shadow-sm">
        <p className="text-sm opacity-90">Ryder Cup Event</p>
        <h1 className="mt-1 text-3xl font-bold">{eventCode}</h1>
        <p className="mt-2 text-sm">{summaries.length} linked round{summaries.length === 1 ? '' : 's'}</p>
      </section>

      {status === 'loading' ? <Card className="text-sm text-slate-600">Loading Ryder event {eventCode}...</Card> : null}
      {status === 'not_found' ? <Card className="text-sm text-slate-600">No Ryder rounds are linked to {eventCode} yet.</Card> : null}

      {status === 'ready' ? (
        <>
          <Card>
            <h2 className="mb-3 text-xl font-bold">Overall Score</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{teamOneName}</p>
                <p className="mt-1 text-3xl font-bold">{teamOneTotal}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{teamTwoName}</p>
                <p className="mt-1 text-3xl font-bold">{teamTwoTotal}</p>
              </div>
            </div>
          </Card>

          {summaries.map((summary) => (
            <Card key={summary.roundCode}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Day {summary.day}: {summary.title}</h2>
                  <p className="text-sm text-slate-500">{summary.format === 'team_match' ? 'Team Match Play' : 'Singles Match Play'}</p>
                </div>
                <Link className="text-sm font-bold text-[#0f5132]" href={`/r/${summary.roundCode}`}>
                  Open Round
                </Link>
              </div>
              <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold">
                {summary.teamOneName} {summary.teamOnePoints} - {summary.teamTwoPoints} {summary.teamTwoName}
              </div>
              <div className="space-y-2">
                {summary.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <span className="font-semibold">{row.label}</span>
                    <span className="font-semibold tabular-nums">{row.score}</span>
                    <span className="text-slate-500">{row.status}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </>
      ) : null}
    </main>
  );
}
