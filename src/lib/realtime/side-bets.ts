import { supabase } from '@/lib/supabase/client';
import { currentDeviceId } from '@/lib/realtime/group-rounds';
import type { SideBet, SideBetKind, SideBetStatus } from '@/lib/games/side-bets';

type SideBetRow = {
  id: string;
  round_id: string;
  kind: SideBetKind;
  amount: number | string;
  proposer_key: string;
  opponent_key: string;
  status: SideBetStatus;
  proposer_device_id: string | null;
  created_at: string;
};

const NOT_SET_UP = 'Side bets are not set up in the database yet. Run the side bets SQL in Supabase.';

function friendly(error: { code?: string; message?: string }): Error {
  const message = error.message ?? '';
  if (error.code === '42P01' || message.includes('does not exist') || message.includes('Could not find the table')) return new Error(NOT_SET_UP);
  return new Error(message || 'Something went wrong with side bets.');
}

const fromRow = (row: SideBetRow): SideBet => ({
  id: row.id,
  roundId: row.round_id,
  kind: row.kind,
  amount: Number(row.amount),
  proposerKey: row.proposer_key,
  opponentKey: row.opponent_key,
  status: row.status,
  proposerDeviceId: row.proposer_device_id,
  createdAt: row.created_at,
});

/** All side bets in a round. Returns [] if the table hasn't been set up, so the rest of the page still works. */
export async function loadSideBets(roundId: string): Promise<SideBet[]> {
  if (!roundId || roundId.startsWith('round-')) return [];
  const { data, error } = await supabase.from('round_side_bets').select('*').eq('round_id', roundId).order('created_at');
  if (error) {
    if (friendly(error).message === NOT_SET_UP) return [];
    throw friendly(error);
  }
  return ((data ?? []) as SideBetRow[]).map(fromRow);
}

export async function createSideBet(input: { roundId: string; kind: SideBetKind; amount: number; proposerKey: string; opponentKey: string }) {
  if (!(input.amount > 0)) throw new Error('Enter how much the bet is for.');
  if (input.proposerKey === input.opponentKey) throw new Error('Pick two different golfers.');
  const { error } = await supabase.from('round_side_bets').insert({
    round_id: input.roundId,
    kind: input.kind,
    amount: Math.round(input.amount * 100) / 100,
    proposer_key: input.proposerKey,
    opponent_key: input.opponentKey,
    status: 'pending',
    proposer_device_id: currentDeviceId(),
  });
  if (error) throw friendly(error);
}

/** Accept, decline or cancel a pending bet. Fails if someone already responded. */
export async function respondToSideBet(id: string, status: Exclude<SideBetStatus, 'pending'>) {
  const { data, error } = await supabase
    .from('round_side_bets')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  if (error) throw friendly(error);
  if (!(data ?? []).length) throw new Error('This bet was already answered. Refresh to see the latest.');
}

export function subscribeToSideBets(roundId: string, onChange: () => void) {
  const channel = supabase
    .channel(`side-bets-${roundId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'round_side_bets', filter: `round_id=eq.${roundId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
