'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
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

type SavedCourseRow = {
  id: string;
  source_provider: string | null;
  source_course_id: string | null;
  name: string;
  city: string | null;
  state: string | null;
  saved_course_holes?: Array<{
    hole_number: number;
    par: number | null;
    handicap_index: number | null;
  }>;
};

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

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const missingPars = useMemo(() => manualHoles.some((h) => !h.par), [manualHoles]);
  const missingHandicaps = useMemo(() => manualHoles.some((h) => !h.handicapIndex), [manualHoles]);

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

  async function findSavedCourse(course: CourseRecord) {
    const supabase = createSupabase();
    if (!supabase) return null;

    const bySource = await supabase
      .from('saved_courses')
      .select('id,name,city,state,source_provider,source_course_id,saved_course_holes(hole_number,par,handicap_index)')
      .eq('source_provider', 'nominatim')
      .eq('source_course_id', course.id)
      .maybeSingle<SavedCourseRow>();

    if (bySource.data) return bySource.data;

    const byName = await supabase
      .from('saved_courses')
      .select('id,name,city,state,source_provider,source_course_id,saved_course_holes(hole_number,par,handicap_index)')
      .eq('normalized_name', normalizeName(course.name))
      .maybeSingle<SavedCourseRow>();

    return byName.data ?? null;
  }

  async function handleSelectCourse(courseId: string) {
    setSaveStatus('idle');

    const resultCourse = courseResults.find((course) => course.id === courseId) ?? null;
    if (!resultCourse) return;

    setSelectedCourse(resultCourse);
    setCourseName(resultCourse.name);
    setCourseQuery(resultCourse.name);
    setCourseResults([]);

    const saved = await findSavedCourse(resultCourse);
    if (saved?.saved_course_holes?.length === 18) {
      setManualHoles(
        saved.saved_course_holes
          .sort((a, b) => a.hole_number - b.hole_number)
          .map((hole) => ({
            holeNumber: hole.hole_number,
            par: ((hole.par ?? 4) as 3 | 4 | 5),
            handicapIndex: hole.handicap_index ?? hole.hole_number,
          }))
      );
      return;
    }

    if (resultCourse.holes.length > 0) {
      setManualHoles(resultCourse.holes.map((hole) => ({ ...hole })));
    } else {
      setManualHoles(
        Array.from({ length: 18 }, (_, index) => ({ holeNumber: index + 1, par: 4, handicapIndex: index + 1 }))
      );
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
    setSaveStatus('idle');
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
    setSaveStatus('idle');
    setManualHoles(
      Array.from({ length: 18 }, (_, index) => ({ holeNumber: index + 1, par: 4, handicapIndex: index + 1 }))
    );
    void getNearbyCourses(userLocation ?? undefined).then((results) => setCourseResults(results));
  }

  async function handleSaveCourse() {
    const supabase = createSupabase();
    if (!supabase || !courseName.trim()) {
      setSaveStatus('error');
      return;
    }

    try {
      setSaveStatus('saving');
      const normalizedName = normalizeName(courseName);

      let courseId: string | null = null;

      if (selectedCourse?.id) {
        const existingBySource = await supabase
          .from('saved_courses')
          .select('id')
          .eq('source_provider', 'nominatim')
          .eq('source_course_id', selectedCourse.id)
          .maybeSingle<{ id: string }>();

        courseId = existingBySource.data?.id ?? null;
      }

      if (!courseId) {
        const existingByName = await supabase
          .from('saved_courses')
          .select('id')
          .eq('normalized_name', normalizedName)
          .maybeSingle<{ id: string }>();

        courseId = existingByName.data?.id ?? null;
      }

      if (courseId) {
        const updateCourse = await supabase
          .from('saved_courses')
          .update({
            name: courseName.trim(),
            city: selectedCourse?.city ?? null,
            state: selectedCourse?.state ?? null,
            normalized_name: normalizedName,
            source_provider: selectedCourse?.id ? 'nominatim' : null,
            source_course_id: selectedCourse?.id ?? null,
          })
          .eq('id', courseId);

        if (updateCourse.error) throw updateCourse.error;
      } else {
        const insertCourse = await supabase
          .from('saved_courses')
          .insert({
            name: courseName.trim(),
            city: selectedCourse?.city ?? null,
            state: selectedCourse?.state ?? null,
            normalized_name: normalizedName,
            source_provider: selectedCourse?.id ? 'nominatim' : null,
            source_course_id: selectedCourse?.id ?? null,
          })
          .select('id')
          .single<{ id: string }>();

        if (insertCourse.error) throw insertCourse.error;
        courseId = insertCourse.data.id;
      }

      const holeRows = manualHoles.map((hole) => ({
        saved_course_id: courseId,
        hole_number: hole.holeNumber,
        par: hole.par,
        handicap_index: hole.handicapIndex,
      }));

      const saveHoles = await supabase
        .from('saved_course_holes')
        .upsert(holeRows, {
          onConflict: 'saved_course_id,hole_number',
          ignoreDuplicates: false,
        });

      if (saveHoles.error) throw saveHoles.error;
      setSaveStatus('saved');
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
    }
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

          <div className="mt-4 space-y-3">
            {(missingPars || missingHandicaps) && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {missingPars && missingHandicaps
                  ? 'Par and hole handicap data are not available for this course yet. Please enter them manually. Once saved, this course can be reused in future rounds.'
                  : missingHandicaps
                    ? 'Hole handicap data is not available for this course yet. Please enter it manually. Once saved, this course can be reused in future rounds.'
                    : 'Par data is not available for this course yet. Please enter it manually. Once saved, this course can be reused in future rounds.'}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveCourse()}
                disabled={!courseName || manualHoles.length !== 18 || saveStatus === 'saving'}
                className="rounded-xl bg-[#2f8df3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save Course'}
              </button>
              {saveStatus === 'saved' && <span className="text-sm text-green-700">Saved for future rounds</span>}
              {saveStatus === 'error' && (
                <span className="text-sm text-red-700">
                  Save failed. Check your Supabase env keys and database tables.
                </span>
              )}
            </div>
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
                  {player.name.trim() || `Player ${index + 1}`} as Banker
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
