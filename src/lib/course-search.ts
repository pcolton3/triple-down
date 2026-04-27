import { createClient } from '@supabase/supabase-js';
import { courseCatalog } from '@/lib/course-data';
import type { CourseRecord } from '@/types/course';

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
    const key = normalize(`${course.name}|${course.city}|${course.state}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreLocalCourse(course: CourseRecord, query: string, options: SearchOptions) {
  const normalized = normalize(query);
  const exactName = normalize(course.name);
  const haystack = normalize(`${course.name} ${course.city} ${course.state}`);

  let score = normalized ? (haystack.includes(normalized) ? 100 : 0) : 25;

  if (normalized && exactName.startsWith(normalized)) score += 30;
  if (normalized && exactName === normalized) score += 60;

  const phoenixAreaCities = new Set(['sun city', 'peoria', 'cave creek', 'glendale', 'phoenix', 'scottsdale']);
  if (phoenixAreaCities.has(normalize(course.city))) score += 15;

  if (options.latitude != null && options.longitude != null && course.latitude != null && course.longitude != null) {
    const latDelta = Math.abs(course.latitude - options.latitude);
    const lonDelta = Math.abs(course.longitude - options.longitude);
    score += Math.max(0, 25 - (latDelta + lonDelta) * 50);
  }

  return score;
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
  return data.courses ?? [];
}

export async function searchCourses(query: string, options: SearchOptions = {}): Promise<CourseRecord[]> {
  const limit = options.limit ?? 12;

  const [savedCourses, localCourses, remoteCourses] = await Promise.all([
    fetchSavedCourses(query, options),
    Promise.resolve(
      [...courseCatalog]
        .map((course) => ({ course, score: scoreLocalCourse(course, query, options) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.course.name.localeCompare(b.course.name))
        .slice(0, limit)
        .map((item) => item.course)
    ),
    fetchRemoteCourses(query, options),
  ]);

  return dedupeCourses([...savedCourses, ...localCourses, ...remoteCourses]).slice(0, limit);
}

export async function getNearbyCourses(options: SearchOptions = {}): Promise<CourseRecord[]> {
  const limit = options.limit ?? 12;

  const [savedCourses, remoteCourses] = await Promise.all([
    fetchSavedCourses('', options),
    fetchRemoteCourses('', options),
  ]);

  const localCourses = [...courseCatalog]
    .map((course) => ({ course, score: scoreLocalCourse(course, '', options) }))
    .sort((a, b) => b.score - a.score || a.course.name.localeCompare(b.course.name))
    .slice(0, limit)
    .map((item) => item.course);

  return dedupeCourses([...savedCourses, ...localCourses, ...remoteCourses]).slice(0, limit);
}

export async function getCourseDetails(courseId: string): Promise<CourseRecord | null> {
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

  const response = await fetch(`/api/courses/details?id=${encodeURIComponent(courseId)}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { course?: CourseRecord | null };
  return data.course ?? null;
}
