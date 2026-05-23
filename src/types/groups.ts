export type RoundGroup = {
  id?: string;
  groupNumber: number;
  groupName?: string | null;
  teeTime?: string | null;
  scorekeeperName?: string | null;
  scorekeeperDeviceId?: string | null;
  currentHole: number;
};

export type RoundGroupPlayer = {
  playerId: string;
  groupNumber: number;
  sortOrder: number;
};

export type GroupedPlayer = {
  id: string;
  name: string;
  handicap: number;
  groupNumber: number;
  sortOrder: number;
};

export type MultiFoursomeSetup = {
  enabled: boolean;
  groups: RoundGroup[];
  groupPlayers: RoundGroupPlayer[];
};
