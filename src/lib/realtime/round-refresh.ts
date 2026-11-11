import { supabase } from '@/lib/supabase/client';
import type { SharedRoundBundle } from '@/lib/realtime/shared-rounds';

/**
 * Cheap leaderboard refresh: instead of downloading the whole round every few seconds, fetch only
 * rows changed since the newest change already on screen, and merge them in. Deletions (rare: a
 * player removed from a hole) aren't seen this way, so callers still do a full reload now and then.
 */

type Row = { id?: string; updated_at?: string | null; created_at?: string | null };

/** Re-read a few seconds before the newest change, so a write committed slightly late isn't missed. */
const OVERLAP_MS = 5000;

const TABLES = [
  { key: 'players', table: 'round_players', order: 'sort_order' },
  { key: 'holes', table: 'round_holes', order: 'hole_number' },
  { key: 'matchups', table: 'round_matchups', order: 'hole_number' },
  { key: 'games', table: 'round_games', order: null },
  { key: 'ctpResults', table: 'round_ctp_results', order: 'hole_number' },
  { key: 'participants', table: 'round_participants', order: null },
  { key: 'groups', table: 'round_groups', order: 'group_number' },
  { key: 'groupPlayers', table: 'round_group_players', order: 'sort_order' },
] as const satisfies ReadonlyArray<{ key: keyof SharedRoundBundle; table: string; order: string | null }>;

function stamp(row: Row) {
  return Date.parse(row.updated_at ?? row.created_at ?? '') || 0;
}

/** Newest change time among everything in the bundle (server clock, not the phone's). */
export function bundleCursor(bundle: SharedRoundBundle): number {
  let newest = stamp(bundle.round as Row);
  for (const { key } of TABLES) for (const row of bundle[key] as Row[]) newest = Math.max(newest, stamp(row));
  return newest;
}

/** Replaces rows by id and adds new ones, keeping the same order the full load uses. */
export function mergeRows<T extends Row>(rows: T[], changed: T[], order: string | null): T[] {
  if (!changed.length) return rows;
  const byId = new Map(changed.filter((row) => row.id).map((row) => [row.id, row]));
  const merged = rows.map((row) => (row.id && byId.has(row.id) ? byId.get(row.id)! : row));
  const known = new Set(rows.map((row) => row.id));
  for (const row of changed) if (!known.has(row.id)) merged.push(row);
  if (!order) return merged;
  return merged
    .map((row, index) => ({ row, index }))
    .sort((a, b) => Number((a.row as Record<string, unknown>)[order] ?? 0) - Number((b.row as Record<string, unknown>)[order] ?? 0) || a.index - b.index)
    .map(({ row }) => row);
}

/**
 * Returns the bundle with recent changes merged in, and whether anything changed.
 * Throws on network errors so the caller can keep showing what it has.
 */
export async function refreshSharedRoundBundle(bundle: SharedRoundBundle): Promise<{ bundle: SharedRoundBundle; changed: boolean }> {
  const roundId = bundle.round.id;
  const since = new Date(Math.max(0, bundleCursor(bundle) - OVERLAP_MS)).toISOString();
  const [roundResult, ...results] = await Promise.all([
    supabase.from('rounds').select('*').eq('id', roundId).gte('updated_at', since).maybeSingle(),
    ...TABLES.map(({ table }) => supabase.from(table).select('*').eq('round_id', roundId).gte('updated_at', since)),
  ]);
  if (roundResult.error) throw new Error(roundResult.error.message);

  const next: SharedRoundBundle = { ...bundle };
  const lists = next as unknown as Record<string, Row[]>;
  let changed = false;
  TABLES.forEach(({ key, order }, index) => {
    const result = results[index];
    if (result.error) throw new Error(result.error.message);
    const rows = (result.data ?? []) as Row[];
    if (!rows.length) return;
    const current = bundle[key] as Row[];
    const merged = mergeRows(current, rows, order);
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      lists[key] = merged;
      changed = true;
    }
  });
  if (roundResult.data && JSON.stringify(roundResult.data) !== JSON.stringify(bundle.round)) {
    next.round = roundResult.data as SharedRoundBundle['round'];
    changed = true;
  }
  return { bundle: next, changed };
}
