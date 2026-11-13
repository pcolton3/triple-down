'use client';

import { useState } from 'react';
import { formatTime, localToday } from '@/lib/events/golf-events';
import { ENGINE_LABELS, type TeeSheet } from '@/lib/tee-sheets/engines';

const small = 'min-h-[40px] rounded-lg border border-slate-300 bg-white px-2 text-sm';

function tomorrow() {
  const [year, month, day] = localToday().split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function priceText(rates: TeeSheet['times'][number]['rates']) {
  if (!rates.length) return '';
  const prices = [...new Set(rates.map((rate) => rate.price))];
  return prices.length === 1 ? `$${prices[0]}` : `$${Math.min(...prices)}–$${Math.max(...prices)}`;
}

/** "See open times" for a booking link: reads that day's tee sheet (TeeItUp, Quick18, foreUP) through /api/tee-sheet. */
export function OpenTimes({ url, date: initialDate, players: initialPlayers }: { url: string; date?: string; players?: number }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initialDate && initialDate >= localToday() ? initialDate : tomorrow());
  const [players, setPlayers] = useState(initialPlayers || 4);
  const [sheets, setSheets] = useState<TeeSheet[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load(nextDate = date, nextPlayers = players) {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ url, date: nextDate, players: String(nextPlayers) });
      const response = await fetch(`/api/tee-sheet?${query}`);
      const data = (await response.json().catch(() => ({}))) as { sheets?: TeeSheet[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Couldn't read the tee sheet.");
      setSheets(data.sheets ?? []);
    } catch (loadError) {
      setSheets(null);
      setError(loadError instanceof Error ? loadError.message : "Couldn't read the tee sheet.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="mt-1 min-h-[40px] text-sm font-semibold text-[#0f5132] underline" onClick={() => { setOpen(true); void load(); }}>
        See open times
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Date"
          type="date"
          className={small}
          value={date}
          min={localToday()}
          onChange={(e) => {
            setDate(e.target.value);
            if (e.target.value) void load(e.target.value, players);
          }}
        />
        <label className="flex items-center gap-1 text-sm">
          <input
            aria-label="Players"
            type="number"
            min={1}
            max={40}
            inputMode="numeric"
            className={`${small} w-16`}
            value={players}
            onChange={(e) => setPlayers(Math.max(1, Math.round(Number(e.target.value) || 1)))}
            onBlur={() => void load()}
          />
          players
        </label>
        <button type="button" className="min-h-[40px] px-1 text-sm text-slate-500 underline" onClick={() => setOpen(false)}>Hide</button>
      </div>
      {loading ? <p className="text-sm text-slate-500" role="status">Reading the tee sheet…</p> : null}
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
      {!loading && sheets
        ? sheets.map((sheet) => {
            const shown = showAll ? sheet.times : sheet.times.slice(0, 12);
            return (
              <div key={`${sheet.course}-${sheet.bookingUrl}`} className="space-y-1">
                <p className="text-sm font-bold">
                  {sheet.course || 'Tee sheet'} <span className="font-normal text-slate-500">· {sheet.times.length} open · via {ENGINE_LABELS[sheet.engine]}</span>
                </p>
                {sheet.groupPicks.length ? (
                  <p className="rounded-lg bg-[#e7f3e5] px-2 py-1 text-sm font-semibold text-[#0f5132]">
                    Back to back for {players}: {sheet.groupPicks.map(formatTime).join(', ')}
                  </p>
                ) : sheet.times.length && players > 4 ? (
                  <p className="text-xs text-slate-500">No back-to-back times fit all {players} that day.</p>
                ) : null}
                {shown.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {shown.map((time) => (
                      <li key={`${time.time}-${time.bookUrl}`}>
                        <a
                          href={time.bookUrl || sheet.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-block rounded-lg border px-2 py-1 text-xs ${sheet.groupPicks.includes(time.time) ? 'border-[#0f5132] bg-white font-bold' : 'border-slate-200 bg-white'}`}
                        >
                          {formatTime(time.time)} · {time.spots} spot{time.spots === 1 ? '' : 's'}
                          {priceText(time.rates) ? ` · ${priceText(time.rates)}` : ''}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {sheet.times.length > 12 && !showAll ? (
                  <button type="button" className="text-xs font-semibold text-[#0f5132] underline" onClick={() => setShowAll(true)}>Show all {sheet.times.length}</button>
                ) : null}
                {sheet.note ? <p className="text-xs text-slate-500">{sheet.note}</p> : null}
                <a href={sheet.bookingUrl} target="_blank" rel="noopener noreferrer" className="inline-block min-h-[40px] py-2 text-sm font-semibold text-[#0f5132] underline">
                  Book on the course&apos;s site ↗
                </a>
              </div>
            );
          })
        : null}
      <p className="text-[11px] text-slate-400">Live from the course&apos;s booking system. Times and prices can change before you book.</p>
    </div>
  );
}
