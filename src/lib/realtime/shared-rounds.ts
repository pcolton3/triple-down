import { supabase } from '@/lib/supabase/client';
import type { RoundState } from '@/types/round';

type RoundRow = {
  id: string;
  round_code: string;
  title: string;
  course_name: string;
  selected_course_id: string | null;
  current_hole: number;
  total_holes: number;
  default_bet: number;
  status: 'active' | 'complete' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type RoundPlayerRow = {
  id: string;
  round_id: string;
  player_key: string;
  name: string;
  handicap: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type RoundHoleRow = {
  id: string;
  round_id: string;
  hole_number: number;
  par: 3 | 4 | 5;
  handicap_index: number;
  banker_player_key: string;
  banker_gross_score: number | null;
  banker_pressed: boolean;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
};

type RoundMatchupRow = {
  id: string;
  round_id: string;
  round_hole_id: string;
  hole_number: number;
  player_key: string;
  base_wager: number;
  pressed: boolean;
  gross_score: number | null;
  player_net_score: number | null;
  banker_net_score: number | null;
  player_gets_stroke: boolean;
  banker_gets_stroke: boolean;
  result: 'player_wins' | 'banker_wins' | 'push' | null;
  final_amount: number;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

type RoundGameRow = {
  id: string;
  round_id: string;
  game_type: 'banker' | 'skins' | 'low_net' | 'ctp';
  pot_amount: number;
  enabled: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type RoundCtpResultRow = {
  id: string;
  round_id: string;
  hole_number: number;
  winner_player_key: string | null;
  note: string | null;
  payout_amount: number;
  created_at: string;
  updated_at: string;
};

type RoundSkinsResultRow = {
  id: string;
  round_id: string;
  hole_number: number;
  winner_player_key: string | null;
  winning_net_score: number | null;
  is_tie: boolean;
  payout_amount: number;
  created_at: string;
  updated_at: string;
};

type RoundLowNetResultRow = {
  id: string;
  round_id: string;
  player_key: string;
  total_net_score: number | null;
  holes_counted: number;
  placement: 'first' | 'second' | 'other' | 'tied_first' | 'tied_second' | null;
  payout_amount: number;
  created_at: string;
  updated_at: string;
};

type RoundParticipantRow = {
  id: string;
  round_id: string;
  participant_name: string | null;
  role: 'scorekeeper' | 'viewer';
  device_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SharedRoundBundle = {
  round: RoundRow;
  players: RoundPlayerRow[];
  holes: RoundHoleRow[];
  matchups: RoundMatchupRow[];
  games: RoundGameRow[];
  ctpResults: RoundCtpResultRow[];
  skinsResults: RoundSkinsResultRow[];
  lowNetResults: RoundLowNetResultRow[];
  participants: RoundParticipantRow[];
};

export async function createSharedRoundFromLocalRound(round: RoundState) {
  const { data: roundRow, error: roundError } = await supabase
    .from('rounds')
    .upsert(
      {
        round_code: round.roundCode,
        title: round.title,
        course_name: round.courseName,
        selected_course_id: round.selectedCourseId,
        current_hole: round.currentHole,
        total_holes: round.totalHoles,
        default_bet: round.defaultBet,
        status: 'active',
      },
      { onConflict: 'round_code' }
    )
    .select('*')
    .single();

  if (roundError) throw roundError;
  const typedRoundRow = roundRow as RoundRow;
  const roundId = typedRoundRow.id;

  const playerRows = round.players.map((player, index) => ({
    round_id: roundId,
    player_key: player.id,
    name: player.name,
    handicap: player.handicap,
    sort_order: index,
  }));

  const { error: playersError } = await supabase
    .from('round_players')
    .upsert(playerRows, { onConflict: 'round_id,player_key' });

  if (playersError) throw playersError;

  const holeRows = round.holes.map((hole) => ({
    round_id: roundId,
    hole_number: hole.holeNumber,
    par: hole.par,
    handicap_index: hole.handicapIndex,
    banker_player_key: hole.bankerPlayerId,
    banker_gross_score: hole.bankerGrossScore,
    banker_pressed: hole.bankerPressed,
    is_saved: hole.isSaved,
  }));

  const { data: savedHoles, error: holesError } = await supabase
    .from('round_holes')
    .upsert(holeRows, { onConflict: 'round_id,hole_number' })
    .select('*');

  if (holesError) throw holesError;

  const typedSavedHoles = (savedHoles ?? []) as RoundHoleRow[];
  const holeIdByNumber = new Map<number, string>(
    typedSavedHoles.map((hole) => [hole.hole_number, hole.id])
  );

  const matchupRows = round.holes.flatMap((hole) => {
    const roundHoleId = holeIdByNumber.get(hole.holeNumber);
    if (!roundHoleId) return [];

    return hole.matchups.map((matchup) => ({
      round_id: roundId,
      round_hole_id: roundHoleId,
      hole_number: hole.holeNumber,
      player_key: matchup.playerId,
      base_wager: matchup.baseWager,
      pressed: matchup.pressed,
      gross_score: matchup.grossScore,
    }));
  });

  if (matchupRows.length > 0) {
    const { error: matchupsError } = await supabase
      .from('round_matchups')
      .upsert(matchupRows, { onConflict: 'round_hole_id,player_key' });

    if (matchupsError) throw matchupsError;
  }

  const { error: gamesError } = await supabase
    .from('round_games')
    .upsert(
      [
        { round_id: roundId, game_type: 'banker', pot_amount: 0, enabled: true },
        { round_id: roundId, game_type: 'skins', pot_amount: 0, enabled: false },
        { round_id: roundId, game_type: 'low_net', pot_amount: 0, enabled: false },
        { round_id: roundId, game_type: 'ctp', pot_amount: 0, enabled: false },
      ],
      { onConflict: 'round_id,game_type' }
    );

  if (gamesError) throw gamesError;

  const { error: participantError } = await supabase
    .from('round_participants')
    .insert({
      round_id: roundId,
      participant_name: 'Scorekeeper',
      role: 'scorekeeper',
      device_id: getDeviceId(),
    });

  if (participantError) throw participantError;

  return typedRoundRow;
}

export async function loadSharedRoundByCode(roundCode: string): Promise<SharedRoundBundle | null> {
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('*')
    .eq('round_code', roundCode)
    .maybeSingle();

  if (roundError) throw roundError;
  if (!round) return null;

  return loadSharedRoundById((round as RoundRow).id);
}

export async function loadSharedRoundById(roundId: string): Promise<SharedRoundBundle> {
  const [
    players,
    holes,
    matchups,
    games,
    ctpResults,
    skinsResults,
    lowNetResults,
    participants,
  ] = await Promise.all([
    supabase.from('round_players').select('*').eq('round_id', roundId).order('sort_order'),
    supabase.from('round_holes').select('*').eq('round_id', roundId).order('hole_number'),
    supabase.from('round_matchups').select('*').eq('round_id', roundId).order('hole_number'),
    supabase.from('round_games').select('*').eq('round_id', roundId),
    supabase.from('round_ctp_results').select('*').eq('round_id', roundId).order('hole_number'),
    supabase.from('round_skins_results').select('*').eq('round_id', roundId).order('hole_number'),
    supabase.from('round_low_net_results').select('*').eq('round_id', roundId),
    supabase.from('round_participants').select('*').eq('round_id', roundId),
  ]);

  for (const result of [players, holes, matchups, games, ctpResults, skinsResults, lowNetResults, participants]) {
    if (result.error) throw result.error;
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single();

  if (roundError) throw roundError;

  return {
    round: round as RoundRow,
    players: (players.data ?? []) as RoundPlayerRow[],
    holes: (holes.data ?? []) as RoundHoleRow[],
    matchups: (matchups.data ?? []) as RoundMatchupRow[],
    games: (games.data ?? []) as RoundGameRow[],
    ctpResults: (ctpResults.data ?? []) as RoundCtpResultRow[],
    skinsResults: (skinsResults.data ?? []) as RoundSkinsResultRow[],
    lowNetResults: (lowNetResults.data ?? []) as RoundLowNetResultRow[],
    participants: (participants.data ?? []) as RoundParticipantRow[],
  };
}

export function subscribeToSharedRound(roundId: string, onChange: () => void) {
  const channel = supabase
    .channel(`shared-round-${roundId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rounds', filter: `id=eq.${roundId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_players', filter: `round_id=eq.${roundId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_holes', filter: `round_id=eq.${roundId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_matchups', filter: `round_id=eq.${roundId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_games', filter: `round_id=eq.${roundId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_ctp_results', filter: `round_id=eq.${roundId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_skins_results', filter: `round_id=eq.${roundId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_low_net_results', filter: `round_id=eq.${roundId}` },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function updateSharedRoundCurrentHole(roundId: string, currentHole: number) {
  const { error } = await supabase
    .from('rounds')
    .update({ current_hole: currentHole })
    .eq('id', roundId);

  if (error) throw error;
}

export async function updateSharedHole(params: {
  roundId: string;
  holeNumber: number;
  bankerPlayerKey?: string;
  bankerGrossScore?: number | null;
  bankerPressed?: boolean;
  isSaved?: boolean;
}) {
  const payload: Record<string, string | number | boolean | null> = {};
  if (params.bankerPlayerKey !== undefined) payload.banker_player_key = params.bankerPlayerKey;
  if (params.bankerGrossScore !== undefined) payload.banker_gross_score = params.bankerGrossScore;
  if (params.bankerPressed !== undefined) payload.banker_pressed = params.bankerPressed;
  if (params.isSaved !== undefined) payload.is_saved = params.isSaved;

  const { error } = await supabase
    .from('round_holes')
    .update(payload)
    .eq('round_id', params.roundId)
    .eq('hole_number', params.holeNumber);

  if (error) throw error;
}

export async function updateSharedMatchup(params: {
  roundId: string;
  holeNumber: number;
  playerKey: string;
  baseWager?: number;
  pressed?: boolean;
  grossScore?: number | null;
}) {
  const payload: Record<string, number | boolean | null> = {};
  if (params.baseWager !== undefined) payload.base_wager = params.baseWager;
  if (params.pressed !== undefined) payload.pressed = params.pressed;
  if (params.grossScore !== undefined) payload.gross_score = params.grossScore;

  const { error } = await supabase
    .from('round_matchups')
    .update(payload)
    .eq('round_id', params.roundId)
    .eq('hole_number', params.holeNumber)
    .eq('player_key', params.playerKey);

  if (error) throw error;
}

function getDeviceId() {
  if (typeof window === 'undefined') return null;

  const key = 'triple-track-device-id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}
