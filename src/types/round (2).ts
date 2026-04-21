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
  holeNumber: number;
  par: 3 | 4 | 5;
  handicapIndex: number;
  bankerPlayerId: string;
  bankerGrossScore: number | null;
  bankerPressed: boolean;
  matchups: MatchupDraft[];
  isSaved: boolean;
};

export type HoleConfig = {
  holeNumber: number;
  par: 3 | 4 | 5;
  handicapIndex: number;
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
};

export type CreateRoundInput = {
  roundCode: string;
  title: string;
  courseName: string;
  selectedCourseId?: string | null;
  defaultBet: number;
  players: Player[];
  firstBankerPlayerId: string;
  totalHoles?: number;
  holesConfig?: HoleConfig[];
};
