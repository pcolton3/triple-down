'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { OpenTimes } from '@/components/events/open-times';
import { parseTeeTimes, teeTimeRequestText, type TeeTimeResult } from '@/lib/assistant/tee-times';
import { dayChoice, formatEventDate, formatTime, isDayLocked, loadGolfEvent, localToday, updateEvent, type GolfEvent, type Signup } from '@/lib/events/golf-events';
import { LinkedText } from '@/components/shared/linked-text';

const input = 'min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base';
const label = 'mb-1 block text-sm font-semibold';

function storageName(code: string, day: number) {
  return `triple-track-teetimes:${code}:${day}`;
}

/** Finds booking options for a golf day (course site first), drafts the golf-shop request, and records booked times. */
type Props =
  | { event: GolfEvent; signups: Signup[]; organizerKey: string; blocked?: string; onSaved: () => void; onDraftTimes?: never; embedded?: boolean }
  /** On the plan page, before the event exists: the form is sent as the draft and times go back into the form. */
  | { event: GolfEvent; onDraftTimes: (dayNumber: number, times: string[]) => void; signups?: never; organizerKey?: never; blocked?: never; onSaved?: never; embedded?: boolean };

export function TeeTimeFinder({ event, signups = [], organizerKey, blocked, onSaved, onDraftTimes, embedded = false }: Props) {
  const days = event.days.filter((day) => !isDayLocked(day));
  const [dayNumber, setDayNumber] = useState(days[0]?.day ?? 0);
  const day = days.find((item) => item.day === dayNumber) ?? days[0];
  const playing = useMemo(() => (day ? signups.filter((signup) => dayChoice(event, signup.choices, day.day).playing).length : 0), [day, event, signups]);
  const [players, setPlayers] = useState(0);
  const [earliest, setEarliest] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<TeeTimeResult | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  // Search problems show right under the button, where the organizer is looking.
  const [findNotice, setFindNotice] = useState('');
  const [booked, setBooked] = useState('');

  // Reset the form (and bring back the last search for this day) when the day changes.
  useEffect(() => {
    if (!day) return;
    setPlayers(playing || players || 8);
    setEarliest(day.teeTime || '08:00');
    setBooked((day.teeTimes?.length ? day.teeTimes : day.teeTime ? [day.teeTime] : []).map(formatTime).join(', '));
    setNotice('');
    setFindNotice('');
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageName(event.code, day.day)) ?? 'null') as TeeTimeResult | null;
      setResult(saved);
      setSubject(saved?.email.subject ?? '');
      setBody(saved?.email.body ?? '');
    } catch {
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.day, event.code]);

  if (!days.length) return null;
  if (!day) return null;
  const teeTimes = Math.max(1, Math.ceil(players / 4));
  const noCourse = !day.course?.trim();

  async function find() {
    if (!day) return;
    if (!day.course?.trim()) {
      setFindNotice(`Add a course for day ${day.day} ${onDraftTimes ? 'in the form' : 'in the editor below'} first.`);
      return;
    }
    setBusy(true);
    setNotice('');
    setFindNotice('');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(onDraftTimes ? { draft: event } : { code: event.code, key: organizerKey }),
          mode: 'teetimes',
          today: localToday(),
          messages: [{ role: 'user', content: teeTimeRequestText({ day: day.day, date: day.date, course: day.course, address: day.address, website: day.website, players, teeTimes, earliest, notes }) }],
        }),
      });
      const data = (await response.json().catch(() => ({}))) as TeeTimeResult & { error?: string };
      if (!response.ok) throw new Error(data.error || 'The search had a problem. Try again.');
      setResult(data);
      setSubject(data.email.subject || `Tee times for ${players} on ${day.date ? formatEventDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' }) : 'our event'}`);
      setBody(data.email.body);
      try { sessionStorage.setItem(storageName(event.code, day.day), JSON.stringify(data)); } catch { /* Only lost on reload. */ }
    } catch (error) {
      setFindNotice(error instanceof Error ? error.message : 'Could not search.');
    } finally {
      setBusy(false);
    }
  }

  function openMail() {
    if (!result) return;
    const query = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`].join('&');
    window.location.href = `mailto:${encodeURIComponent(result.email.to)}?${query}`;
    setNotice(result.email.to ? 'Your mail app should open with the request ready to send.' : "Your mail app should open. I didn't find the shop's email, so add it (or call them).");
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied.`);
    } catch {
      window.prompt('Copy this:', text);
    }
  }

  async function saveBooked() {
    if (!day) return;
    const times = parseTeeTimes(booked);
    if (times === null) {
      setNotice('Enter tee times like 7:30, 7:39, 7:48.');
      return;
    }
    if (onDraftTimes) {
      onDraftTimes(day.day, times);
      setNotice(times.length ? `Added to the plan: ${times.map(formatTime).join(', ')}.` : 'Tee times cleared (shows as TBA).');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const latest = await loadGolfEvent(event.code);
      if (!latest) throw new Error('This event no longer exists.');
      const current = latest.days.find((item) => item.day === day.day);
      if (!current || isDayLocked(current)) throw new Error("That day's round has started, so it can't change.");
      await updateEvent(event.code, organizerKey, {
        days: latest.days.map((item) => (item.day === day.day ? { ...item, teeTime: times[0] ?? '', teeTimes: times.length > 1 ? times : undefined } : item)),
      });
      setNotice(times.length ? `Saved. Players will see ${times.map(formatTime).join(', ')}.` : 'Tee times cleared (shows as TBA).');
      onSaved?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const Wrapper = embedded ? 'section' : Card;
  const sourceBadge = (source: 'course' | 'third_party') =>
    source === 'course'
      ? <span className="rounded-full bg-[#e7f3e5] px-2 py-0.5 text-xs font-bold text-[#0f5132]">Course direct · usually cheapest</span>
      : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">Third-party · may cost more</span>;

  return (
    <Wrapper className={embedded ? 'space-y-4 border-t border-slate-200 pt-4' : 'space-y-4'}>
      <div>
        {embedded ? <h3 className="text-lg font-bold">Find tee times</h3> : <h2 className="text-xl font-bold">Tee times</h2>}
        <p className="text-sm text-slate-600">Searches the course&apos;s own site first, then booking sites. Drafts the request to the golf shop. You book, email or call; nothing is sent for you.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {days.length > 1 ? (
          <label className="block sm:col-span-2">
            <span className={label}>Golf day</span>
            <select className={input} value={day.day} onChange={(e) => { setDayNumber(Number(e.target.value)); setResult(null); }}>
              {days.map((item) => (
                <option key={item.day} value={item.day}>
                  Day {item.day}{item.date ? ` · ${formatEventDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}{item.course ? ` · ${item.course}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm sm:col-span-2"><span className="font-semibold">Day {day.day}</span>{day.date ? ` · ${formatEventDate(day.date)}` : ''} · {day.course || 'no course yet'}</p>
        )}
        <label className="block">
          <span className={label}>Players</span>
          <input className={input} type="number" inputMode="numeric" min={1} max={200} value={players || ''} onChange={(e) => setPlayers(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
          <span className="mt-1 block text-xs text-slate-500">{teeTimes} tee time{teeTimes === 1 ? '' : 's'}{playing ? ` · ${playing} signed up for this day` : ''}</span>
        </label>
        <label className="block">
          <span className={label}>First tee time around</span>
          <input className={input} type="time" value={earliest} onChange={(e) => setEarliest(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Anything else (optional)</span>
          <input className={input} maxLength={300} placeholder="Walking, budget, shotgun start, need a range…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <Button className="w-full" disabled={busy || noCourse} onClick={() => void find()}>
        {busy ? 'Searching the course site… (up to a minute or two)' : result ? 'Search again' : 'Find tee times'}
      </Button>
      {noCourse ? (
        <p className="text-sm text-amber-800">Day {day.day} has no course yet. {onDraftTimes ? 'Pick one in the form, or tap Use this plan on a plan above.' : 'Add one in the editor below.'}</p>
      ) : null}
      {findNotice ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{findNotice}</p> : null}

      {result ? (
        <div className="space-y-4">
          {result.reply ? <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><LinkedText text={result.reply} /></p> : null}

          <div className="space-y-1 text-sm">
            <p className="font-bold">{result.course.name || day.course}</p>
            <p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${result.bookable_now === 'yes' ? 'bg-[#e7f3e5] text-[#0f5132]' : result.bookable_now === 'no' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                {result.bookable_now === 'yes' ? 'Bookable now' : result.bookable_now === 'no' ? 'Not open for booking yet' : 'Booking window unknown'}
              </span>
            </p>
            {result.booking_window ? <p><span className="font-semibold">Booking window: </span>{result.booking_window}</p> : null}
            {result.group_policy ? <p><span className="font-semibold">Groups: </span>{result.group_policy}</p> : null}
            {result.course.contact ? <p><span className="font-semibold">Contact: </span>{result.course.contact}</p> : null}
            <div className="flex flex-wrap gap-x-4">
              {result.course.phone ? <a className="min-h-[44px] py-2 font-semibold text-[#0f5132] underline" href={`tel:${result.course.phone.replace(/[^\d+]/g, '')}`}>Call {result.course.phone}</a> : null}
              {result.course.email ? <a className="min-h-[44px] py-2 font-semibold text-[#0f5132] underline" href={`mailto:${result.course.email}`}>{result.course.email}</a> : null}
            </div>
          </div>

          {result.options.length ? (
            <ul className="space-y-2">
              {result.options.map((option) => (
                <li key={option.url} className={`rounded-xl border p-3 ${option.source === 'course' ? 'border-[#0f5132]' : 'border-slate-200'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href={option.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0f5132] underline">{option.title}</a>
                    {sourceBadge(option.source)}
                  </div>
                  {option.price ? <p className="mt-1 text-sm">{option.price}</p> : null}
                  {option.notes ? <p className="mt-1 text-xs text-slate-500">{option.notes}</p> : null}
                  {option.source === 'course' ? <OpenTimes url={option.url} date={day.date} players={players} /> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-slate-500">Prices and policies come from the course&apos;s pages and can be out of date. Confirm when you book.</p>

          <div className="space-y-2">
            <h3 className="font-bold">Request to the golf shop</h3>
            <input className={input} aria-label="Email subject" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
            <textarea className={`${input} min-h-[160px]`} aria-label="Email body" maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={!body.trim()} onClick={openMail}>Open in my mail app</Button>
              <Button variant="secondary" disabled={!body.trim()} onClick={() => void copy(`${subject}\n\n${body}`, 'Request')}>Copy request</Button>
            </div>
            {!result.email.to ? <p className="text-xs text-slate-500">I didn&apos;t find the shop&apos;s email, so add the address in your mail app, or call.</p> : null}
          </div>

          {result.call_notes ? (
            <div>
              <h3 className="font-bold">If you call</h3>
              <p className="whitespace-pre-line text-sm text-slate-700"><LinkedText text={result.call_notes} /></p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <h3 className="font-bold">Booked? Save the times</h3>
        <input className={input} placeholder="7:30, 7:39, 7:48" value={booked} onChange={(e) => setBooked(e.target.value)} />
        <Button variant="secondary" disabled={busy || Boolean(blocked)} onClick={() => void saveBooked()}>{onDraftTimes ? `Put these in the plan for day ${day.day}` : `Save tee times for day ${day.day}`}</Button>
        {blocked ? <p className="text-xs text-amber-800">{blocked}</p> : <p className="text-xs text-slate-500">{onDraftTimes ? 'Only add times you actually booked; players read them as real.' : 'Shows on the invite and schedule.'} Clear the box and save to go back to TBA.</p>}
      </div>

      {notice ? <p role="status" className="text-sm font-semibold text-slate-700">{notice}</p> : null}
    </Wrapper>
  );
}
