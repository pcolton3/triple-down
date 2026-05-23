'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/shared/button';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';
import { loadSharedRoundByCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';

function NumberField({
  value,
  onChange,
  placeholder,
  blankWhenZero = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  blankWhenZero?: boolean;
}) {
  const displayValue = value == null ? '' : blankWhenZero && value === 0 ? '' : value;

  return (
    <input
      type="number"
      inputMode="numeric"
      value={displayValue}
      placeholder={placeholder}
      onFocus={(event) => event.currentTarget.select()}
      onMouseUp={(event) => event.preventDefault()}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
    />
  );
}

export default function GroupScoringPage() {
  const router = useRouter();
  const params = useParams<{ roundCode: string; groupNumber: string }>();
  const groupNumber = Math.max(1, Number(params.groupNumber) || 1);
  const {
    round,
    hydrateRound,
    setBanker,
    setPar,
    setHoleHandicap,
    setWager,
    togglePlayerPress,
    toggleBankerPress,
    setPlayerGrossScore,
    setBankerGrossScore,
    updateHole,
    nextHole,
    getCurrentHoleSummary,
    setCtpWinner,
  } = useRoundStore();
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'not_found' | 'ready'>('idle');

  useEffect(() => {
    let cancelled = false;

    async function loadRound() {
      const requestedCode = params.roundCode?.toUpperCase();
      if (!requestedCode || round.roundCode === requestedCode) return;

      setLoadStatus('loading');
      const bundle = await loadSharedRoundByCode(requestedCode);
      if (cancelled) return;

      if (!bundle) {
        setLoadStatus('not_found');
        return;
      }

      hydrateRound(sharedRoundBundleToRoundState(bundle));
      setLoadStatus('ready');
    }

    void loadRound();

    return () => {
      cancelled = true;
    };
  }, [hydrateRound, params.roundCode, round.roundCode]);

  const group = round.multiFoursome?.groups.find((item) => item.groupNumber === groupNumber);
  const groupPlayerIds =
    round.multiFoursome?.groupPlayers
      .filter((item) => item.groupNumber === groupNumber)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => item.playerId) ?? round.players.map((player) => player.id);
  const groupPlayers = groupPlayerIds
    .map((playerId) => round.players.find((player) => player.id === playerId))
    .filter((player): player is typeof round.players[number] => Boolean(player));
  const currentHoleNumber = group?.currentHole ?? round.currentHole;
  const hole =
    round.holes.find((item) => (item.groupNumber ?? 1) === groupNumber && item.holeNumber === currentHoleNumber) ??
    round.holes.find((item) => item.holeNumber === currentHoleNumber) ??
    round.holes[0];
  const banker = groupPlayers.find((player) => player.id === hole.bankerPlayerId) ?? groupPlayers[0] ?? round.players[0];
  const summary = getCurrentHoleSummary(groupNumber);
  const matchupSummaryByPlayerId = Object.fromEntries(summary.matchups.map((item) => [item.playerId, item]));
  const isFinalHole = hole.holeNumber === round.totalHoles;
  const pressAction = hole.par === 3 ? 'Triple' : 'Double';

  function handleUpdate() {
    const result = updateHole(groupNumber);
    setMessage(result.message ?? (result.ok ? `Hole ${hole.holeNumber} updated.` : 'Unable to update this hole.'));
  }

  function handleNext() {
    const result = nextHole(groupNumber);
    if (result.ok && isFinalHole) {
      router.push(`/r/${round.roundCode}`);
      return;
    }
    setMessage(result.message ?? (result.ok ? `Moved to Hole ${hole.holeNumber + 1}.` : 'Unable to move to the next hole.'));
  }

  async function copyGroupLink() {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    await navigator.clipboard?.writeText(`${origin}/r/${round.roundCode}/group/${groupNumber}`);
    setCopied(true);
  }

  if (!group && round.multiFoursome?.groups.length) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <div className="rounded-2xl border border-[#68aef7] bg-white p-4">
          <h1 className="text-xl font-bold">Group not found</h1>
          <p className="mt-2 text-sm text-slate-500">This round does not have a Group {groupNumber}.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#2f8df3]" href={`/r/${round.roundCode}`}>
            Back to leaderboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-6 pb-24">
      {loadStatus === 'loading' ? (
        <section className="rounded-2xl border border-[#68aef7] bg-white p-4 text-sm text-slate-600">
          Loading round {params.roundCode}...
        </section>
      ) : null}
      {loadStatus === 'not_found' ? (
        <section className="rounded-2xl border border-[#68aef7] bg-white p-4 text-sm text-slate-600">
          No round was found for code {params.roundCode}.
        </section>
      ) : null}
      <section className="rounded-3xl bg-[#2f8df3] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">{round.courseName}</p>
            <h1 className="mt-1 text-2xl font-bold">Group {groupNumber}</h1>
            <p className="mt-2 text-sm">
              Hole {hole.holeNumber} of {round.totalHoles} - {round.title}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white px-3 py-2 font-mono text-lg font-bold text-[#1f2937]">
                {round.roundCode}
              </span>
              <button
                type="button"
                className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold"
                onClick={() => void copyGroupLink()}
              >
                {copied ? 'Copied' : 'Copy Group Link'}
              </button>
            </div>
          </div>
          <Link className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold" href={`/r/${round.roundCode}`}>
            Leaderboard
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Par</label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
              value={hole.par}
              onChange={(event) => setPar(Number(event.target.value) as 3 | 4 | 5, groupNumber)}
            >
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hole Hcp</label>
            <NumberField value={hole.handicapIndex} onChange={(value) => setHoleHandicap(value ?? 1, groupNumber)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Banker</label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
              value={hole.bankerPlayerId}
              onChange={(event) => setBanker(event.target.value, groupNumber)}
            >
              {groupPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-slate-500">{groupPlayers.map((player) => player.name).join(', ')}</p>
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Banker gross score</p>
            <h2 className="text-xl font-bold">{banker.name}</h2>
          </div>
          <Button variant="secondary" onClick={() => toggleBankerPress(groupNumber)}>
            {hole.bankerPressed ? `Undo Banker ${pressAction}` : `Banker ${pressAction}`}
          </Button>
        </div>
        <NumberField value={hole.bankerGrossScore} onChange={(value) => setBankerGrossScore(value, groupNumber)} placeholder="Gross" blankWhenZero />
      </section>

      {hole.par === 3 ? (
        <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Closest to the Pin</h2>
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
            value={hole.ctpWinnerPlayerId ?? ''}
            onChange={(event) => setCtpWinner(hole.holeNumber, event.target.value || null, groupNumber)}
          >
            <option value="">No Winner</option>
            {groupPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      <section className="space-y-3">
        {hole.matchups.map((matchup) => {
          const player = groupPlayers.find((item) => item.id === matchup.playerId) ?? round.players[0];
          const summaryItem = matchupSummaryByPlayerId[player.id];
          return (
            <div key={player.id} className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">
                    {player.name}
                    {summaryItem?.playerGetsStroke ? ' *' : ''}
                  </h3>
                  <p className="text-sm text-slate-500">vs {banker.name}</p>
                </div>
                <Button variant="secondary" onClick={() => togglePlayerPress(player.id, groupNumber)}>
                  {matchup.pressed ? `Undo ${pressAction}` : pressAction}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bet</label>
                  <NumberField value={matchup.baseWager} onChange={(value) => setWager(player.id, value ?? 0, groupNumber)} placeholder="Bet" blankWhenZero />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gross</label>
                  <NumberField value={matchup.grossScore} onChange={(value) => setPlayerGrossScore(player.id, value, groupNumber)} placeholder="Gross" blankWhenZero />
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Net {summaryItem?.playerNetScore ?? '-'} vs Banker {summaryItem?.bankerNetScore ?? '-'}
              </p>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold">Current Hole Summary</h3>
        <div className="space-y-2">
          {summary.matchups.map((item) => (
            <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{item.playerName}</p>
                <p className="text-sm font-semibold">{item.payoutText}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Bet {formatCurrency(item.baseWager)}
                {item.modifiers.length > 0 ? `, ${item.modifiers.join(', ')}` : ''}
              </p>
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{message}</p> : null}

      <div className="flex gap-3">
        <Button className="flex-1" variant="secondary" onClick={handleUpdate}>
          Update
        </Button>
        <Button className="flex-1" onClick={handleNext}>
          {isFinalHole ? 'Finish Group' : 'Next'}
        </Button>
      </div>
    </main>
  );
}
