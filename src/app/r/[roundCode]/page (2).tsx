'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/shared/button';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';

function formatPosition(amount: number) {
  if (amount > 0) return `Up ${formatCurrency(amount)}`;
  if (amount < 0) return `Down ${formatCurrency(Math.abs(amount))}`;
  return 'Even';
}

function NumberField({
  value,
  onChange,
  placeholder,
  readOnly = false,
  blankWhenZero = false,
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  placeholder?: string;
  readOnly?: boolean;
  blankWhenZero?: boolean;
}) {
  const displayValue = value == null ? '' : blankWhenZero && value === 0 ? '' : value;

  return (
    <input
      type="number"
      inputMode="numeric"
      value={displayValue}
      readOnly={readOnly}
      placeholder={placeholder}
      onFocus={(event) => event.currentTarget.select()}
      onMouseUp={(event) => event.preventDefault()}
      onChange={(event) => {
        if (!onChange) return;
        const next = event.target.value;
        onChange(next === '' ? null : Number(next));
      }}
      className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
    />
  );
}

export default function LiveRoundPage() {
  const router = useRouter();
  const {
    round,
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
    getRunningTotals,
    getCurrentHoleSummary,
  } = useRoundStore();

  const [message, setMessage] = useState('');
  const hole = round.holes.find((item) => item.holeNumber === round.currentHole) ?? round.holes[0];
  const banker = round.players.find((player) => player.id === hole.bankerPlayerId) ?? round.players[0];
  const totals = getRunningTotals();
  const summary = getCurrentHoleSummary();
  const matchupSummaryByPlayerId = Object.fromEntries(summary.matchups.map((item) => [item.playerId, item]));
  const isFinalHole = round.currentHole === round.totalHoles;
  const holesSaved = useMemo(() => round.holes.filter((item) => item.isSaved).length, [round.holes]);
  const pressAction = hole.par === 3 ? 'Triple' : 'Double';

  function handleUpdate() {
    const result = updateHole();
    setMessage(result.message ?? (result.ok ? `Hole ${hole.holeNumber} updated.` : 'Unable to update this hole.'));
  }

  function handleNext() {
    const result = nextHole();
    if (result.ok && isFinalHole) {
      router.push(`/r/${round.roundCode}/settle`);
      return;
    }
    setMessage(
      result.message ??
        (result.ok
          ? `Moved to Hole ${Math.min(round.currentHole + 1, round.totalHoles)}.`
          : 'Unable to move to the next hole.')
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-6 pb-24">
      <section className="rounded-3xl bg-[#2f8df3] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">{round.courseName}</p>
            <h1 className="mt-1 text-2xl font-bold">{round.title}</h1>
            <p className="mt-2 text-sm">
              Hole {hole.holeNumber} of {round.totalHoles} • {holesSaved} holes updated • Banker
            </p>
          </div>
          <div className="rounded-2xl bg-white/20 px-3 py-2 text-right">
            <p className="text-xs uppercase tracking-wide opacity-80">Current Banker</p>
            <p className="text-xl font-bold">
              {banker.name}
              {summary.bankerGetsStrokeFromNames.length > 0 ? ' *' : ''}
            </p>
            <p className="text-xs opacity-90">
              {summary.bankerGetsStrokeFromNames.length > 0
                ? `Gets stroke from: ${summary.bankerGetsStrokeFromNames.join(', ')}`
                : 'No stroke this hole'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Hole Setup</h2>
            <p className="text-sm text-slate-500">Update the par, hole handicap, and current Banker.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Par</label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
              value={hole.par}
              onChange={(event) => setPar(Number(event.target.value) as 3 | 4 | 5)}
            >
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hole Hcp</label>
            <NumberField value={hole.handicapIndex} onChange={(value) => setHoleHandicap(value ?? 1)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Banker</label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
              value={hole.bankerPlayerId}
              onChange={(event) => setBanker(event.target.value)}
            >
              {round.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Banker gross score</p>
            <h2 className="text-xl font-bold">
              {banker.name}
              {summary.bankerGetsStrokeFromNames.length > 0 ? ' *' : ''}
            </h2>
          </div>
          <Button variant="secondary" onClick={toggleBankerPress}>
            {hole.bankerPressed ? `Undo Banker ${pressAction}` : `Banker ${pressAction}`}
          </Button>
        </div>

        <NumberField
          value={hole.bankerGrossScore}
          onChange={setBankerGrossScore}
          placeholder="Gross"
          blankWhenZero
        />
      </section>

      <section className="space-y-3">
        {hole.matchups.map((matchup) => {
          const player = round.players.find((item) => item.id === matchup.playerId) ?? round.players[0];
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
                <Button variant="secondary" onClick={() => togglePlayerPress(player.id)}>
                  {matchup.pressed ? `Undo ${pressAction}` : pressAction}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bet</label>
                  <NumberField
                    value={matchup.baseWager}
                    onChange={(value) => setWager(player.id, value ?? 0)}
                    placeholder="Bet"
                    blankWhenZero
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gross</label>
                  <NumberField
                    value={matchup.grossScore}
                    onChange={(value) => setPlayerGrossScore(player.id, value)}
                    placeholder="Gross"
                    blankWhenZero
                  />
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-500">
                {summaryItem?.playerGetsStroke ? `${player.name} gets a stroke on this hole.` : 'No stroke for this matchup.'}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Current Hole Summary</h3>
            <p className="text-sm text-slate-500">Payouts are determined by net scores. Gross scores are only used for automatic birdie doubles.</p>
          </div>
          <div className="flex gap-3 text-sm font-medium text-[#2f8df3]">
            <Link href={`/r/${round.roundCode}/history`}>History</Link>
            <Link href={`/r/${round.roundCode}/settle`}>Settle Up</Link>
          </div>
        </div>

        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Banker: <span className="font-semibold text-slate-900">{summary.bankerName}</span>
          {summary.bankerGetsStrokeFromNames.length > 0 ? <span className="ml-1 text-[#2f8df3]">*</span> : null}
          {' '}• Handicap {summary.bankerHandicap}
          {summary.bankerGetsStrokeFromNames.length > 0 ? ` • Gets stroke from: ${summary.bankerGetsStrokeFromNames.join(', ')}` : ' • No stroke this hole'}
        </div>

        <div className="space-y-2">
          {summary.matchups.map((item) => (
            <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="font-semibold">
                  {item.playerName}
                  {item.playerGetsStroke ? ' *' : ''}
                </p>
                <p className="text-sm font-semibold">{item.payoutText}</p>
              </div>
              <p className="text-sm text-slate-600">
                Bet {formatCurrency(item.baseWager)}
                {item.modifiers.length > 0 ? `, ${item.modifiers.join(', ')}` : ''}
              </p>
              <p className="text-sm text-slate-600">
                Net {item.playerNetScore ?? '-'} vs Banker {item.bankerNetScore ?? '-'}
                {item.playerGetsStroke ? ' • player gets stroke' : ''}
                {item.bankerGetsStroke ? ' • banker gets stroke' : ''}
              </p>
              <p className="text-sm text-slate-600">Total multiplier x{item.totalMultiplier}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Running Totals</h3>
            <p className="text-sm text-slate-500">Up or down only during the round.</p>
          </div>
          <div className="flex gap-3 text-sm font-medium text-[#2f8df3]">
            <Link href={`/r/${round.roundCode}/history`}>History</Link>
            <Link href={`/r/${round.roundCode}/settle`}>Settle Up</Link>
          </div>
        </div>

        <div className="space-y-2">
          {totals.map((total) => (
            <div key={total.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
              <span className="font-medium">{total.name}</span>
              <span className="font-bold">{formatPosition(total.amount)}</span>
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
          {isFinalHole ? 'Finish' : 'Next'}
        </Button>
      </div>
    </main>
  );
}
