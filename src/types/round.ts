export type Player = {
  id: string;
  name: string;
  handicap: number;
  bankerParticipant?: boolean;
  skinsParticipant?: boolean;
  ctpParticipant?: boolean;
  lowNetParticipant?: boolean;
};

export type MatchupDraft = {
  playerId: string;
  baseWager: number;
  pressed: boolean;
  grossScore: number | null;
  bankerParticipant?: boolean;
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
  bankerEnabled?: boolean;
  skinsEnabled?: boolean;
  lowNetEnabled?: boolean;
  ctpEnabled?: boolean;
  nassauEnabled?: boolean;
  stablefordEnabled?: boolean;
  birdiePotEnabled?: boolean;
  eaglePotEnabled?: boolean;
  holeInOneEnabled?: boolean;
  wolfEnabled?: boolean;
  bingoBangoBongoEnabled?: boolean;
  vegasEnabled?: boolean;
  teamMatchPlayEnabled?: boolean;
  skinsPot: number;
  lowNetPot: number;
  ctpPot: number;
  nassauPot?: number;
  stablefordPot?: number;
  birdiePot?: number;
  eaglePot?: number;
  wolfUnit?: number;
  bingoBangoBongoUnit?: number;
  vegasUnit?: number;
  teamMatchPlayUnit?: number;
  teamOneName?: string;
  teamTwoName?: string;
  teamAssignments?: Record<string, 'team_one' | 'team_two'>;
  courseRating?: number | null;
  slopeRating?: number | null;
  teeColor?: string | null;
  pcc?: number | null;
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
