import { supabase } from '@/lib/supabase/client';

export type CtpLeader = { playerKey: string; groupNumber: number; markedAt: number };

/**
 * The current closest-to-the-pin mark on a par 3 across every group: groups only mark when they
 * beat what's there, so the most recent mark is the one to beat. Null if nobody has marked.
 */
export async function loadCtpLeader(roundId: string, holeNumber: number): Promise<CtpLeader | null> {
  const [marks, holes] = await Promise.all([
    supabase.from('round_ctp_results').select('group_number,winner_player_key').eq('round_id', roundId).eq('hole_number', holeNumber).not('winner_player_key', 'is', null),
    supabase.from('round_holes').select('group_number,game_data').eq('round_id', roundId).eq('hole_number', holeNumber),
  ]);
  if (marks.error || holes.error) return null;
  const markedAt = new Map(
    (holes.data ?? []).map((row) => [row.group_number ?? 1, Number((row.game_data as { ctpMarkedAt?: number } | null)?.ctpMarkedAt) || 0])
  );
  return (marks.data ?? []).reduce<CtpLeader | null>((best, row) => {
    const candidate = { playerKey: row.winner_player_key as string, groupNumber: row.group_number ?? 1, markedAt: markedAt.get(row.group_number ?? 1) ?? 0 };
    return !best || candidate.markedAt >= best.markedAt ? candidate : best;
  }, null);
}
