'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/shared/card';
import { Button } from '@/components/shared/button';
import { generateRoundCode } from '@/lib/utils/round-code';
import { useRoundStore } from '@/stores/round-store';
import { getCourseDetails, searchCourses } from '@/lib/course-search';
import type { CourseRecord } from '@/types/course';
import type { HoleConfig } from '@/types/round';

const defaultPlayers = [
  { id: 'p1', name: '', handicap: 0 },
  { id: 'p2', name: '', handicap: 0 },
  { id: 'p3', name: '', handicap: 0 },
  { id: 'p4', name: '', handicap: 0 },
];

export default function NewRoundPage() {
  const router = useRouter();
  const createRound = useRoundStore((state) => state.createRound);
  const roundCode = useMemo(() => generateRoundCode(), []);
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
      setCourseResults([]);
      return;
    }
    const results = await searchCourses(value);
    setCourseResults(results);
  }

  async function handleSelectCourse(courseId: string) {
    const course = await getCourseDetails(courseId);
    if (!course) return;
    setSelectedCourse(course);
    setCourseName(course.name);
    setManualHoles(course.holes.map((hole) => ({ ...hole })));
    setCourseQuery(course.name);
    setCourseResults([]);
  }

  function updateHoleConfig(holeNumber: number, field: 'par' | 'handicapIndex', value: number) {
    setManualHoles((current) =>
      current.map((hole) =>
        hole.holeNumber === holeNumber
          ? {
              ...hole,
              [field]: field === 'par'
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
    setCourseResults([]);
  }

  function handleCreateRound() {
    const sanitizedPlayers = players.map((player, index) => ({
      ...player,
      name: player.name.trim() || `Player ${index + 1}`,
    }));

    createRound({
      roundCode,
      title: title.trim() || 'Saturday Group',
      courseName: courseName.trim() || selectedCourse?.name || 'Golf Course',
      selectedCourseId: selectedCourse?.id ?? null,
      defaultBet: Number.isFinite(defaultBet) ? Math.max(0, defaultBet) : 0,
      players: sanitizedPlayers,
      firstBankerPlayerId,
      totalHoles: 18,
      holesConfig: manualHoles,
    });

    router.push(`/r/${roundCode}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Create Round</h1>
          <p className="mt-2 text-slate-600">
            Search for a course first, then confirm your group and opening Banker.
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
              placeholder="Papago, Quintero, Troon..."
              onChange={(event) => void handleCourseSearch(event.target.value)}
            />
            <p className="mt-2 text-xs text-slate-500">
              Starter build uses a small built-in course catalog. Later we can swap this to a live golf course API.
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
                    <div className="text-sm text-slate-500">{course.city}, {course.state}</div>
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
              <input
                type="number"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-300 px-3 py-3"
                value={defaultBet === 0 ? '' : defaultBet}
                placeholder="Bet"
                onFocus={(event) => event.currentTarget.select()}
                onMouseUp={(event) => event.preventDefault()}
                onChange={(event) => setDefaultBet(event.target.value === '' ? 0 : Number(event.target.value) || 0)}
              />
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
              <p className="text-sm text-slate-500">Pars and hole handicaps will auto-fill from the selected course when available.</p>
            </div>
            {selectedCourse ? (
              <Button type="button" variant="secondary" onClick={clearSelectedCourse}>Clear Course</Button>
            ) : null}
          </div>

          {selectedCourse ? (
            <div className="mb-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
              Selected course: <span className="font-semibold text-slate-900">{selectedCourse.name}</span> • {selectedCourse.city}, {selectedCourse.state}
            </div>
          ) : (
            <div className="mb-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
              No course selected yet. You can still edit the pars and hole handicaps manually below.
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
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={hole.handicapIndex}
                  onFocus={(event) => event.currentTarget.select()}
                  onMouseUp={(event) => event.preventDefault()}
                  onChange={(event) => updateHoleConfig(hole.holeNumber, 'handicapIndex', Number(event.target.value) || 1)}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Players and Handicaps</h2>
            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={firstBankerPlayerId}
              onChange={(event) => setFirstBankerPlayerId(event.target.value)}
            >
              {players.map((player, index) => (
                <option key={player.id} value={player.id}>
                  {(player.name || `Player ${index + 1}`).trim()} starts as Banker
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {players.map((player, index) => (
              <div key={player.id} className="grid grid-cols-[1fr_96px] gap-3 rounded-2xl border border-slate-200 p-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Player Name
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    value={player.name}
                    placeholder={`Player ${index + 1}`}
                    onChange={(event) => updatePlayer(player.id, 'name', event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Handicap
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    value={player.handicap === 0 ? '' : player.handicap}
                    placeholder="Hcp"
                    onFocus={(event) => event.currentTarget.select()}
                    onMouseUp={(event) => event.preventDefault()}
                    onChange={(event) => updatePlayer(player.id, 'handicap', event.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Button className="w-full" onClick={handleCreateRound}>
          Create and Open Round
        </Button>
      </div>
    </main>
  );
}
