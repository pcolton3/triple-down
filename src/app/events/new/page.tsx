'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BuyInCard, EventSchedule } from '@/components/events/event-details';
import { EventEditor, cleanDraft, newDay } from '@/components/events/event-editor';
import { PlannerAssistant } from '@/components/events/planner-assistant';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { createGolfEvent, normalizeEvent, rememberMyEvent, validateDraft, type EventDraft, type GolfEvent } from '@/lib/events/golf-events';

function emptyDraft(): EventDraft {
  return {
    title: '',
    description: '',
    days: [newDay()],
    agenda: [],
    buy_in: 30,
    team_bet: 0,
    team_one_name: 'Team 1',
    team_two_name: 'Team 2',
    max_players: null,
  };
}

const DRAFT_STORAGE = 'triple-track-new-event-draft';

function previewEvent(draft: EventDraft): GolfEvent {
  return normalizeEvent({ ...draft, id: 'preview', code: 'PREVIEW', ctp_per_day: 0, skins_per_day: 0, signups_open: true });
}

export default function NewEventPage() {
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ code: string; organizerKey: string; title: string } | null>(null);
  const [copied, setCopied] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  // Keep the form across a reload (an assistant-built plan shouldn't vanish).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT_STORAGE) ?? 'null') as EventDraft | null;
      if (saved && Array.isArray(saved.days)) {
        setDraft(saved);
        setEditorKey((value) => value + 1);
      }
    } catch { /* Start with an empty form. */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_STORAGE, JSON.stringify(draft)); } catch { /* Not saved; still works. */ }
  }, [draft]);

  async function create() {
    const clean = cleanDraft(draft);
    const found = validateDraft(clean);
    setProblems(found);
    setError('');
    if (found.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    try {
      const result = await createGolfEvent(clean);
      rememberMyEvent(result.code, clean.title, result.organizerKey);
      try {
        sessionStorage.removeItem(DRAFT_STORAGE);
        sessionStorage.removeItem('triple-track-assistant:planner');
      } catch { /* Nothing to clear. */ }
      setCreated({ ...result, title: clean.title });
      window.scrollTo({ top: 0 });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the event.');
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      window.prompt('Copy this:', text);
    }
  }

  if (created) {
    const origin = window.location.origin;
    const joinUrl = `${origin}/join/${created.code}`;
    const organizerUrl = `${origin}/join/${created.code}/organize#key=${created.organizerKey}`;
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <section className="rounded-3xl bg-[#071b12] p-5 text-white shadow-sm">
          <p className="text-sm text-white/80">Event created · {created.code}</p>
          <h1 className="mt-1 text-3xl font-bold">{created.title}</h1>
        </section>
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">1. Invite your players</h2>
          <p className="text-sm text-slate-600">Text or email this link. People sign up with their name, email and handicap.</p>
          <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">{joinUrl}</p>
          <Button className="w-full" onClick={() => void copy(joinUrl, 'signup')}>{copied === 'signup' ? 'Signup link copied' : 'Copy signup link'}</Button>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">2. Save your organizer link</h2>
          <p className="text-sm text-slate-600">
            This private link lets you see emails, set teams, track who paid and edit the event. It&apos;s saved on this device, but keep a copy (for example in your notes) in case you switch phones. Don&apos;t share it.
          </p>
          <p className="break-all rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold">{organizerUrl}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="flex-1" onClick={() => void copy(organizerUrl, 'organizer')}>{copied === 'organizer' ? 'Organizer link copied' : 'Copy organizer link'}</Button>
            <Link href={`/join/${created.code}/organize`} className="flex-1 rounded-xl bg-[#0f5132] px-4 py-3 text-center text-sm font-bold text-white">Open organizer page</Link>
          </div>
        </Card>
      </main>
    );
  }

  const preview = previewEvent(cleanDraft(draft));

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-28">
      <section className="rounded-3xl bg-[#071b12] p-5 text-white shadow-sm">
        <p className="text-sm text-white/80">Plan an event</p>
        <h1 className="mt-1 text-3xl font-bold">Golf trip or event</h1>
        <p className="mt-2 text-sm text-white/80">Set up the days, games, buy-in and agenda. You&apos;ll get a signup link to send your group.</p>
      </section>

      <PlannerAssistant
        draft={draft}
        onUseDraft={(next) => {
          setDraft(next);
          setProblems([]);
          setEditorKey((value) => value + 1);
        }}
      />

      {problems.length ? (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p className="font-bold">Fix these before creating the event:</p>
          <ul className="mt-1 list-disc pl-5">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </div>
      ) : null}

      <Card>
        <EventEditor key={editorKey} draft={draft} onChange={setDraft} />
      </Card>

      <h2 className="px-1 pt-2 text-sm font-bold uppercase tracking-wide text-slate-500">What players will see</h2>
      <EventSchedule event={preview} />
      <BuyInCard event={preview} players={0} />

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button className="w-full" disabled={saving} onClick={() => void create()}>
            {saving ? 'Creating…' : 'Create event'}
          </Button>
        </div>
      </div>
    </main>
  );
}
