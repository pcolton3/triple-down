import { createClient } from '@supabase/supabase-js';
import { courseCatalog } from '@/lib/course-data';
import type { CourseRecord } from '@/types/course';

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeCourseIdentity(text: string) {
  return normalize(text)
    .replace(/\b(country club|golf club|golf course|gc|course|club)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type SearchOptions = {
  latitude?: number | null;
  longitude?: number | null;
  limit?: number;
};

type RemoteCourseResult = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  holes: CourseRecord['holes'];
};

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

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function mapSavedCourse(row: SavedCourseRow): CourseRecord {
  return {
    id: row.source_course_id ?? `saved-${row.id}`,
    name: row.name,
    city: row.city ?? '',
    state: row.state ?? '',
    holes: (row.saved_course_holes ?? [])
      .map((hole) => ({
        holeNumber: hole.hole_number,
        par: (hole.par ?? 4) as 3 | 4 | 5,
        handicapIndex: hole.handicap_index ?? hole.hole_number,
      }))
      .sort((a, b) => a.holeNumber - b.holeNumber),
  };
}

async function fetchSavedCourses(query: string, options: SearchOptions): Promise<CourseRecord[]> {
  const supabase = createSupabase();
  if (!supabase) return [];

  let request = supabase
    .from('saved_courses')
    .select('id,name,city,state,source_provider,source_course_id,saved_course_holes(hole_number,par,handicap_index)')
    .limit(options.limit ?? 12);

  const normalized = normalize(query);
  if (normalized) {
    request = request.ilike('normalized_name', `%${normalized}%`);
  }

  const { data, error } = await request;
  if (error || !data) return [];

  return (data as SavedCourseRow[]).map(mapSavedCourse);
}

function dedupeCourses(courses: CourseRecord[]) {
  const seen = new Set<string>();
  return courses.filter((course) => {
    const key = normalizeCourseIdentity(course.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function distanceScore(course: CourseRecord, options: SearchOptions) {
  if (
    options.latitude == null ||
    options.longitude == null ||
    course.latitude == null ||
    course.longitude == null
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const latDelta = course.latitude - options.latitude;
  const lonDelta = course.longitude - options.longitude;
  return latDelta * latDelta + lonDelta * lonDelta;
}

function hasDistance(course: CourseRecord, options: SearchOptions) {
  return (
    options.latitude != null &&
    options.longitude != null &&
    course.latitude != null &&
    course.longitude != null
  );
}

function hasSavedDetails(course: CourseRecord) {
  return course.holes.length > 0 && !course.id.startsWith('osm-');
}

function mergeSavedDetailsIntoRemoteCourses(remoteCourses: CourseRecord[], savedCourses: CourseRecord[]) {
  const savedByIdentity = new Map(savedCourses.map((course) => [normalizeCourseIdentity(course.name), course]));

  return remoteCourses.map((course) => {
    const savedCourse = savedByIdentity.get(normalizeCourseIdentity(course.name));
    if (!savedCourse) return course;

    return {
      ...savedCourse,
      latitude: course.latitude,
      longitude: course.longitude,
    };
  });
}

function sortByDistanceThenSaved(a: CourseRecord, b: CourseRecord, options: SearchOptions) {
  const aHasDistance = hasDistance(a, options);
  const bHasDistance = hasDistance(b, options);

  if (aHasDistance !== bHasDistance) return aHasDistance ? -1 : 1;

  if (aHasDistance && bHasDistance) {
    const distanceDelta = distanceScore(a, options) - distanceScore(b, options);
    if (Math.abs(distanceDelta) > 0.000001) return distanceDelta;
  }

  const aSaved = hasSavedDetails(a) ? 1 : 0;
  const bSaved = hasSavedDetails(b) ? 1 : 0;
  if (aSaved !== bSaved) return bSaved - aSaved;

  return a.name.localeCompare(b.name);
}

async function fetchRemoteCourses(query: string, options: SearchOptions): Promise<RemoteCourseResult[]> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 12));
  if (query.trim()) params.set('q', query.trim());
  if (options.latitude != null) params.set('lat', String(options.latitude));
  if (options.longitude != null) params.set('lon', String(options.longitude));

  const response = await fetch(`/api/courses/search?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { courses?: RemoteCourseResult[] };
  const courses = data.courses ?? [];
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return courses;

  return courses.filter((course) => {
    const searchable = normalize(`${course.name} ${course.city} ${course.state}`);
    return searchable.includes(normalizedQuery);
  });
}

export async function searchCourses(query: string, options: SearchOptions = {}): Promise<CourseRecord[]> {
  const limit = options.limit ?? 12;

  const [savedCourses, remoteCourses] = await Promise.all([
    fetchSavedCourses(query, { ...options, limit: 250 }),
    fetchRemoteCourses(query, options),
  ]);

const normalizedQuery = normalize(query);

const remoteWithSavedDetails = mergeSavedDetailsIntoRemoteCourses(remoteCourses, savedCourses);
const combined = dedupeCourses([...remoteWithSavedDetails, ...savedCourses]);

return combined
  .sort((a, b) => {
    if (options.latitude != null && options.longitude != null) {
      const distanceResult = sortByDistanceThenSaved(a, b, options);
      if (distanceResult !== 0) return distanceResult;
    }

    const aName = normalize(a.name);
    const bName = normalize(b.name);

    const aExact = aName === normalizedQuery ? 1 : 0;
    const bExact = bName === normalizedQuery ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const aStarts = aName.startsWith(normalizedQuery) ? 1 : 0;
    const bStarts = bName.startsWith(normalizedQuery) ? 1 : 0;
    if (aStarts !== bStarts) return bStarts - aStarts;

    const aIncludes = aName.includes(normalizedQuery) ? 1 : 0;
    const bIncludes = bName.includes(normalizedQuery) ? 1 : 0;
    if (aIncludes !== bIncludes) return bIncludes - aIncludes;

    return a.name.localeCompare(b.name);
  })
  .slice(0, limit);
}

export async function getNearbyCourses(options: SearchOptions = {}): Promise<CourseRecord[]> {
  const limit = options.limit ?? 12;

  const [savedCourses, remoteCourses] = await Promise.all([
    fetchSavedCourses('', { ...options, limit: 250 }),
    fetchRemoteCourses('', options),
  ]);

  const nearbyWithSavedDetails = mergeSavedDetailsIntoRemoteCourses(remoteCourses, savedCourses);

  return dedupeCourses([...nearbyWithSavedDetails, ...savedCourses])
    .sort((a, b) => sortByDistanceThenSaved(a, b, options))
    .slice(0, limit);
}

export async function getCourseDetails(courseId: string, courseHint?: Partial<CourseRecord>): Promise<CourseRecord | null> {
  const local = courseCatalog.find((course) => course.id === courseId);
  if (local) return local;

  const supabase = createSupabase();
  if (supabase) {
    const savedId = courseId.startsWith('saved-') ? courseId.replace('saved-', '') : null;

    let request = supabase
      .from('saved_courses')
      .select('id,name,city,state,source_provider,source_course_id,saved_course_holes(hole_number,par,handicap_index)');

    if (savedId) {
      request = request.eq('id', savedId);
    } else {
      request = request.eq('source_course_id', courseId);
    }

    const { data } = await request.maybeSingle<SavedCourseRow>();
    if (data) return mapSavedCourse(data);
  }

  const params = new URLSearchParams({ id: courseId });
  if (courseHint?.name) params.set('name', courseHint.name);
  if (courseHint?.city) params.set('city', courseHint.city);
  if (courseHint?.state) params.set('state', courseHint.state);
  if (courseHint?.latitude != null) params.set('lat', String(courseHint.latitude));
  if (courseHint?.longitude != null) params.set('lon', String(courseHint.longitude));

  const response = await fetch(`/api/courses/details?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { course?: CourseRecord | null };
  return data.course ?? null;
}
