import { supabase } from '@/lib/supabase/client';
import { calculateHandicapIndex, calculateScoreDifferential } from '@/lib/handicap/whs';

export type SavedGolfer = {
  id: string;
  name: string;
  handicap: number;
  postedRounds?: number;
};

type SavedGolferRow = {
  id: string;
  name: string;
  normalized_name: string;
  handicap: number;
  posted_rounds?: number;
};

type SavedGolferScoreRow = {
  golfer_id: string;
  score_differential: number;
  played_at: string;
};

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const details = error as { code?: string; message?: string };
  const message = details.message ?? '';
  return details.code === '42P01' || details.code === '42703' || message.includes('does not exist') || message.includes('Could not find');
}

function normalizedName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function loadSavedGolfers(): Promise<SavedGolfer[]> {
  const { data, error } = await supabase
    .from('saved_golfers')
    .select('id,name,normalized_name,handicap,posted_rounds')
    .order('name');

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }

  return ((data ?? []) as SavedGolferRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    handicap: row.handicap,
    postedRounds: row.posted_rounds ?? 0,
  }));
}

export async function saveGolfersForLater(golfers: Array<{ name: string; handicap: number }>) {
  const rows = golfers
    .map((golfer) => ({
      name: golfer.name.trim(),
      normalized_name: normalizedName(golfer.name),
      handicap: Number.isFinite(golfer.handicap) ? golfer.handicap : 0,
    }))
    .filter((golfer) => golfer.name.length > 0 && golfer.normalized_name.length > 0);

  if (rows.length === 0) return;

  const uniqueRows = Array.from(new Map(rows.map((row) => [row.normalized_name, row])).values());
  const { error } = await supabase
    .from('saved_golfers')
    .upsert(uniqueRows, { onConflict: 'normalized_name' });

  if (error && !isMissingSchemaError(error)) throw error;
}

export async function postHandicapScores(input: {
  roundCode: string;
  courseName: string;
  courseRating: number;
  slopeRating: number;
  pcc?: number;
  scores: Array<{
    playerKey: string;
    playerName: string;
    adjustedGrossScore: number;
  }>;
}) {
  const rows = input.scores
    .map((score) => {
      const differential = calculateScoreDifferential({
        adjustedGrossScore: score.adjustedGrossScore,
        courseRating: input.courseRating,
        slopeRating: input.slopeRating,
        pcc: input.pcc ?? 0,
      });
      return {
        playerKey: score.playerKey,
        name: score.playerName.trim(),
        normalizedName: normalizedName(score.playerName),
        adjustedGrossScore: score.adjustedGrossScore,
        scoreDifferential: differential,
      };
    })
    .filter((score): score is {
      playerKey: string;
      name: string;
      normalizedName: string;
      adjustedGrossScore: number;
      scoreDifferential: number;
    } => score.name.length > 0 && score.scoreDifferential != null);

  if (rows.length === 0) return [];

  const normalizedNames = rows.map((row) => row.normalizedName);
  const { data: existingGolfers, error: existingError } = await supabase
    .from('saved_golfers')
    .select('id,name,normalized_name,handicap')
    .in('normalized_name', normalizedNames);

  if (existingError) throw existingError;

  const existingRows = (existingGolfers ?? []) as SavedGolferRow[];
  const missingRows = rows.filter((row) => !existingRows.some((golfer) => golfer.normalized_name === row.normalizedName));

  if (missingRows.length > 0) {
    const { error: insertError } = await supabase
      .from('saved_golfers')
      .insert(
        missingRows.map((row) => ({
          name: row.name,
          normalized_name: row.normalizedName,
          handicap: 0,
        }))
      );

    if (insertError) throw insertError;
  }

  const { data: golfers, error: golferError } = await supabase
    .from('saved_golfers')
    .select('id,name,normalized_name,handicap')
    .in('normalized_name', normalizedNames);

  if (golferError) throw golferError;

  const golferRows = (golfers ?? []) as SavedGolferRow[];
  if (golferRows.length === 0) return [];

  const postedAt = new Date().toISOString();
  const scoreRows = rows.flatMap((row) => {
    const golfer = golferRows.find((item) => item.normalized_name === row.normalizedName);
    if (!golfer) return [];
    return {
      golfer_id: golfer.id,
      round_code: input.roundCode,
      player_key: row.playerKey,
      course_name: input.courseName,
      adjusted_gross_score: row.adjustedGrossScore,
      course_rating: input.courseRating,
      slope_rating: input.slopeRating,
      pcc: input.pcc ?? 0,
      score_differential: row.scoreDifferential,
      played_at: postedAt,
    };
  });

  const { error: scoreError } = await supabase
    .from('saved_golfer_scores')
    .upsert(scoreRows, { onConflict: 'golfer_id,round_code,player_key' });

  if (scoreError) throw scoreError;

  const postedGolferIds = Array.from(new Set(scoreRows.map((row) => row.golfer_id)));
  const updates = await Promise.all(
    postedGolferIds.map(async (golferId) => {
      const { data: history, error } = await supabase
        .from('saved_golfer_scores')
        .select('golfer_id,score_differential,played_at')
        .eq('golfer_id', golferId)
        .order('played_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      const scoreHistory = (history ?? []) as SavedGolferScoreRow[];
      const nextHandicap = calculateHandicapIndex(scoreHistory.map((score) => score.score_differential));
      if (nextHandicap == null) {
        const { error: countUpdateError } = await supabase
          .from('saved_golfers')
          .update({ posted_rounds: scoreHistory.length })
          .eq('id', golferId);

        if (countUpdateError) throw countUpdateError;
        return { golferId, handicap: null, postedRounds: scoreHistory.length };
      }

      const { error: updateError } = await supabase
        .from('saved_golfers')
        .update({ handicap: nextHandicap, posted_rounds: scoreHistory.length })
        .eq('id', golferId);

      if (updateError) throw updateError;
      return { golferId, handicap: nextHandicap, postedRounds: scoreHistory.length };
    })
  );

  return updates;
}
