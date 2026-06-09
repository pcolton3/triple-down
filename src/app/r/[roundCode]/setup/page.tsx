'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { loadSharedRoundByCode, sharedRoundBundleToRoundState, updateSharedRoundSetup } from '@/lib/realtime/shared-rounds';
import { saveCourseTee, savedCourseKey } from '@/lib/realtime/saved-course-tees';
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

function getGroupLabel(round: RoundState, playerId: string) {
  const assignment = round.multiFoursome?.groupPlayers.find((item) => item.playerId === playerId);
  return assignment ? `Group ${assignment.groupNumber}` : 'Group 1';
}

export default function EditRoundSetupPage() {
  const params = useParams<{ roundCode: string }>();
  const { round, hydrateRound } = useRoundStore();
  const routeRoundCode = params.roundCode?.toUpperCase() || round.roundCode;
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'not_found'>('loading');
  const [saveStatus, setSaveStatus] = useState('');
  const [title, setTitle] = useState(round.title);
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
  const [skinsPot, setSkinsPot] = useState(String(round.gameSettings.skinsPot ?? 0));
  const [lowNetPot, setLowNetPot] = useState(String(round.gameSettings.lowNetPot ?? 0));
  const [ctpPot, setCtpPot] = useState(String(round.gameSettings.ctpPot ?? 0));
  const [nassauPot, setNassauPot] = useState(String(round.gameSettings.nassauPot ?? 0));
  const [stablefordPot, setStablefordPot] = useState(String(round.gameSettings.stablefordPot ?? 0));
  const [birdiePot, setBirdiePot] = useState(String(round.gameSettings.birdiePot ?? 0));
  const [eaglePot, setEaglePot] = useState(String(round.gameSettings.eaglePot ?? 0));
  const [courseRating, setCourseRating] = useState(round.gameSettings.courseRating == null ? '' : String(round.gameSettings.courseRating));
  const [slopeRating, setSlopeRating] = useState(round.gameSettings.slopeRating == null ? '' : String(round.gameSettings.slopeRating));
  const [teeColor, setTeeColor] = useState(round.gameSettings.teeColor ?? '');
  const [pcc, setPcc] = useState(String(round.gameSettings.pcc ?? 0));
  const [playerDrafts, setPlayerDrafts] = useState<PlayerDraft[]>(buildPlayerDrafts(round.players));
  const [gamesOpen, setGamesOpen] = useState(false);

  const groupCount = useMemo(() => round.multiFoursome?.groups.length ?? 1, [round.multiFoursome?.groups.length]);
  const selectedGameLabels = [
    bankerEnabled ? 'Banker' : null,
    skinsEnabled ? 'Skins' : null,
    ctpEnabled ? 'CTP' : null,
    lowNetEnabled ? 'Low Net' : null,
    nassauEnabled ? 'Nassau' : null,
    stablefordEnabled ? 'Stableford' : null,
    birdiePotEnabled ? 'Birdie Pot' : null,
    eaglePotEnabled ? 'Eagle Pot' : null,
    holeInOneEnabled ? 'Hole-in-One' : null,
  ].filter(Boolean);
  const gameOptions: Array<{ label: string; checked: boolean; setChecked: Dispatch<SetStateAction<boolean>> }> = [
    { label: 'Banker', checked: bankerEnabled, setChecked: setBankerEnabled },
    { label: 'Skins', checked: skinsEnabled, setChecked: setSkinsEnabled },
    { label: 'CTP', checked: ctpEnabled, setChecked: setCtpEnabled },
    { label: 'Low Net', checked: lowNetEnabled, setChecked: setLowNetEnabled },
    { label: 'Nassau', checked: nassauEnabled, setChecked: setNassauEnabled },
    { label: 'Stableford', checked: stablefordEnabled, setChecked: setStablefordEnabled },
    { label: 'Birdie Pot', checked: birdiePotEnabled, setChecked: setBirdiePotEnabled },
    { label: 'Eagle Pot', checked: eaglePotEnabled, setChecked: setEaglePotEnabled },
    { label: 'Hole-in-One', checked: holeInOneEnabled, setChecked: setHoleInOneEnabled },
  ];

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
    setSkinsPot(String(round.gameSettings.skinsPot ?? 0));
    setLowNetPot(String(round.gameSettings.lowNetPot ?? 0));
    setCtpPot(String(round.gameSettings.ctpPot ?? 0));
    setNassauPot(String(round.gameSettings.nassauPot ?? 0));
    setStablefordPot(String(round.gameSettings.stablefordPot ?? 0));
    setBirdiePot(String(round.gameSettings.birdiePot ?? 0));
    setEaglePot(String(round.gameSettings.eaglePot ?? 0));
    setCourseRating(round.gameSettings.courseRating == null ? '' : String(round.gameSettings.courseRating));
    setSlopeRating(round.gameSettings.slopeRating == null ? '' : String(round.gameSettings.slopeRating));
    setTeeColor(round.gameSettings.teeColor ?? '');
    setPcc(String(round.gameSettings.pcc ?? 0));
    setPlayerDrafts(buildPlayerDrafts(round.players));
  }, [round]);

  function updatePlayerDraft(playerId: string, field: keyof PlayerDraft, value: string | boolean) {
    setPlayerDrafts((current) =>
      current.map((player) => (player.id === playerId ? { ...player, [field]: value } : player))
    );
  }

  async function handleSaveSetup() {
    try {
      setSaveStatus('Saving setup...');
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

      const nextRound: RoundState = {
        ...round,
        title: title.trim() || round.title,
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
          skinsPot: Math.max(0, numberOrZero(skinsPot)),
          lowNetPot: Math.max(0, numberOrZero(lowNetPot)),
          ctpPot: Math.max(0, numberOrZero(ctpPot)),
          nassauPot: Math.max(0, numberOrZero(nassauPot)),
          stablefordPot: Math.max(0, numberOrZero(stablefordPot)),
          birdiePot: Math.max(0, numberOrZero(birdiePot)),
          eaglePot: Math.max(0, numberOrZero(eaglePot)),
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
      await saveCourseTee({
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
      setSaveStatus('Setup saved.');
    } catch (error) {
      console.error('Unable to save setup.', error);
      setSaveStatus(error instanceof Error ? error.message : 'Unable to save setup.');
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Edit Round Setup</h1>
          <p className="mt-2 text-sm text-slate-600">Update event details, pots, handicap settings, and player setup.</p>
        </div>
        <Link href={`/r/${routeRoundCode}`} className="text-sm font-semibold text-[#2f8df3]">
          Back to Round
        </Link>
      </div>

      {loadStatus === 'loading' ? <Card className="text-sm text-slate-600">Loading round {routeRoundCode}...</Card> : null}
      {loadStatus === 'not_found' ? <Card className="text-sm text-slate-600">No round was found for code {routeRoundCode}.</Card> : null}

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Event</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Round Title</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-3" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Course Name</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-3" value={courseName} onChange={(event) => setCourseName(event.target.value)} />
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Games, Pots, and Handicap Posting</h2>
        <div className="relative">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-3 text-left font-semibold"
            onClick={() => setGamesOpen((value) => !value)}
          >
            <span>{selectedGameLabels.length > 0 ? selectedGameLabels.join(', ') : 'Select games'}</span>
            <span className="text-slate-500">{gamesOpen ? 'Close' : 'Open'}</span>
          </button>
          {gamesOpen ? (
            <div className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {gameOptions.map((option) => (
                  <label key={option.label} className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="mr-2 h-4 w-4"
                      checked={option.checked}
                      onChange={() => option.setChecked((value) => !value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="button" onClick={() => setGamesOpen(false)}>
                  Submit
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {skinsEnabled ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Skins Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={skinsPot} onChange={(event) => setSkinsPot(event.target.value)} />
          </label>
          ) : null}
          {lowNetEnabled ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Low Net Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={lowNetPot} onChange={(event) => setLowNetPot(event.target.value)} />
          </label>
          ) : null}
          {ctpEnabled ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">CTP Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={ctpPot} onChange={(event) => setCtpPot(event.target.value)} />
          </label>
          ) : null}
          {nassauEnabled ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nassau Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={nassauPot} onChange={(event) => setNassauPot(event.target.value)} />
          </label>
          ) : null}
          {stablefordEnabled ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Stableford Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={stablefordPot} onChange={(event) => setStablefordPot(event.target.value)} />
          </label>
          ) : null}
          {birdiePotEnabled ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Birdie Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={birdiePot} onChange={(event) => setBirdiePot(event.target.value)} />
          </label>
          ) : null}
          {eaglePotEnabled ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Eagle Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={eaglePot} onChange={(event) => setEaglePot(event.target.value)} />
          </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tee Color</span>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-3" value={teeColor} onChange={(event) => setTeeColor(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Course Rating</span>
            <input type="number" inputMode="decimal" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={courseRating} onChange={(event) => setCourseRating(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Slope Rating</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={slopeRating} onChange={(event) => setSlopeRating(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">PCC</span>
            <input type="number" inputMode="decimal" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={pcc} onChange={(event) => setPcc(event.target.value)} />
          </label>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-xl font-bold">Players</h2>
          <p className="text-sm text-slate-500">Player IDs and score history stay attached while you correct visible names or handicaps.</p>
        </div>
        <div className="space-y-3">
          {playerDrafts.map((player) => (
            <div key={player.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[100px_1fr_110px]">
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Group</span>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold">{getGroupLabel(round, player.id)}</div>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                <input className="w-full rounded-xl border border-slate-300 px-3 py-3" value={player.name} onChange={(event) => updatePlayerDraft(player.id, 'name', event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">HCP</span>
                <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={player.handicap} onChange={(event) => updatePlayerDraft(player.id, 'handicap', event.target.value)} />
              </label>
              <div className="sm:col-span-3">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Games</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {bankerEnabled ? (
                  <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                    <input type="checkbox" className="mr-2 h-4 w-4" checked={player.bankerParticipant} onChange={() => updatePlayerDraft(player.id, 'bankerParticipant', !player.bankerParticipant)} />
                    Banker
                  </label>
                  ) : null}
                  {skinsEnabled ? (
                  <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                    <input type="checkbox" className="mr-2 h-4 w-4" checked={player.skinsParticipant} onChange={() => updatePlayerDraft(player.id, 'skinsParticipant', !player.skinsParticipant)} />
                    Skins
                  </label>
                  ) : null}
                  {ctpEnabled ? (
                  <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                    <input type="checkbox" className="mr-2 h-4 w-4" checked={player.ctpParticipant} onChange={() => updatePlayerDraft(player.id, 'ctpParticipant', !player.ctpParticipant)} />
                    CTP
                  </label>
                  ) : null}
                  {lowNetEnabled ? (
                  <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                    <input type="checkbox" className="mr-2 h-4 w-4" checked={player.lowNetParticipant} onChange={() => updatePlayerDraft(player.id, 'lowNetParticipant', !player.lowNetParticipant)} />
                    Low Net
                  </label>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saveStatus ? <span className="text-sm text-slate-600">{saveStatus}</span> : null}
        <Button type="button" onClick={() => void handleSaveSetup()}>
          Save Setup
        </Button>
      </div>

      {groupCount > 1 ? (
        <p className="text-sm text-slate-500">
          Group moves are intentionally read-only here so saved hole scores stay attached to the right player IDs.
        </p>
      ) : null}
    </main>
  );
}
