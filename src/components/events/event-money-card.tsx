'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { eventMoney, type DayRound } from '@/lib/events/event-money';
import type { GolfEvent, Signup } from '@/lib/events/golf-events';
import { loadSharedRoundByCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);

/** End-of-event money for the organizer: Cup result, team bet, pots won, and who's owed what. */
export function EventMoneyCard({ event, signups }: { event: GolfEvent; signups: Signup[] }) {
  const roundCodes = event.days.map((day) => `${day.day}:${day.roundCode ?? ''}`).join(',');
  const [dayRounds, setDayRounds] = useState<DayRound[] | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all(event.days.map(async (day) => ({
        day: day.day,
        round: day.roundCode ? await loadSharedRoundByCode(day.roundCode).then((bundle) => (bundle ? sharedRoundBundleToRoundState(bundle) : null)) : null,
      })))
        .then((rounds) => { if (!cancelled) { setDayRounds(rounds); setError(''); } })
        .catch((loadError: Error) => { if (!cancelled) setError(loadError.message); });
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
    // Reload when a day gets a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.code, roundCodes]);

  const result = useMemo(() => (dayRounds ? eventMoney(event, signups, dayRounds) : null), [event, signups, dayRounds]);
  if (!signups.length) return null;

  const teamName = (team: string | null) => (team === 'team_one' ? event.team_one_name : team === 'team_two' ? event.team_two_name : '');
  const anyRound = event.days.some((day) => day.roundCode);

  function summaryText() {
    if (!result) return '';
    const lines = [`${event.title}: money`];
    if (result.cup.leader) lines.push(`Cup: ${event.team_one_name} ${result.cup.teamOne} - ${event.team_two_name} ${result.cup.teamTwo}${result.cup.final ? (result.cup.leader === 'tie' ? ' (tied)' : ` - ${teamName(result.cup.leader)} win`) : ' (in progress)'}`);
    for (const row of [...result.rows].sort((a, b) => b.net - a.net)) {
      if (!row.potTotal && !row.teamBetWon && row.paid) continue;
      const parts = [row.potTotal ? `pots ${money(row.potTotal)}` : '', row.teamBetWon ? `team bet ${money(row.teamBetWon)}` : '', !row.paid ? `owes buy-in ${money(row.buyIn)}` : ''].filter(Boolean);
      lines.push(`${row.name}: ${parts.join(', ')} → ${row.net >= 0 ? `gets ${money(row.net)}` : `pays ${money(-row.net)}`}`);
    }
    lines.push('Banker and group games: see each day’s settle-up in the app.');
    return lines.join('\n');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summaryText());
      setCopied(true);
    } catch {
      window.prompt('Copy this:', summaryText());
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Event money</h2>
        <p className="text-sm text-slate-600">What you pay out of the buy-ins you hold: pots won on every day, plus the team bet once the Cup is decided.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {!anyRound ? <p className="text-sm text-slate-500">Nothing to settle yet. This fills in once a day&apos;s round starts.</p> : null}
      {result && anyRound ? (
        <>
          {result.cup.leader ? (
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="font-bold">
                {event.team_one_name} {result.cup.teamOne} – {event.team_two_name} {result.cup.teamTwo}
              </p>
              <p className="text-sm text-slate-600">
                {result.cup.final
                  ? result.cup.leader === 'tie' ? 'Cup tied: everyone gets their team bet back.' : `${teamName(result.cup.leader)} win the Cup and split the ${money(result.teamBetPot)} team bet.`
                  : `In progress (${result.cup.daysScored} of ${result.cup.teamDays} team days finished). Team bet pot: ${money(result.teamBetPot)}.`}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2">Player</th>
                  <th className="py-2 pr-2 text-right">Buy-in</th>
                  <th className="py-2 pr-2 text-right">Pots won</th>
                  <th className="py-2 pr-2 text-right">Team bet</th>
                  <th className="py-2 text-right">You pay / they owe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {[...result.rows].sort((a, b) => b.net - a.net).map((row) => (
                  <tr key={row.signupId}>
                    <td className="py-2 pr-2">
                      <span className="font-semibold">{row.name}</span>
                      {row.pots.length ? <span className="block text-xs text-slate-500">{row.pots.map((win) => `D${win.day} ${win.game} ${money(win.amount)}`).join(' · ')}</span> : null}
                    </td>
                    <td className="py-2 pr-2 text-right">{money(row.buyIn)} <span className={row.paid ? 'text-[#0f5132]' : 'text-amber-700'}>{row.paid ? 'paid' : 'unpaid'}</span></td>
                    <td className="py-2 pr-2 text-right">{row.potTotal ? money(row.potTotal) : '–'}</td>
                    <td className="py-2 pr-2 text-right">{row.teamBetWon ? money(row.teamBetWon) : '–'}</td>
                    <td className={`py-2 text-right font-bold ${row.net < 0 ? 'text-amber-700' : ''}`}>{row.net === 0 ? '–' : row.net > 0 ? `Pay ${money(row.net)}` : `Owes ${money(-row.net)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-slate-600">
            Buy-ins {money(result.totals.buyInsDue)} ({money(result.totals.collected)} collected) · pots paid {money(result.totals.potsPaid)} · team bet paid {money(result.totals.teamBetPaid)} · left over {money(result.totals.left)}
          </p>
          {result.notes.map((note) => <p key={note} className="text-sm text-amber-700">{note}</p>)}
          <p className="text-xs text-slate-500">
            Banker and in-group games settle between players on each day&apos;s settle-up page:{' '}
            {event.days.filter((day) => day.roundCode).map((day, index) => (
              <span key={day.day}>{index ? ', ' : ''}<Link className="font-semibold text-[#0f5132] underline" href={`/r/${day.roundCode}/settle`}>Day {day.day}</Link></span>
            ))}
          </p>
          <Button variant="secondary" onClick={() => void copy()}>{copied ? 'Summary copied' : 'Copy summary for the group chat'}</Button>
        </>
      ) : null}
    </Card>
  );
}
