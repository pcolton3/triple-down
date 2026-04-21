'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/shared/card';
import { Button } from '@/components/shared/button';
import { generateRoundCode } from '@/lib/utils/round-code';
import { useRoundStore } from '@/stores/round-store';
import { getCourseDetails, getNearbyCourses, searchCourses } from '@/lib/course-search';
import type { CourseRecord } from '@/types/course';
import type { HoleConfig } from '@/types/round';

const defaultPlayers = [
  { id: 'p1', name: '', handicap: 0 },
  { id: 'p2', name: '', handicap: 0 },
  { id: 'p3', name: '', handicap: 0 },
  { id: 'p4', name: '', handicap: 0 },
];

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
  const [title, setTitle] = useState('Saturday Group');
  const [courseName, setCourseName] = useState('');
  const [defaultBet, setDefaultBet] = useState(5);
  const [players, setPlayers] = useState(defaultPlayers);
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

  useEffect(() => {
    setRoundCode(generateRoundCode());
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
    const detailedCourse = await getCourseDetails(courseId);
    const course = detailedCourse ?? resultCourse;
    if (!course) return;
    setSelectedCourse(course);
    setCourseName(course.name);
    if (course.holes.length > 0) {
      setManualHoles(course.holes.map((hole) => ({ ...hole })));
    }
    setCourseQuery(course.name);
    setCourseResults([]);
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
    setCourseQuery('');
    void getNearbyCourses(userLocation ?? undefined).then((results) => setCourseResults(results));
  }

  function handleCreateRound() {
    const sanitizedPlayers = players.map((player, index) => ({
      ...player,
      name: player.name.trim() || `Player ${index + 1}`,
    }));

    const finalRoundCode = generateRoundCode();

    createRound({
      roundCode: finalRoundCode,
      title: title.trim() || 'Saturday Group',
      courseName: courseName.trim() || selectedCourse?.name || 'Golf Course',
      selectedCourseId: selectedCourse?.id ?? null,
      defaultBet: Number.isFinite(defaultBet) ? Math.max(0, defaultBet) : 0,
      players: sanitizedPlayers,
      firstBankerPlayerId,
      totalHoles: 18,
      holesConfig: manualHoles,
    });

    router.push(`/r/${finalRoundCode}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Create Round</h1>
          <p className="mt-2 text-slate-600">
            Search for a course, confirm your group, then start your Banker round.
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
              {searchMode === 'nearby' ? locationStatus : 'Search results are ranked with nearby courses first when location is available.'}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Default Bet</label>
              <NumberField value={defaultBet} onChange={setDefaultBet} placeholder="Bet" />
            </div>
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
              Selected course: <span className="font-semibold text-slate-900">{selectedCourse.name}</span>{selectedCourse.city || selectedCourse.state ? <> • {selectedCourse.city}{selectedCourse.city && selectedCourse.state ? ', ' : ''}{selectedCourse.state}</> : null}
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
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Par</label>
                <select
                  className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={hole.par}
                  onChange={(event) => updateHoleConfig(hole.holeNumber, 'par', Number(event.target.value))}
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hcp</label>
                <NumberField
                  value={hole.handicapIndex}
                  onChange={(value) => updateHoleConfig(hole.holeNumber, 'handicapIndex', value)}
                  placeholder="Hcp"
                />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Players and Handicaps</h2>
              <p className="text-sm text-slate-500">Set the opening Banker and each player handicap.</p>
            </div>
            <select
              className="rounded-xl border border-slate-300 px-3 py-2"
              value={firstBankerPlayerId}
              onChange={(event) => setFirstBankerPlayerId(event.target.value)}
            >
              {players.map((player, index) => (
                <option key={player.id} value={player.id}>
                  {(player.name.trim() || `Player ${index + 1}`)} as Banker
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {players.map((player, index) => (
              <div key={player.id} className="grid grid-cols-[1fr_100px] gap-3 rounded-xl border border-slate-200 p-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-3"
                    value={player.name}
                    placeholder={`Player ${index + 1}`}
                    onChange={(event) => updatePlayer(player.id, 'name', event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hcp</label>
                  <NumberField
                    value={player.handicap}
                    onChange={(value) => updatePlayer(player.id, 'handicap', String(value))}
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleCreateRound}>Create and Open Round</Button>
        </div>
      </div>
    </main>
  );
}
