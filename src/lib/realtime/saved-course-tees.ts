import { supabase } from '@/lib/supabase/client';

export type SavedCourseTee = {
  id: string;
  courseKey: string;
  courseName: string;
  teeColor: string;
  courseRating: number;
  slopeRating: number;
};

type SavedCourseTeeRow = {
  id: string;
  course_key: string;
  course_name: string;
  tee_color: string;
  course_rating: number;
  slope_rating: number;
};

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const details = error as { code?: string; message?: string };
  const message = details.message ?? '';
  return details.code === '42P01' || details.code === '42703' || message.includes('does not exist') || message.includes('Could not find');
}

export function savedCourseKey(courseId: string | null | undefined, courseName: string) {
  if (courseId) return courseId;
  return courseName.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapRow(row: SavedCourseTeeRow): SavedCourseTee {
  return {
    id: row.id,
    courseKey: row.course_key,
    courseName: row.course_name,
    teeColor: row.tee_color,
    courseRating: row.course_rating,
    slopeRating: row.slope_rating,
  };
}

export async function loadSavedCourseTees(courseKey: string): Promise<SavedCourseTee[]> {
  if (!courseKey) return [];

  const { data, error } = await supabase
    .from('saved_course_tees')
    .select('id,course_key,course_name,tee_color,course_rating,slope_rating')
    .eq('course_key', courseKey)
    .order('tee_color');

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }

  return ((data ?? []) as SavedCourseTeeRow[]).map(mapRow);
}

export async function saveCourseTee(input: {
  courseKey: string;
  courseName: string;
  teeColor: string;
  courseRating: number;
  slopeRating: number;
}) {
  const teeColor = input.teeColor.trim();
  const courseName = input.courseName.trim();
  if (!input.courseKey || !courseName || !teeColor || !Number.isFinite(input.courseRating) || !Number.isFinite(input.slopeRating)) return;

  const { error } = await supabase
    .from('saved_course_tees')
    .upsert(
      {
        course_key: input.courseKey,
        course_name: courseName,
        tee_color: teeColor,
        course_rating: input.courseRating,
        slope_rating: input.slopeRating,
      },
      { onConflict: 'course_key,tee_color' }
    );

  if (error && !isMissingSchemaError(error)) throw error;
}
