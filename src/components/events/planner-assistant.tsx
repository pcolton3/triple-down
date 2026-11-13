'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { draftFromWire, draftOutline, type PlannerReply } from '@/lib/assistant/changes';
import { cleanBookingOptions, type TeeTimeOption } from '@/lib/assistant/tee-times';
import { localToday, type EventDraft } from '@/lib/events/golf-events';

type Plan = { draft: EventDraft; lines: string[]; status: 'offered' | 'used' };
type Turn = { role: 'user' | 'assistant'; content: string; plan?: Plan; links?: TeeTimeOption[] };

const STORAGE = 'triple-track-assistant:planner';
const SUGGESTIONS = [
  "Plan a 2-day guys' trip in Scottsdale in late April, Ryder Cup style, about 12 players",
  'One-day member-guest scramble with skins and CTP',
  'What games work well for a group of 8?',
  'Find tee times for 8 players Saturday morning',
];

/** Plain text with any http(s) URLs turned into links. */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part.replace(/[.,;:!?]+$/, '')} target="_blank" rel="noopener noreferrer" className="break-all font-semibold underline">
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function BookingLinks({ links }: { links: TeeTimeOption[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {links.map((option) => (
        <li key={option.url} className={`rounded-2xl border bg-white p-3 text-sm ${option.source === 'course' ? 'border-[#0f5132]' : 'border-slate-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href={option.url} target="_blank" rel="noopener noreferrer" className="min-h-[44px] py-2 font-semibold text-[#0f5132] underline">{option.title} ↗</a>
            {option.source === 'course' ? (
              <span className="rounded-full bg-[#e7f3e5] px-2 py-0.5 text-xs font-bold text-[#0f5132]">Course direct · usually cheapest</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">Third-party · may cost more</span>
            )}
          </div>
          {option.price ? <p>{option.price}</p> : null}
          {option.notes ? <p className="text-xs text-slate-500">{option.notes}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function historyText(turn: Turn) {
  const links = turn.links?.length ? `\n\n[Booking links shown: ${turn.links.map((link) => `${link.title} (${link.source}) ${link.url}`).join('; ')}]` : '';
  if (!turn.plan) return `${turn.content}${links}`;
  const status = turn.plan.status === 'used' ? 'the organizer put this plan in the form' : 'offered, not used yet';
  return `${turn.content}\n\n[Plan (${status}): ${turn.plan.lines.join('; ')}]${links}`;
}

/** Chat on the create page that builds the event with the organizer and fills in the form. */
export function PlannerAssistant({ draft, onUseDraft, children }: { draft: EventDraft; onUseDraft: (draft: EventDraft) => void; children?: React.ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE) ?? '[]') as Turn[];
      if (Array.isArray(saved) && saved.length) setTurns(saved);
    } catch { /* Start fresh. */ }
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE, JSON.stringify(turns.slice(-30))); } catch { /* Not saved; still works. */ }
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    const next: Turn[] = [...turns, { role: 'user', content: question }];
    setTurns(next);
    setInput('');
    setError('');
    setSending(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'planner',
          today: localToday(),
          draft,
          messages: next.map((turn) => ({ role: turn.role, content: historyText(turn) })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<PlannerReply> & { error?: string };
      if (!response.ok) throw new Error(data.error || 'The assistant had a problem. Try again.');
      const plan = data.draft ? draftFromWire(data.draft) : null;
      const links = cleanBookingOptions(data.booking_links);
      setTurns([
        ...next,
        {
          role: 'assistant',
          content: data.reply?.trim() || (plan ? 'Here is a plan:' : 'Sorry, I lost my train of thought. Ask again?'),
          ...(plan ? { plan: { draft: plan, lines: draftOutline(plan), status: 'offered' as const } } : {}),
          ...(links.length ? { links } : {}),
        },
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Couldn't reach the assistant.");
      setTurns(turns);
      setInput(question);
    } finally {
      setSending(false);
    }
  }

  function use(index: number) {
    const plan = turns[index]?.plan;
    if (!plan) return;
    onUseDraft(plan.draft);
    setTurns((current) => current.map((turn, i) => (i === index && turn.plan ? { ...turn, plan: { ...turn.plan, status: 'used' } } : turn)));
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    void send(input);
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Plan it with the assistant</h2>
          <p className="text-sm text-slate-600">Describe the trip. It can find courses, suggest formats and games, fill in the form below, and look up tee times.</p>
        </div>
        {turns.length ? (
          <button type="button" className="min-h-[44px] shrink-0 px-2 text-sm text-slate-500 underline" onClick={() => { setTurns([]); setError(''); }}>
            New chat
          </button>
        ) : null}
      </div>

      {turns.length ? (
        <ol ref={listRef} className="max-h-[60vh] space-y-3 overflow-y-auto" aria-live="polite">
          {turns.map((turn, index) => (
            <li key={index} className={turn.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[90%] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-sm ${turn.role === 'user' ? 'bg-[#0f5132] text-white' : 'bg-slate-50 text-slate-800'}`}>
                <Linked text={turn.content} />
              </div>
              {turn.links?.length ? <BookingLinks links={turn.links} /> : null}
              {turn.plan ? (
                <div className="mt-2 rounded-2xl border border-[#c9d8c7] bg-white p-3 text-sm">
                  <p className="mb-1 font-bold">{turn.plan.lines[0]}</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {turn.plan.lines.slice(1).map((line, lineIndex) => <li key={`${lineIndex}-${line}`}>{line}</li>)}
                  </ul>
                  {turn.plan.status === 'offered' ? (
                    <div className="mt-3 space-y-1">
                      <Button onClick={() => use(index)}>Use this plan</Button>
                      <p className="text-xs text-slate-500">Fills in the form below, replacing what&apos;s there. Nothing is created until you tap Create event.</p>
                    </div>
                  ) : (
                    <p className="mt-2 font-semibold text-[#0f5132]">In the form below. Review it, then tap Create event.</p>
                  )}
                </div>
              ) : null}
            </li>
          ))}
          {sending ? <li className="text-sm text-slate-500" role="status">Working on it… (searching courses and tee times can take a minute or two)</li> : null}
        </ol>
      ) : (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className="min-h-[44px] rounded-full border border-[#c9d8c7] px-3 text-left text-sm" onClick={() => void send(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={submit} className="flex gap-2">
        <textarea
          className="min-h-[48px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-3 text-base"
          rows={2}
          maxLength={2000}
          placeholder="Where, when, how many, what kind of golf…"
          aria-label="Message the planning assistant"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <Button type="submit" disabled={sending || !input.trim()}>Send</Button>
      </form>
      <p className="text-xs text-slate-500">Uses AI and web search. Check course details, prices and tee times with the course.</p>
      {children}
    </Card>
  );
}
