'use client';

import { useEffect, useState } from 'react';
import { loadCtpLeader, type CtpLeader } from '@/lib/realtime/ctp-leader';
import type { HoleState, Player, RoundState } from '@/types/round';

/**
 * Closest to the pin on a par 3. Shows the current mark from any group; a group only marks its
 * player when they beat it, and the most recent mark wins the hole.
 */
export function CtpCard({ round, hole, groupNumber, players, canEdit, onChange }: {
  round: RoundState;
  hole: HoleState;
  groupNumber: number;
  players: Player[];
  canEdit: boolean;
  onChange: (playerId: string | null) => void;
}) {
  const [leader, setLeader] = useState<CtpLeader | null>(null);
  const shared = !round.id.startsWith('round-');
  const multiGroup = (round.multiFoursome?.groups.length ?? 1) > 1;

  useEffect(() => {
    if (!shared || !multiGroup) return;
    let cancelled = false;
    const load = () => loadCtpLeader(round.id, hole.holeNumber).then((next) => { if (!cancelled) setLeader(next); });
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [round.id, hole.holeNumber, shared, multiGroup, hole.ctpWinnerPlayerId]);

  const leaderName = leader ? round.players.find((player) => player.id === leader.playerKey)?.name ?? 'someone' : null;
  const ours = leader?.groupNumber === groupNumber;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-lg font-bold">Closest to the Pin</h2>
      {multiGroup ? (
        <p className="mb-2 text-sm text-slate-600">
          {leaderName
            ? ours
              ? `Your group holds the mark: ${leaderName}.`
              : `Current mark: ${leaderName} (Group ${leader!.groupNumber}). Only pick someone if they finished closer.`
            : 'No mark yet. Pick your closest player if they hit the green.'}
        </p>
      ) : null}
      <label className="sr-only" htmlFor={`ctp-${groupNumber}-${hole.holeNumber}`}>Closest to the pin</label>
      <select
        id={`ctp-${groupNumber}-${hole.holeNumber}`}
        className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
        value={hole.ctpWinnerPlayerId ?? ''}
        disabled={!canEdit}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{multiGroup && leaderName && !ours ? 'Not closer than the mark' : 'No winner'}</option>
        {players.map((player) => (
          <option key={player.id} value={player.id}>{player.name}</option>
        ))}
      </select>
    </section>
  );
}
