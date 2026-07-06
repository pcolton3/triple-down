import { supabase } from '@/lib/supabase/client';

export type SavedCourseTee = {
  id: string;
  courseKey: string;
  courseName: string;
  teeName: string;
  teeColor: string;
  gender: string | null;
  courseRating: number;
  slopeRating: number;
  totalYards: number | null;
  sourceUrl: string | null;
};

type SavedCourseTeeRow = {
  id: string;
  course_key: string;
  course_name: string;
  tee_name?: string | null;
  tee_color: string;
  gender?: string | null;
  course_rating: number;
  slope_rating: number;
  total_yards?: number | null;
  source_url?: string | null;
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
    teeName: row.tee_name || row.tee_color,
    teeColor: row.tee_color,
    gender: row.gender ?? null,
    courseRating: row.course_rating,
    slopeRating: row.slope_rating,
    totalYards: row.total_yards ?? null,
    sourceUrl: row.source_url ?? null,
  };
}

export async function loadSavedCourseTees(courseKey: string): Promise<SavedCourseTee[]> {
  if (!courseKey) return [];

  const { data, error } = await supabase
    .from('saved_course_tees')
    .select('id,course_key,course_name,tee_name,tee_color,gender,course_rating,slope_rating,total_yards,source_url')
    .eq('course_key', courseKey)
    .order('total_yards', { ascending: false, nullsFirst: false })
    .order('tee_name');

  if (error) {
    if (isMissingSchemaError(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('saved_course_tees')
        .select('id,course_key,course_name,tee_color,course_rating,slope_rating')
        .eq('course_key', courseKey)
        .order('tee_color');

      if (fallbackError) return [];
      return ((fallbackData ?? []) as SavedCourseTeeRow[]).map(mapRow);
    }
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
  gender?: string | null;
  totalYards?: number | null;
  sourceUrl?: string | null;
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
        tee_name: teeColor,
        tee_color: teeColor,
        gender: input.gender ?? 'M',
        course_rating: input.courseRating,
        slope_rating: input.slopeRating,
        total_yards: input.totalYards ?? null,
        source_url: input.sourceUrl ?? null,
      },
      { onConflict: 'course_key,tee_name,gender' }
    );

  if (error) {
    if (!isMissingSchemaError(error)) throw error;

    const { error: fallbackError } = await supabase
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

    if (fallbackError && !isMissingSchemaError(fallbackError)) throw fallbackError;
  }
}
