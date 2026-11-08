'use client';

import { SaveStatus } from '@/app/score-sync';
import { cacheRound, cachedRound, rememberRound, corrections, recordCorrection, describeScores, type Correction } from '@/lib/offline/local-rounds';
import { queueHole, flushScores } from '@/lib/offline/round-sync';
import type { HoleState } from '@/types/round';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/shared/button';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';
import {
  createSharedRoundFromLocalRound,
  loadSharedRoundByCode,
  sharedRoundBundleToRoundState,
} from '@/lib/realtime/shared-rounds';
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
  par,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  blankWhenZero?: boolean;
  disabled?: boolean;
  par?: number;
}) {
  const displayValue = value == null ? '' : blankWhenZero && value === 0 ? '' : value;

  return (
    <div className="flex min-w-0 items-center gap-1">
      {par ? <button type="button" aria-label="Decrease gross score" disabled={disabled || (value != null && value <= 1)} className="min-h-[48px] min-w-[44px] rounded-xl border border-slate-300 font-bold disabled:opacity-40" onClick={() => onChange(Math.max(1, (value ?? par + 1) - 1))}>−</button> : null}
    <input
      aria-label={par ? "Gross score" : placeholder}
      min={par ? 1 : 0}
      step={par ? 1 : 0.01}
      type="number"
      inputMode="numeric"
      value={displayValue}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={(event) => event.currentTarget.select()}
      onMouseUp={(event) => event.preventDefault()}
      onChange={(event) => {
        const raw = event.target.value;
        const next = Number(raw);
        if (!raw) onChange(null);
        else if (Number.isFinite(next) && (!par || Number.isInteger(next)) && next >= (par ? 1 : 0)) onChange(next);
      }}
      className="min-h-[52px] min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-lg font-bold tabular-nums shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
    />
      {par ? <button type="button" aria-label="Increase gross score" disabled={disabled} className="min-h-[48px] min-w-[44px] rounded-xl border border-slate-300 font-bold disabled:opacity-40" onClick={() => onChange(value == null ? par : value + 1)}>+</button> : null}
    </div>
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
    getGroupBankerPreviewTotals,
    setCtpWinner,
  } = useRoundStore();
  const [message, setMessage] = useState('');
  const [copiedEventLink, setCopiedEventLink] = useState(false);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'not_found' | 'ready'>('idle');
  const [loadError, setLoadError] = useState('');
  const [scorekeeperName, setScorekeeperName] = useState('');
  const [claimStatus, setClaimStatus] = useState('');
  const [audit, setAudit] = useState<Correction[]>([]);
  const [busy, setBusy] = useState(false);
  const editingBaseline = useRef<HoleState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRound() {
      const requestedCode = params.roundCode?.toUpperCase();
      if (!requestedCode) return;

      try {
        setLoadStatus('loading');
        setLoadError('');
        if (!navigator.onLine) throw new Error('Offline');
        const bundle = await loadSharedRoundByCode(requestedCode);
        if (cancelled) return;

        if (!bundle) {
          setLoadStatus('not_found');
          return;
        }

        hydrateRound(sharedRoundBundleToRoundState(bundle));
        try { cacheRound(useRoundStore.getState().round); } catch { setMessage('Could not cache this round for offline reopening. Keep this page open.'); }
        setLoadStatus('ready');
      } catch (error) {
        if (cancelled) return;
        let cached = null;
        try { cached = cachedRound(requestedCode); } catch { /* Fall through to a readable load error. */ }
        if (cached) {
          hydrateRound(cached);
          setLoadStatus('ready');
          setLoadError('Using the saved round on this device. Changes will sync when a connection is available.');
        } else {
          setLoadStatus('idle');
          setLoadError(formatUnknownError(error, 'Unable to load this round. Connect once to make it available offline.'));
        }
      }
    }

    void loadRound();

    return () => {
      cancelled = true;
    };
  }, [hydrateRound, params.roundCode]);

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
  const bankerGameEnabled = round.gameSettings?.bankerEnabled !== false;
  const ctpGameEnabled = round.gameSettings?.ctpEnabled === true;
  const bankerPlayers = groupPlayers.filter((player) => player.bankerParticipant !== false);
  const ctpPlayers = groupPlayers.filter((player) => player.ctpParticipant !== false);
  const isScoreOnlyGroup = !bankerGameEnabled || bankerPlayers.length === 0;
  const currentHoleNumber = group?.currentHole ?? round.currentHole;
  const targetHoleNumber = editHoleNumber ?? currentHoleNumber;
  const hole =
    roundHoles.find((item) => (item.groupNumber ?? 1) === groupNumber && item.holeNumber === targetHoleNumber) ??
    roundHoles.find((item) => item.holeNumber === targetHoleNumber) ??
    roundHoles[0];
  const isEditingPastHole = editHoleNumber != null || Boolean(hole?.isSaved);
  const banker = groupPlayers.find((player) => player.id === hole?.bankerPlayerId) ?? groupPlayers[0] ?? roundPlayers[0];
  const isFinalHole = hole?.holeNumber === round.totalHoles;
  const pressAction = hole?.par === 3 ? 'Triple' : 'Double';
  const isClaimed = Boolean(group?.scorekeeperDeviceId);
  const canEdit = loadStatus === 'ready' && round.roundCode.toUpperCase() === params.roundCode.toUpperCase() && Boolean(group && userCanEditGroup(group));

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

  const persistHoleSnapshot = useCallback(async (holeNumber: number, currentHole?: number) => {
    const latestRound = useRoundStore.getState().round;
    const target = latestRound.holes.find((item) => (item.groupNumber ?? 1) === groupNumber && item.holeNumber === holeNumber);
    if (!target || latestRound.id.startsWith('round-')) throw new Error('Load the shared round before saving.');
    queueHole(latestRound, groupNumber, target, currentHole);
    // The durable queue owns retries; moving holes does not depend on connectivity.
    void flushScores();
  }, [groupNumber]);

  async function handleUpdate() {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      const before = editingBaseline.current;
      const result = updateHole(groupNumber, targetHoleNumber);
      if (!result.ok) { setMessage(result.message ?? 'Unable to save correction.'); return; }
      await persistHoleSnapshot(targetHoleNumber);
      const after = useRoundStore.getState().round.holes.find((item) => (item.groupNumber ?? 1) === groupNumber && item.holeNumber === targetHoleNumber)!;
      if (before && JSON.stringify(before) !== JSON.stringify(after)) {
        recordCorrection({ id: crypto.randomUUID(), roundId: round.id, group: groupNumber, actor: group.scorekeeperName ?? 'Scorekeeper', at: new Date().toISOString(), before, after: structuredClone(after) });
        setAudit(corrections(round.id, groupNumber));
      }
      editingBaseline.current = structuredClone(after);
      setMessage('Correction saved on this device. Check sync status below.');
    } catch (error) { setMessage(formatUnknownError(error, 'Unable to save correction. Keep this page open and retry.')); }
    finally { setBusy(false); }
  }

  async function handleNext() {
    if (!canEdit || busy) return;
    setBusy(true);
    const before = structuredClone(useRoundStore.getState().round);
    try {
      const completedHoleNumber = hole.holeNumber;
      const result = nextHole(groupNumber);
      if (!result.ok) { setMessage(result.message ?? 'Enter every gross score before continuing.'); return; }
      await persistHoleSnapshot(completedHoleNumber, isFinalHole ? completedHoleNumber : completedHoleNumber + 1);
      if (isFinalHole) { router.push(`/r/${round.roundCode}`); return; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setMessage(`Hole ${completedHoleNumber} saved on this device.`);
    } catch (error) {
      hydrateRound(before);
      setMessage(formatUnknownError(error, 'Unable to save. Keep this page open and retry.'));
    } finally { setBusy(false); }
  }

  async function undoCorrection(entry: Correction) {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      const latest = useRoundStore.getState().round;
      const current = latest.holes.find((item) => (item.groupNumber ?? 1) === groupNumber && item.holeNumber === entry.after.holeNumber);
      if (JSON.stringify(current) !== JSON.stringify(entry.after)) throw new Error('This hole has newer changes. Open its history to review before editing.');
      const restored = { ...latest, holes: latest.holes.map((item) => item === current ? structuredClone(entry.before) : item) };
      queueHole(restored, groupNumber, entry.before);
      hydrateRound(restored);
      recordCorrection({ id: crypto.randomUUID(), roundId: round.id, group: groupNumber, actor: group.scorekeeperName ?? 'Scorekeeper', at: new Date().toISOString(), before: entry.after, after: entry.before, undoes: entry.id });
      editingBaseline.current = structuredClone(entry.before);
      setAudit(corrections(round.id, groupNumber));
      void flushScores();
      setMessage('Correction undone. Check sync status below.');
    } catch (error) { setMessage(formatUnknownError(error, 'Unable to undo correction.')); }
    finally { setBusy(false); }
  }

  async function copyEventLink() {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    await navigator.clipboard?.writeText(`${origin}/r/${round.roundCode}`);
    setCopiedEventLink(true);
  }

  useEffect(() => {
    if (loadStatus !== 'ready' || round.roundCode.toUpperCase() !== params.roundCode.toUpperCase() || !hole) return;
    try {
      rememberRound(round, groupNumber, currentHoleNumber);
      setAudit(corrections(round.id, groupNumber));
      editingBaseline.current = structuredClone(hole);
    } catch { setMessage('Device storage is unavailable. Keep this page open until scores are synced.'); }
    // Capture the original score when opening a hole, not after every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadStatus, round.id, groupNumber, targetHoleNumber]);

  useEffect(() => {
    if (!canEdit || isEditingPastHole) return;
    return useRoundStore.subscribe((next, previous) => {
      if (next.round.id !== round.id || previous.round.id !== round.id) return;
      const changed = next.round.holes.filter((item) => (item.groupNumber ?? 1) === groupNumber && JSON.stringify(item) !== JSON.stringify(previous.round.holes.find((old) => (old.groupNumber ?? 1) === groupNumber && old.holeNumber === item.holeNumber)));
      try {
        for (const changedHole of changed) queueHole(next.round, groupNumber, changedHole);
        const current = next.round.multiFoursome?.groups.find((item) => item.groupNumber === groupNumber)?.currentHole ?? next.round.currentHole;
        rememberRound(next.round, groupNumber, current);
      } catch (error) { setMessage(formatUnknownError(error, 'Unable to save on this device. Keep this page open and retry.')); }
    });
  }, [canEdit, groupNumber, isEditingPastHole, round.id]);

  if (!hole || !banker || loadStatus !== 'ready' || round.roundCode.toUpperCase() !== params.roundCode.toUpperCase()) {
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
  const bankerRunningTotals = getGroupBankerPreviewTotals(groupNumber, targetHoleNumber).sort((a, b) => b.amount - a.amount);
  const bankerHasPop = summary.bankerGetsStrokeFromNames.length > 0;
  const savedGroupHoles = roundHoles.filter((item) => (item.groupNumber ?? 1) === groupNumber && item.isSaved).length;
  const groupProgress = Math.round((savedGroupHoles / Math.max(1, round.totalHoles)) * 100);

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-44">
      {loadError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </section>
      ) : null}
      <section className="overflow-hidden rounded-3xl bg-[#0f5132] text-white shadow-sm">
        <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">{round.courseName}</p>
            <h1 className="mt-1 text-2xl font-bold">Group {groupNumber}</h1>
            <p className="mt-2 text-sm">
              {isEditingPastHole ? `Editing Hole ${hole.holeNumber}` : `Hole ${hole.holeNumber}`} - {round.title}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white px-3 py-2 font-mono text-lg font-bold text-[#1f2937]">
                {round.roundCode}
              </span>
              <span className="rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold">{savedGroupHoles}/{round.totalHoles} saved</span>
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
        </div>
        <div className="h-2 bg-white/20">
          <div className="h-full bg-[#f6c453]" style={{ width: `${groupProgress}%` }} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
          {canEdit ? <span className="rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-700">Scorekeeper</span> : <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">Viewing</span>}
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

      <section className="sticky top-2 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="mb-3 rounded-xl bg-[#eef7f0] px-3 py-3">
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
        <p className="truncate text-sm text-slate-500">{groupPlayers.map((player) => player.name).join(', ')}</p>
      </section>

      {!isScoreOnlyGroup ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gross</label>
        <NumberField value={hole.bankerGrossScore} disabled={!canEdit} onChange={(value) => setBankerGrossScore(value, groupNumber, targetHoleNumber)} placeholder="Gross" par={hole.par} blankWhenZero />
      </section>
      ) : null}

      {ctpGameEnabled && hole.par === 3 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Closest to the Pin</h2>
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold"
            value={hole.ctpWinnerPlayerId ?? ''}
            disabled={!canEdit}
            onChange={(event) => setCtpWinner(hole.holeNumber, event.target.value || null, groupNumber)}
          >
            <option value="">No Winner</option>
            {ctpPlayers.map((player) => (
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
              <div key={player.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">{player.name}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">Score</span>
                </div>
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
                  par={hole.par}
                  blankWhenZero
                />
                <p className="mt-3 text-sm text-slate-500">Counts for leaderboard and any side games this golfer joined.</p>
              </div>
            );
          })
        ) : (
        hole.matchups.map((matchup) => {
          const player = groupPlayers.find((item) => item.id === matchup.playerId) ?? round.players[0];
          const summaryItem = matchupSummaryByPlayerId[player.id];
          const playsBanker = matchup.bankerParticipant !== false;
          return (
            <div key={player.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bet</label>
                  <NumberField value={playsBanker ? matchup.baseWager : null} disabled={!canEdit || !playsBanker} onChange={(value) => setWager(player.id, value ?? 0, groupNumber, targetHoleNumber)} placeholder={playsBanker ? 'Bet' : 'N/A'} blankWhenZero />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gross</label>
                  <NumberField value={matchup.grossScore} disabled={!canEdit} onChange={(value) => setPlayerGrossScore(player.id, value, groupNumber, targetHoleNumber)} placeholder="Gross" par={hole.par} blankWhenZero />
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {playsBanker
                  ? `Net ${summaryItem?.playerNetScore ?? '-'} vs Banker ${summaryItem?.bankerNetScore ?? '-'}`
                  : `Gross score counts for leaderboard and any side games this golfer joined.`}
              </p>
            </div>
          );
        })
        )}
      </section>

      {!isScoreOnlyGroup ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

      {audit.length ? <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-bold">Correction history on this device ({audit.length})</summary>
        <p className="mt-2 text-xs text-slate-500">Records and undo are available on this device. Share scores through the event leaderboard.</p>
        {audit.slice().reverse().map((entry, index) => <div key={entry.id} className="mt-3 border-t pt-3 text-sm">
          <p className="font-semibold">Hole {entry.after.holeNumber} · {entry.actor} {entry.undoes ? 'undid a correction' : 'saved a correction'}</p>
          <p>{new Date(entry.at).toLocaleString()}</p>
          <p className="mt-1">Before: {describeScores(entry.before, round.players)}</p>
          <p>After: {describeScores(entry.after, round.players)}</p>
          {index === 0 && canEdit && !entry.undoes ? <Button variant="secondary" disabled={busy} onClick={() => void undoCorrection(entry)}>Undo correction</Button> : null}
        </div>)}
      </details> : null}

      {message ? <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{message}</p> : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto max-w-lg">
        {canEdit ? <SaveStatus roundId={round.id} group={groupNumber} dirty={isEditingPastHole && JSON.stringify(hole) !== JSON.stringify(editingBaseline.current)} onRetry={() => { if (isEditingPastHole) void handleUpdate(); else void persistHoleSnapshot(targetHoleNumber).catch((error) => setMessage(formatUnknownError(error, "Unable to retry saving."))); }} /> : null}
        <div className="flex gap-3">
        {isEditingPastHole ? (
          <>
          <Button className="flex-1" disabled={!canEdit || busy} onClick={() => void handleUpdate()}>
            Save Correction
          </Button>
          <Link className="flex-1 rounded-xl border border-[#2f8df3] px-4 py-3 text-center font-semibold text-[#2f8df3]" href={`/r/${round.roundCode}/history`}>
            Back to History
          </Link>
          </>
        ) : (
          <Button className="flex-1" disabled={!canEdit || busy} onClick={() => void handleNext()}>
            {busy ? 'Saving…' : isFinalHole ? 'Save & Finish Group' : 'Save & Next Hole'}
          </Button>
        )}
        </div>
        </div>
      </div>
    </main>
  );
}
