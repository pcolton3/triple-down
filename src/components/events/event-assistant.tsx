'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { planChanges, type AssistantReply, type WireChange } from '@/lib/assistant/changes';
import { localToday, updateEvent, updateSignup, type GolfEvent, type Signup } from '@/lib/events/golf-events';

type Proposal = { changes: WireChange[]; lines: string[]; status: 'pending' | 'applied' | 'dismissed' };
type Turn = { role: 'user' | 'assistant'; content: string; proposal?: Proposal };

type Props =
  | { mode: 'player'; event: GolfEvent }
  | {
      mode: 'organizer';
      event: GolfEvent;
      signups: Signup[];
      organizerKey: string;
      /** Why Apply is blocked right now (e.g. unsaved edits in the editor), if it is. */
      applyBlocked?: string;
      /** Reloads the event and signups from the database. */
      reload: () => Promise<{ event: GolfEvent; signups: Signup[] }>;
      onApplied: () => void;
    };

const SUGGESTIONS = {
  organizer: ["Who hasn't paid yet?", 'Add a 6:30 PM dinner on Saturday', 'Are the teams balanced?'],
  player: ['What do I owe?', 'When and where do we tee off?', 'How does Banker work?'],
};

function storageKey(code: string, mode: string) {
  return `triple-track-assistant:${mode}:${code}`;
}

/** What the model sees for a past turn, including what happened to any proposal it made. */
function historyText(turn: Turn) {
  if (!turn.proposal) return turn.content;
  const status = { pending: 'not applied yet', applied: 'the organizer applied these', dismissed: 'the organizer dismissed these' }[turn.proposal.status];
  return `${turn.content}\n\n[Proposed changes (${status}): ${turn.proposal.lines.join('; ') || 'none'}]`;
}

export function EventAssistant(props: Props) {
  const { event, mode } = props;
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey(event.code, mode)) ?? '[]') as Turn[];
      if (Array.isArray(saved) && saved.length) setTurns(saved);
    } catch { /* A fresh chat is fine. */ }
  }, [event.code, mode]);

  useEffect(() => {
    try { sessionStorage.setItem(storageKey(event.code, mode), JSON.stringify(turns.slice(-30))); } catch { /* Not saved; still works. */ }
    if (open) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns, open, event.code, mode]);

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
          code: event.code,
          mode,
          key: props.mode === 'organizer' ? props.organizerKey : undefined,
          today: localToday(),
          messages: next.map((turn) => ({ role: turn.role, content: historyText(turn) })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<AssistantReply> & { error?: string };
      if (!response.ok) throw new Error(data.error || 'The assistant had a problem. Try again.');
      const changes = props.mode === 'organizer' && Array.isArray(data.changes) ? data.changes : [];
      const plan = changes.length && props.mode === 'organizer' ? planChanges(props.event, props.signups, changes) : null;
      const reply = data.reply?.trim() || (plan?.lines.length ? 'Here are the changes:' : 'Sorry, I lost my train of thought. Ask again?');
      setTurns([
        ...next,
        {
          role: 'assistant',
          content: plan?.problems.length ? `${reply}\n\nI couldn't draft that cleanly: ${plan.problems.join(' ')}` : reply,
          ...(plan && plan.lines.length && !plan.problems.length ? { proposal: { changes, lines: plan.lines, status: 'pending' as const } } : {}),
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

  function setStatus(index: number, status: Proposal['status']) {
    setTurns((current) => current.map((turn, i) => (i === index && turn.proposal ? { ...turn, proposal: { ...turn.proposal, status } } : turn)));
  }

  async function apply(index: number) {
    if (props.mode !== 'organizer') return;
    const proposal = turns[index]?.proposal;
    if (!proposal) return;
    setApplying(index);
    setError('');
    try {
      // Re-plan against what's in the database right now, in case anything changed since.
      const fresh = await props.reload();
      const plan = planChanges(fresh.event, fresh.signups, proposal.changes);
      if (plan.problems.length) throw new Error(plan.problems.join(' '));
      if (Object.keys(plan.eventPatch).length) await updateEvent(event.code, props.organizerKey, plan.eventPatch);
      for (const signup of plan.signupPatches) await updateSignup(event.code, props.organizerKey, signup.id, signup.patch);
      setStatus(index, 'applied');
      props.onApplied();
    } catch (applyError) {
      setError(applyError instanceof Error ? `Not applied: ${applyError.message}` : 'Not applied.');
    } finally {
      setApplying(null);
    }
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    void send(input);
  }

  if (!open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Ask the assistant</h2>
          <p className="text-sm text-slate-600">
            {mode === 'organizer' ? 'Questions about your event, or changes in plain English. You approve every change.' : 'Questions about this event, the games or the app.'}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>{turns.length ? 'Open chat' : 'Ask'}</Button>
      </Card>
    );
  }

  const description = (changes: WireChange[]) => changes.find((change) => change.op === 'set_text' && change.field === 'description') as Extract<WireChange, { op: 'set_text' }> | undefined;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Assistant</h2>
        <div className="flex gap-1">
          {turns.length ? (
            <button type="button" className="min-h-[44px] px-2 text-sm text-slate-500 underline" onClick={() => { setTurns([]); setError(''); }}>
              New chat
            </button>
          ) : null}
          <button type="button" className="min-h-[44px] px-2 text-sm font-semibold text-[#0f5132] underline" onClick={() => setOpen(false)}>
            Hide
          </button>
        </div>
      </div>

      {turns.length ? (
        <ol className="max-h-[60vh] space-y-3 overflow-y-auto" aria-live="polite">
          {turns.map((turn, index) => (
            <li key={index} className={turn.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[90%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${turn.role === 'user' ? 'bg-[#0f5132] text-white' : 'bg-slate-50 text-slate-800'}`}>
                {turn.content}
              </div>
              {turn.proposal ? (
                <div className="mt-2 rounded-2xl border border-[#c9d8c7] bg-white p-3 text-sm">
                  <p className="mb-1 font-bold">Proposed changes</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {turn.proposal.lines.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  {description(turn.proposal.changes) ? (
                    <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-2 text-slate-700">{description(turn.proposal.changes)?.value}</p>
                  ) : null}
                  {turn.proposal.status === 'pending' ? (
                    props.mode === 'organizer' && props.applyBlocked ? (
                      <p className="mt-2 text-amber-700">{props.applyBlocked}</p>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <Button disabled={applying !== null} onClick={() => void apply(index)}>{applying === index ? 'Applying…' : 'Apply'}</Button>
                        <Button variant="secondary" disabled={applying !== null} onClick={() => setStatus(index, 'dismissed')}>Dismiss</Button>
                      </div>
                    )
                  ) : (
                    <p className={`mt-2 font-semibold ${turn.proposal.status === 'applied' ? 'text-[#0f5132]' : 'text-slate-500'}`}>
                      {turn.proposal.status === 'applied' ? 'Applied' : 'Dismissed'}
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          ))}
          {sending ? <li className="text-sm text-slate-500" role="status">Thinking…</li> : null}
          <div ref={endRef} />
        </ol>
      ) : (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS[mode].map((suggestion) => (
            <button key={suggestion} type="button" className="min-h-[44px] rounded-full border border-[#c9d8c7] px-3 text-sm" onClick={() => void send(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={submit} className="flex gap-2">
        <textarea
          className="min-h-[48px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-3 text-base"
          rows={1}
          maxLength={2000}
          placeholder={mode === 'organizer' ? 'Ask or tell me what to change…' : 'Ask about this event…'}
          aria-label="Message the assistant"
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
      <p className="text-xs text-slate-500">
        {mode === 'organizer' ? 'Uses AI. Nothing changes until you tap Apply. Player emails are never sent to it.' : 'Uses AI and can make mistakes. Check with the organizer on anything important.'}
      </p>
    </Card>
  );
}
