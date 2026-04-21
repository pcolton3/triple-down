export type BankerMatchupInput = {
  playerId: string;
  baseWager: number;
  pressCount: number;
  playerGrossScore: number;
  playerNetScore: number;
};

export type BankerHoleInput = {
  par: 3 | 4 | 5;
  bankerPlayerId: string;
  bankerGrossScore: number;
  bankerNetScore: number;
  matchups: BankerMatchupInput[];
};

export type BankerMatchupResult = {
  playerId: string;
  result: 'player_wins' | 'banker_wins' | 'push';
  pressMultiplier: number;
  birdieMultiplier: number;
  finalAmount: number;
  reason: string;
};
