import type { Player } from '@/types/round';
import type { GroupedPlayer, RoundGroup, RoundGroupPlayer } from '@/types/groups';

export function buildGroupsForPlayers(players: Player[], groupSize: 4 | 5 = 4) {
  const groups: RoundGroup[] = [];
  const groupPlayers: RoundGroupPlayer[] = [];

  players.forEach((player, index) => {
    const groupNumber = Math.floor(index / groupSize) + 1;
    const sortOrder = index % groupSize;

    if (!groups.some((group) => group.groupNumber === groupNumber)) {
      groups.push({
        groupNumber,
        groupName: `Group ${groupNumber}`,
        teeTime: null,
        scorekeeperName: null,
        scorekeeperDeviceId: null,
        currentHole: 1,
      });
    }

    groupPlayers.push({
      playerId: player.id,
      groupNumber,
      sortOrder,
    });
  });

  return { groupSize, groups, groupPlayers };
}

export function assignPlayersToGroups(players: Player[], groupPlayers: RoundGroupPlayer[], groupSize: 4 | 5 = 4): GroupedPlayer[] {
  return players.map((player, index) => {
    const assignment = groupPlayers.find((item) => item.playerId === player.id);

    return {
      ...player,
      groupNumber: assignment?.groupNumber ?? Math.floor(index / groupSize) + 1,
      sortOrder: assignment?.sortOrder ?? index % groupSize,
    };
  });
}

export function getPlayersInGroup(players: GroupedPlayer[], groupNumber: number) {
  return players
    .filter((player) => player.groupNumber === groupNumber)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getUniqueGroupNumbers(players: GroupedPlayer[]) {
  return Array.from(new Set(players.map((player) => player.groupNumber))).sort((a, b) => a - b);
}

export function isValidGroupSize(players: GroupedPlayer[], groupNumber: number, maxGroupSize: 4 | 5 = 4) {
  const count = players.filter((player) => player.groupNumber === groupNumber).length;
  return count >= 1 && count <= maxGroupSize;
}
