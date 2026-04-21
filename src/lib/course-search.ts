
import { courseCatalog } from '@/lib/course-data';
import type { CourseRecord } from '@/types/course';

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMiles = 3958.8;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

type SearchOptions = {
  latitude?: number | null;
  longitude?: number | null;
  limit?: number;
};

export async function searchCourses(query: string, options: SearchOptions = {}): Promise<CourseRecord[]> {
  const normalized = normalize(query);
  const hasLocation = options.latitude != null && options.longitude != null;
  const limit = options.limit ?? 12;

  const results = courseCatalog
    .map((course) => {
      const haystack = normalize(`${course.name} ${course.city} ${course.state}`);
      const exactName = normalize(course.name);
      const includes = normalized ? haystack.includes(normalized) : true;
      const startsWith = normalized ? exactName.startsWith(normalized) : false;
      const distance =
        hasLocation && course.latitude != null && course.longitude != null
          ? distanceMiles(options.latitude as number, options.longitude as number, course.latitude, course.longitude)
          : null;

      let score = includes ? 100 : 0;
      if (startsWith) score += 40;
      if (normalized && exactName === normalized) score += 80;
      if (hasLocation && distance != null) {
        score += Math.max(0, 50 - distance);
      }

      return { course, score, distance };
    })
    .filter((item) => item.score > 0 || (!normalized && item.distance != null))
    .sort((a, b) => b.score - a.score || (a.distance ?? 9999) - (b.distance ?? 9999) || a.course.name.localeCompare(b.course.name))
    .slice(0, limit)
    .map((item) => item.course);

  return results;
}

export async function getNearbyCourses(options: SearchOptions = {}): Promise<CourseRecord[]> {
  const hasLocation = options.latitude != null && options.longitude != null;
  const limit = options.limit ?? 12;

  if (!hasLocation) {
    return courseCatalog.slice(0, limit);
  }

  return [...courseCatalog]
    .map((course) => ({
      course,
      distance:
        course.latitude != null && course.longitude != null
          ? distanceMiles(options.latitude as number, options.longitude as number, course.latitude, course.longitude)
          : 9999,
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((item) => item.course);
}

export async function getCourseDetails(courseId: string): Promise<CourseRecord | null> {
  return courseCatalog.find((course) => course.id === courseId) ?? null;
}
