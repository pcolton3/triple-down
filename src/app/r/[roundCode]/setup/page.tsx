'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { deleteSharedRound, loadSharedRoundByCode, roundDeletePermission, sharedRoundBundleToRoundState, updateSharedRoundSetup } from '@/lib/realtime/shared-rounds';
import { forgetRound } from '@/lib/offline/local-rounds';
import { saveCourseTee, savedCourseKey } from '@/lib/realtime/saved-course-tees';
import { BEEZER_EXTRA_GAMES, type BeezerExtraGameKey } from '@/lib/games/catalog';
import { GamePicker } from '@/components/round/game-picker';
import { moneyLabel } from '@/lib/games/help';
import { optionalGames, PlayerGames, toggleExcluded } from '@/components/round/player-games';
import { useRoundStore } from '@/stores/round-store';
import type { Player, RoundState } from '@/types/round';

type PlayerDraft = {
  id: string;
  name: string;
  handicap: string;
  bankerParticipant: boolean;
  skinsParticipant: boolean;
  ctpParticipant: boolean;
  lowNetParticipant: boolean;
};

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPlayerDrafts(players: Player[]): PlayerDraft[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    handicap: String(player.handicap ?? 0),
    bankerParticipant: player.bankerParticipant !== false,
    skinsParticipant: player.skinsParticipant !== false,
    ctpParticipant: player.ctpParticipant !== false,
    lowNetParticipant: player.lowNetParticipant !== false,
  }));
}

const inputClass = 'min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 py-3';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input type="number" inputMode="decimal" min={0} step="any" className={inputClass} value={value} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function getGroupLabel(round: RoundState, playerId: string) {
  const assignment = round.multiFoursome?.groupPlayers.find((item) => item.playerId === playerId);
  return assignment ? `Group ${assignment.groupNumber}` : 'Group 1';
}

/** Permanent delete, behind typing the round code. The database also checks who may delete and blocks finalized rounds. */
function DeleteRoundCard({ round }: { round: RoundState }) {
  const [permission, setPermission] = useState<{ allowed: boolean; finalized: boolean } | null>(null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const code = round.roundCode.toUpperCase();

  useEffect(() => {
    roundDeletePermission(code).then(setPermission).catch(() => setPermission({ allowed: true, finalized: false }));
  }, [code]);

  async function remove() {
    if (typed.trim().toUpperCase() !== code || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteSharedRound(code);
      try { forgetRound(code, round.id); } catch { /* storage unavailable */ }
      window.location.href = '/';
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the round.');
      setDeleting(false);
    }
  }

  return (
    <details className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer font-bold text-red-700">Delete this round</summary>
      <div className="mt-3 space-y-3 text-sm">
        {!permission ? (
          <p className="text-slate-500" role="status">Checking…</p>
        ) : permission.finalized ? (
          <p className="text-slate-700">This round&apos;s settle-up has been finalized, so it&apos;s kept as the record of who paid whom and can&apos;t be deleted.</p>
        ) : !permission.allowed ? (
          <p className="text-slate-700">Only the phone that created this round can delete it.</p>
        ) : (
          <>
            <p className="text-slate-700">
              This permanently deletes <span className="font-semibold">{round.title}</span> for everyone: all scores, groups, side bets and payouts. This can&apos;t be undone.
              {round.ryderEventCode ? ' If it was started from an event day, that day reopens so it can be started again.' : ''}
            </p>
            <label className="block">
              <span className="mb-1 block font-medium">Type <span className="font-mono font-bold">{code}</span> to confirm</span>
              <input
                className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 py-3 font-mono uppercase"
                value={typed}
                autoCapitalize="characters"
                autoCorrect="off"
                onChange={(event) => setTyped(event.target.value)}
              />
            </label>
            {error ? <p role="alert" className="text-red-700">{error}</p> : null}
            <button
              type="button"
              disabled={typed.trim().toUpperCase() !== code || deleting}
              className="min-h-[48px] w-full rounded-xl bg-red-700 px-4 font-bold text-white disabled:opacity-40"
              onClick={() => void remove()}
            >
              {deleting ? 'Deleting…' : 'Delete round permanently'}
            </button>
          </>
        )}
      </div>
    </details>
  );
}

export default function EditRoundSetupPage() {
  const params = useParams<{ roundCode: string }>();
  const { round, hydrateRound } = useRoundStore();
  const routeRoundCode = params.roundCode?.toUpperCase() || round.roundCode;
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [saveStatus, setSaveStatus] = useState('');
  const [title, setTitle] = useState(round.title);
  const [ryderEventCode, setRyderEventCode] = useState(round.ryderEventCode ?? '');
  const [ryderEventDay, setRyderEventDay] = useState(String(round.ryderEventDay ?? 1));
  const [courseName, setCourseName] = useState(round.courseName);
  const [bankerEnabled, setBankerEnabled] = useState(round.gameSettings.bankerEnabled !== false);
  const [skinsEnabled, setSkinsEnabled] = useState(round.gameSettings.skinsEnabled === true);
  const [lowNetEnabled, setLowNetEnabled] = useState(round.gameSettings.lowNetEnabled === true);
  const [ctpEnabled, setCtpEnabled] = useState(round.gameSettings.ctpEnabled === true);
  const [nassauEnabled, setNassauEnabled] = useState(round.gameSettings.nassauEnabled === true);
  const [stablefordEnabled, setStablefordEnabled] = useState(round.gameSettings.stablefordEnabled === true);
  const [birdiePotEnabled, setBirdiePotEnabled] = useState(round.gameSettings.birdiePotEnabled === true);
  const [eaglePotEnabled, setEaglePotEnabled] = useState(round.gameSettings.eaglePotEnabled === true);
  const [holeInOneEnabled, setHoleInOneEnabled] = useState(round.gameSettings.holeInOneEnabled === true);
  const [wolfEnabled, setWolfEnabled] = useState(round.gameSettings.wolfEnabled === true);
  const [bingoBangoBongoEnabled, setBingoBangoBongoEnabled] = useState(round.gameSettings.bingoBangoBongoEnabled === true);
  const [vegasEnabled, setVegasEnabled] = useState(round.gameSettings.vegasEnabled === true);
  const [matchPlayEnabled, setMatchPlayEnabled] = useState(round.gameSettings.matchPlayEnabled === true);
  const [teamMatchPlayEnabled, setTeamMatchPlayEnabled] = useState(round.gameSettings.teamMatchPlayEnabled === true);
  const [skinsPot, setSkinsPot] = useState(String(round.gameSettings.skinsPot ?? 0));
  const [lowNetPot, setLowNetPot] = useState(String(round.gameSettings.lowNetPot ?? 0));
  const [ctpPot, setCtpPot] = useState(String(round.gameSettings.ctpPot ?? 0));
  const [nassauPot, setNassauPot] = useState(String(round.gameSettings.nassauPot ?? 0));
  const [stablefordPot, setStablefordPot] = useState(String(round.gameSettings.stablefordPot ?? 0));
  const [birdiePot, setBirdiePot] = useState(String(round.gameSettings.birdiePot ?? 0));
  const [eaglePot, setEaglePot] = useState(String(round.gameSettings.eaglePot ?? 0));
  const [wolfUnit, setWolfUnit] = useState(String(round.gameSettings.wolfUnit ?? 0));
  const [bingoBangoBongoUnit, setBingoBangoBongoUnit] = useState(String(round.gameSettings.bingoBangoBongoUnit ?? 0));
  const [vegasUnit, setVegasUnit] = useState(String(round.gameSettings.vegasUnit ?? 0));
  const [matchPlayUnit, setMatchPlayUnit] = useState(String(round.gameSettings.matchPlayUnit ?? 0));
  const [teamMatchPlayUnit, setTeamMatchPlayUnit] = useState(String(round.gameSettings.teamMatchPlayUnit ?? 0));
  const [extraGames, setExtraGames] = useState<Partial<Record<BeezerExtraGameKey, boolean>>>(round.gameSettings.extraGames ?? {});
  const [extraGameUnits, setExtraGameUnits] = useState<Partial<Record<BeezerExtraGameKey, string>>>(
    Object.fromEntries(BEEZER_EXTRA_GAMES.map((game) => [game.key, String(round.gameSettings.extraGameUnits?.[game.key] ?? 0)]))
  );
  const [teamOneName, setTeamOneName] = useState(round.gameSettings.teamOneName ?? 'Team 1');
  const [teamTwoName, setTeamTwoName] = useState(round.gameSettings.teamTwoName ?? 'Team 2');
  const [ryderCupFormat, setRyderCupFormat] = useState<'team_match' | 'singles_match'>(round.gameSettings.ryderCupFormat ?? 'team_match');
  const [teamAssignments, setTeamAssignments] = useState<Record<string, 'team_one' | 'team_two'>>(round.gameSettings.teamAssignments ?? {});
  const [singlesPairings, setSinglesPairings] = useState<Record<string, string>>(round.gameSettings.singlesPairings ?? {});
  const [excludedPlayers, setExcludedPlayers] = useState<Record<string, string[]>>(round.gameSettings.excludedPlayers ?? {});
  const [courseRating, setCourseRating] = useState(round.gameSettings.courseRating == null ? '' : String(round.gameSettings.courseRating));
  const [slopeRating, setSlopeRating] = useState(round.gameSettings.slopeRating == null ? '' : String(round.gameSettings.slopeRating));
  const [teeColor, setTeeColor] = useState(round.gameSettings.teeColor ?? '');
  const [pcc, setPcc] = useState(String(round.gameSettings.pcc ?? 0));
  const [playerDrafts, setPlayerDrafts] = useState<PlayerDraft[]>(buildPlayerDrafts(round.players));
  const [saving, setSaving] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [baseline, setBaseline] = useState<{ all: string; money: string } | null>(null);

  const groupCount = useMemo(() => round.multiFoursome?.groups.length ?? 1, [round.multiFoursome?.groups.length]);
  const gameOptions: Array<{ label: string; checked: boolean; onToggle: () => void }> = [
    { label: 'Banker', checked: bankerEnabled, onToggle: () => setBankerEnabled((value) => !value) },
    { label: 'Skins', checked: skinsEnabled, onToggle: () => setSkinsEnabled((value) => !value) },
    { label: 'CTP', checked: ctpEnabled, onToggle: () => setCtpEnabled((value) => !value) },
    { label: 'Low Net', checked: lowNetEnabled, onToggle: () => setLowNetEnabled((value) => !value) },
    { label: 'Nassau', checked: nassauEnabled, onToggle: () => setNassauEnabled((value) => !value) },
    { label: 'Stableford', checked: stablefordEnabled, onToggle: () => setStablefordEnabled((value) => !value) },
    { label: 'Birdie Pot', checked: birdiePotEnabled, onToggle: () => setBirdiePotEnabled((value) => !value) },
    { label: 'Eagle Pot', checked: eaglePotEnabled, onToggle: () => setEaglePotEnabled((value) => !value) },
    { label: 'Hole-in-One', checked: holeInOneEnabled, onToggle: () => setHoleInOneEnabled((value) => !value) },
    { label: 'Wolf', checked: wolfEnabled, onToggle: () => setWolfEnabled((value) => !value) },
    { label: 'Bingo Bango Bongo', checked: bingoBangoBongoEnabled, onToggle: () => setBingoBangoBongoEnabled((value) => !value) },
    { label: 'Vegas', checked: vegasEnabled, onToggle: () => setVegasEnabled((value) => !value) },
    { label: 'Match Play', checked: matchPlayEnabled, onToggle: () => setMatchPlayEnabled((value) => !value) },
    { label: 'Team Match Play / Ryder Cup', checked: teamMatchPlayEnabled, onToggle: () => setTeamMatchPlayEnabled((value) => !value) },
    ...BEEZER_EXTRA_GAMES.map((game) => ({
      label: game.label,
      checked: extraGames[game.key] === true,
      onToggle: () => setExtraGames((current) => ({ ...current, [game.key]: !current[game.key] })),
    })),
  ];

  const moneyJson = JSON.stringify([
    bankerEnabled, skinsEnabled, lowNetEnabled, ctpEnabled, nassauEnabled, stablefordEnabled, birdiePotEnabled, eaglePotEnabled, holeInOneEnabled,
    teamMatchPlayEnabled, skinsPot, lowNetPot, ctpPot, nassauPot, stablefordPot, birdiePot, eaglePot, teamMatchPlayUnit,
    teamAssignments, singlesPairings, ryderCupFormat, excludedPlayers,
    playerDrafts.map((player) => [player.handicap, player.bankerParticipant, player.skinsParticipant, player.ctpParticipant, player.lowNetParticipant]),
  ]);
  const allJson = JSON.stringify([
    moneyJson, title, courseName, ryderEventCode, ryderEventDay, wolfEnabled, bingoBangoBongoEnabled, vegasEnabled, matchPlayEnabled, extraGames,
    extraGameUnits, wolfUnit, bingoBangoBongoUnit, vegasUnit, matchPlayUnit, teamOneName, teamTwoName, courseRating, slopeRating, teeColor, pcc,
    playerDrafts.map((player) => player.name),
  ]);
  const dirty = baseline != null && baseline.all !== allJson;
  const scoresEntered = round.holes.some((hole) => hole.isSaved);

  useEffect(() => {
    // Runs on the render after the form is reset from the loaded round.
    if (resetToken > 0) setBaseline({ all: allJson, money: moneyJson });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    let cancelled = false;

    async function loadRound() {
      setLoadStatus('loading');
      const bundle = await loadSharedRoundByCode(routeRoundCode);
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
  }, [hydrateRound, routeRoundCode]);

  useEffect(() => {
    setTitle(round.title);
    setRyderEventCode(round.ryderEventCode ?? '');
    setRyderEventDay(String(round.ryderEventDay ?? 1));
    setCourseName(round.courseName);
    setBankerEnabled(round.gameSettings.bankerEnabled !== false);
    setSkinsEnabled(round.gameSettings.skinsEnabled === true);
    setLowNetEnabled(round.gameSettings.lowNetEnabled === true);
    setCtpEnabled(round.gameSettings.ctpEnabled === true);
    setNassauEnabled(round.gameSettings.nassauEnabled === true);
    setStablefordEnabled(round.gameSettings.stablefordEnabled === true);
    setBirdiePotEnabled(round.gameSettings.birdiePotEnabled === true);
    setEaglePotEnabled(round.gameSettings.eaglePotEnabled === true);
    setHoleInOneEnabled(round.gameSettings.holeInOneEnabled === true);
    setWolfEnabled(round.gameSettings.wolfEnabled === true);
    setBingoBangoBongoEnabled(round.gameSettings.bingoBangoBongoEnabled === true);
    setVegasEnabled(round.gameSettings.vegasEnabled === true);
    setMatchPlayEnabled(round.gameSettings.matchPlayEnabled === true);
    setTeamMatchPlayEnabled(round.gameSettings.teamMatchPlayEnabled === true);
    setExtraGames(round.gameSettings.extraGames ?? {});
    setExtraGameUnits(
      Object.fromEntries(BEEZER_EXTRA_GAMES.map((game) => [game.key, String(round.gameSettings.extraGameUnits?.[game.key] ?? 0)]))
    );
    setSkinsPot(String(round.gameSettings.skinsPot ?? 0));
    setLowNetPot(String(round.gameSettings.lowNetPot ?? 0));
    setCtpPot(String(round.gameSettings.ctpPot ?? 0));
    setNassauPot(String(round.gameSettings.nassauPot ?? 0));
    setStablefordPot(String(round.gameSettings.stablefordPot ?? 0));
    setBirdiePot(String(round.gameSettings.birdiePot ?? 0));
    setEaglePot(String(round.gameSettings.eaglePot ?? 0));
    setWolfUnit(String(round.gameSettings.wolfUnit ?? 0));
    setBingoBangoBongoUnit(String(round.gameSettings.bingoBangoBongoUnit ?? 0));
    setVegasUnit(String(round.gameSettings.vegasUnit ?? 0));
    setMatchPlayUnit(String(round.gameSettings.matchPlayUnit ?? 0));
    setTeamMatchPlayUnit(String(round.gameSettings.teamMatchPlayUnit ?? 0));
    setTeamOneName(round.gameSettings.teamOneName ?? 'Team 1');
    setTeamTwoName(round.gameSettings.teamTwoName ?? 'Team 2');
    setRyderCupFormat(round.gameSettings.ryderCupFormat ?? 'team_match');
    setTeamAssignments(round.gameSettings.teamAssignments ?? {});
    setSinglesPairings(round.gameSettings.singlesPairings ?? {});
    setExcludedPlayers(round.gameSettings.excludedPlayers ?? {});
    setCourseRating(round.gameSettings.courseRating == null ? '' : String(round.gameSettings.courseRating));
    setSlopeRating(round.gameSettings.slopeRating == null ? '' : String(round.gameSettings.slopeRating));
    setTeeColor(round.gameSettings.teeColor ?? '');
    setPcc(String(round.gameSettings.pcc ?? 0));
    setPlayerDrafts(buildPlayerDrafts(round.players));
    setResetToken((token) => token + 1);
  }, [round]);

  function updatePlayerDraft(playerId: string, field: keyof PlayerDraft, value: string | boolean) {
    setPlayerDrafts((current) =>
      current.map((player) => (player.id === playerId ? { ...player, [field]: value } : player))
    );
  }

  function setPlayerTeam(playerId: string, team: 'team_one' | 'team_two') {
    setTeamAssignments((current) => ({ ...current, [playerId]: team }));
  }

  function setSinglesOpponent(playerId: string, opponentId: string) {
    setSinglesPairings((current) => {
      const next = { ...current };
      if (!opponentId) {
        delete next[playerId];
        return next;
      }
      next[playerId] = opponentId;
      next[opponentId] = playerId;
      return next;
    });
  }

  async function handleSaveSetup() {
    if (saving) return;
    if (scoresEntered && baseline && baseline.money !== moneyJson &&
      !window.confirm('Some holes are already scored. Changing games, pots, handicaps or who plays what recalculates the payouts for the whole round. Save these changes?')) return;
    setSaving(true);
    try {
      setSaveStatus('Saving…');
      const playerById = new Map(playerDrafts.map((player) => [player.id, player]));
      const nextPlayers = round.players.map((player) => {
        const draft = playerById.get(player.id);
        if (!draft) return player;
        return {
          ...player,
          name: draft.name.trim() || player.name,
          handicap: Math.max(0, numberOrZero(draft.handicap)),
          bankerParticipant: draft.bankerParticipant,
          skinsParticipant: draft.skinsParticipant,
          ctpParticipant: draft.ctpParticipant,
          lowNetParticipant: draft.lowNetParticipant,
        };
      });
      const nextPlayerById = new Map(nextPlayers.map((player) => [player.id, player]));
      const finalTeamAssignments = nextPlayers.reduce<Record<string, 'team_one' | 'team_two'>>((assignments, player, index) => {
        assignments[player.id] = teamAssignments[player.id] ?? (index % 2 === 0 ? 'team_one' : 'team_two');
        return assignments;
      }, {});
      const teamOneIds = nextPlayers.filter((player) => finalTeamAssignments[player.id] === 'team_one').map((player) => player.id);
      const teamTwoIds = nextPlayers.filter((player) => finalTeamAssignments[player.id] === 'team_two').map((player) => player.id);
      const finalSinglesPairings = { ...singlesPairings };
      teamOneIds.forEach((playerId, index) => {
        if (finalSinglesPairings[playerId]) return;
        const opponentId = teamTwoIds[index];
        if (!opponentId) return;
        finalSinglesPairings[playerId] = opponentId;
        finalSinglesPairings[opponentId] = playerId;
      });

      const nextRound: RoundState = {
        ...round,
        title: title.trim() || round.title,
        ryderEventCode: teamMatchPlayEnabled ? (ryderEventCode.trim().toUpperCase() || round.ryderEventCode || round.roundCode) : null,
        ryderEventDay: teamMatchPlayEnabled ? Math.max(1, numberOrZero(ryderEventDay) || 1) : null,
        courseName: courseName.trim() || round.courseName,
        gameSettings: {
          ...round.gameSettings,
          bankerEnabled,
          skinsEnabled,
          lowNetEnabled,
          ctpEnabled,
          nassauEnabled,
          stablefordEnabled,
          birdiePotEnabled,
          eaglePotEnabled,
          holeInOneEnabled,
          wolfEnabled,
          bingoBangoBongoEnabled,
          vegasEnabled,
          matchPlayEnabled,
          teamMatchPlayEnabled,
          extraGames,
          extraGameUnits: Object.fromEntries(
            BEEZER_EXTRA_GAMES.map((game) => [game.key, Math.max(0, numberOrZero(extraGameUnits[game.key] ?? '0'))])
          ) as Partial<Record<BeezerExtraGameKey, number>>,
          skinsPot: Math.max(0, numberOrZero(skinsPot)),
          lowNetPot: Math.max(0, numberOrZero(lowNetPot)),
          ctpPot: Math.max(0, numberOrZero(ctpPot)),
          nassauPot: Math.max(0, numberOrZero(nassauPot)),
          stablefordPot: Math.max(0, numberOrZero(stablefordPot)),
          birdiePot: Math.max(0, numberOrZero(birdiePot)),
          eaglePot: Math.max(0, numberOrZero(eaglePot)),
          wolfUnit: Math.max(0, numberOrZero(wolfUnit)),
          bingoBangoBongoUnit: Math.max(0, numberOrZero(bingoBangoBongoUnit)),
          vegasUnit: Math.max(0, numberOrZero(vegasUnit)),
          matchPlayUnit: Math.max(0, numberOrZero(matchPlayUnit)),
          teamMatchPlayUnit: Math.max(0, numberOrZero(teamMatchPlayUnit)),
          teamOneName: teamOneName.trim() || 'Team 1',
          teamTwoName: teamTwoName.trim() || 'Team 2',
          ryderCupFormat,
          teamAssignments: finalTeamAssignments,
          singlesPairings: finalSinglesPairings,
          excludedPlayers: Object.fromEntries(optionalGameList.map((game) => [game.key, excludedPlayers[game.key] ?? []]).filter(([, ids]) => ids.length)),
          courseRating: numberOrNull(courseRating),
          slopeRating: numberOrNull(slopeRating),
          teeColor: teeColor.trim() || null,
          pcc: numberOrZero(pcc),
        },
        players: nextPlayers,
        holes: round.holes.map((hole) => ({
          ...hole,
          ctpWinnerPlayerId:
            hole.ctpWinnerPlayerId && nextPlayerById.get(hole.ctpWinnerPlayerId)?.ctpParticipant === false
              ? null
              : hole.ctpWinnerPlayerId,
          matchups: hole.matchups.map((matchup) => ({
            ...matchup,
            bankerParticipant: nextPlayerById.get(matchup.playerId)?.bankerParticipant !== false,
          })),
        })),
      };

      hydrateRound(nextRound);
      await updateSharedRoundSetup(nextRound);
      if (courseRating.trim() && slopeRating.trim()) await saveCourseTee({
        courseKey: savedCourseKey(nextRound.selectedCourseId ?? null, nextRound.courseName),
        courseName: nextRound.courseName,
        teeColor: teeColor.trim(),
        courseRating: Number(courseRating),
        slopeRating: Number(slopeRating),
      });
      const bundle = await loadSharedRoundByCode(routeRoundCode);
      if (bundle) {
        hydrateRound(sharedRoundBundleToRoundState(bundle));
      }
      setSaveStatus('Saved ✓');
    } catch (error) {
      console.error('Unable to save setup.', error);
      setSaveStatus(error instanceof Error ? `Couldn't save: ${error.message}` : "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const optionalGameList = optionalGames({
    nassauEnabled, stablefordEnabled, birdiePotEnabled, eaglePotEnabled, holeInOneEnabled,
    wolfEnabled, vegasEnabled, bingoBangoBongoEnabled, matchPlayEnabled, extraGames,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-32">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Edit round</h1>
          <p className="mt-1 text-sm text-slate-600">Fix names, handicaps, games or pots. Scores already entered stay with each golfer.</p>
        </div>
        <Link href={`/r/${routeRoundCode}`} className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl border border-[#c9d8c7] px-3 text-sm font-semibold text-[#0f5132]">
          Back to round
        </Link>
      </div>

      {loadStatus === 'loading' ? <Card className="text-sm text-slate-600" role="status">Loading round {routeRoundCode}…</Card> : null}
      {loadStatus === 'not_found' ? <Card className="text-sm text-slate-600">No round was found for code {routeRoundCode}. Check the code and try again.</Card> : null}

      {loadStatus === 'ready' ? (
      <>
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">1. Round &amp; course</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Round title">
            <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Course name">
            <input className={inputClass} value={courseName} onChange={(event) => setCourseName(event.target.value)} />
          </Field>
        </div>
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer font-semibold">Handicap posting <span className="font-normal text-slate-500">(optional)</span></summary>
          <p className="mt-2 text-sm text-slate-500">Only needed if you post scores for your official handicap. Copy the ratings for your tees from the scorecard.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Tee color">
              <input className={inputClass} value={teeColor} onChange={(event) => setTeeColor(event.target.value)} />
            </Field>
            <Field label="Course rating">
              <input type="number" inputMode="decimal" className={inputClass} value={courseRating} onChange={(event) => setCourseRating(event.target.value)} />
            </Field>
            <Field label="Slope rating">
              <input type="number" inputMode="numeric" className={inputClass} value={slopeRating} onChange={(event) => setSlopeRating(event.target.value)} />
            </Field>
            <Field label="Playing conditions adjustment (PCC)">
              <input type="number" inputMode="decimal" className={inputClass} value={pcc} onChange={(event) => setPcc(event.target.value)} />
            </Field>
          </div>
        </details>
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">2. Golfers</h2>
          <p className="text-sm text-slate-500">
            {groupCount > 1 ? 'Groups can\'t be changed after the round starts, so saved scores stay with the right golfer. ' : ''}
            Handicap is each golfer&apos;s handicap index.
          </p>
        </div>
        {playerDrafts.map((player) => (
          <div key={player.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label={groupCount > 1 ? `Name · ${getGroupLabel(round, player.id)}` : 'Name'}>
              <input className={inputClass} value={player.name} onChange={(event) => updatePlayerDraft(player.id, 'name', event.target.value)} />
            </Field>
            <Field label="Handicap">
              <input type="number" inputMode="decimal" step="0.1" className={inputClass} value={player.handicap} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updatePlayerDraft(player.id, 'handicap', event.target.value)} />
            </Field>
            <PlayerGames
              className="sm:col-span-2"
              options={[
                ...(bankerEnabled ? [{ key: 'banker', label: 'Banker', checked: player.bankerParticipant, onToggle: () => updatePlayerDraft(player.id, 'bankerParticipant', !player.bankerParticipant) }] : []),
                ...(skinsEnabled ? [{ key: 'skins', label: 'Skins', checked: player.skinsParticipant, onToggle: () => updatePlayerDraft(player.id, 'skinsParticipant', !player.skinsParticipant) }] : []),
                ...(ctpEnabled ? [{ key: 'ctp', label: 'CTP', checked: player.ctpParticipant, onToggle: () => updatePlayerDraft(player.id, 'ctpParticipant', !player.ctpParticipant) }] : []),
                ...(lowNetEnabled ? [{ key: 'low_net', label: 'Low Net', checked: player.lowNetParticipant, onToggle: () => updatePlayerDraft(player.id, 'lowNetParticipant', !player.lowNetParticipant) }] : []),
                ...optionalGameList.map((game) => ({
                  ...game,
                  checked: !(excludedPlayers[game.key] ?? []).includes(player.id),
                  onToggle: () => setExcludedPlayers((current) => toggleExcluded(current, game.key, player.id)),
                })),
              ]}
            />
            {teamMatchPlayEnabled ? (
              <div className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium">Ryder Cup team</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['team_one', 'team_two'] as const).map((team) => (
                    <label key={team} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">
                      <input type="radio" className="h-5 w-5 accent-[#0f5132]" checked={(teamAssignments[player.id] ?? 'team_one') === team} onChange={() => setPlayerTeam(player.id, team)} />
                      {team === 'team_one' ? teamOneName || 'Team 1' : teamTwoName || 'Team 2'}
                    </label>
                  ))}
                </div>
                {ryderCupFormat === 'singles_match' ? (
                  <div className="mt-3">
                    <Field label="Singles opponent">
                      <select className={inputClass} value={singlesPairings[player.id] ?? ''} onChange={(event) => setSinglesOpponent(player.id, event.target.value)}>
                        <option value="">Auto pair by team order</option>
                        {playerDrafts
                          .filter((opponent) => opponent.id !== player.id && (teamAssignments[player.id] ?? 'team_one') !== (teamAssignments[opponent.id] ?? 'team_one'))
                          .map((opponent) => (
                            <option key={opponent.id} value={opponent.id}>{opponent.name.trim() || opponent.id}</option>
                          ))}
                      </select>
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">3. Games</h2>
          <p className="text-sm text-slate-500">
            {scoresEntered ? 'Scores are already in, so changing games or pots recalculates the payouts. ' : ''}
            <Link href="/games" target="_blank" className="font-semibold text-[#0f5132] underline">How the games work</Link>
          </p>
        </div>
        <GamePicker options={gameOptions} />
        <div className="grid gap-3 sm:grid-cols-2">
          {skinsEnabled ? <MoneyField label="Skins pot (total $)" value={skinsPot} onChange={setSkinsPot} /> : null}
          {lowNetEnabled ? <MoneyField label="Low net pot (total $)" value={lowNetPot} onChange={setLowNetPot} /> : null}
          {ctpEnabled ? <MoneyField label="Closest-to-pin pot (total $)" value={ctpPot} onChange={setCtpPot} /> : null}
          {nassauEnabled ? <MoneyField label="Nassau pot (total $)" value={nassauPot} onChange={setNassauPot} /> : null}
          {stablefordEnabled ? <MoneyField label="Stableford pot (total $)" value={stablefordPot} onChange={setStablefordPot} /> : null}
          {birdiePotEnabled ? <MoneyField label="Birdie pot (total $)" value={birdiePot} onChange={setBirdiePot} /> : null}
          {eaglePotEnabled ? <MoneyField label="Eagle pot (total $)" value={eaglePot} onChange={setEaglePot} /> : null}
          {wolfEnabled ? <MoneyField label="Wolf $ per point" value={wolfUnit} onChange={setWolfUnit} /> : null}
          {bingoBangoBongoEnabled ? <MoneyField label="Bingo Bango Bongo $ per point" value={bingoBangoBongoUnit} onChange={setBingoBangoBongoUnit} /> : null}
          {vegasEnabled ? <MoneyField label="Vegas $ per point" value={vegasUnit} onChange={setVegasUnit} /> : null}
          {matchPlayEnabled ? <MoneyField label="Match play $ per match" value={matchPlayUnit} onChange={setMatchPlayUnit} /> : null}
          {BEEZER_EXTRA_GAMES.filter((game) => extraGames[game.key]).map((game) => (
            <MoneyField
              key={game.key}
              label={moneyLabel(game.label)}
              value={extraGameUnits[game.key] ?? '0'}
              onChange={(value) => setExtraGameUnits((current) => ({ ...current, [game.key]: value }))}
            />
          ))}
        </div>
        {holeInOneEnabled ? <p className="text-sm text-slate-500">Hole-in-one pays $100 from every other golfer to the player who made it.</p> : null}
        {teamMatchPlayEnabled ? (
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <h3 className="font-bold sm:col-span-2">Ryder Cup</h3>
            <Field label="Format">
              <select className={inputClass} value={ryderCupFormat} onChange={(event) => setRyderCupFormat(event.target.value as 'team_match' | 'singles_match')}>
                <option value="team_match">Team match play (2 vs 2)</option>
                <option value="singles_match">Singles match play (1 vs 1)</option>
              </select>
            </Field>
            <MoneyField label="Team match $ per point" value={teamMatchPlayUnit} onChange={setTeamMatchPlayUnit} />
            <Field label="Team 1 name">
              <input className={inputClass} value={teamOneName} onChange={(event) => setTeamOneName(event.target.value)} />
            </Field>
            <Field label="Team 2 name">
              <input className={inputClass} value={teamTwoName} onChange={(event) => setTeamTwoName(event.target.value)} />
            </Field>
            <Field label="Ryder event code (links days together)">
              <input className={`${inputClass} uppercase`} value={ryderEventCode} onChange={(event) => setRyderEventCode(event.target.value.toUpperCase())} />
            </Field>
            <Field label="Day number">
              <input type="number" inputMode="numeric" min={1} className={inputClass} value={ryderEventDay} onChange={(event) => setRyderEventDay(event.target.value)} />
            </Field>
          </div>
        ) : null}
      </Card>

      <DeleteRoundCard round={round} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p role="status" className="min-w-0 flex-1 text-sm text-slate-600">
            {saving ? 'Saving…' : saveStatus.startsWith("Couldn't") ? saveStatus : dirty ? 'You have unsaved changes.' : saveStatus || 'No changes yet.'}
          </p>
          <Button type="button" className="shrink-0 px-6 py-4" disabled={saving || !dirty} onClick={() => void handleSaveSetup()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
      </>
      ) : null}
    </main>
  );
}
