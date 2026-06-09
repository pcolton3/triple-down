'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/shared/card';
import { Button } from '@/components/shared/button';
import { generateRoundCode } from '@/lib/utils/round-code';
import { useRoundStore } from '@/stores/round-store';
import { getCourseDetails, getNearbyCourses, searchCourses } from '@/lib/course-search';
import { createSharedRoundFromLocalRound } from '@/lib/realtime/shared-rounds';
import { loadSavedGolfers, saveGolfersForLater, type SavedGolfer } from '@/lib/realtime/saved-golfers';
import type { CourseRecord } from '@/types/course';
import type { HoleConfig } from '@/types/round';

const MAX_PLAYERS = 24;
const MIN_PLAYERS = 4;
const PLAYER_COUNTS = [4, 5, 8, 12, 16, 20, 24];

function buildDefaultPlayers(count = 4) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: '',
    handicap: 0,
    bankerParticipant: true,
    skinsParticipant: true,
    ctpParticipant: true,
    lowNetParticipant: true,
  }));
}

function NumberField({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className="w-full rounded-xl border border-slate-300 px-3 py-3"
      value={value === 0 ? '' : value}
      placeholder={placeholder}
      onFocus={(event) => event.currentTarget.select()}
      onMouseUp={(event) => event.preventDefault()}
      onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value) || 0)}
    />
  );
}

export default function NewRoundPage() {
  const router = useRouter();
  const createRound = useRoundStore((state) => state.createRound);
  const [roundCode, setRoundCode] = useState('');
  const [title, setTitle] = useState('Triple');
  const [courseName, setCourseName] = useState('');
  const [bankerEnabled, setBankerEnabled] = useState(true);
  const [skinsEnabled, setSkinsEnabled] = useState(false);
  const [lowNetEnabled, setLowNetEnabled] = useState(false);
  const [ctpEnabled, setCtpEnabled] = useState(false);
  const [defaultBet, setDefaultBet] = useState(5);
  const [skinsPot, setSkinsPot] = useState(0);
  const [lowNetPot, setLowNetPot] = useState(0);
  const [ctpPot, setCtpPot] = useState(0);
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('');
  const [pcc, setPcc] = useState('0');
  const [playerCount, setPlayerCount] = useState(4);
  const [players, setPlayers] = useState(buildDefaultPlayers(4));
  const [firstBankerPlayerId, setFirstBankerPlayerId] = useState('p1');
  const [courseQuery, setCourseQuery] = useState('');
  const [courseResults, setCourseResults] = useState<CourseRecord[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseRecord | null>(null);
  const [manualHoles, setManualHoles] = useState<HoleConfig[]>(
    Array.from({ length: 18 }, (_, index) => ({ holeNumber: index + 1, par: 4, handicapIndex: index + 1 }))
  );
  const [locationStatus, setLocationStatus] = useState('Getting nearby courses…');
  const [searchMode, setSearchMode] = useState<'nearby' | 'search'>('nearby');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedGolfers, setSavedGolfers] = useState<SavedGolfer[]>([]);
  const [savedGolfersStatus, setSavedGolfersStatus] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const effectiveGroupSize: 4 | 5 = players.length === 5 ? 5 : 4;

  const groups = useMemo(() => {
    return Array.from({ length: Math.ceil(players.length / effectiveGroupSize) }, (_, groupIndex) => ({
      groupNumber: groupIndex + 1,
      players: players.slice(groupIndex * effectiveGroupSize, groupIndex * effectiveGroupSize + effectiveGroupSize),
    }));
  }, [effectiveGroupSize, players]);
  const bankerEligiblePlayers = useMemo(
    () => players.filter((player) => player.bankerParticipant !== false),
    [players]
  );

  useEffect(() => {
    setRoundCode(generateRoundCode());
  }, []);

  useEffect(() => {
    if (!bankerEligiblePlayers.some((player) => player.id === firstBankerPlayerId)) {
      setFirstBankerPlayerId(bankerEligiblePlayers[0]?.id ?? 'p1');
    }
  }, [bankerEligiblePlayers, firstBankerPlayerId]);

  useEffect(() => {
    let cancelled = false;

    async function loadGolfers() {
      try {
        const golfers = await loadSavedGolfers();
        if (!cancelled) {
          setSavedGolfers(golfers);
          setSavedGolfersStatus(golfers.length > 0 ? `${golfers.length} saved golfers available.` : '');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to load saved golfers.', error);
          setSavedGolfersStatus('Saved golfers are unavailable right now.');
        }
      }
    }

    void loadGolfers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNearby() {
      const results = await getNearbyCourses();
      if (!cancelled) {
        setCourseResults(results);
        setLocationStatus('Showing featured nearby-friendly courses.');
      }
    }

    if (!navigator.geolocation) {
      void loadNearby();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(location);
        const results = await getNearbyCourses(location);
        if (!cancelled) {
          setCourseResults(results);
          setLocationStatus('Showing courses closest to you first.');
        }
      },
      async () => {
        const results = await getNearbyCourses();
        if (!cancelled) {
          setCourseResults(results);
          setLocationStatus('Location unavailable. Showing featured courses.');
        }
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 600000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  function updatePlayerCount(nextCount: number) {
    const bounded = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.floor(nextCount || MIN_PLAYERS)));
    const normalized = PLAYER_COUNTS.reduce((best, count) =>
      Math.abs(count - bounded) < Math.abs(best - bounded) ? count : best
    );
    setPlayerCount(normalized);
    setPlayers((current) => {
      if (normalized === current.length) return current;
      if (normalized < current.length) {
        const next = current.slice(0, normalized);
        if (!next.some((player) => player.id === firstBankerPlayerId)) {
          setFirstBankerPlayerId(next[0]?.id ?? 'p1');
        }
        return next;
      }

      const additions = Array.from({ length: normalized - current.length }, (_, index) => {
        const nextNumber = current.length + index + 1;
        return {
          id: `p${nextNumber}`,
          name: '',
          handicap: 0,
          bankerParticipant: true,
          skinsParticipant: true,
          ctpParticipant: true,
          lowNetParticipant: true,
        };
      });

      return [...current, ...additions];
    });
  }

  function updatePlayer(playerId: string, field: 'name' | 'handicap', value: string) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              [field]: field === 'name' ? value : Number(value) || 0,
            }
          : player
      )
    );
  }

  function togglePlayerBanker(playerId: string) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, bankerParticipant: player.bankerParticipant === false } : player
      )
    );
  }

  function togglePlayerGame(playerId: string, field: 'skinsParticipant' | 'ctpParticipant' | 'lowNetParticipant') {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, [field]: player[field] === false } : player
      )
    );
  }

  function selectSavedGolfer(playerId: string, savedGolferId: string) {
    const savedGolfer = savedGolfers.find((golfer) => golfer.id === savedGolferId);
    if (!savedGolfer) return;

    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name: savedGolfer.name,
              handicap: savedGolfer.handicap,
            }
          : player
      )
    );
  }

  async function handleCourseSearch(value: string) {
    setCourseQuery(value);
    if (value.trim().length < 2) {
      setSearchMode('nearby');
      const results = await getNearbyCourses(userLocation ?? undefined);
      setCourseResults(results);
      return;
    }
    setSearchMode('search');
    const results = await searchCourses(value, { ...userLocation, limit: 12 });
    setCourseResults(results);
  }

  async function handleSelectCourse(courseId: string) {
    const resultCourse = courseResults.find((course) => course.id === courseId) ?? null;
    if (!resultCourse) return;

    setSelectedCourse(resultCourse);
    setCourseName(resultCourse.name);
    setCourseQuery(resultCourse.name);
    setCourseResults([]);

    if (resultCourse.holes.length > 0) {
      setManualHoles(resultCourse.holes.map((hole) => ({ ...hole })));
    }

    const detailedCourse = await getCourseDetails(courseId);
    if (detailedCourse) {
      const mergedCourse = {
        ...resultCourse,
        ...detailedCourse,
        name: detailedCourse.name || resultCourse.name,
        city: detailedCourse.city || resultCourse.city,
        state: detailedCourse.state || resultCourse.state,
        latitude: detailedCourse.latitude ?? resultCourse.latitude,
        longitude: detailedCourse.longitude ?? resultCourse.longitude,
        holes: detailedCourse.holes.length > 0 ? detailedCourse.holes : resultCourse.holes,
      };

      setSelectedCourse(mergedCourse);
      setCourseName(mergedCourse.name);

      if (mergedCourse.holes.length > 0) {
        setManualHoles(mergedCourse.holes.map((hole) => ({ ...hole })));
      }
    }
  }

  function updateHoleConfig(holeNumber: number, field: 'par' | 'handicapIndex', value: number) {
    setManualHoles((current) =>
      current.map((hole) =>
        hole.holeNumber === holeNumber
          ? {
              ...hole,
              [field]:
                field === 'par'
                  ? (Math.max(3, Math.min(5, value)) as 3 | 4 | 5)
                  : Math.max(1, Math.min(18, Math.floor(value || 1))),
            }
          : hole
      )
    );
  }

  function clearSelectedCourse() {
    setSelectedCourse(null);
    setCourseName('');
    setCourseQuery('');
    setManualHoles(
      Array.from({ length: 18 }, (_, index) => ({ holeNumber: index + 1, par: 4, handicapIndex: index + 1 }))
    );
    void getNearbyCourses(userLocation ?? undefined).then((results) => setCourseResults(results));
  }

  async function handleCreateRound() {
    setCreateError('');
    setIsCreating(true);

    const filledPlayers = players.filter((player) => player.name.trim().length > 0);
    if (filledPlayers.length < MIN_PLAYERS) {
      setCreateError('Enter at least 4 golfer names before creating the round.');
      setIsCreating(false);
      return;
    }

    const sanitizedPlayers = filledPlayers.map((player) => ({
      ...player,
      name: player.name.trim(),
    }));
    const playerIds = new Set(sanitizedPlayers.map((player) => player.id));
    const groupPlayers = groups.flatMap((group) =>
      group.players
        .filter((player) => playerIds.has(player.id))
        .map((player, sortOrder) => ({
          playerId: player.id,
          groupNumber: group.groupNumber,
          sortOrder,
        }))
    );
    const firstFilledPlayerId = sanitizedPlayers[0]?.id ?? firstBankerPlayerId;
    const openingBankerId = playerIds.has(firstBankerPlayerId) ? firstBankerPlayerId : firstFilledPlayerId;

    const finalRoundCode = roundCode || generateRoundCode();

    createRound({
      roundCode: finalRoundCode,
      title: title.trim() || 'Saturday Group',
      courseName: courseName.trim() || selectedCourse?.name || 'Golf Course',
      selectedCourseId: selectedCourse?.id ?? null,
      defaultBet: Number.isFinite(defaultBet) ? Math.max(0, defaultBet) : 0,
      gameSettings: {
        bankerEnabled,
        skinsEnabled,
        lowNetEnabled,
        ctpEnabled,
        skinsPot: Number.isFinite(skinsPot) ? Math.max(0, skinsPot) : 0,
        lowNetPot: Number.isFinite(lowNetPot) ? Math.max(0, lowNetPot) : 0,
        ctpPot: Number.isFinite(ctpPot) ? Math.max(0, ctpPot) : 0,
        courseRating: courseRating.trim() ? Number(courseRating) || null : null,
        slopeRating: slopeRating.trim() ? Number(slopeRating) || null : null,
        pcc: pcc.trim() ? Number(pcc) || 0 : 0,
      },
      players: sanitizedPlayers,
      firstBankerPlayerId: openingBankerId,
      groupSize: effectiveGroupSize,
      groupPlayers,
      totalHoles: 18,
      holesConfig: manualHoles,
    });

    try {
      await createSharedRoundFromLocalRound(useRoundStore.getState().round);
    } catch (error) {
      console.error('Unable to save shared round to Supabase.', error);
      const message = error instanceof Error ? error.message : 'Unable to save this round to Supabase.';
      setCreateError(message);
      setIsCreating(false);
      return;
    }

    try {
      await saveGolfersForLater(
        players
          .filter((player) => player.name.trim().length > 0)
          .map((player) => ({
            name: player.name.trim(),
            handicap: player.handicap,
          }))
      );
    } catch (error) {
      console.error('Unable to save golfers for later.', error);
    }

    router.push(`/r/${finalRoundCode}/group/1`);
    setRoundCode(generateRoundCode());
    setIsCreating(false);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Create Round</h1>
          <p className="mt-2 text-slate-600">
            Search for a course, set side games, add 4 to 24 golfers, then start your Triple Track round.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-[#2f8df3]">
          Back Home
        </Link>
      </div>

      <div className="space-y-4">
        <Card className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Round Title</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Search Course</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={courseQuery}
              placeholder="Search by course name"
              onChange={(event) => void handleCourseSearch(event.target.value)}
            />
            <p className="mt-2 text-xs text-slate-500">
              {searchMode === 'nearby'
                ? locationStatus
                : 'Search results are ranked with nearby courses first when location is available.'}
            </p>
          </div>

          {courseResults.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              {courseResults.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-white"
                  onClick={() => void handleSelectCourse(course.id)}
                >
                  <div>
                    <div className="font-semibold text-slate-900">{course.name}</div>
                    <div className="text-sm text-slate-500">
                      {course.city}, {course.state}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-[#2f8df3]">Select</span>
                </button>
              ))}
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium">Course Name</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
              placeholder="Manual course name"
            />
          </div>

          <div>
            <h2 className="mb-2 text-lg font-bold">Handicap Posting</h2>
            <p className="mb-3 text-sm text-slate-500">
              Optional USGA/WHS posting values. These prefill the handicap posting section after the round.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Course Rating</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3"
                  value={courseRating}
                  placeholder="71.2"
                  onChange={(event) => setCourseRating(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Slope Rating</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3"
                  value={slopeRating}
                  placeholder="128"
                  onChange={(event) => setSlopeRating(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">PCC</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3"
                  value={pcc}
                  placeholder="0"
                  onChange={(event) => setPcc(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {bankerEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Default Banker Bet</label>
              <NumberField value={defaultBet} onChange={setDefaultBet} placeholder="Bet" />
            </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium">Holes</label>
              <input
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-500"
                value="18"
                readOnly
              />
            </div>
          </div>
          <p className="text-sm text-slate-500">Preview share code: {roundCode}</p>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Games</h2>
            <p className="text-sm text-slate-500">
              Choose which games are active for this round. Skins and CTP are separate games.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="mr-2 h-4 w-4"
                checked={bankerEnabled}
                onChange={() => setBankerEnabled((value) => !value)}
              />
              Banker
            </label>
            <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="mr-2 h-4 w-4"
                checked={skinsEnabled}
                onChange={() => setSkinsEnabled((value) => !value)}
              />
              Skins
            </label>
            <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="mr-2 h-4 w-4"
                checked={ctpEnabled}
                onChange={() => setCtpEnabled((value) => !value)}
              />
              CTP
            </label>
            <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="mr-2 h-4 w-4"
                checked={lowNetEnabled}
                onChange={() => setLowNetEnabled((value) => !value)}
              />
              Low Net
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {skinsEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Skins Pot</label>
              <NumberField value={skinsPot} onChange={setSkinsPot} placeholder="0" />
            </div>
            ) : null}
            {lowNetEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Low Net Pot</label>
              <NumberField value={lowNetPot} onChange={setLowNetPot} placeholder="0" />
            </div>
            ) : null}
            {ctpEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">CTP Pot</label>
              <NumberField value={ctpPot} onChange={setCtpPot} placeholder="0" />
            </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-xl font-bold">Golfers and Foursomes</h2>
            <p className="text-sm text-slate-500">
              Pick the number of setup slots you need. Blank golfer rows are ignored, so 8 slots can become 4/3, 3/3, or 4/4.
            </p>
            {savedGolfersStatus ? <p className="mt-2 text-xs text-slate-500">{savedGolfersStatus}</p> : null}
          </div>

          <div className="mb-4 max-w-xs">
            <label className="mb-1 block text-sm font-medium">Number of Golfers</label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={playerCount}
              onChange={(event) => updatePlayerCount(Number(event.target.value))}
            >
              {PLAYER_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>

          {bankerEnabled ? (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Opening Banker</label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={firstBankerPlayerId}
              onChange={(event) => setFirstBankerPlayerId(event.target.value)}
            >
              {bankerEligiblePlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name.trim() || `Player ${players.findIndex((item) => item.id === player.id) + 1}`}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Each group starts with the first listed golfer in that group unless this player belongs to the group.
            </p>
          </div>
          ) : null}

          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.groupNumber} className="rounded-2xl border border-slate-200 p-3">
                <h3 className="mb-3 font-bold">Group {group.groupNumber}</h3>
                <div className="space-y-3">
                  {group.players.map((player, groupIndex) => {
                    const absoluteIndex = (group.groupNumber - 1) * effectiveGroupSize + groupIndex;
                    return (
                      <div key={player.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_100px]">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Saved Golfer
                          </label>
                          <select
                            className="w-full rounded-xl border border-slate-300 px-3 py-3"
                            value=""
                            onChange={(event) => selectSavedGolfer(player.id, event.target.value)}
                          >
                            <option value="">Select golfer</option>
                            {savedGolfers.map((golfer) => (
                              <option key={golfer.id} value={golfer.id}>
                                {golfer.name} ({golfer.handicap}{golfer.postedRounds ? `, ${golfer.postedRounds} posted` : ''})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Name
                          </label>
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-3"
                            value={player.name}
                            placeholder={`Player ${absoluteIndex + 1}`}
                            onChange={(event) => updatePlayer(player.id, 'name', event.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Hcp
                          </label>
                          <NumberField
                            value={player.handicap}
                            onChange={(value) => updatePlayer(player.id, 'handicap', String(value))}
                            placeholder="0"
                          />
                        </div>
                        <div className="sm:col-span-3">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Game Participation
                          </span>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {bankerEnabled ? (
                            <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                              <input
                                type="checkbox"
                                className="mr-2 h-4 w-4"
                                checked={player.bankerParticipant !== false}
                                onChange={() => togglePlayerBanker(player.id)}
                              />
                              Banker
                            </label>
                            ) : null}
                            {skinsEnabled ? (
                            <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                              <input
                                type="checkbox"
                                className="mr-2 h-4 w-4"
                                checked={player.skinsParticipant !== false}
                                onChange={() => togglePlayerGame(player.id, 'skinsParticipant')}
                              />
                              Skins
                            </label>
                            ) : null}
                            {ctpEnabled ? (
                            <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                              <input
                                type="checkbox"
                                className="mr-2 h-4 w-4"
                                checked={player.ctpParticipant !== false}
                                onChange={() => togglePlayerGame(player.id, 'ctpParticipant')}
                              />
                              CTP
                            </label>
                            ) : null}
                            {lowNetEnabled ? (
                            <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                              <input
                                type="checkbox"
                                className="mr-2 h-4 w-4"
                                checked={player.lowNetParticipant !== false}
                                onChange={() => togglePlayerGame(player.id, 'lowNetParticipant')}
                              />
                              Low Net
                            </label>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Course Setup</h2>
              <p className="text-sm text-slate-500">
                Pars and hole handicaps auto-fill when full data is available. Otherwise you can edit them manually below.
              </p>
            </div>
            {selectedCourse ? (
              <Button type="button" variant="secondary" onClick={clearSelectedCourse}>
                Clear Course
              </Button>
            ) : null}
          </div>

          {selectedCourse ? (
            <div className="mb-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
              Selected course: <span className="font-semibold text-slate-900">{selectedCourse.name}</span>
              {selectedCourse.city || selectedCourse.state ? (
                <>
                  {' '}
                  • {selectedCourse.city}
                  {selectedCourse.city && selectedCourse.state ? ', ' : ''}
                  {selectedCourse.state}
                </>
              ) : null}
            </div>
          ) : (
            <div className="mb-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
              No course selected yet. You can still edit pars and hole handicaps manually below.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {manualHoles.map((hole) => (
              <div key={hole.holeNumber} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-900">Hole {hole.holeNumber}</div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Par
                </label>
                <select
                  className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={hole.par}
                  onChange={(event) => updateHoleConfig(hole.holeNumber, 'par', Number(event.target.value))}
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Hcp
                </label>
                <NumberField
                  value={hole.handicapIndex}
                  onChange={(value) => updateHoleConfig(hole.holeNumber, 'handicapIndex', value)}
                  placeholder="Hcp"
                />
              </div>
            ))}
          </div>
        </Card>

        {createError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {createError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button disabled={isCreating} onClick={() => void handleCreateRound()}>
            {isCreating ? 'Creating...' : 'Create and Open Group 1'}
          </Button>
        </div>
      </div>
    </main>
  );
}
