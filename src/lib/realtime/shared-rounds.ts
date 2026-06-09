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
  banker_participant: boolean | null;
  skins_participant: boolean | null;
  ctp_participant: boolean | null;
  low_net_participant: boolean | null;
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
  banker_participant: boolean | null;
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
  group_number: number | null;
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

export type SettlementSnapshot = {
  roundCode: string;
  roundTitle: string;
  courseName: string;
  finalizedAt: string;
  finalScoring: Array<{ playerId: string; playerName: string; grossTotal: number; netTotal: number }>;
  skins: Array<{ playerId: string; playerName: string; amount: number; skins: number; holes: number[] }>;
  ctp: Array<{ playerId: string; playerName: string; amount: number; wins: number; holes: number[] }>;
  lowNet: Array<{ playerId: string; playerName: string; amount: number; placement: string }>;
  bankerPositions: Array<{ playerId: string; name: string; amount: number }>;
  bankerSettlements: Array<{
    groupNumber: number;
    fromPlayerId: string;
    fromPlayerName: string;
    toPlayerId: string;
    toPlayerName: string;
    amount: number;
  }>;
};

type SettlementSnapshotRow = {
  id: string;
  round_id: string;
  round_code: string;
  snapshot: SettlementSnapshot;
  finalized_at: string;
  created_at: string;
  updated_at: string;
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
    banker_participant: player.bankerParticipant !== false,
    skins_participant: player.skinsParticipant !== false,
    ctp_participant: player.ctpParticipant !== false,
    low_net_participant: player.lowNetParticipant !== false,
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
      banker_participant: matchup.bankerParticipant !== false,
    }));
  });

  if (matchupRows.length > 0) {
    const { error: matchupsError } = await supabase
      .from('round_matchups')
      .upsert(matchupRows, { onConflict: 'round_hole_id,player_key' });

    if (matchupsError) throw new Error(formatSupabaseError(matchupsError, 'Unable to save matchups.'));
  }

  const ctpRows = round.holes
    .filter((hole) => hole.par === 3)
    .map((hole) => ({
      round_id: roundId,
      group_number: hole.groupNumber ?? 1,
      hole_number: hole.holeNumber,
      winner_player_key: hole.ctpWinnerPlayerId ?? null,
      note: null,
      payout_amount: 0,
    }));

  if (ctpRows.length > 0) {
    const { error: ctpError } = await supabase
      .from('round_ctp_results')
      .upsert(ctpRows, { onConflict: 'round_id,group_number,hole_number' });

    if (ctpError) throw new Error(formatSupabaseError(ctpError, 'Unable to save CTP results.'));
  }

  const { error: gamesError } = await supabase
    .from('round_games')
    .upsert(
      [
        { round_id: roundId, game_type: 'banker', pot_amount: 0, enabled: round.gameSettings.bankerEnabled !== false, settings: {} },
        {
          round_id: roundId,
          game_type: 'skins',
          pot_amount: round.gameSettings.skinsPot,
          enabled: round.gameSettings.skinsEnabled === true,
          settings: {},
        },
        {
          round_id: roundId,
          game_type: 'low_net',
          pot_amount: round.gameSettings.lowNetPot,
          enabled: round.gameSettings.lowNetEnabled === true,
          settings: {
            courseRating: round.gameSettings.courseRating ?? null,
            slopeRating: round.gameSettings.slopeRating ?? null,
            pcc: round.gameSettings.pcc ?? 0,
          },
        },
        {
          round_id: roundId,
          game_type: 'ctp',
          pot_amount: round.gameSettings.ctpPot,
          enabled: round.gameSettings.ctpEnabled === true,
          settings: {},
        },
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

export async function updateSharedRoundSetup(round: RoundState) {
  if (round.id.startsWith('round-')) {
    await createSharedRoundFromLocalRound(round);
    return;
  }

  const { error: roundError } = await supabase
    .from('rounds')
    .update({
      title: round.title,
      course_name: round.courseName,
      selected_course_id: round.selectedCourseId,
      default_bet: round.defaultBet,
    })
    .eq('id', round.id);

  if (roundError) throw new Error(formatSupabaseError(roundError, 'Unable to save round setup.'));

  const playerRows = round.players.map((player, index) => ({
    round_id: round.id,
    player_key: player.id,
    name: player.name,
    handicap: player.handicap,
    banker_participant: player.bankerParticipant !== false,
    skins_participant: player.skinsParticipant !== false,
    ctp_participant: player.ctpParticipant !== false,
    low_net_participant: player.lowNetParticipant !== false,
    sort_order: index,
  }));

  const { error: playersError } = await supabase
    .from('round_players')
    .upsert(playerRows, { onConflict: 'round_id,player_key' });

  if (playersError) throw new Error(formatSupabaseError(playersError, 'Unable to save player setup.'));

  await Promise.all(
    round.players.map(async (player) => {
      const { error } = await supabase
        .from('round_matchups')
        .update({ banker_participant: player.bankerParticipant !== false })
        .eq('round_id', round.id)
        .eq('player_key', player.id);

      if (error) throw new Error(formatSupabaseError(error, 'Unable to save Banker participation.'));
    })
  );

  const ctpOptOutIds = round.players.filter((player) => player.ctpParticipant === false).map((player) => player.id);
  if (ctpOptOutIds.length > 0) {
    const { error: ctpError } = await supabase
      .from('round_ctp_results')
      .update({ winner_player_key: null })
      .eq('round_id', round.id)
      .in('winner_player_key', ctpOptOutIds);

    if (ctpError) throw new Error(formatSupabaseError(ctpError, 'Unable to clear ineligible CTP winners.'));
  }

  const { error: gamesError } = await supabase
    .from('round_games')
    .upsert(
      [
        { round_id: round.id, game_type: 'banker', pot_amount: 0, enabled: round.gameSettings.bankerEnabled !== false, settings: {} },
        {
          round_id: round.id,
          game_type: 'skins',
          pot_amount: round.gameSettings.skinsPot,
          enabled: round.gameSettings.skinsEnabled === true,
          settings: {},
        },
        {
          round_id: round.id,
          game_type: 'low_net',
          pot_amount: round.gameSettings.lowNetPot,
          enabled: round.gameSettings.lowNetEnabled === true,
          settings: {
            courseRating: round.gameSettings.courseRating ?? null,
            slopeRating: round.gameSettings.slopeRating ?? null,
            pcc: round.gameSettings.pcc ?? 0,
          },
        },
        {
          round_id: round.id,
          game_type: 'ctp',
          pot_amount: round.gameSettings.ctpPot,
          enabled: round.gameSettings.ctpEnabled === true,
          settings: {},
        },
      ],
      { onConflict: 'round_id,game_type' }
    );

  if (gamesError) throw new Error(formatSupabaseError(gamesError, 'Unable to save game setup.'));
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

export async function loadSettlementSnapshot(roundCode: string): Promise<SettlementSnapshot | null> {
  const { data, error } = await supabase
    .from('round_settlement_snapshots')
    .select('*')
    .eq('round_code', roundCode)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw new Error(formatSupabaseError(error, 'Unable to load settlement snapshot.'));
  }

  return data ? (data as SettlementSnapshotRow).snapshot : null;
}

export async function saveSettlementSnapshot(params: {
  roundId: string;
  roundCode: string;
  snapshot: SettlementSnapshot;
}) {
  const { data, error } = await supabase
    .from('round_settlement_snapshots')
    .upsert(
      {
        round_id: params.roundId,
        round_code: params.roundCode,
        snapshot: params.snapshot,
        finalized_at: params.snapshot.finalizedAt,
      },
      { onConflict: 'round_id' }
    )
    .select('*')
    .single();

  if (error) throw new Error(formatSupabaseError(error, 'Unable to save settlement snapshot.'));
  return (data as SettlementSnapshotRow).snapshot;
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
    bankerParticipant: player.banker_participant !== false,
    skinsParticipant: player.skins_participant !== false,
    ctpParticipant: player.ctp_participant !== false,
    lowNetParticipant: player.low_net_participant !== false,
  }));
  const games = new Map(bundle.games.map((game) => [game.game_type, game]));
  const handicapSettings = games.get('low_net')?.settings ?? {};
  const ctpByGroupHole = new Map(
    bundle.ctpResults.map((ctp) => [`${ctp.group_number ?? 1}:${ctp.hole_number}`, ctp.winner_player_key])
  );
  const groupNumberById = new Map(bundle.groups.map((group) => [group.id, group.group_number]));

  const holes: HoleState[] = bundle.holes.map((hole) => {
    const groupNumber = hole.group_number ?? 1;
    const holeMatchupsByPlayerKey = new Map(
      bundle.matchups
        .filter((matchup) => matchup.round_hole_id === hole.id && matchup.player_key !== hole.banker_player_key)
        .map((matchup) => [matchup.player_key, matchup])
    );
    const groupPlayerKeys = bundle.groupPlayers
      .filter((assignment) => groupNumberById.get(assignment.round_group_id) === groupNumber)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((assignment) => assignment.player_key);
    const matchupPlayerKeys =
      groupPlayerKeys.length > 0
        ? groupPlayerKeys.filter((playerKey) => playerKey !== hole.banker_player_key)
        : Array.from(holeMatchupsByPlayerKey.keys());

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
      matchups: matchupPlayerKeys.map((playerKey) => {
        const matchup = holeMatchupsByPlayerKey.get(playerKey);
        const player = players.find((item) => item.id === playerKey);
        return {
          playerId: playerKey,
          baseWager: matchup?.base_wager ?? bundle.round.default_bet,
          pressed: matchup?.pressed ?? false,
          grossScore: matchup?.gross_score ?? null,
          bankerParticipant: matchup?.banker_participant ?? (player?.bankerParticipant !== false),
        };
      }),
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
      bankerEnabled: games.get('banker')?.enabled ?? true,
      skinsEnabled: games.get('skins')?.enabled ?? false,
      lowNetEnabled: games.get('low_net')?.enabled ?? false,
      ctpEnabled: games.get('ctp')?.enabled ?? false,
      skinsPot: games.get('skins')?.pot_amount ?? 0,
      lowNetPot: games.get('low_net')?.pot_amount ?? 0,
      ctpPot: games.get('ctp')?.pot_amount ?? 0,
      courseRating: typeof handicapSettings.courseRating === 'number' ? handicapSettings.courseRating : null,
      slopeRating: typeof handicapSettings.slopeRating === 'number' ? handicapSettings.slopeRating : null,
      pcc: typeof handicapSettings.pcc === 'number' ? handicapSettings.pcc : 0,
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

export async function updateSharedCtpResult(params: {
  roundId: string;
  groupNumber?: number;
  holeNumber: number;
  winnerPlayerKey: string | null;
}) {
  const { error } = await supabase
    .from('round_ctp_results')
    .update({ winner_player_key: params.winnerPlayerKey })
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

export async function replaceSharedHoleMatchups(params: {
  roundId: string;
  groupNumber?: number;
  holeNumber: number;
  matchups: HoleState['matchups'];
}) {
  const { data: hole, error: holeError } = await supabase
    .from('round_holes')
    .select('id')
    .eq('round_id', params.roundId)
    .eq('group_number', params.groupNumber ?? 1)
    .eq('hole_number', params.holeNumber)
    .single();

  if (holeError) throw holeError;

  const rows = params.matchups.map((matchup) => ({
    round_id: params.roundId,
    round_hole_id: hole.id,
    group_number: params.groupNumber ?? 1,
    hole_number: params.holeNumber,
    player_key: matchup.playerId,
    base_wager: matchup.baseWager,
    pressed: matchup.pressed,
    gross_score: matchup.grossScore,
    banker_participant: matchup.bankerParticipant !== false,
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from('round_matchups').upsert(rows, { onConflict: 'round_hole_id,player_key' });

    if (upsertError) throw upsertError;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('round_matchups')
    .select('player_key')
    .eq('round_hole_id', hole.id);

  if (existingError) throw existingError;

  const expectedPlayerKeys = new Set(params.matchups.map((matchup) => matchup.playerId));
  const stalePlayerKeys = (existingRows ?? [])
    .map((row) => row.player_key)
    .filter((playerKey) => !expectedPlayerKeys.has(playerKey));

  if (stalePlayerKeys.length > 0) {
    const { error: deleteError } = await supabase
      .from('round_matchups')
      .delete()
      .eq('round_hole_id', hole.id)
      .in('player_key', stalePlayerKeys);

    if (deleteError) throw deleteError;
  }
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
