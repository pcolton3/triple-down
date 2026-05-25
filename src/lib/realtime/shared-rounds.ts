import { supabase } from '@/lib/supabase/client';
import type { HoleState, RoundState } from '@/types/round';
import { createRoundGroups } from '@/lib/realtime/group-rounds';

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
  group_number: number | null;
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
  group_number: number | null;
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

type RoundGroupRow = {
  id: string;
  round_id: string;
  group_number: number;
  group_name: string | null;
  tee_time: string | null;
  scorekeeper_device_id: string | null;
  scorekeeper_name: string | null;
  current_hole: number;
};

type RoundGroupPlayerRow = {
  id: string;
  round_id: string;
  round_group_id: string;
  player_key: string;
  sort_order: number;
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
  groups: RoundGroupRow[];
  groupPlayers: RoundGroupPlayerRow[];
};

function formatSupabaseError(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const details = error as { message?: string; details?: string; hint?: string; code?: string };
  return [details.message, details.details, details.hint, details.code ? `Code: ${details.code}` : null]
    .filter(Boolean)
    .join(' ');
}

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const details = error as { code?: string; message?: string };
  const message = details.message ?? '';
  return (
    details.code === '42P01' ||
    details.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('Could not find')
  );
}

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

  if (roundError) throw new Error(formatSupabaseError(roundError, 'Unable to save round.'));
  const typedRoundRow = roundRow as RoundRow;
  const roundId = typedRoundRow.id;

  if (round.multiFoursome) {
    await createRoundGroups({
      roundId,
      groups: round.multiFoursome.groups,
      groupPlayers: round.multiFoursome.groupPlayers,
    });
  }

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

  if (playersError) throw new Error(formatSupabaseError(playersError, 'Unable to save players.'));

  const holeRows = round.holes.map((hole) => ({
    round_id: roundId,
    group_number: hole.groupNumber ?? 1,
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
    .upsert(holeRows, { onConflict: 'round_id,group_number,hole_number' })
    .select('*');

  if (holesError) throw new Error(formatSupabaseError(holesError, 'Unable to save holes.'));

  const typedSavedHoles = (savedHoles ?? []) as RoundHoleRow[];
  const holeIdByNumber = new Map<string, string>(
    typedSavedHoles.map((hole) => [`${hole.group_number ?? 1}:${hole.hole_number}`, hole.id])
  );

  const matchupRows = round.holes.flatMap((hole) => {
    const roundHoleId = holeIdByNumber.get(`${hole.groupNumber ?? 1}:${hole.holeNumber}`);
    if (!roundHoleId) return [];

    return hole.matchups.map((matchup) => ({
      round_id: roundId,
      round_hole_id: roundHoleId,
      group_number: hole.groupNumber ?? 1,
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

    if (matchupsError) throw new Error(formatSupabaseError(matchupsError, 'Unable to save matchups.'));
  }

  const { error: gamesError } = await supabase
    .from('round_games')
    .upsert(
      [
        { round_id: roundId, game_type: 'banker', pot_amount: 0, enabled: true },
        { round_id: roundId, game_type: 'skins', pot_amount: round.gameSettings.skinsPot, enabled: round.gameSettings.skinsPot > 0 },
        { round_id: roundId, game_type: 'low_net', pot_amount: round.gameSettings.lowNetPot, enabled: round.gameSettings.lowNetPot > 0 },
        { round_id: roundId, game_type: 'ctp', pot_amount: round.gameSettings.ctpPot, enabled: round.gameSettings.ctpPot > 0 },
      ],
      { onConflict: 'round_id,game_type' }
    );

  if (gamesError) throw new Error(formatSupabaseError(gamesError, 'Unable to save games.'));

  const { error: participantError } = await supabase
    .from('round_participants')
    .insert({
      round_id: roundId,
      participant_name: 'Scorekeeper',
      role: 'scorekeeper',
      device_id: getDeviceId(),
    });

  if (participantError) throw new Error(formatSupabaseError(participantError, 'Unable to save participant.'));

  return typedRoundRow;
}

export async function loadSharedRoundByCode(roundCode: string): Promise<SharedRoundBundle | null> {
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('*')
    .eq('round_code', roundCode)
    .maybeSingle();

  if (roundError) throw new Error(formatSupabaseError(roundError, 'Unable to load round by code.'));
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
    if (result.error) throw new Error(formatSupabaseError(result.error, 'Unable to load round data.'));
  }

  const [groups, groupPlayers] = await Promise.all([
    supabase.from('round_groups').select('*').eq('round_id', roundId).order('group_number'),
    supabase.from('round_group_players').select('*').eq('round_id', roundId).order('sort_order'),
  ]);

  if (groups.error && !isMissingSchemaError(groups.error)) {
    throw new Error(formatSupabaseError(groups.error, 'Unable to load round groups.'));
  }

  if (groupPlayers.error && !isMissingSchemaError(groupPlayers.error)) {
    throw new Error(formatSupabaseError(groupPlayers.error, 'Unable to load group players.'));
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single();

  if (roundError) throw new Error(formatSupabaseError(roundError, 'Unable to load round.'));

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
    groups: (groups.error ? [] : groups.data ?? []) as RoundGroupRow[],
    groupPlayers: (groupPlayers.error ? [] : groupPlayers.data ?? []) as RoundGroupPlayerRow[],
  };
}

export function sharedRoundBundleToRoundState(bundle: SharedRoundBundle): RoundState {
  const players = bundle.players.map((player) => ({
    id: player.player_key,
    name: player.name,
    handicap: player.handicap,
  }));
  const games = new Map(bundle.games.map((game) => [game.game_type, game]));
  const ctpByGroupHole = new Map(
    bundle.ctpResults.map((ctp) => [`1:${ctp.hole_number}`, ctp.winner_player_key])
  );

  const holes: HoleState[] = bundle.holes.map((hole) => {
    const groupNumber = hole.group_number ?? 1;
    const holeMatchups = bundle.matchups.filter((matchup) => matchup.round_hole_id === hole.id);

    return {
      groupNumber,
      holeNumber: hole.hole_number,
      par: hole.par,
      handicapIndex: hole.handicap_index,
      bankerPlayerId: hole.banker_player_key,
      bankerGrossScore: hole.banker_gross_score,
      bankerPressed: hole.banker_pressed,
      isSaved: hole.is_saved,
      ctpWinnerPlayerId: ctpByGroupHole.get(`${groupNumber}:${hole.hole_number}`) ?? null,
      matchups: holeMatchups.map((matchup) => ({
        playerId: matchup.player_key,
        baseWager: matchup.base_wager,
        pressed: matchup.pressed,
        grossScore: matchup.gross_score,
      })),
    };
  });

  const groupCounts = new Map<string, number>();
  bundle.groupPlayers.forEach((assignment) => {
    groupCounts.set(assignment.round_group_id, (groupCounts.get(assignment.round_group_id) ?? 0) + 1);
  });
  const groupSize: 4 | 5 = Math.max(...groupCounts.values(), 4) > 4 ? 5 : 4;
  const fallbackGroups = Array.from({ length: Math.max(1, Math.ceil(players.length / groupSize)) }, (_, index) => ({
    groupNumber: index + 1,
    groupName: `Group ${index + 1}`,
    teeTime: null,
    scorekeeperName: null,
    scorekeeperDeviceId: null,
    currentHole: bundle.round.current_hole,
  }));
  const groupNumberById = new Map(bundle.groups.map((group) => [group.id, group.group_number]));

  return {
    id: bundle.round.id,
    roundCode: bundle.round.round_code,
    title: bundle.round.title,
    courseName: bundle.round.course_name,
    selectedCourseId: bundle.round.selected_course_id,
    currentHole: bundle.round.current_hole,
    totalHoles: bundle.round.total_holes,
    defaultBet: bundle.round.default_bet,
    players,
    holes,
    gameSettings: {
      skinsPot: games.get('skins')?.pot_amount ?? 0,
      lowNetPot: games.get('low_net')?.pot_amount ?? 0,
      ctpPot: games.get('ctp')?.pot_amount ?? 0,
    },
    multiFoursome: {
      enabled: bundle.groups.length > 1,
      groupSize,
      groups: bundle.groups.length > 0
        ? bundle.groups.map((group) => ({
            id: group.id,
            groupNumber: group.group_number,
            groupName: group.group_name,
            teeTime: group.tee_time,
            scorekeeperName: group.scorekeeper_name,
            scorekeeperDeviceId: group.scorekeeper_device_id,
            currentHole: group.current_hole,
          }))
        : fallbackGroups,
      groupPlayers: bundle.groupPlayers.length > 0
        ? bundle.groupPlayers.map((assignment) => ({
            playerId: assignment.player_key,
            groupNumber: groupNumberById.get(assignment.round_group_id) ?? 1,
            sortOrder: assignment.sort_order,
          }))
        : players.map((player, index) => ({
            playerId: player.id,
            groupNumber: Math.floor(index / groupSize) + 1,
            sortOrder: index % groupSize,
          })),
    },
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
      { event: '*', schema: 'public', table: 'round_groups', filter: `round_id=eq.${roundId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'round_group_players', filter: `round_id=eq.${roundId}` },
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
  groupNumber?: number;
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
    .eq('group_number', params.groupNumber ?? 1)
    .eq('hole_number', params.holeNumber);

  if (error) throw error;
}

export async function updateSharedMatchup(params: {
  roundId: string;
  groupNumber?: number;
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
    .eq('group_number', params.groupNumber ?? 1)
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
