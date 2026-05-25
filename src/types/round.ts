export type Player = {
  id: string;
  name: string;
  handicap: number;
};

export type MatchupDraft = {
  playerId: string;
  baseWager: number;
  pressed: boolean;
  grossScore: number | null;
};

export type HoleState = {
  groupNumber?: number;
  holeNumber: number;
  par: 3 | 4 | 5;
  handicapIndex: number;
  bankerPlayerId: string;
  bankerGrossScore: number | null;
  bankerPressed: boolean;
  matchups: MatchupDraft[];
  isSaved: boolean;
  ctpWinnerPlayerId?: string | null;
};

export type HoleConfig = {
  holeNumber: number;
  par: 3 | 4 | 5;
  handicapIndex: number;
};

export type RoundGameSettings = {
  skinsPot: number;
  lowNetPot: number;
  ctpPot: number;
};

export type RoundState = {
  id: string;
  roundCode: string;
  title: string;
  courseName: string;
  selectedCourseId?: string | null;
  currentHole: number;
  totalHoles: number;
  defaultBet: number;
  players: Player[];
  holes: HoleState[];
  gameSettings: RoundGameSettings;
  multiFoursome?: import('@/types/groups').MultiFoursomeSetup;
};

export type CreateRoundInput = {
  roundCode: string;
  title: string;
  courseName: string;
  selectedCourseId?: string | null;
  defaultBet: number;
  players: Player[];
  firstBankerPlayerId: string;
  groupSize?: 4 | 5;
  groupPlayers?: import('@/types/groups').RoundGroupPlayer[];
  totalHoles?: number;
  holesConfig?: HoleConfig[];
  gameSettings?: Partial<RoundGameSettings>;
};
