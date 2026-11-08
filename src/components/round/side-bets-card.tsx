'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RoundState } from '@/types/round';
import { formatCurrency } from '@/lib/utils/currency';
import { currentDeviceId } from '@/lib/realtime/group-rounds';
import { createSideBet, loadSideBets, respondToSideBet, subscribeToSideBets } from '@/lib/realtime/side-bets';
import { SIDE_BET_KINDS, sideBetLabel, sideBetProgress, type SideBet, type SideBetKind } from '@/lib/games/side-bets';

const input = 'min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 py-3';
const meKey = (roundId: string) => `triple-track-me:${roundId}`;

/** Head-to-head bets any two golfers in the round can make, across groups, without the organizer. */
export function SideBetsCard({ round, onBetsChange }: { round: RoundState; onBetsChange?: (bets: SideBet[]) => void }) {
  const [bets, setBets] = useState<SideBet[]>([]);
  const [me, setMe] = useState('');
  const [opponent, setOpponent] = useState('');
  const [amount, setAmount] = useState('20');
  const [kind, setKind] = useState<SideBetKind>('low_net_18');
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const players = round.players;
  const name = (key: string) => players.find((player) => player.id === key)?.name ?? 'Unknown golfer';
  const shared = !round.id.startsWith('round-');

  const reload = useCallback(async () => {
    try {
      const next = await loadSideBets(round.id);
      setBets(next);
      onBetsChange?.(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load side bets.');
    }
    // onBetsChange is a callback prop; reloading shouldn't depend on its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id]);

  useEffect(() => {
    if (!shared) return;
    try { setMe(localStorage.getItem(meKey(round.id)) ?? ''); } catch { /* no saved name */ }
    setDeviceId(currentDeviceId());
    void reload();
    const stop = subscribeToSideBets(round.id, () => void reload());
    const timer = window.setInterval(() => void reload(), 20000);
    return () => { stop(); window.clearInterval(timer); };
  }, [round.id, reload, shared]);

  if (!shared || players.length < 2) return null;

  function chooseMe(id: string) {
    setMe(id);
    if (id === opponent) setOpponent('');
    try { localStorage.setItem(meKey(round.id), id); } catch { /* fine without it */ }
  }

  async function propose() {
    if (!me || !opponent) { setMessage('Pick who is betting whom.'); return; }
    setBusy(true);
    setMessage('');
    try {
      await createSideBet({ roundId: round.id, kind, amount: Number(amount), proposerKey: me, opponentKey: opponent });
      setMessage(`Bet sent. It counts once ${name(opponent)} accepts on their phone.`);
      setFormOpen(false);
      setOpponent('');
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send the bet.');
    } finally {
      setBusy(false);
    }
  }

  async function respond(bet: SideBet, status: 'accepted' | 'declined' | 'cancelled') {
    const prompt =
      status === 'accepted'
        ? `Are you ${name(bet.opponentKey)}? Accepting puts you in for ${formatCurrency(bet.amount)}: ${sideBetLabel(bet.kind).toLowerCase()} against ${name(bet.proposerKey)}. Accepted bets can't be undone.`
        : status === 'declined'
          ? `Decline ${name(bet.proposerKey)}'s ${formatCurrency(bet.amount)} bet?`
          : 'Cancel this bet?';
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setMessage('');
    try {
      await respondToSideBet(bet.id, status);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update the bet.');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const live = bets.filter((bet) => bet.status === 'accepted' || bet.status === 'pending');
  const closed = bets.filter((bet) => bet.status === 'declined' || bet.status === 'cancelled');
  const waitingOnMe = live.filter((bet) => bet.status === 'pending' && bet.opponentKey === me).length;

  return (
    <section id="side-bets" className="scroll-mt-4 rounded-2xl border border-[#c9d8c7] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Side bets{waitingOnMe ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800">{waitingOnMe} for you</span> : null}</h2>
        {!formOpen ? (
          <button type="button" className="min-h-[44px] shrink-0 rounded-xl bg-[#0f5132] px-4 text-sm font-bold text-white" onClick={() => setFormOpen(true)}>
            + Side bet
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-600">Bet anyone in the round, in any group. A bet counts once the other golfer accepts. Ties pay nothing.</p>

      {formOpen ? (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">I am</span>
            <select className={input} value={me} onChange={(event) => chooseMe(event.target.value)}>
              <option value="">Pick your name</option>
              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Betting against</span>
            <select className={input} value={opponent} onChange={(event) => setOpponent(event.target.value)}>
              <option value="">Pick a golfer</option>
              {players.filter((player) => player.id !== me).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Amount ($)</span>
              <input className={input} type="number" inputMode="decimal" min={1} step="any" value={amount} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Bet</span>
              <select className={input} value={kind} onChange={(event) => setKind(event.target.value as SideBetKind)}>
                {SIDE_BET_KINDS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="min-h-[48px] flex-1 rounded-xl bg-[#0f5132] px-4 font-bold text-white disabled:opacity-50" onClick={() => void propose()}>
              {busy ? 'Sending…' : 'Send bet'}
            </button>
            <button type="button" className="min-h-[48px] rounded-xl border border-slate-300 px-4 font-semibold" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}

      {message ? <p role="status" className="mt-3 text-sm text-slate-700">{message}</p> : null}

      {live.length ? (
        <ul className="mt-3 space-y-2">
          {live.map((bet) => {
            const progress = sideBetProgress(round, bet);
            const winner = progress.winnerKey;
            return (
              <li key={bet.id} className={`rounded-xl p-3 ${bet.status === 'pending' ? 'border border-amber-300 bg-amber-50' : 'bg-slate-50'}`}>
                <p className="font-semibold">
                  {name(bet.proposerKey)} vs {name(bet.opponentKey)} · {formatCurrency(bet.amount)}
                  <span className="font-normal text-slate-600"> · {sideBetLabel(bet.kind)}</span>
                </p>
                {bet.status === 'pending' ? (
                  <>
                    <p className="mt-1 text-sm text-amber-800">Waiting for {name(bet.opponentKey)} to accept</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} className="min-h-[44px] rounded-xl bg-[#0f5132] px-4 text-sm font-bold text-white" onClick={() => void respond(bet, 'accepted')}>
                        Accept as {name(bet.opponentKey)}
                      </button>
                      <button type="button" disabled={busy} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold" onClick={() => void respond(bet, 'declined')}>
                        Decline
                      </button>
                      {deviceId && bet.proposerDeviceId === deviceId ? (
                        <button type="button" disabled={busy} className="min-h-[44px] px-2 text-sm font-semibold text-slate-600 underline" onClick={() => void respond(bet, 'cancelled')}>
                          Cancel bet
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className={`mt-1 text-sm ${winner ? 'font-semibold text-[#0f5132]' : 'text-slate-700'}`}>
                    {progress.summary}
                    {winner ? ` · ${name(winner === bet.proposerKey ? bet.opponentKey : bet.proposerKey)} pays ${name(winner)} ${formatCurrency(bet.amount)}` : ''}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : !formOpen ? (
        <p className="mt-3 text-sm text-slate-500">No side bets yet.</p>
      ) : null}

      {closed.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">Declined or cancelled ({closed.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            {closed.map((bet) => (
              <li key={bet.id}>
                {name(bet.proposerKey)} vs {name(bet.opponentKey)} · {formatCurrency(bet.amount)} · {sideBetLabel(bet.kind)} · {bet.status}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
