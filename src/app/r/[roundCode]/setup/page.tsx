'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/shared/button';
import { Card } from '@/components/shared/card';
import { createSharedRoundFromLocalRound, loadSharedRoundByCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';
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
  const [skinsPot, setSkinsPot] = useState(String(round.gameSettings.skinsPot ?? 0));
  const [lowNetPot, setLowNetPot] = useState(String(round.gameSettings.lowNetPot ?? 0));
  const [ctpPot, setCtpPot] = useState(String(round.gameSettings.ctpPot ?? 0));
  const [courseRating, setCourseRating] = useState(round.gameSettings.courseRating == null ? '' : String(round.gameSettings.courseRating));
  const [slopeRating, setSlopeRating] = useState(round.gameSettings.slopeRating == null ? '' : String(round.gameSettings.slopeRating));
  const [pcc, setPcc] = useState(String(round.gameSettings.pcc ?? 0));
  const [playerDrafts, setPlayerDrafts] = useState<PlayerDraft[]>(buildPlayerDrafts(round.players));

  const groupCount = useMemo(() => round.multiFoursome?.groups.length ?? 1, [round.multiFoursome?.groups.length]);

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
    setSkinsPot(String(round.gameSettings.skinsPot ?? 0));
    setLowNetPot(String(round.gameSettings.lowNetPot ?? 0));
    setCtpPot(String(round.gameSettings.ctpPot ?? 0));
    setCourseRating(round.gameSettings.courseRating == null ? '' : String(round.gameSettings.courseRating));
    setSlopeRating(round.gameSettings.slopeRating == null ? '' : String(round.gameSettings.slopeRating));
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
          skinsPot: Math.max(0, numberOrZero(skinsPot)),
          lowNetPot: Math.max(0, numberOrZero(lowNetPot)),
          ctpPot: Math.max(0, numberOrZero(ctpPot)),
          courseRating: numberOrNull(courseRating),
          slopeRating: numberOrNull(slopeRating),
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
      await createSharedRoundFromLocalRound(nextRound);
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
        <h2 className="text-xl font-bold">Pots and Handicap Posting</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Skins Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={skinsPot} onChange={(event) => setSkinsPot(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Low Net Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={lowNetPot} onChange={(event) => setLowNetPot(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">CTP Pot</span>
            <input type="number" inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-3" value={ctpPot} onChange={(event) => setCtpPot(event.target.value)} />
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
                  <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                    <input type="checkbox" className="mr-2 h-4 w-4" checked={player.bankerParticipant} onChange={() => updatePlayerDraft(player.id, 'bankerParticipant', !player.bankerParticipant)} />
                    Banker
                  </label>
                  <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                    <input type="checkbox" className="mr-2 h-4 w-4" checked={player.skinsParticipant} onChange={() => updatePlayerDraft(player.id, 'skinsParticipant', !player.skinsParticipant)} />
                    Skins
                  </label>
                  <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                    <input type="checkbox" className="mr-2 h-4 w-4" checked={player.ctpParticipant} onChange={() => updatePlayerDraft(player.id, 'ctpParticipant', !player.ctpParticipant)} />
                    CTP
                  </label>
                  <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                    <input type="checkbox" className="mr-2 h-4 w-4" checked={player.lowNetParticipant} onChange={() => updatePlayerDraft(player.id, 'lowNetParticipant', !player.lowNetParticipant)} />
                    Low Net
                  </label>
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
