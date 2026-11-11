'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { dayChoice, formatEventDate, isTeamEvent, localToday, type GolfEvent, type Signup } from '@/lib/events/golf-events';

type Audience = { id: string; label: string; people: Signup[] };

function audiences(event: GolfEvent, signups: Signup[]): Audience[] {
  const list: Audience[] = [{ id: 'all', label: 'Everyone', people: signups }];
  const unpaid = signups.filter((signup) => !signup.paid);
  if (unpaid.length && unpaid.length < signups.length) list.push({ id: 'unpaid', label: 'Not paid yet', people: unpaid });
  if (event.days.length > 1) {
    for (const day of event.days) {
      list.push({
        id: `day-${day.day}`,
        label: `Day ${day.day} players${day.date ? ` (${formatEventDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })})` : ''}`,
        people: signups.filter((signup) => dayChoice(event, signup.choices, day.day).playing),
      });
    }
  }
  if (isTeamEvent(event)) {
    list.push({ id: 'team_one', label: event.team_one_name, people: signups.filter((signup) => signup.team === 'team_one') });
    list.push({ id: 'team_two', label: event.team_two_name, people: signups.filter((signup) => signup.team === 'team_two') });
  }
  return list.filter((audience) => audience.id === 'all' || audience.people.length);
}

/** Writes an email to some or all players and hands it to the organizer's own mail app (everyone BCC'd). */
export function EmailPlayers({ event, signups, organizerKey }: { event: GolfEvent; signups: Signup[]; organizerKey: string }) {
  const options = useMemo(() => audiences(event, signups), [event, signups]);
  const [audienceId, setAudienceId] = useState('all');
  const [subject, setSubject] = useState(event.title);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const audience = options.find((option) => option.id === audienceId) ?? options[0];
  const emails = audience.people.map((person) => person.email).filter(Boolean);

  async function draft() {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: event.code,
          mode: 'email',
          key: organizerKey,
          today: localToday(),
          messages: [{
            role: 'user',
            content: `Write an email to ${audience.label.toLowerCase()} (${emails.length} player${emails.length === 1 ? '' : 's'}: ${audience.people.map((person) => person.name).join(', ')}). ${body.trim() ? `What it's about, in my words:\n${body.trim()}` : 'A friendly update with the key details everyone needs.'}`,
          }],
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { subject?: string; body?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'The assistant had a problem. Try again.');
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
      setNotice('Drafted. Edit anything you like, then open it in your mail app.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not draft it.');
    } finally {
      setBusy(false);
    }
  }

  function openMail() {
    const query = [`bcc=${emails.map(encodeURIComponent).join(',')}`, `subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`].join('&');
    window.location.href = `mailto:?${query}`;
    setNotice('Your mail app should open with everyone in BCC. If nothing happened, use the copy buttons and paste into any email.');
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      window.prompt('Copy this:', text);
    }
  }

  if (!signups.length) return null;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Email players</h2>
        <p className="text-sm text-slate-600">Sends from your own email, with everyone BCC&apos;d so replies come to you.</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">To</span>
        <select className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base" value={audience.id} onChange={(e) => setAudienceId(e.target.value)}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>{option.label} ({option.people.length})</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Subject</span>
        <input className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-base" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Message</span>
        <textarea
          className="min-h-[140px] w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          maxLength={5000}
          placeholder="Write it, or jot a few notes (“remind unpaid guys, $300 by April 1, Venmo me”) and tap Draft it for me."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !emails.length || !body.trim()} onClick={openMail}>Open in my mail app</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void draft()}>{busy ? 'Drafting…' : 'Draft it for me'}</Button>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" className="min-h-[44px] font-semibold text-[#0f5132] underline" onClick={() => void copy(emails.join(', '), `${emails.length} email address${emails.length === 1 ? '' : 'es'}`)}>Copy addresses</button>
        <button type="button" className="min-h-[44px] font-semibold text-[#0f5132] underline" disabled={!body.trim()} onClick={() => void copy(`${subject}\n\n${body}`, 'Message')}>Copy message</button>
      </div>
      {notice ? <p className="text-sm text-slate-700" role="status">{notice}</p> : null}
    </Card>
  );
}
