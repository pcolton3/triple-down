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
  let score = normalized ? (haystack.includes(normalized) ? 100 : 0) : 10;
  if (normalized && exactName.startsWith(normalized)) score += 30;
  if (normalized && exactName === normalized) score += 60;
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
  const [remoteCourses, localCourses] = await Promise.all([
    fetchRemoteCourses(query, options),
    Promise.resolve(
      [...courseCatalog]
        .map((course) => ({ course, score: scoreLocalCourse(course, query, options) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.course.name.localeCompare(b.course.name))
        .slice(0, options.limit ?? 12)
        .map((item) => item.course)
    ),
  ]);

  return dedupeCourses([...remoteCourses, ...localCourses]).slice(0, options.limit ?? 12);
}

export async function getNearbyCourses(options: SearchOptions = {}): Promise<CourseRecord[]> {
  const remoteCourses = await fetchRemoteCourses('', options);
  const localCourses = [...courseCatalog]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, options.limit ?? 12);

  return dedupeCourses([...remoteCourses, ...localCourses]).slice(0, options.limit ?? 12);
}

export async function getCourseDetails(courseId: string): Promise<CourseRecord | null> {
  const local = courseCatalog.find((course) => course.id === courseId);
  if (local) return local;

  const response = await fetch(`/api/courses/details?id=${encodeURIComponent(courseId)}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { course?: CourseRecord | null };
  return data.course ?? null;
}
