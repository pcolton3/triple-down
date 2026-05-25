import { supabase } from '@/lib/supabase/client';

export type SavedGolfer = {
  id: string;
  name: string;
  handicap: number;
};

type SavedGolferRow = {
  id: string;
  name: string;
  normalized_name: string;
  handicap: number;
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
    .select('id,name,normalized_name,handicap')
    .order('name');

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }

  return ((data ?? []) as SavedGolferRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    handicap: row.handicap,
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
