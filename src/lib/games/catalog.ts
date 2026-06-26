export const BEEZER_EXTRA_GAMES = [
  { key: 'aces_and_deuces', label: 'Aces and Deuces', unitLabel: 'Aces and Deuces Unit' },
  { key: 'arnies', label: 'Arnies', unitLabel: 'Arnies Unit' },
  { key: 'best_ball', label: 'Best Ball', unitLabel: 'Best Ball Unit' },
  { key: 'better_ball', label: 'Better Ball', unitLabel: 'Better Ball Unit' },
  { key: 'dots', label: 'Dots', unitLabel: 'Dots Unit' },
  { key: 'four_ball', label: 'Four Ball', unitLabel: 'Four Ball Unit' },
  { key: 'medal_play', label: 'Medal Play', unitLabel: 'Medal Play Unit' },
  { key: 'medal_play_group', label: 'Medal Play Group', unitLabel: 'Medal Play Group Pot' },
  { key: 'nines', label: 'Nines', unitLabel: 'Nines Unit' },
  { key: 'points', label: 'Points', unitLabel: 'Points Unit' },
  { key: 'quota', label: 'Quota', unitLabel: 'Quota Unit' },
  { key: 'rabbit', label: 'Rabbit', unitLabel: 'Rabbit Unit' },
  { key: 'scotch', label: 'Scotch', unitLabel: 'Scotch Unit' },
  { key: 'sixes', label: 'Sixes', unitLabel: 'Sixes Unit' },
  { key: 'skins_group', label: 'Skins Group', unitLabel: 'Skins Group Pot' },
  { key: 'snake', label: 'Snake', unitLabel: 'Snake Unit' },
  { key: 'stableford_group', label: 'Stableford Group', unitLabel: 'Stableford Group Pot' },
  { key: 'three_ball', label: 'Three Ball', unitLabel: 'Three Ball Unit' },
  { key: 'trouble', label: 'Trouble', unitLabel: 'Trouble Unit' },
] as const;

export type BeezerExtraGameKey = (typeof BEEZER_EXTRA_GAMES)[number]['key'];
