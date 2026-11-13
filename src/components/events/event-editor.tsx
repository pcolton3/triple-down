'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/button';
import { formatCurrency } from '@/lib/utils/currency';
import {
  EVENT_GAMES,
  FORMAT_LABELS,
  TEAM_FORMATS,
  isTeamEvent,
  renumberDays,
  suggestedBuyIn,
  type AgendaItem,
  type DayFormat,
  type EventDay,
  type EventDraft,
  type GameDefinition,
} from '@/lib/events/golf-events';
import { INVITE_SECTIONS, composeDescription, formatFromDays, parseDescription, sideGamesFromDays, tidyDescription, type InviteParts } from '@/lib/events/invite-sections';

const input = 'min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{title}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function money(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

function MoneyInput({ value, onChange, ariaLabel }: { value: number; onChange: (value: number) => void; ariaLabel: string }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
      <input
        aria-label={ariaLabel}
        className={`${input} pl-7`}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value || ''}
        placeholder="0"
        onChange={(e) => onChange(money(e.target.value))}
      />
    </span>
  );
}

function addDays(date: string, count: number) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year) return '';
  const next = new Date(year, month - 1, day + count);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export function newDay(previous?: EventDay): EventDay {
  return {
    day: (previous?.day ?? 0) + 1,
    date: previous?.date ? addDays(previous.date, 1) : '',
    format: previous?.format ?? 'stroke_play',
    games: previous?.games?.map((game) => ({ ...game })) ?? [{ key: 'skins', amount: 20 }, { key: 'ctp', amount: 10 }],
  };
}

function GamePicker({ day, onChange }: { day: EventDay; onChange: (games: EventDay['games']) => void }) {
  const games = day.games ?? [];
  const selected = (key: string) => games.find((game) => game.key === key);
  const toggle = (definition: GameDefinition) => {
    if (selected(definition.key)) onChange(games.filter((game) => game.key !== definition.key));
    else onChange([...games, { key: definition.key, amount: definition.kind === 'pot' ? 10 : 5 }]);
  };
  const setAmount = (key: string, amount: number) => onChange(games.map((game) => (game.key === key ? { ...game, amount } : game)));

  const renderGroup = (kind: 'pot' | 'group', title: string, hint: string) => (
    <div>
      <p className="text-sm font-bold">{title}</p>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      <ul className="space-y-2">
        {EVENT_GAMES.filter((game) => game.kind === kind).map((definition) => {
          const game = selected(definition.key);
          return (
            <li key={definition.key} className={`rounded-xl border p-2 ${game ? 'border-[#0f5132] bg-[#f3f8f2]' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <label className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 shrink-0" checked={Boolean(game)} onChange={() => toggle(definition)} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{definition.label}</span>
                    <span className="block text-xs text-slate-500">{definition.blurb}</span>
                  </span>
                </label>
                {game ? (
                  <span className="w-28 shrink-0">
                    <MoneyInput ariaLabel={`${definition.label} amount, day ${day.day}`} value={game.amount} onChange={(amount) => setAmount(definition.key, amount)} />
                    <span className="mt-0.5 block text-center text-xs text-slate-500">{kind === 'pot' ? 'per player' : 'per bet'}</span>
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderGroup('pot', 'Pot games', 'Paid from the buy-in. Everyone in the event is in these.')}
      {renderGroup('group', 'Group games', 'Optional bets inside each group, settled in the app after the round. Not part of the buy-in.')}
    </div>
  );
}

export function EventEditor({ draft, onChange, autoBuyInDefault = true }: { draft: EventDraft; onChange: (draft: EventDraft) => void; autoBuyInDefault?: boolean }) {
  const [autoBuyIn, setAutoBuyIn] = useState(autoBuyInDefault);
  const teamEvent = isTeamEvent(draft);
  const suggested = suggestedBuyIn(draft);

  function update(patch: Partial<EventDraft>, auto = autoBuyIn) {
    const next = { ...draft, ...patch };
    onChange(auto ? { ...next, buy_in: suggestedBuyIn(next) } : next);
  }

  const parts = parseDescription(draft.description);
  function setPart(key: keyof InviteParts, value: string) {
    update({ description: composeDescription({ ...parts, [key]: value }) });
  }

  function setDay(index: number, patch: Partial<EventDay>) {
    update({ days: draft.days.map((day, i) => (i === index ? { ...day, ...patch } : day)) });
  }

  function setAgenda(id: string, patch: Partial<AgendaItem>) {
    update({ agenda: draft.agenda.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Event</h2>
        <Field title="Event name">
          <input className={input} placeholder="Birthday Cup 2027" maxLength={80} value={draft.title} onChange={(e) => update({ title: e.target.value })} />
        </Field>
        <Field title="Message to players">
          <textarea
            className={`${input} min-h-[96px]`}
            placeholder="What it's for, who's invited, anything people should know first."
            value={parts.message}
            onChange={(e) => setPart('message', e.target.value)}
          />
        </Field>
        <Field title="Player limit (optional)" hint="Signups stop when the event is full.">
          <input
            className={input}
            type="number"
            inputMode="numeric"
            min={2}
            value={draft.max_players ?? ''}
            onChange={(e) => update({ max_players: e.target.value ? Math.max(0, Math.round(Number(e.target.value))) : null })}
          />
        </Field>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">Invite details</h2>
          <p className="text-sm text-slate-500">Each box shows as its own section on the invite. Leave any blank to skip it.</p>
        </div>
        {INVITE_SECTIONS.map((section) => {
          const starter = section.key === 'format' ? formatFromDays(draft.days) : section.key === 'side_games' ? sideGamesFromDays(draft.days) : '';
          return (
            <div key={section.key}>
              <Field title={section.title}>
                <textarea
                  className={`${input} min-h-[96px]`}
                  placeholder={section.placeholder}
                  value={parts[section.key]}
                  onChange={(e) => setPart(section.key, e.target.value)}
                />
              </Field>
              {starter && !parts[section.key].trim() ? (
                <button type="button" className="min-h-[44px] text-sm font-semibold text-[#0f5132] underline" onClick={() => setPart(section.key, starter)}>
                  Fill in from the golf days
                </button>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Golf days</h2>
        {draft.days.map((day, index) => (
          <div key={index} className="space-y-4 rounded-2xl border border-[#c9d8c7] p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Day {day.day}</h3>
              {draft.days.length > 1 ? (
                <button
                  type="button"
                  className="min-h-[44px] px-2 text-sm text-red-700 underline"
                  onClick={() => {
                    if (window.confirm(`Remove golf day ${day.day}?`)) update({ days: renumberDays(draft.days.filter((_, i) => i !== index)) });
                  }}
                >
                  Remove day
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field title="Date"><input type="date" className={input} value={day.date} onChange={(e) => setDay(index, { date: e.target.value })} /></Field>
              <Field title="First tee time"><input type="time" className={input} value={day.teeTime ?? ''} onChange={(e) => setDay(index, { teeTime: e.target.value })} /></Field>
            </div>
            <Field title="Main format" hint={TEAM_FORMATS.includes(day.format) ? 'Counts toward the two-team, Ryder Cup style score.' : undefined}>
              <select className={input} value={day.format} onChange={(e) => setDay(index, { format: e.target.value as DayFormat })}>
                {Object.entries(FORMAT_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field title="Course"><input className={input} value={day.course ?? ''} onChange={(e) => setDay(index, { course: e.target.value })} /></Field>
              <Field title="Address"><input className={input} value={day.address ?? ''} onChange={(e) => setDay(index, { address: e.target.value })} /></Field>
            </div>
            <Field title="Course website"><input className={input} inputMode="url" value={day.website ?? ''} onChange={(e) => setDay(index, { website: e.target.value })} /></Field>
            <Field title="Course notes (dress code, range, carts…)">
              <textarea className={`${input} min-h-[72px]`} value={day.notes ?? ''} onChange={(e) => setDay(index, { notes: e.target.value })} />
            </Field>
            <GamePicker day={day} onChange={(games) => setDay(index, { games })} />
          </div>
        ))}
        <Button variant="secondary" className="w-full" onClick={() => update({ days: [...draft.days, newDay(draft.days[draft.days.length - 1])] })}>
          Add another golf day
        </Button>
      </section>

      {teamEvent ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Teams</h2>
          <p className="text-sm text-slate-600">You&apos;ll put players on teams from the organizer page once they sign up.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field title="Team 1 name"><input className={input} maxLength={40} value={draft.team_one_name} onChange={(e) => update({ team_one_name: e.target.value })} /></Field>
            <Field title="Team 2 name"><input className={input} maxLength={40} value={draft.team_two_name} onChange={(e) => update({ team_two_name: e.target.value })} /></Field>
          </div>
          <Field title="Team bet per player" hint="Paid from the buy-in. The team with the most match points splits it.">
            <MoneyInput ariaLabel="Team bet per player" value={draft.team_bet} onChange={(team_bet) => update({ team_bet })} />
          </Field>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Buy-in</h2>
        <label className="flex min-h-[44px] items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={autoBuyIn}
            onChange={(e) => {
              setAutoBuyIn(e.target.checked);
              if (e.target.checked) update({}, true);
            }}
          />
          Set the buy-in to the total of the pot games{teamEvent ? ' and team bet' : ''} ({formatCurrency(suggested)})
        </label>
        <Field title="Buy-in per player">
          {autoBuyIn ? (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-lg font-bold">{formatCurrency(draft.buy_in)}</p>
          ) : (
            <MoneyInput ariaLabel="Buy-in per player" value={draft.buy_in} onChange={(buy_in) => update({ buy_in })} />
          )}
        </Field>
        {!autoBuyIn && draft.buy_in !== suggested ? (
          <p className="text-xs text-amber-700">
            The games add up to {formatCurrency(suggested)}, so {formatCurrency(Math.abs(draft.buy_in - suggested))} is {draft.buy_in > suggested ? 'not assigned to a game' : 'over-assigned'}.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Agenda</h2>
        <p className="text-sm text-slate-600">Dinners, practice, travel, anything else on the schedule.</p>
        {draft.agenda.map((item) => (
          <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Field title="What"><input className={input} placeholder="Birthday dinner" value={item.title} onChange={(e) => setAgenda(item.id, { title: e.target.value })} /></Field>
              <Field title="Date"><input type="date" className={input} value={item.date} onChange={(e) => setAgenda(item.id, { date: e.target.value })} /></Field>
              <Field title="Time"><input type="time" className={input} value={item.time ?? ''} onChange={(e) => setAgenda(item.id, { time: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field title="Place"><input className={input} value={item.location ?? ''} onChange={(e) => setAgenda(item.id, { location: e.target.value })} /></Field>
              <Field title="Address"><input className={input} value={item.address ?? ''} onChange={(e) => setAgenda(item.id, { address: e.target.value })} /></Field>
            </div>
            <Field title="Link (reservation, menu…)"><input className={input} inputMode="url" value={item.link ?? ''} onChange={(e) => setAgenda(item.id, { link: e.target.value })} /></Field>
            <Field title="Notes"><textarea className={`${input} min-h-[60px]`} value={item.notes ?? ''} onChange={(e) => setAgenda(item.id, { notes: e.target.value })} /></Field>
            <button type="button" className="min-h-[44px] text-sm text-red-700 underline" onClick={() => update({ agenda: draft.agenda.filter((entry) => entry.id !== item.id) })}>
              Remove item
            </button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => update({ agenda: [...draft.agenda, { id: crypto.randomUUID(), date: draft.days[0]?.date ?? '', time: '18:00', title: '' }] })}
        >
          Add agenda item
        </Button>
      </section>
    </div>
  );
}

/** The fields to save, with blank agenda rows dropped and days in date order. */
export function cleanDraft(draft: EventDraft): EventDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    description: tidyDescription(draft.description),
    team_one_name: draft.team_one_name.trim() || 'Team 1',
    team_two_name: draft.team_two_name.trim() || 'Team 2',
    team_bet: isTeamEvent(draft) ? draft.team_bet : 0,
    days: renumberDays(draft.days),
    agenda: draft.agenda.filter((item) => item.title.trim()),
  };
}
