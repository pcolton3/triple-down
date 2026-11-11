'use client';

import { SaveStatus } from '@/app/score-sync';
import { cacheRound, cachedRound, rememberRound, corrections, recordCorrection, describeScores, type Correction } from '@/lib/offline/local-rounds';
import { queueHole, flushScores, syncError } from '@/lib/offline/round-sync';
import type { HoleState } from '@/types/round';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/shared/button';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';
import { GroupGameInputs, GroupGameStandings } from '@/components/round/group-game-inputs';
import { computeGroupGames } from '@/lib/games/group-games';
import {
  createSharedRoundFromLocalRound,
  loadSharedRoundByCode,
  sharedRoundBundleToRoundState,
} from '@/lib/realtime/shared-rounds';
import { claimGroupScorekeeper, releaseGroupScorekeeper, takeOverGroupScorekeeper, userCanEditGroup } from '@/lib/realtime/group-rounds';
import { AnnouncementsBanner } from '@/components/events/announcements';
import { CtpCard } from '@/components/round/ctp-card';
import { discardPendingForGroup, pendingForGroup, QUEUE_EVENT, type PendingHole } from '@/lib/offline/score-queue';

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

  const isEmpty = value == null || (blankWhenZero && value === 0);
  const quickScores = par && isEmpty && !disabled
    ? [
        { label: 'Birdie', score: par - 1 },
        { label: 'Par', score: par },
        { label: 'Bogey', score: par + 1 },
        { label: 'Double', score: par + 2 },
      ].filter((item) => item.score >= 1)
    : [];

  return (
    <div className="min-w-0">
    <div className="flex min-w-0 items-center gap-1">
      {par ? <button type="button" aria-label="Decrease gross score" disabled={disabled || (!isEmpty && (value ?? 0) <= 1)} className="min-h-[48px] min-w-[44px] rounded-xl border border-slate-300 font-bold disabled:opacity-40" onClick={() => onChange(Math.max(1, (isEmpty ? par : value ?? par) - 1))}>−</button> : null}
    <input
      aria-label={par ? "Gross score" : placeholder}
      min={par ? 1 : 0}
      step={par ? 1 : 0.01}
      type="number"
      inputMode={par ? 'numeric' : 'decimal'}
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
      {par ? <button type="button" aria-label="Increase gross score" disabled={disabled} className="min-h-[48px] min-w-[44px] rounded-xl border border-slate-300 font-bold disabled:opacity-40" onClick={() => onChange(isEmpty ? par + 1 : (value ?? par) + 1)}>+</button> : null}
    </div>
    {quickScores.length ? (
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {quickScores.map((item) => (
          <button
            key={item.label}
            type="button"
            aria-label={`${item.label}, ${item.score}`}
            className={`min-h-[48px] rounded-xl border px-1 text-center leading-tight ${item.label === 'Par' ? 'border-[#0f5132] bg-[#eef7f0] text-[#0f5132]' : 'border-slate-300 bg-white text-slate-700'}`}
            onClick={() => onChange(item.score)}
          >
            <span className="block text-lg font-bold tabular-nums">{item.score}</span>
            <span className="block text-xs font-semibold uppercase tracking-wide">{item.label}</span>
          </button>
        ))}
      </div>
    ) : null}
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
    setHoleGameData,
  } = useRoundStore();
  const [message, setMessage] = useState('');
  const [copiedEventLink, setCopiedEventLink] = useState(false);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'not_found' | 'ready'>('idle');
  const [loadError, setLoadError] = useState('');
  const [scorekeeperName, setScorekeeperName] = useState('');
  const [claimStatus, setClaimStatus] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [stuckHoles, setStuckHoles] = useState<PendingHole[]>([]);
  const [handoffOpen, setHandoffOpen] = useState(false);
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
    if (claiming) return;
    setClaiming(true);
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
      setClaimStatus(`You're keeping score for Group ${groupNumber} ✓`);
    } catch (error) {
      setClaimStatus(formatUnknownError(error, 'Unable to claim scorekeeper.'));
      try {
        await refreshRound();
      } catch {
        // The claim error is more useful than a follow-up refresh error.
      }
    } finally {
      setClaiming(false);
    }
  }

  async function handleTakeOver() {
    if (claiming) return;
    const previous = group?.scorekeeperName ?? 'the current scorekeeper';
    if (!window.confirm(`Take over scoring Group ${groupNumber} from ${previous}? Only do this if their phone died, they asked you to, or you switched to the installed app. Scores still waiting on their phone won't be sent.`)) return;
    setClaiming(true);
    try {
      setClaimStatus('');
      await takeOverGroupScorekeeper({
        roundId: round.id,
        groupNumber,
        expectedDeviceId: group?.scorekeeperDeviceId ?? null,
        scorekeeperName: scorekeeperName.trim() || group?.scorekeeperName || `Group ${groupNumber} Scorekeeper`,
      });
      await refreshRound();
      setHandoffOpen(false);
      setClaimStatus(`You're keeping score for Group ${groupNumber} ✓`);
      void flushScores();
    } catch (error) {
      setClaimStatus(formatUnknownError(error, 'Unable to take over scoring.'));
      try { await refreshRound(); } catch { /* Keep the take-over error. */ }
    } finally {
      setClaiming(false);
    }
  }

  async function handleHandOff() {
    if (claiming) return;
    if (pendingForGroup(localStorage, round.id, groupNumber).length) {
      window.alert('Some scores from this phone are still sending. Wait for the green "All scores saved" dot, then hand off.');
      return;
    }
    if (!window.confirm(`Stop scoring Group ${groupNumber} on this phone? Anyone in the group can then tap Start scoring on their phone.`)) return;
    setClaiming(true);
    try {
      await releaseGroupScorekeeper({ roundId: round.id, groupNumber });
      await refreshRound();
      setClaimStatus('Scoring handed off. Anyone can start scoring this group now.');
    } catch (error) {
      setClaimStatus(formatUnknownError(error, 'Unable to hand off scoring.'));
    } finally {
      setClaiming(false);
    }
  }

  async function discardStuckHoles() {
    if (!window.confirm(`Discard ${stuckHoles.length} unsent hole${stuckHoles.length === 1 ? '' : 's'} from this phone? The scores ${group?.scorekeeperName ?? 'the current scorekeeper'} entered will be kept.`)) return;
    try {
      discardPendingForGroup(localStorage, round.id, groupNumber);
      window.dispatchEvent(new Event(QUEUE_EVENT));
      await refreshRound();
    } catch (error) {
      setMessage(formatUnknownError(error, 'Unable to discard those scores.'));
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
      setMessage(`Hole ${targetHoleNumber} correction saved ✓`);
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
      if (isFinalHole) { window.scrollTo({ top: 0 }); setMessage(''); return; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setMessage(`Hole ${completedHoleNumber} saved ✓`);
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
      setMessage('Correction undone ✓');
    } catch (error) { setMessage(formatUnknownError(error, 'Unable to undo correction.')); }
    finally { setBusy(false); }
  }

  async function shareRoundLink() {
    const url = `${window.location.origin}/r/${round.roundCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: round.title, text: `Follow ${round.title} live on Triple Track (code ${round.roundCode})`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiedEventLink(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMessage(`Couldn't share automatically. Send this link: ${url}`);
    }
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
    if (loadStatus !== 'ready') return;
    const update = () => {
      try { setStuckHoles(canEdit ? [] : pendingForGroup(localStorage, round.id, groupNumber)); } catch { setStuckHoles([]); }
      // Scores were refused because another phone took over: reload so this screen stops offering edits.
      if (canEdit && syncError().startsWith('Another phone is now scoring')) void refreshRound().catch(() => undefined);
    };
    update();
    window.addEventListener(QUEUE_EVENT, update);
    return () => window.removeEventListener(QUEUE_EVENT, update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadStatus, canEdit, round.id, groupNumber]);

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

  const holeIsDirty = isEditingPastHole && JSON.stringify(hole) !== JSON.stringify(editingBaseline.current);
  const groupHoleSaved = (holeNumber: number) => roundHoles.some((item) => (item.groupNumber ?? 1) === groupNumber && item.holeNumber === holeNumber && item.isSaved);
  const canOpenHole = (holeNumber: number) => holeNumber === currentHoleNumber || groupHoleSaved(holeNumber);

  async function goToHole(holeNumber: number) {
    if (holeNumber === targetHoleNumber || !canOpenHole(holeNumber) || busy) return;
    if (holeIsDirty) {
      if (!window.confirm(`You changed hole ${targetHoleNumber} but haven't saved it. Save the correction and continue?`)) return;
      await handleUpdate();
    }
    const base = `/r/${round.roundCode}/group/${groupNumber}`;
    router.push(holeNumber === currentHoleNumber && !groupHoleSaved(holeNumber) ? base : `${base}?hole=${holeNumber}`);
    window.scrollTo({ top: 0 });
  }

  const summary = getCurrentHoleSummary(groupNumber, targetHoleNumber);
  const matchupSummaryByPlayerId = Object.fromEntries(summary.matchups.map((item) => [item.playerId, item]));
  const bankerRunningTotals = getGroupBankerPreviewTotals(groupNumber, targetHoleNumber).sort((a, b) => b.amount - a.amount);
  const bankerHasPop = summary.bankerGetsStrokeFromNames.length > 0;
  const savedGroupHoles = roundHoles.filter((item) => (item.groupNumber ?? 1) === groupNumber && item.isSaved).length;
  const groupProgress = Math.round((savedGroupHoles / Math.max(1, round.totalHoles)) * 100);

  const groupGameResults = computeGroupGames(round).filter((result) => result.groupNumber === groupNumber);
  function changeGameData(holeNumber: number, patch: Parameters<typeof setHoleGameData>[2]) {
    setHoleGameData(groupNumber, holeNumber, patch);
    // Team picks live on hole 1; when correcting a different hole, send hole 1 straight away.
    if (isEditingPastHole && holeNumber !== targetHoleNumber) {
      void persistHoleSnapshot(holeNumber).catch((error) => setMessage(formatUnknownError(error, 'Unable to save the team change.')));
    }
  }

  const holeStrip = (
      <nav aria-label="Holes" className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-1.5 pb-1">
          {Array.from({ length: round.totalHoles }, (_, index) => index + 1).map((holeNumber) => {
            const open = canOpenHole(holeNumber);
            const saved = groupHoleSaved(holeNumber);
            const active = holeNumber === targetHoleNumber;
            return (
              <button
                key={holeNumber}
                type="button"
                disabled={!open || busy}
                aria-current={active ? 'step' : undefined}
                aria-label={`Hole ${holeNumber}${saved ? ', saved' : holeNumber === currentHoleNumber ? ', current hole' : ', not played yet'}`}
                onClick={() => void goToHole(holeNumber)}
                className={`min-h-[44px] min-w-[44px] shrink-0 rounded-xl border text-base font-bold tabular-nums ${
                  active
                    ? 'border-[#0f5132] bg-[#0f5132] text-white'
                    : saved
                      ? 'border-[#c9d8c7] bg-[#eef7f0] text-[#0f5132]'
                      : holeNumber === currentHoleNumber
                        ? 'border-[#f6c453] bg-white text-[#071b12]'
                        : 'border-slate-200 bg-white text-slate-300'
                }`}
              >
                {holeNumber}
              </button>
            );
          })}
        </div>
      </nav>
  );

  const groupFinished = editHoleNumber == null && savedGroupHoles >= round.totalHoles;
  if (groupFinished) {
    const groupNumbers = roundGroups.length ? roundGroups.map((item) => item.groupNumber) : [groupNumber];
    const finishedGroups = groupNumbers.filter(
      (number) => roundHoles.filter((item) => (item.groupNumber ?? 1) === number && item.isSaved).length >= round.totalHoles
    ).length;
    const everyoneDone = finishedGroups === groupNumbers.length;
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-12">
        <section className="rounded-3xl bg-[#0f5132] p-5 text-center text-white shadow-sm">
          <p className="text-sm opacity-90">{round.courseName} · {round.title}</p>
          <h1 className="mt-2 text-3xl font-bold">Group {groupNumber} is done ⛳</h1>
          <p className="mt-2 text-sm">
            {groupNumbers.length > 1
              ? everyoneDone
                ? `All ${groupNumbers.length} groups have finished.`
                : `${finishedGroups} of ${groupNumbers.length} groups finished. Waiting on the rest.`
              : 'All 18 holes saved.'}
          </p>
        </section>
        {canEdit ? <SaveStatus roundId={round.id} group={groupNumber} dirty={false} onRetry={() => void persistHoleSnapshot(round.totalHoles).catch((error) => setMessage(formatUnknownError(error, 'Unable to retry saving.')))} /> : null}
        {message ? <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{message}</p> : null}
        {!isScoreOnlyGroup && bankerRunningTotals.length ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">Banker results for this group</h2>
            <div className="space-y-2">
              {bankerRunningTotals.map((total) => (
                <div key={total.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <span className="font-medium">{total.name}</span>
                  <span className="font-bold">
                    {total.amount > 0 ? `Up ${formatCurrency(total.amount)}` : total.amount < 0 ? `Down ${formatCurrency(Math.abs(total.amount))}` : 'Even'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <GroupGameStandings results={groupGameResults} open />
        <Link href={`/r/${round.roundCode}/settle`} className="block rounded-xl bg-[#0f5132] px-4 py-4 text-center text-lg font-bold text-white">
          {everyoneDone ? 'Settle up →' : 'See payouts so far →'}
        </Link>
        <Link href={`/r/${round.roundCode}`} className="block rounded-xl border border-[#c9d8c7] bg-white px-4 py-3 text-center font-semibold text-[#0f5132]">
          Leaderboard
        </Link>
        <section className="space-y-2">
          <p className="px-1 text-sm text-slate-600">Need to fix a score? Tap the hole.</p>
          {holeStrip}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-44">
      {params.roundCode ? <AnnouncementsBanner scope="round" code={params.roundCode} showNotify={false} /> : null}
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
              <span className="inline-flex min-h-[44px] items-center rounded-xl bg-white/20 px-3 text-sm font-semibold">{savedGroupHoles}/{round.totalHoles} saved</span>
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-white/20 px-3 text-sm font-semibold"
                onClick={() => void shareRoundLink()}
              >
                {copiedEventLink ? 'Link copied ✓' : 'Share round'}
              </button>
            </div>
          </div>
          <Link className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-white/20 px-3 text-sm font-semibold" href={`/r/${round.roundCode}`}>
            Leaderboard
          </Link>
        </div>
        </div>
        <div className="h-2 bg-white/20">
          <div className="h-full bg-[#f6c453]" style={{ width: `${groupProgress}%` }} />
        </div>
      </section>

      {!isClaimed ? (
        <section className="rounded-2xl border-2 border-[#0f5132] bg-[#eef7f0] p-4 shadow-sm">
          <h2 className="text-lg font-bold">Keeping score for Group {groupNumber}?</h2>
          <p className="mt-1 text-sm text-slate-600">One person per group enters scores. Everyone else can just watch live.</p>
          <input
            className="mt-3 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
            value={scorekeeperName}
            placeholder="Your name (optional)"
            autoComplete="given-name"
            onChange={(event) => setScorekeeperName(event.target.value)}
          />
          <Button type="button" className="mt-3 w-full py-4 text-lg" disabled={claiming || loadStatus !== 'ready'} onClick={() => void handleClaimScorekeeper()}>
            {claiming ? 'Starting…' : 'Start scoring this group'}
          </Button>
          {claimStatus ? <p role="status" className="mt-3 text-sm text-slate-600">{claimStatus}</p> : null}
        </section>
      ) : canEdit ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
          <span role="status">{claimStatus || `You're keeping score for Group ${groupNumber} ✓`}</span>
          <button type="button" className="min-h-[40px] shrink-0 px-1 text-xs font-bold underline" disabled={claiming} onClick={() => void handleHandOff()}>
            Hand off
          </button>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <p>
            <span className="font-semibold text-slate-800">{group?.scorekeeperName ?? 'Someone else'}</span> is keeping score for this group. You&apos;re watching live.
          </p>
          {stuckHoles.length ? (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <p className="font-semibold">
                {stuckHoles.length} hole{stuckHoles.length === 1 ? '' : 's'} from this phone didn&apos;t send, because scoring moved to another phone.
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {stuckHoles.map((entry) => (
                  <li key={entry.hole.holeNumber}>Hole {entry.hole.holeNumber}: {describeScores(entry.hole, round.players)}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Tell {group?.scorekeeperName ?? 'the scorekeeper'} these scores, then discard them. Or take scoring back to send them.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={claiming} onClick={() => void handleTakeOver()}>Take back &amp; send</Button>
                <Button type="button" variant="secondary" onClick={() => void discardStuckHoles()}>Discard</Button>
              </div>
            </div>
          ) : null}
          {!stuckHoles.length ? (
            handoffOpen ? (
              <div className="mt-3 space-y-2">
                <input
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
                  value={scorekeeperName}
                  placeholder="Your name (optional)"
                  onChange={(event) => setScorekeeperName(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="button" className="flex-1" disabled={claiming} onClick={() => void handleTakeOver()}>
                    {claiming ? 'Taking over…' : 'Take over scoring'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setHandoffOpen(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button type="button" className="mt-2 min-h-[44px] text-sm font-semibold text-[#0f5132] underline" onClick={() => setHandoffOpen(true)}>
                Need to take over scoring?
              </button>
            )
          ) : null}
          {claimStatus ? <p role="status" className="mt-2 text-sm text-slate-600">{claimStatus}</p> : null}
        </section>
      )}

      {holeStrip}

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
        <CtpCard round={round} hole={hole} groupNumber={groupNumber} players={ctpPlayers} canEdit={canEdit} onChange={(playerId) => setCtpWinner(hole.holeNumber, playerId, groupNumber)} />
      ) : null}

      <GroupGameInputs round={round} groupNumber={groupNumber} hole={hole} canEdit={canEdit} onChange={changeGameData} />

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

      <GroupGameStandings results={groupGameResults} />
      <Link href={`/r/${round.roundCode}#side-bets`} className="flex min-h-[48px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0f5132] shadow-sm">
        <span>Side bets with anyone in the round</span>
        <span aria-hidden>→</span>
      </Link>

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
        {canEdit ? <SaveStatus roundId={round.id} group={groupNumber} dirty={holeIsDirty} onRetry={() => { if (isEditingPastHole) void handleUpdate(); else void persistHoleSnapshot(targetHoleNumber).catch((error) => setMessage(formatUnknownError(error, "Unable to retry saving."))); }} /> : null}
        <div className="flex gap-3">
        {isEditingPastHole ? (
          <>
          <Button className="flex-1" disabled={!canEdit || busy} onClick={() => void handleUpdate()}>
            Save Correction
          </Button>
          {savedGroupHoles >= round.totalHoles ? (
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => void (async () => {
              if (holeIsDirty) {
                if (!window.confirm(`You changed hole ${targetHoleNumber} but haven't saved it. Save the correction and continue?`)) return;
                await handleUpdate();
              }
              router.push(`/r/${round.roundCode}/group/${groupNumber}`);
            })()}>
              Done
            </Button>
          ) : targetHoleNumber !== currentHoleNumber || !groupHoleSaved(currentHoleNumber) ? (
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => void goToHole(currentHoleNumber)}>
              Back to Hole {currentHoleNumber}
            </Button>
          ) : (
            <Link className="flex-1 rounded-xl border border-[#2f8df3] px-4 py-3 text-center font-semibold text-[#2f8df3]" href={`/r/${round.roundCode}`}>
              Leaderboard
            </Link>
          )}
          </>
        ) : (
          <>
          {hole.holeNumber > 1 && canOpenHole(hole.holeNumber - 1) ? (
            <Button variant="secondary" className="shrink-0 px-4" disabled={busy} aria-label={`Go back to hole ${hole.holeNumber - 1}`} onClick={() => void goToHole(hole.holeNumber - 1)}>
              ◀ {hole.holeNumber - 1}
            </Button>
          ) : null}
          <Button className="flex-1" disabled={!canEdit || busy} onClick={() => void handleNext()}>
            {busy ? 'Saving…' : isFinalHole ? 'Save & Finish Group' : 'Save & Next Hole'}
          </Button>
          </>
        )}
        </div>
        </div>
      </div>
    </main>
  );
}
