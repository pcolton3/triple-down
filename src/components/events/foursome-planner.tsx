'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { checkFoursomes, suggestFoursomes, type FoursomePlan, type PlanPlayer } from '@/lib/events/foursomes';
import { dayChoice, formatEventDate, FORMAT_LABELS, isDayLocked, loadGolfEvent, updateEvent, type EventDay, type GolfEvent, type Signup } from '@/lib/events/golf-events';

const selectClass = 'min-h-[44px] rounded-xl border border-slate-300 bg-white px-2 text-sm';

function DayPlanner({ event, day, signups, organizerKey, blocked, onSaved }: {
  event: GolfEvent;
  day: EventDay;
  signups: Signup[];
  organizerKey: string;
  blocked?: string;
  onSaved: () => void;
}) {
  const players: PlanPlayer[] = useMemo(
    () => signups.filter((signup) => dayChoice(event, signup.choices, day.day).playing).map((signup) => ({ id: signup.id, name: signup.name, handicap: signup.handicap, team: signup.team })),
    [event, signups, day.day]
  );
  const saved = day.foursomes ?? { groups: [], pairings: [] };
  const [plan, setPlan] = useState<FoursomePlan>(saved);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const locked = isDayLocked(day);
  const singles = day.format === 'singles_match';
  const teamName = (team: PlanPlayer['team']) => (team === 'team_one' ? event.team_one_name : team === 'team_two' ? event.team_two_name : 'No team');
  const byId = new Map(players.map((player) => [player.id, player]));
  const check = checkFoursomes(day.format, players, plan);
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved);
  const groupOf = (id: string) => plan.groups.findIndex((group) => group.includes(id));
  const opponentOf = (id: string) => plan.pairings.find(([a, b]) => a === id || b === id)?.find((other) => other !== id) ?? '';
  const unplaced = players.filter((player) => groupOf(player.id) < 0);
  const groupOptions = plan.groups.length + 1; // existing groups plus "New group"

  function move(id: string, target: number) {
    setPlan((current) => {
      const groups = current.groups.map((group) => group.filter((member) => member !== id));
      while (groups.length <= target) groups.push([]);
      if (target >= 0) groups[target].push(id);
      return { ...current, groups: groups.filter((group, index) => group.length || index < current.groups.length) };
    });
  }

  function setOpponent(id: string, opponent: string) {
    setPlan((current) => {
      const pairings = current.pairings.filter((pair) => !pair.includes(id) && (!opponent || !pair.includes(opponent)));
      return { ...current, pairings: opponent ? [...pairings, [id, opponent] as [string, string]] : pairings };
    });
  }

  async function save() {
    setBusy(true);
    setNotice('');
    try {
      // Patch only this day on the latest copy, so other edits aren't overwritten.
      const latest = await loadGolfEvent(event.code);
      if (!latest) throw new Error('This event no longer exists.');
      const cleaned: FoursomePlan = { groups: plan.groups.filter((group) => group.length), pairings: plan.pairings };
      await updateEvent(event.code, organizerKey, { days: latest.days.map((item) => (item.day === day.day ? { ...item, foursomes: cleaned } : item)) });
      setPlan(cleaned);
      setNotice(check.problems.length ? 'Saved, but fix the problems above before starting the round.' : 'Saved. Starting this day’s round will use these groups.');
      onSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">
          Day {day.day}{day.date ? ` · ${formatEventDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''} · {FORMAT_LABELS[day.format]}
        </h3>
        <span className="text-sm text-slate-500">{players.length} playing</span>
      </div>
      {locked ? <p className="text-sm text-slate-600">This day&apos;s round has started; change groups in the round itself.</p> : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy || !players.length} onClick={() => setPlan(suggestFoursomes(day.format, players))}>
              {plan.groups.length ? 'Suggest again' : 'Suggest foursomes'}
            </Button>
            <Button disabled={busy || !dirty || Boolean(blocked)} onClick={() => void save()}>{busy ? 'Saving…' : dirty ? 'Save foursomes' : 'Saved'}</Button>
          </div>
          {blocked && dirty ? <p className="text-sm text-amber-700">{blocked}</p> : null}
          <p className="text-xs text-slate-500">
            {day.format === 'team_match' ? 'Team match: each foursome should be 2 v 2. ' : singles ? 'Singles: put each player in the same group as their opponent. ' : ''}
            Players are matched by handicap; move anyone with the Group menu.
          </p>

          {plan.groups.map((group, index) => (
            <div key={index} className="rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-sm font-bold">Group {index + 1} <span className="font-normal text-slate-500">· {group.filter((id) => byId.has(id)).length} players</span></p>
              <ul className="space-y-2">
                {group.filter((id) => byId.has(id)).map((id) => {
                  const player = byId.get(id)!;
                  return (
                    <li key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0"><span className="font-semibold">{player.name}</span> <span className="text-slate-500">· {player.handicap} · {teamName(player.team)}</span></span>
                      <span className="flex flex-wrap gap-2">
                        {singles ? (
                          <select aria-label={`Opponent for ${player.name}`} className={selectClass} value={opponentOf(id)} onChange={(e) => setOpponent(id, e.target.value)}>
                            <option value="">No opponent</option>
                            {players.filter((other) => other.id !== id && other.team !== player.team).map((other) => <option key={other.id} value={other.id}>vs {other.name}</option>)}
                          </select>
                        ) : null}
                        <select aria-label={`Group for ${player.name}`} className={selectClass} value={index} onChange={(e) => move(id, Number(e.target.value))}>
                          {Array.from({ length: groupOptions }, (_, g) => <option key={g} value={g}>{g < plan.groups.length ? `Group ${g + 1}` : 'New group'}</option>)}
                        </select>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {unplaced.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-3">
              <p className="mb-2 text-sm font-bold">Not in a group</p>
              <ul className="space-y-2">
                {unplaced.map((player) => (
                  <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span><span className="font-semibold">{player.name}</span> <span className="text-slate-500">· {player.handicap} · {teamName(player.team)}</span></span>
                    <select aria-label={`Group for ${player.name}`} className={selectClass} value="" onChange={(e) => move(player.id, Number(e.target.value))}>
                      <option value="" disabled>Add to…</option>
                      {Array.from({ length: groupOptions }, (_, g) => <option key={g} value={g}>{g < plan.groups.length ? `Group ${g + 1}` : 'New group'}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan.groups.length ? (
            check.problems.length || check.warnings.length ? (
              <div className="space-y-1 text-sm">
                {check.problems.map((problem) => <p key={problem} className="text-red-700">✗ {problem}</p>)}
                {check.warnings.map((warning) => <p key={warning} className="text-amber-700">! {warning}</p>)}
              </div>
            ) : <p className="text-sm font-semibold text-[#0f5132]">✓ Everyone is placed{day.format === 'team_match' ? ', every group is balanced' : singles ? ', and every match is in one group' : ''}.</p>
          ) : null}
          {notice ? <p role="status" className="text-sm text-slate-700">{notice}</p> : null}
        </>
      )}
    </div>
  );
}

/** Plan each golf day's foursomes (and singles opponents) ahead of the event, with checks. */
export function FoursomePlanner(props: { event: GolfEvent; signups: Signup[]; organizerKey: string; blocked?: string; onSaved: () => void }) {
  if (!props.event.days.length || !props.signups.length) return null;
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Foursomes</h2>
        <p className="text-sm text-slate-600">Set the groups before the event. When you start a day&apos;s round it uses them.</p>
      </div>
      {props.event.days.map((day) => (
        <DayPlanner key={`${day.day}-${JSON.stringify(day.foursomes ?? null)}`} {...props} day={day} />
      ))}
    </Card>
  );
}
