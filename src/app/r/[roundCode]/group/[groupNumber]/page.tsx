'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/shared/button';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';
import { createSharedRoundFromLocalRound, loadSharedRoundByCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';
import { claimGroupScorekeeper, userCanEditGroup } from '@/lib/realtime/group-rounds';

function formatUnknownError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const details = error as { message?: string; details?: string; hint?: string; code?: string };
    return [details.message, details.details, details.hint, details.code ? `Code: ${details.code}` : null]
      .filter(Boolean)
      .join(' ') || fallback;
  }
  return fallback;
}

function NumberField({
  value,
  onChange,
  placeholder,
  blankWhenZero = false,
  disabled = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  blankWhenZero?: boolean;
  disabled?: boolean;
}) {
  const displayValue = value == null ? '' : blankWhenZero && value === 0 ? '' : value;

  return (
    <input
      type="number"
      inputMode="numeric"
      value={displayValue}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={(event) => event.currentTarget.select()}
      onMouseUp={(event) => event.preventDefault()}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

function formatScore(value: number | null | undefined) {
  return value == null ? '-' : String(value);
}

function strokeSummary(item: {
  playerName: string;
  bankerParticipant: boolean;
  playerGetsStroke: boolean;
  bankerGetsStroke: boolean;
  playerGrossScore: number | null;
  playerNetScore: number | null;
  bankerGrossScore: number | null;
  bankerNetScore: number | null;
}) {
  if (!item.bankerParticipant) {
    return `${item.playerName}: gross ${formatScore(item.playerGrossScore)}. Not playing Banker.`;
  }

  const strokeText = item.playerGetsStroke
    ? `${item.playerName} got 1 stroke`
    : item.bankerGetsStroke
      ? 'Banker got 1 stroke'
      : 'No strokes';

  return `${strokeText}. ${item.playerName}: gross ${formatScore(item.playerGrossScore)}, net ${formatScore(item.playerNetScore)}. Banker: gross ${formatScore(item.bankerGrossScore)}, net ${formatScore(item.bankerNetScore)}.`;
}

export default function GroupScoringPage() {
  const router = useRouter();
  const params = useParams<{ roundCode: string; groupNumber: string }>();
  const searchParams = useSearchParams();
  const groupNumber = Math.max(1, Number(params.groupNumber) || 1);
  const requestedHoleNumber = Number(searchParams.get('hole'));
  const editHoleNumber =
    Number.isInteger(requestedHoleNumber) && requestedHoleNumber >= 1 && requestedHoleNumber <= 18
      ? requestedHoleNumber
      : null;
  const isEditingPastHole = editHoleNumber != null;
  const {
    round,
    hydrateRound,
    setBanker,
    setWager,
    togglePlayerPress,
    toggleBankerPress,
    setPlayerGrossScore,
    setBankerGrossScore,
    updateHole,
    nextHole,
    getCurrentHoleSummary,
    getGroupBankerTotals,
    setCtpWinner,
  } = useRoundStore();
  const [message, setMessage] = useState('');
  const [copiedEventLink, setCopiedEventLink] = useState(false);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'not_found' | 'ready'>('idle');
  const [loadError, setLoadError] = useState('');
  const [scorekeeperName, setScorekeeperName] = useState('');
  const [claimStatus, setClaimStatus] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadRound() {
      const requestedCode = params.roundCode?.toUpperCase();
      const hasUsableRound = Array.isArray(round.holes) && round.holes.length > 0;
      if (!requestedCode || (round.roundCode === requestedCode && !round.id.startsWith('round-') && hasUsableRound)) return;

      try {
        setLoadStatus('loading');
        setLoadError('');
        const bundle = await loadSharedRoundByCode(requestedCode);
        if (cancelled) return;

        if (!bundle) {
          setLoadStatus('not_found');
          return;
        }

        hydrateRound(sharedRoundBundleToRoundState(bundle));
        setLoadStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setLoadStatus('idle');
        setLoadError(formatUnknownError(error, 'Unable to load this round from Supabase.'));
      }
    }

    void loadRound();

    return () => {
      cancelled = true;
    };
  }, [hydrateRound, params.roundCode, round.holes, round.id, round.roundCode]);

  const roundPlayers = Array.isArray(round.players) ? round.players : [];
  const roundHoles = Array.isArray(round.holes) ? round.holes : [];
  const roundGroups = Array.isArray(round.multiFoursome?.groups) ? round.multiFoursome.groups : [];
  const roundGroupPlayers = Array.isArray(round.multiFoursome?.groupPlayers) ? round.multiFoursome.groupPlayers : [];
  const groupSize = round.multiFoursome?.groupSize ?? 4;
  const fallbackGroup = {
    groupNumber,
    groupName: `Group ${groupNumber}`,
    currentHole: round.currentHole || 1,
    scorekeeperName: null,
    scorekeeperDeviceId: null,
  };
  const group = roundGroups.find((item) => item.groupNumber === groupNumber) ?? fallbackGroup;
  const groupPlayerIds =
    roundGroupPlayers
      .filter((item) => item.groupNumber === groupNumber)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => item.playerId);
  const fallbackPlayerIds = roundPlayers
    .slice((groupNumber - 1) * groupSize, groupNumber * groupSize)
    .map((player) => player.id);
  const effectiveGroupPlayerIds = groupPlayerIds.length > 0 ? groupPlayerIds : fallbackPlayerIds;
  const groupPlayers = effectiveGroupPlayerIds
    .map((playerId) => roundPlayers.find((player) => player.id === playerId))
    .filter((player): player is typeof round.players[number] => Boolean(player));
  const bankerPlayers = groupPlayers.filter((player) => player.bankerParticipant !== false);
  const isScoreOnlyGroup = bankerPlayers.length === 0;
  const currentHoleNumber = group?.currentHole ?? round.currentHole;
  const targetHoleNumber = editHoleNumber ?? currentHoleNumber;
  const hole =
    roundHoles.find((item) => (item.groupNumber ?? 1) === groupNumber && item.holeNumber === targetHoleNumber) ??
    roundHoles.find((item) => item.holeNumber === targetHoleNumber) ??
    roundHoles[0];
  const banker = groupPlayers.find((player) => player.id === hole?.bankerPlayerId) ?? groupPlayers[0] ?? roundPlayers[0];
  const isFinalHole = hole?.holeNumber === round.totalHoles;
  const pressAction = hole?.par === 3 ? 'Triple' : 'Double';
  const isClaimed = Boolean(group?.scorekeeperDeviceId);
  const canEdit = group ? userCanEditGroup(group) : false;

  async function refreshRound() {
    const bundle = await loadSharedRoundByCode(round.roundCode);
    if (bundle) hydrateRound(sharedRoundBundleToRoundState(bundle));
    return bundle;
  }

  async function ensureSharedRoundId() {
    if (!round.id.startsWith('round-')) return round.id;

    await createSharedRoundFromLocalRound(useRoundStore.getState().round);
    const bundle = await loadSharedRoundByCode(round.roundCode);
    if (!bundle) throw new Error('Round was saved, but could not be reloaded from Supabase.');

    hydrateRound(sharedRoundBundleToRoundState(bundle));
    return bundle.round.id;
  }

  async function handleClaimScorekeeper() {
    try {
      setClaimStatus('');
      const roundId = await ensureSharedRoundId();
      await claimGroupScorekeeper({
        roundId,
        groupNumber,
        currentHole: hole.holeNumber,
        scorekeeperName: scorekeeperName.trim() || `Group ${groupNumber} Scorekeeper`,
      });
      await refreshRound();
      setClaimStatus('Scorekeeper mode enabled for this device.');
    } catch (error) {
      setClaimStatus(formatUnknownError(error, 'Unable to claim scorekeeper.'));
      try {
        await refreshRound();
      } catch {
        // The claim error is more useful than a follow-up refresh error.
      }
    }
  }

  async function persistRound() {
    await createSharedRoundFromLocalRound(useRoundStore.getState().round);
    await refreshRound();
  }

  async function handleUpdate() {
    if (!canEdit) return;
    const result = updateHole(groupNumber, targetHoleNumber);
    if (result.ok) await persistRound();
    setMessage(
      result.message ??
        (result.ok
          ? isEditingPastHole
            ? `Group ${groupNumber} hole ${hole.holeNumber} correction saved.`
            : `Hole ${hole.holeNumber} updated.`
          : 'Unable to update this hole.')
    );
  }

  async function handleNext() {
    if (!canEdit) return;
    const result = nextHole(groupNumber);
    if (result.ok && !isFinalHole) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (result.ok) await persistRound();
    if (result.ok && isFinalHole) {
      router.push(`/r/${round.roundCode}`);
      return;
    }
    setMessage(result.message ?? (result.ok ? `Moved to Hole ${hole.holeNumber + 1}.` : 'Unable to move to the next hole.'));
  }

  async function copyEventLink() {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    await navigator.clipboard?.writeText(`${origin}/r/${round.roundCode}`);
    setCopiedEventLink(true);
  }

  if (!hole || !banker) {
    const title =
      loadStatus === 'not_found'
        ? 'Round Not Found'
        : loadError
          ? 'Unable to Load Round'
          : 'Loading Round';
    const body =
      loadStatus === 'not_found'
        ? `No round was found for code ${params.roundCode}.`
        : loadError || `Loading round ${params.roundCode} from Supabase...`;

    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <div className="rounded-2xl border border-[#68aef7] bg-white p-4">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{body}</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#2f8df3]" href="/">
            Back Home
          </Link>
        </div>
      </main>
    );
  }

  if (roundGroups.length > 0 && !roundGroups.some((item) => item.groupNumber === groupNumber)) {
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

  const summary = getCurrentHoleSummary(groupNumber, targetHoleNumber);
  const matchupSummaryByPlayerId = Object.fromEntries(summary.matchups.map((item) => [item.playerId, item]));
  const bankerRunningTotals = getGroupBankerTotals(groupNumber).sort((a, b) => b.amount - a.amount);
  const bankerHasPop = summary.bankerGetsStrokeFromNames.length > 0;

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
      {loadError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </section>
      ) : null}
      <section className="rounded-3xl bg-[#2f8df3] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">{round.courseName}</p>
            <h1 className="mt-1 text-2xl font-bold">Group {groupNumber}</h1>
            <p className="mt-2 text-sm">
              {isEditingPastHole ? `Editing Hole ${hole.holeNumber}` : `Hole ${hole.holeNumber} of ${round.totalHoles}`} - {round.title}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white px-3 py-2 font-mono text-lg font-bold text-[#1f2937]">
                {round.roundCode}
              </span>
              <span className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold">Group {groupNumber}</span>
              <button
                type="button"
                className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold"
                onClick={() => void copyEventLink()}
              >
                {copiedEventLink ? 'Event Link Copied' : 'Copy Event Link'}
              </button>
            </div>
          </div>
          <Link className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold" href={`/r/${round.roundCode}`}>
            Leaderboard
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
          <h2 className="text-lg font-bold">Scorekeeper</h2>
            <p className="mt-1 text-sm text-slate-500">
              {canEdit
                ? isEditingPastHole
                  ? 'This device can edit this saved hole for this group.'
                  : 'This device can edit scores for this group.'
                : isClaimed
                  ? `${group?.scorekeeperName ?? 'Another scorekeeper'} is scoring this group. You can still view live scores.`
                  : 'Anyone can view. The first person to claim this group can edit scores.'}
            </p>
          </div>
          {canEdit ? <span className="rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-700">Can Edit</span> : null}
        </div>

        {!isClaimed ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="min-w-0 rounded-xl border border-slate-300 px-3 py-3"
              value={scorekeeperName}
              placeholder="Scorekeeper name"
              onChange={(event) => setScorekeeperName(event.target.value)}
            />
            <Button type="button" onClick={() => void handleClaimScorekeeper()}>
              Claim
            </Button>
          </div>
        ) : null}

        {claimStatus ? <p className="mt-3 text-sm text-slate-500">{claimStatus}</p> : null}
      </section>

      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Hole</p>
              <p className="mt-1 text-xl font-bold">Hole {hole.holeNumber}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Par</p>
              <p className="mt-1 text-xl font-bold">{hole.par}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hcp</p>
              <p className="mt-1 text-xl font-bold">{hole.handicapIndex}</p>
            </div>
          </div>
        </div>
        <div className="mb-3">
          {isScoreOnlyGroup ? (
            <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600">
              Score-only group. These scores count for leaderboard and side games.
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Banker</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
                value={hole.bankerPlayerId}
                disabled={!canEdit}
                onChange={(event) => setBanker(event.target.value, groupNumber, targetHoleNumber)}
              >
                {bankerPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500">{groupPlayers.map((player) => player.name).join(', ')}</p>
      </section>

      {!isScoreOnlyGroup ? (
      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Banker gross score</p>
            <h2 className="text-xl font-bold">
              {banker.name}
              {bankerHasPop ? ' *' : ''}
            </h2>
            {bankerHasPop ? (
              <p className="mt-1 text-xs font-semibold text-slate-500">
                * pop vs {summary.bankerGetsStrokeFromNames.join(', ')}
              </p>
            ) : null}
          </div>
          <Button variant="secondary" disabled={!canEdit} onClick={() => toggleBankerPress(groupNumber, targetHoleNumber)}>
            {hole.bankerPressed ? `Undo Banker ${pressAction}` : `Banker ${pressAction}`}
          </Button>
        </div>
        <NumberField value={hole.bankerGrossScore} disabled={!canEdit} onChange={(value) => setBankerGrossScore(value, groupNumber, targetHoleNumber)} placeholder="Gross" blankWhenZero />
      </section>
      ) : null}

      {hole.par === 3 ? (
        <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Closest to the Pin</h2>
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
            value={hole.ctpWinnerPlayerId ?? ''}
            disabled={!canEdit}
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
        {isScoreOnlyGroup ? (
          groupPlayers.map((player) => {
            const matchup = hole.matchups.find((item) => item.playerId === player.id);
            const isStoredAsBanker = player.id === hole.bankerPlayerId;
            const grossScore = isStoredAsBanker ? hole.bankerGrossScore : matchup?.grossScore ?? null;

            return (
              <div key={player.id} className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-lg font-bold">{player.name}</h3>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gross</label>
                <NumberField
                  value={grossScore}
                  disabled={!canEdit}
                  onChange={(value) =>
                    isStoredAsBanker
                      ? setBankerGrossScore(value, groupNumber, targetHoleNumber)
                      : setPlayerGrossScore(player.id, value, groupNumber, targetHoleNumber)
                  }
                  placeholder="Gross"
                  blankWhenZero
                />
                <p className="mt-3 text-sm text-slate-500">Counts for leaderboard, skins, CTP, and low net.</p>
              </div>
            );
          })
        ) : (
        hole.matchups.map((matchup) => {
          const player = groupPlayers.find((item) => item.id === matchup.playerId) ?? round.players[0];
          const summaryItem = matchupSummaryByPlayerId[player.id];
          const playsBanker = matchup.bankerParticipant !== false;
          return (
            <div key={player.id} className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">
                    {player.name}
                    {summaryItem?.playerGetsStroke ? ' *' : ''}
                  </h3>
                  <p className="text-sm text-slate-500">{playsBanker ? `vs ${banker.name}` : 'Score only, not playing Banker'}</p>
                </div>
                {playsBanker ? (
                  <Button variant="secondary" disabled={!canEdit} onClick={() => togglePlayerPress(player.id, groupNumber, targetHoleNumber)}>
                    {matchup.pressed ? `Undo ${pressAction}` : pressAction}
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bet</label>
                  <NumberField value={playsBanker ? matchup.baseWager : null} disabled={!canEdit || !playsBanker} onChange={(value) => setWager(player.id, value ?? 0, groupNumber, targetHoleNumber)} placeholder={playsBanker ? 'Bet' : 'N/A'} blankWhenZero />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gross</label>
                  <NumberField value={matchup.grossScore} disabled={!canEdit} onChange={(value) => setPlayerGrossScore(player.id, value, groupNumber, targetHoleNumber)} placeholder="Gross" blankWhenZero />
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {playsBanker
                  ? `Net ${summaryItem?.playerNetScore ?? '-'} vs Banker ${summaryItem?.bankerNetScore ?? '-'}`
                  : `Gross score counts for leaderboard and side games.`}
              </p>
            </div>
          );
        })
        )}
      </section>

      {!isScoreOnlyGroup ? (
      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold">Current Hole Summary</h3>
        <div className="space-y-2">
          {summary.matchups.map((item) => (
            <div key={item.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">
                  {item.playerName}
                  {item.playerGetsStroke && item.bankerParticipant ? ' *' : ''}
                </p>
                <p className="text-sm font-semibold">{item.payoutText}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Bet {formatCurrency(item.baseWager)}
                {item.modifiers.length > 0 ? `, ${item.modifiers.join(', ')}` : ''}
              </p>
              <p className="mt-1 text-sm text-slate-600">{strokeSummary(item)}</p>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {!isScoreOnlyGroup ? (
      <section className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold">Banker Running Total</h3>
        <div className="space-y-2">
          {bankerRunningTotals.map((total) => (
            <div key={total.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
              <span className="font-medium">{total.name}</span>
              <span className="font-bold">
                {total.amount > 0
                  ? `Up ${formatCurrency(total.amount)}`
                  : total.amount < 0
                    ? `Down ${formatCurrency(Math.abs(total.amount))}`
                    : 'Even'}
              </span>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {message ? <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{message}</p> : null}

      <div className="flex gap-3">
        <Button className="flex-1" variant="secondary" disabled={!canEdit} onClick={() => void handleUpdate()}>
          {isEditingPastHole ? 'Save Correction' : 'Update'}
        </Button>
        {isEditingPastHole ? (
          <Link className="flex-1 rounded-xl border border-[#2f8df3] px-4 py-3 text-center font-semibold text-[#2f8df3]" href={`/r/${round.roundCode}/history`}>
            Back to History
          </Link>
        ) : (
          <Button className="flex-1" disabled={!canEdit} onClick={() => void handleNext()}>
            {isFinalHole ? 'Finish Group' : 'Next'}
          </Button>
        )}
      </div>
    </main>
  );
}
