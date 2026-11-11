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

/** Per-hole picks for games that need more than scores. Team choice lives on hole 1 for the whole round. */
export type HoleGameData = {
  /** Wolf: the partner the wolf picked, or 'lone' for lone wolf. */
  wolfChoice?: string | null;
  bingoPlayerId?: string | null;
  bangoPlayerId?: string | null;
  bongoPlayerId?: string | null;
  /** Team games (Vegas, Best Ball…): who partners the group's first player. */
  teamPartnerOfFirst?: string | null;
  /** CTP: when this group marked its player as closest (ms, phone clock). The latest mark wins. */
  ctpMarkedAt?: number | null;
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
  gameData?: HoleGameData;
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
  matchPlayEnabled?: boolean;
  teamMatchPlayEnabled?: boolean;
  extraGames?: Partial<Record<import('@/lib/games/catalog').BeezerExtraGameKey, boolean>>;
  extraGameUnits?: Partial<Record<import('@/lib/games/catalog').BeezerExtraGameKey, number>>;
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
  matchPlayUnit?: number;
  teamMatchPlayUnit?: number;
  teamOneName?: string;
  teamTwoName?: string;
  ryderCupFormat?: 'team_match' | 'singles_match';
  teamAssignments?: Record<string, 'team_one' | 'team_two'>;
  singlesPairings?: Record<string, string>;
  /** Player ids who opted out of a game, keyed by game type (e.g. 'wolf', 'nassau'). Banker, skins, CTP and low net use the player flags instead. */
  excludedPlayers?: Record<string, string[]>;
  courseRating?: number | null;
  slopeRating?: number | null;
  teeColor?: string | null;
  pcc?: number | null;
};

export type RoundState = {
  id: string;
  roundCode: string;
  ryderEventCode?: string | null;
  ryderEventDay?: number | null;
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
  ryderEventCode?: string | null;
  ryderEventDay?: number | null;
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
