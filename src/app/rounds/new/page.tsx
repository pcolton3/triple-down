'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/shared/card';
import { Button } from '@/components/shared/button';
import { generateRoundCode } from '@/lib/utils/round-code';
import { useRoundStore } from '@/stores/round-store';
import { getCourseDetails, getNearbyCourses, searchCourses } from '@/lib/course-search';
import { createSharedRoundFromLocalRound, loadSharedRoundsByRyderEventCode, sharedRoundBundleToRoundState } from '@/lib/realtime/shared-rounds';
import { loadSavedGolfers, saveGolfersForLater, type SavedGolfer } from '@/lib/realtime/saved-golfers';
import { loadSavedCourseTees, saveCourseTee, savedCourseKey, type SavedCourseTee } from '@/lib/realtime/saved-course-tees';
import { BEEZER_EXTRA_GAMES, type BeezerExtraGameKey } from '@/lib/games/catalog';
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

function buildDefaultHoleConfig() {
  return Array.from({ length: 18 }, (_, index) => ({ holeNumber: index + 1, par: 4 as const, handicapIndex: index + 1 }));
}

function mergeHoleConfig(importedHoles: HoleConfig[]) {
  const importedByNumber = new Map(importedHoles.map((hole) => [hole.holeNumber, hole]));
  return buildDefaultHoleConfig().map((hole) => importedByNumber.get(hole.holeNumber) ?? hole);
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

function NewRoundPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createRound = useRoundStore((state) => state.createRound);
  const [roundCode, setRoundCode] = useState('');
  const [ryderEventCode, setRyderEventCode] = useState('');
  const [ryderEventDay, setRyderEventDay] = useState(1);
  const [title, setTitle] = useState('Triple');
  const [courseName, setCourseName] = useState('');
  const [bankerEnabled, setBankerEnabled] = useState(false);
  const [skinsEnabled, setSkinsEnabled] = useState(false);
  const [lowNetEnabled, setLowNetEnabled] = useState(false);
  const [ctpEnabled, setCtpEnabled] = useState(false);
  const [nassauEnabled, setNassauEnabled] = useState(false);
  const [stablefordEnabled, setStablefordEnabled] = useState(false);
  const [birdiePotEnabled, setBirdiePotEnabled] = useState(false);
  const [eaglePotEnabled, setEaglePotEnabled] = useState(false);
  const [holeInOneEnabled, setHoleInOneEnabled] = useState(false);
  const [wolfEnabled, setWolfEnabled] = useState(false);
  const [bingoBangoBongoEnabled, setBingoBangoBongoEnabled] = useState(false);
  const [vegasEnabled, setVegasEnabled] = useState(false);
  const [matchPlayEnabled, setMatchPlayEnabled] = useState(false);
  const [teamMatchPlayEnabled, setTeamMatchPlayEnabled] = useState(false);
  const [defaultBet, setDefaultBet] = useState(5);
  const [skinsPot, setSkinsPot] = useState(0);
  const [lowNetPot, setLowNetPot] = useState(0);
  const [ctpPot, setCtpPot] = useState(0);
  const [nassauPot, setNassauPot] = useState(0);
  const [stablefordPot, setStablefordPot] = useState(0);
  const [birdiePot, setBirdiePot] = useState(0);
  const [eaglePot, setEaglePot] = useState(0);
  const [wolfUnit, setWolfUnit] = useState(0);
  const [bingoBangoBongoUnit, setBingoBangoBongoUnit] = useState(0);
  const [vegasUnit, setVegasUnit] = useState(0);
  const [matchPlayUnit, setMatchPlayUnit] = useState(0);
  const [teamMatchPlayUnit, setTeamMatchPlayUnit] = useState(0);
  const [extraGames, setExtraGames] = useState<Partial<Record<BeezerExtraGameKey, boolean>>>({});
  const [extraGameUnits, setExtraGameUnits] = useState<Partial<Record<BeezerExtraGameKey, number>>>({});
  const [teamOneName, setTeamOneName] = useState('Team 1');
  const [teamTwoName, setTeamTwoName] = useState('Team 2');
  const [ryderCupFormat, setRyderCupFormat] = useState<'team_match' | 'singles_match'>('team_match');
  const [teamAssignments, setTeamAssignments] = useState<Record<string, 'team_one' | 'team_two'>>({});
  const [singlesPairings, setSinglesPairings] = useState<Record<string, string>>({});
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('');
  const [teeColor, setTeeColor] = useState('');
  const [savedCourseTees, setSavedCourseTees] = useState<SavedCourseTee[]>([]);
  const [savedCourseTeesStatus, setSavedCourseTeesStatus] = useState('');
  const [courseImportStatus, setCourseImportStatus] = useState('');
  const [pcc, setPcc] = useState('0');
  const [playerCount, setPlayerCount] = useState(4);
  const [players, setPlayers] = useState(buildDefaultPlayers(4));
  const [firstBankerPlayerId, setFirstBankerPlayerId] = useState('p1');
  const [courseQuery, setCourseQuery] = useState('');
  const [courseResults, setCourseResults] = useState<CourseRecord[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseRecord | null>(null);
  const [manualHoles, setManualHoles] = useState<HoleConfig[]>(buildDefaultHoleConfig());
  const [locationStatus, setLocationStatus] = useState('Getting nearby courses…');
  const [searchMode, setSearchMode] = useState<'nearby' | 'search'>('nearby');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedGolfers, setSavedGolfers] = useState<SavedGolfer[]>([]);
  const [savedGolfersStatus, setSavedGolfersStatus] = useState('');
  const [golferSearchQueries, setGolferSearchQueries] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [prefillStatus, setPrefillStatus] = useState('');
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
    wolfEnabled ? 'Wolf' : null,
    bingoBangoBongoEnabled ? 'Bingo Bango Bongo' : null,
    vegasEnabled ? 'Vegas' : null,
    matchPlayEnabled ? 'Match Play' : null,
    teamMatchPlayEnabled ? 'Team Match Play' : null,
    ...BEEZER_EXTRA_GAMES.filter((game) => extraGames[game.key]).map((game) => game.label),
  ].filter(Boolean);
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

  useEffect(() => {
    const code = generateRoundCode();
    setRoundCode(code);
    setRyderEventCode(code);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const eventCodeParam = searchParams.get('ryderEventCode')?.toUpperCase();
    const day = Number(searchParams.get('ryderDay') ?? '');
    if (!eventCodeParam) return;
    const eventCode = eventCodeParam;

    async function prefillFromRyderEvent() {
      try {
        setPrefillStatus(`Loading Ryder event ${eventCode}...`);
        const bundles = await loadSharedRoundsByRyderEventCode(eventCode);
        if (cancelled || bundles.length === 0) {
          if (!cancelled) setPrefillStatus(`No existing Ryder event was found for ${eventCode}.`);
          return;
        }

        const rounds = bundles.map(sharedRoundBundleToRoundState).sort((a, b) => (a.ryderEventDay ?? 1) - (b.ryderEventDay ?? 1));
        const template = rounds[rounds.length - 1];
        if (!template) return;
        const nextDay = Number.isFinite(day) && day > 0 ? Math.floor(day) : (template.ryderEventDay ?? rounds.length) + 1;
        const copiedPlayers = template.players.map((player) => ({
          ...player,
          bankerParticipant: player.bankerParticipant !== false,
          skinsParticipant: player.skinsParticipant !== false,
          ctpParticipant: player.ctpParticipant !== false,
          lowNetParticipant: player.lowNetParticipant !== false,
        }));
        const uniqueHoles = Array.from(
          new Map(
            template.holes
              .filter((hole) => (hole.groupNumber ?? 1) === 1)
              .sort((a, b) => a.holeNumber - b.holeNumber)
              .map((hole) => [hole.holeNumber, { holeNumber: hole.holeNumber, par: hole.par, handicapIndex: hole.handicapIndex }])
          ).values()
        );

        setTeamMatchPlayEnabled(true);
        setRyderEventCode(eventCode);
        setRyderEventDay(nextDay);
        setRyderCupFormat(nextDay > 1 ? 'singles_match' : template.gameSettings.ryderCupFormat ?? 'team_match');
        setTitle(`Ryder Cup Day ${nextDay}`);
        setCourseName(template.courseName);
        setCourseQuery(template.courseName);
        setSelectedCourse(null);
        setPlayers(copiedPlayers);
        setPlayerCount(PLAYER_COUNTS.includes(copiedPlayers.length) ? copiedPlayers.length : PLAYER_COUNTS.find((count) => count >= copiedPlayers.length) ?? 24);
        setFirstBankerPlayerId(copiedPlayers.find((player) => player.bankerParticipant !== false)?.id ?? copiedPlayers[0]?.id ?? 'p1');
        setTeamOneName(template.gameSettings.teamOneName ?? 'Team 1');
        setTeamTwoName(template.gameSettings.teamTwoName ?? 'Team 2');
        setTeamAssignments(template.gameSettings.teamAssignments ?? {});
        setSinglesPairings(template.gameSettings.singlesPairings ?? {});
        setTeamMatchPlayUnit(template.gameSettings.teamMatchPlayUnit ?? 0);
        setCourseRating(template.gameSettings.courseRating == null ? '' : String(template.gameSettings.courseRating));
        setSlopeRating(template.gameSettings.slopeRating == null ? '' : String(template.gameSettings.slopeRating));
        setTeeColor(template.gameSettings.teeColor ?? '');
        setPcc(String(template.gameSettings.pcc ?? 0));
        if (uniqueHoles.length > 0) setManualHoles(uniqueHoles);
        setPrefillStatus(`Prefilled Day ${nextDay} from Ryder event ${eventCode}.`);
      } catch (error) {
        console.error('Unable to prefill Ryder event.', error);
        if (!cancelled) setPrefillStatus(error instanceof Error ? error.message : 'Unable to prefill Ryder event.');
      }
    }

    void prefillFromRyderEvent();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

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
    setGolferSearchQueries((current) => ({ ...current, [playerId]: savedGolfer.name }));
  }

  function updateGolferSearch(playerId: string, value: string) {
    setGolferSearchQueries((current) => ({ ...current, [playerId]: value }));
  }

  function savedGolferMatches(query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return savedGolfers.slice(0, 6);

    return savedGolfers
      .map((golfer) => {
        const normalizedName = golfer.name.toLowerCase();
        const starts = normalizedName.startsWith(normalizedQuery);
        const includes = normalizedName.includes(normalizedQuery);
        return { golfer, score: starts ? 2 : includes ? 1 : 0 };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.golfer.name.localeCompare(b.golfer.name))
      .slice(0, 6)
      .map((item) => item.golfer);
  }

  async function loadTeesForCourse(courseId: string | null | undefined, name: string) {
    const key = savedCourseKey(courseId, name);
    if (!key) {
      setSavedCourseTees([]);
      setSavedCourseTeesStatus('');
      return;
    }

    try {
      const tees = await loadSavedCourseTees(key);
      setSavedCourseTees(tees);
      setSavedCourseTeesStatus(tees.length > 0 ? `${tees.length} saved tee setup${tees.length === 1 ? '' : 's'} available.` : '');
    } catch (error) {
      console.error('Unable to load saved course tees.', error);
      setSavedCourseTees([]);
      setSavedCourseTeesStatus('Saved tee setups are unavailable right now.');
    }
  }

  function applySavedCourseTee(teeId: string) {
    const savedTee = savedCourseTees.find((tee) => tee.id === teeId);
    if (!savedTee) return;
    setTeeColor(savedTee.teeColor);
    setCourseRating(String(savedTee.courseRating));
    setSlopeRating(String(savedTee.slopeRating));
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
    setCourseImportStatus('Checking OpenStreetMap for scorecard details...');
    void loadTeesForCourse(resultCourse.id, resultCourse.name);

    if (resultCourse.holes.length > 0) {
      setManualHoles(mergeHoleConfig(resultCourse.holes));
      setCourseImportStatus(`Loaded ${resultCourse.holes.length} saved/local hole setup${resultCourse.holes.length === 1 ? '' : 's'}.`);
    }

    const detailedCourse = await getCourseDetails(courseId, resultCourse);
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
      void loadTeesForCourse(mergedCourse.id, mergedCourse.name);

      if (mergedCourse.holes.length > 0) {
        setManualHoles(mergeHoleConfig(mergedCourse.holes));
        setCourseImportStatus(
          detailedCourse.holes.length >= 18
            ? 'Imported full scorecard from OpenStreetMap.'
            : `Imported ${detailedCourse.holes.length} OpenStreetMap hole${detailedCourse.holes.length === 1 ? '' : 's'}; fill any missing details below.`
        );
      } else {
        setCourseImportStatus('No OpenStreetMap scorecard found yet. You can enter it once and save it for later rounds.');
      }
    } else if (resultCourse.holes.length === 0) {
      setCourseImportStatus('No OpenStreetMap scorecard found yet. You can enter it once and save it for later rounds.');
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
    setTeeColor('');
    setCourseRating('');
    setSlopeRating('');
    setSavedCourseTees([]);
    setSavedCourseTeesStatus('');
    setCourseImportStatus('');
    setManualHoles(buildDefaultHoleConfig());
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
    const finalTeamAssignments = sanitizedPlayers.reduce<Record<string, 'team_one' | 'team_two'>>((assignments, player, index) => {
      assignments[player.id] = teamAssignments[player.id] ?? (index % 2 === 0 ? 'team_one' : 'team_two');
      return assignments;
    }, {});
    const teamOneIds = sanitizedPlayers.filter((player) => finalTeamAssignments[player.id] === 'team_one').map((player) => player.id);
    const teamTwoIds = sanitizedPlayers.filter((player) => finalTeamAssignments[player.id] === 'team_two').map((player) => player.id);
    const finalSinglesPairings = { ...singlesPairings };
    teamOneIds.forEach((playerId, index) => {
      if (finalSinglesPairings[playerId]) return;
      const opponentId = teamTwoIds[index];
      if (!opponentId) return;
      finalSinglesPairings[playerId] = opponentId;
      finalSinglesPairings[opponentId] = playerId;
    });

    const finalRoundCode = roundCode || generateRoundCode();

    createRound({
      roundCode: finalRoundCode,
      ryderEventCode: teamMatchPlayEnabled ? (ryderEventCode.trim().toUpperCase() || finalRoundCode) : null,
      ryderEventDay: teamMatchPlayEnabled ? Math.max(1, Math.floor(ryderEventDay || 1)) : null,
      title: title.trim() || 'Saturday Group',
      courseName: courseName.trim() || selectedCourse?.name || 'Golf Course',
      selectedCourseId: selectedCourse?.id ?? null,
      defaultBet: Number.isFinite(defaultBet) ? Math.max(0, defaultBet) : 0,
      gameSettings: {
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
        extraGameUnits,
        skinsPot: Number.isFinite(skinsPot) ? Math.max(0, skinsPot) : 0,
        lowNetPot: Number.isFinite(lowNetPot) ? Math.max(0, lowNetPot) : 0,
        ctpPot: Number.isFinite(ctpPot) ? Math.max(0, ctpPot) : 0,
        nassauPot: Number.isFinite(nassauPot) ? Math.max(0, nassauPot) : 0,
        stablefordPot: Number.isFinite(stablefordPot) ? Math.max(0, stablefordPot) : 0,
        birdiePot: Number.isFinite(birdiePot) ? Math.max(0, birdiePot) : 0,
        eaglePot: Number.isFinite(eaglePot) ? Math.max(0, eaglePot) : 0,
        wolfUnit: Number.isFinite(wolfUnit) ? Math.max(0, wolfUnit) : 0,
        bingoBangoBongoUnit: Number.isFinite(bingoBangoBongoUnit) ? Math.max(0, bingoBangoBongoUnit) : 0,
        vegasUnit: Number.isFinite(vegasUnit) ? Math.max(0, vegasUnit) : 0,
        matchPlayUnit: Number.isFinite(matchPlayUnit) ? Math.max(0, matchPlayUnit) : 0,
        teamMatchPlayUnit: Number.isFinite(teamMatchPlayUnit) ? Math.max(0, teamMatchPlayUnit) : 0,
        teamOneName: teamOneName.trim() || 'Team 1',
        teamTwoName: teamTwoName.trim() || 'Team 2',
        ryderCupFormat,
        teamAssignments: finalTeamAssignments,
        singlesPairings: finalSinglesPairings,
        courseRating: courseRating.trim() ? Number(courseRating) || null : null,
        slopeRating: slopeRating.trim() ? Number(slopeRating) || null : null,
        teeColor: teeColor.trim() || null,
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
      await saveCourseTee({
        courseKey: savedCourseKey(selectedCourse?.id ?? null, courseName.trim() || selectedCourse?.name || 'Golf Course'),
        courseName: courseName.trim() || selectedCourse?.name || 'Golf Course',
        teeColor: teeColor.trim(),
        courseRating: Number(courseRating),
        slopeRating: Number(slopeRating),
      });
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
    const nextCode = generateRoundCode();
    setRoundCode(nextCode);
    setRyderEventCode(nextCode);
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
          {prefillStatus ? <p className="mt-2 text-sm font-bold text-[#0f5132]">{prefillStatus}</p> : null}
        </div>
        <Link href="/" className="text-sm font-bold text-[#0f5132]">
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
                    {course.holes.length > 0 ? (
                      <div className="mt-1 text-xs font-semibold text-[#0f5132]">
                        {course.holes.length} saved hole{course.holes.length === 1 ? '' : 's'}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-sm font-bold text-[#0f5132]">Select</span>
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
              onBlur={() => void loadTeesForCourse(selectedCourse?.id ?? null, courseName)}
              placeholder="Manual course name"
            />
          </div>

          <div>
            <h2 className="mb-2 text-lg font-bold">Handicap Posting</h2>
            <p className="mb-3 text-sm text-slate-500">
              Optional USGA/WHS posting values. These prefill the handicap posting section after the round.
            </p>
            {savedCourseTeesStatus ? <p className="mb-3 text-xs text-slate-500">{savedCourseTeesStatus}</p> : null}
            {savedCourseTees.length > 0 ? (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">Saved Tee Setup</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-3"
                  value=""
                  onChange={(event) => applySavedCourseTee(event.target.value)}
                >
                  <option value="">Select saved tees</option>
                  {savedCourseTees.map((tee) => (
                    <option key={tee.id} value={tee.id}>
                      {tee.teeName}
                      {tee.gender ? ` (${tee.gender})` : ''}
                      {tee.totalYards ? ` - ${tee.totalYards} yds` : ''}
                      {` - ${tee.courseRating} / ${tee.slopeRating}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Tee Color</label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-3"
                  value={teeColor}
                  placeholder="Blue"
                  onChange={(event) => setTeeColor(event.target.value)}
                />
              </div>
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

          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium">Holes</label>
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-500"
              value="18"
              readOnly
            />
          </div>
          <p className="text-sm text-slate-500">Preview share code: {roundCode}</p>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Games</h2>
            <p className="text-sm text-slate-500">
              Choose which games are active for this round.
            </p>
          </div>

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
                        onChange={option.onToggle}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {bankerEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Default Banker Bet</label>
              <NumberField value={defaultBet} onChange={setDefaultBet} placeholder="Bet" />
            </div>
            ) : null}
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
            {nassauEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Nassau Pot</label>
              <NumberField value={nassauPot} onChange={setNassauPot} placeholder="0" />
            </div>
            ) : null}
            {stablefordEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Stableford Pot</label>
              <NumberField value={stablefordPot} onChange={setStablefordPot} placeholder="0" />
            </div>
            ) : null}
            {birdiePotEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Birdie Pot</label>
              <NumberField value={birdiePot} onChange={setBirdiePot} placeholder="0" />
            </div>
            ) : null}
            {eaglePotEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Eagle Pot</label>
              <NumberField value={eaglePot} onChange={setEaglePot} placeholder="0" />
            </div>
            ) : null}
            {wolfEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Wolf Unit</label>
              <NumberField value={wolfUnit} onChange={setWolfUnit} placeholder="0" />
            </div>
            ) : null}
            {bingoBangoBongoEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Bingo Bango Bongo Unit</label>
              <NumberField value={bingoBangoBongoUnit} onChange={setBingoBangoBongoUnit} placeholder="0" />
            </div>
            ) : null}
            {vegasEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Vegas Unit</label>
              <NumberField value={vegasUnit} onChange={setVegasUnit} placeholder="0" />
            </div>
            ) : null}
            {matchPlayEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Match Play Unit</label>
              <NumberField value={matchPlayUnit} onChange={setMatchPlayUnit} placeholder="0" />
            </div>
            ) : null}
            {teamMatchPlayEnabled ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Team Match Unit</label>
              <NumberField value={teamMatchPlayUnit} onChange={setTeamMatchPlayUnit} placeholder="0" />
            </div>
            ) : null}
            {BEEZER_EXTRA_GAMES.filter((game) => extraGames[game.key]).map((game) => (
              <div key={game.key}>
                <label className="mb-1 block text-sm font-medium">{game.unitLabel}</label>
                <NumberField
                  value={extraGameUnits[game.key] ?? 0}
                  onChange={(value) => setExtraGameUnits((current) => ({ ...current, [game.key]: value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          {holeInOneEnabled ? (
            <p className="text-sm text-slate-500">Hole-in-One pays $100 from every other golfer to the player who made it.</p>
          ) : null}
          {teamMatchPlayEnabled ? (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Ryder Format</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-3"
                  value={ryderCupFormat}
                  onChange={(event) => setRyderCupFormat(event.target.value as 'team_match' | 'singles_match')}
                >
                  <option value="team_match">Day 1 - Team Match Play</option>
                  <option value="singles_match">Day 2 - Singles Match Play</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ryder Event Code</label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 uppercase"
                  value={ryderEventCode}
                  onChange={(event) => setRyderEventCode(event.target.value.toUpperCase())}
                  placeholder="Same code for every day"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ryder Day</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3"
                  value={ryderEventDay}
                  onChange={(event) => setRyderEventDay(Number(event.target.value) || 1)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Team 1 Name</label>
                <input className="w-full rounded-xl border border-slate-300 px-3 py-3" value={teamOneName} onChange={(event) => setTeamOneName(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Team 2 Name</label>
                <input className="w-full rounded-xl border border-slate-300 px-3 py-3" value={teamTwoName} onChange={(event) => setTeamTwoName(event.target.value)} />
              </div>
            </div>
          ) : null}
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
                    const golferSearchQuery = golferSearchQueries[player.id] ?? '';
                    const golferMatches = savedGolferMatches(golferSearchQuery);
                    return (
                      <div key={player.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_100px]">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Search Saved Golfers
                          </label>
                          <input
                            className="w-full rounded-xl border border-slate-300 px-3 py-3"
                            value={golferSearchQuery}
                            placeholder="Search saved golfers"
                            onChange={(event) => updateGolferSearch(player.id, event.target.value)}
                          />
                          {savedGolfers.length > 0 && golferSearchQuery.trim().length > 0 ? (
                            <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                              {golferMatches.length > 0 ? (
                                golferMatches.map((golfer) => (
                                  <button
                                    key={golfer.id}
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-emerald-50"
                                    onClick={() => selectSavedGolfer(player.id, golfer.id)}
                                  >
                                    <span className="font-semibold text-slate-900">{golfer.name}</span>
                                    <span className="shrink-0 text-xs text-slate-500">
                                      HCP {golfer.handicap}
                                      {golfer.postedRounds ? `, ${golfer.postedRounds} posted` : ''}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-sm text-slate-500">No saved golfers found.</div>
                              )}
                            </div>
                          ) : null}
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
                        {teamMatchPlayEnabled ? (
                          <div className="sm:col-span-3">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Ryder Cup Team
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                                <input
                                  type="radio"
                                  className="mr-2 h-4 w-4"
                                  checked={(teamAssignments[player.id] ?? (absoluteIndex % 2 === 0 ? 'team_one' : 'team_two')) === 'team_one'}
                                  onChange={() => setPlayerTeam(player.id, 'team_one')}
                                />
                                {teamOneName || 'Team 1'}
                              </label>
                              <label className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold">
                                <input
                                  type="radio"
                                  className="mr-2 h-4 w-4"
                                  checked={(teamAssignments[player.id] ?? (absoluteIndex % 2 === 0 ? 'team_one' : 'team_two')) === 'team_two'}
                                  onChange={() => setPlayerTeam(player.id, 'team_two')}
                                />
                                {teamTwoName || 'Team 2'}
                              </label>
                            </div>
                            {ryderCupFormat === 'singles_match' ? (
                              <div className="mt-3">
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Singles Opponent
                                </label>
                                <select
                                  className="w-full rounded-xl border border-slate-300 px-3 py-3"
                                  value={singlesPairings[player.id] ?? ''}
                                  onChange={(event) => setSinglesOpponent(player.id, event.target.value)}
                                >
                                  <option value="">Auto pair by team order</option>
                                  {players
                                    .filter((opponent) => {
                                      if (opponent.id === player.id) return false;
                                      const playerTeam = teamAssignments[player.id] ?? (absoluteIndex % 2 === 0 ? 'team_one' : 'team_two');
                                      const opponentIndex = players.findIndex((item) => item.id === opponent.id);
                                      const opponentTeam = teamAssignments[opponent.id] ?? (opponentIndex % 2 === 0 ? 'team_one' : 'team_two');
                                      return playerTeam !== opponentTeam;
                                    })
                                    .map((opponent) => (
                                      <option key={opponent.id} value={opponent.id}>
                                        {opponent.name.trim() || `Player ${players.findIndex((item) => item.id === opponent.id) + 1}`}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
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
              {courseImportStatus ? (
                <div className="mt-2 text-xs font-semibold text-[#0f5132]">{courseImportStatus}</div>
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

export default function NewRoundPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-8">Loading create round...</main>}>
      <NewRoundPageContent />
    </Suspense>
  );
}
