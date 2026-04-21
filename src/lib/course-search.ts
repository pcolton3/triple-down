import { courseCatalog } from '@/lib/course-data';
import type { CourseRecord } from '@/types/course';

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function searchCourses(query: string): Promise<CourseRecord[]> {
  const normalized = normalize(query);
  if (!normalized) return [];

  const results = courseCatalog.filter((course) => {
    const haystack = normalize(`${course.name} ${course.city} ${course.state}`);
    return haystack.includes(normalized);
  });

  return results.slice(0, 8);
}

export async function getCourseDetails(courseId: string): Promise<CourseRecord | null> {
  return courseCatalog.find((course) => course.id === courseId) ?? null;
}
