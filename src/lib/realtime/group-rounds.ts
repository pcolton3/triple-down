import { supabase } from '@/lib/supabase/client';
import type { RoundState } from '@/types/round';
import type { RoundGroup, RoundGroupPlayer } from '@/types/groups';

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

export async function createRoundGroups(params: {
  roundId: string;
  groups: RoundGroup[];
  groupPlayers: RoundGroupPlayer[];
}) {
  const groupRows = params.groups.map((group) => ({
    round_id: params.roundId,
    group_number: group.groupNumber,
    group_name: group.groupName ?? `Group ${group.groupNumber}`,
    tee_time: group.teeTime ?? null,
    scorekeeper_name: group.scorekeeperName ?? null,
    scorekeeper_device_id: group.scorekeeperDeviceId ?? null,
    current_hole: group.currentHole ?? 1,
  }));

  const { data: savedGroups, error: groupError } = await supabase
    .from('round_groups')
    .upsert(groupRows, { onConflict: 'round_id,group_number' })
    .select('*');

  if (groupError) throw groupError;

  const typedGroups = (savedGroups ?? []) as RoundGroupRow[];
  const groupIdByNumber = new Map<number, string>(
    typedGroups.map((group) => [group.group_number, group.id])
  );

  const groupPlayerRows = params.groupPlayers
    .map((assignment) => {
      const groupId = groupIdByNumber.get(assignment.groupNumber);
      if (!groupId) return null;

      return {
        round_id: params.roundId,
        round_group_id: groupId,
        player_key: assignment.playerId,
        sort_order: assignment.sortOrder,
      };
    })
    .filter((item): item is {
      round_id: string;
      round_group_id: string;
      player_key: string;
      sort_order: number;
    } => Boolean(item));

  if (groupPlayerRows.length === 0) return typedGroups;

  const { error: playerError } = await supabase
    .from('round_group_players')
    .upsert(groupPlayerRows, { onConflict: 'round_id,player_key' });

  if (playerError) throw playerError;

  return typedGroups;
}

export async function loadRoundGroups(roundId: string) {
  const [groups, groupPlayers] = await Promise.all([
    supabase
      .from('round_groups')
      .select('*')
      .eq('round_id', roundId)
      .order('group_number'),
    supabase
      .from('round_group_players')
      .select('*')
      .eq('round_id', roundId)
      .order('sort_order'),
  ]);

  if (groups.error) throw groups.error;
  if (groupPlayers.error) throw groupPlayers.error;

  return {
    groups: (groups.data ?? []) as RoundGroupRow[],
    groupPlayers: (groupPlayers.data ?? []) as RoundGroupPlayerRow[],
  };
}

export async function updateGroupCurrentHole(params: {
  roundId: string;
  groupNumber: number;
  currentHole: number;
}) {
  const { error } = await supabase
    .from('round_groups')
    .update({ current_hole: params.currentHole })
    .eq('round_id', params.roundId)
    .eq('group_number', params.groupNumber);

  if (error) throw error;
}

export async function claimGroupScorekeeper(params: {
  roundId: string;
  groupNumber: number;
  scorekeeperName: string;
}) {
  const deviceId = getDeviceId();

  const { error } = await supabase
    .from('round_groups')
    .update({
      scorekeeper_name: params.scorekeeperName,
      scorekeeper_device_id: deviceId,
    })
    .eq('round_id', params.roundId)
    .eq('group_number', params.groupNumber);

  if (error) throw error;

  return deviceId;
}

export function userCanEditGroup(group: {
  scorekeeper_device_id: string | null;
}) {
  if (typeof window === 'undefined') return false;
  return group.scorekeeper_device_id === getDeviceId();
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
