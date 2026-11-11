import type { BeezerExtraGameKey } from '@/lib/games/catalog';
import type { Player, RoundGameSettings } from '@/types/round';
import { dayChoice, potGames, suggestGroupOrder, TEAM_FORMATS, type GolfEvent, type Signup } from './golf-events';

/** Games with their own per-player flags in a round; every other game uses the opt-out list. */
const FLAG_GAMES: Record<string, 'bankerParticipant' | 'skinsParticipant' | 'ctpParticipant' | 'lowNetParticipant'> = {
  banker: 'bankerParticipant',
  skins: 'skinsParticipant',
  ctp: 'ctpParticipant',
  low_net: 'lowNetParticipant',
};
const EXTRA_KEYS: BeezerExtraGameKey[] = ['best_ball', 'sixes', 'rabbit', 'aces_and_deuces', 'medal_play'];

export type EventRoundPrefill = {
  title: string;
  courseName: string;
  defaultBet: number;
  players: Player[];
  settings: Partial<RoundGameSettings> & { excludedPlayers: Record<string, string[]> };
  teamMatch: { format: 'team_match' | 'singles_match'; eventCode: string; day: number; teamOneName: string; teamTwoName: string } | null;
  notes: string[];
};

/**
 * Turns an event day's signups into a ready-to-create round: players in suggested group order,
 * each game switched on with pots sized by who's in, and everyone's opt-outs applied.
 */
export function buildEventRoundPrefill(event: GolfEvent, signups: Signup[], dayNumber: number): EventRoundPrefill {
  const day = event.days.find((item) => item.day === dayNumber);
  if (!day) throw new Error(`This event has no Day ${dayNumber}.`);
  const notes: string[] = [];
  const entries = signups
    .map((signup) => ({ signup, games: dayChoice(event, signup.choices, dayNumber) }))
    .filter((entry) => entry.games.playing)
    .map((entry) => ({ signup: entry.signup, games: entry.games.games }));
  const ordered = suggestGroupOrder(entries);
  // Everyone plays off the lowest handicap signed up for the event (not just this day), so the low
  // player gets 0 pops and a player 8 shots higher gets 8 pops on the 8 hardest holes, every day.
  // The difference is rounded to whole strokes (12.4 -> 12, 12.6 -> 13).
  const handicapOf = (signup: Signup) => Math.max(0, Number(signup.handicap) || 0);
  const eventLow = signups.length ? Math.min(...signups.map(handicapOf)) : 0;
  if (eventLow > 0) notes.push(`Handicaps are played off the event's lowest handicap (${eventLow}), so each player gets the difference.`);
  const players: Player[] = ordered.map((entry, index) => {
    const handicap = Math.round(handicapOf(entry.signup) - eventLow);
    const player: Player = { id: `p${index + 1}`, name: entry.signup.name, handicap };
    Object.entries(FLAG_GAMES).forEach(([key, flag]) => { player[flag] = entry.games.includes(key); });
    return player;
  });

  const settings: EventRoundPrefill['settings'] = { excludedPlayers: {}, extraGames: {}, extraGameUnits: {} };
  let defaultBet = 0;
  const inGame = (key: string) => ordered.map((entry, index) => ({ entry, id: players[index].id })).filter(({ entry }) => entry.games.includes(key));
  const pots = new Set(potGames(day).map((game) => game.key));

  (day.games ?? []).forEach((game) => {
    const players = inGame(game.key);
    const pot = pots.has(game.key) ? game.amount * players.length : 0;
    if (!(game.key in FLAG_GAMES)) {
      const out = ordered.map((_, index) => `p${index + 1}`).filter((id) => !players.some((player) => player.id === id));
      if (out.length) settings.excludedPlayers[game.key] = out;
    }
    switch (game.key) {
      case 'banker': settings.bankerEnabled = true; defaultBet = game.amount; break;
      case 'skins': settings.skinsEnabled = true; settings.skinsPot = pot; break;
      case 'ctp': settings.ctpEnabled = true; settings.ctpPot = pot; break;
      case 'low_net': settings.lowNetEnabled = true; settings.lowNetPot = pot; break;
      case 'nassau': settings.nassauEnabled = true; settings.nassauPot = pot; break;
      case 'stableford': settings.stablefordEnabled = true; settings.stablefordPot = pot; break;
      case 'birdie_pot': settings.birdiePotEnabled = true; settings.birdiePot = pot; break;
      case 'eagle_pot': settings.eaglePotEnabled = true; settings.eaglePot = pot; break;
      case 'hole_in_one': settings.holeInOneEnabled = true; notes.push('Hole-in-one pays a fixed $100 from each other player in it.'); break;
      case 'wolf': settings.wolfEnabled = true; settings.wolfUnit = game.amount; break;
      case 'vegas': settings.vegasEnabled = true; settings.vegasUnit = game.amount; break;
      case 'bingo_bango_bongo': settings.bingoBangoBongoEnabled = true; settings.bingoBangoBongoUnit = game.amount; break;
      case 'match_play': settings.matchPlayEnabled = true; settings.matchPlayUnit = game.amount; break;
      default:
        if ((EXTRA_KEYS as string[]).includes(game.key)) {
          settings.extraGames![game.key as BeezerExtraGameKey] = true;
          settings.extraGameUnits![game.key as BeezerExtraGameKey] = game.amount;
        }
    }
  });
  if (!settings.bankerEnabled) settings.bankerEnabled = false;

  const teamMatch = TEAM_FORMATS.includes(day.format)
    ? { format: day.format as 'team_match' | 'singles_match', eventCode: event.code, day: dayNumber, teamOneName: event.team_one_name, teamTwoName: event.team_two_name }
    : null;
  if (teamMatch) {
    settings.teamMatchPlayEnabled = true;
    settings.teamAssignments = Object.fromEntries(
      ordered.map((entry, index) => [players[index].id, entry.signup.team ?? (index % 2 === 0 ? 'team_one' : 'team_two')])
    );
  }
  if (players.length < signups.length) notes.push(`${signups.length - players.length} signed-up player${signups.length - players.length === 1 ? ' is' : 's are'} not playing this day.`);

  return {
    title: `${event.title} · Day ${dayNumber}`,
    courseName: day.course ?? '',
    defaultBet,
    players,
    settings,
    teamMatch,
    notes,
  };
}
