import { BEEZER_EXTRA_GAMES } from '@/lib/games/catalog';
import type { RoundGameSettings } from '@/types/round';

/** Games a golfer can sit out, beyond the four with their own player flags (Banker, Skins, CTP, Low Net). */
export function optionalGames(settings: Partial<RoundGameSettings>): Array<{ key: string; label: string }> {
  return [
    settings.nassauEnabled ? { key: 'nassau', label: 'Nassau' } : null,
    settings.stablefordEnabled ? { key: 'stableford', label: 'Stableford' } : null,
    settings.birdiePotEnabled ? { key: 'birdie_pot', label: 'Birdie Pot' } : null,
    settings.eaglePotEnabled ? { key: 'eagle_pot', label: 'Eagle Pot' } : null,
    settings.holeInOneEnabled ? { key: 'hole_in_one', label: 'Hole-in-One' } : null,
    settings.wolfEnabled ? { key: 'wolf', label: 'Wolf' } : null,
    settings.vegasEnabled ? { key: 'vegas', label: 'Vegas' } : null,
    settings.bingoBangoBongoEnabled ? { key: 'bingo_bango_bongo', label: 'Bingo Bango Bongo' } : null,
    settings.matchPlayEnabled ? { key: 'match_play', label: 'Match Play' } : null,
    ...BEEZER_EXTRA_GAMES.filter((game) => settings.extraGames?.[game.key]).map((game) => ({ key: game.key, label: game.label })),
  ].filter((game): game is { key: string; label: string } => Boolean(game));
}

export type PlayerGameOption = { key: string; label: string; checked: boolean; onToggle: () => void };

/** Collapsed "Plays: …" line with a checkbox per game for one golfer. */
export function PlayerGames({ options, className = '' }: { options: PlayerGameOption[]; className?: string }) {
  if (!options.length) return null;
  const playing = options.filter((option) => option.checked).map((option) => option.label);
  return (
    <details className={className}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-600">
        Plays: {playing.length === options.length ? 'all games' : playing.join(', ') || 'no side games'}{' '}
        <span className="font-normal text-slate-500">(change)</span>
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => (
          <label key={option.key} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[#0f5132]" checked={option.checked} onChange={option.onToggle} />
            {option.label}
          </label>
        ))}
      </div>
    </details>
  );
}

/** Adds or removes a player from a game's opt-out list. */
export function toggleExcluded(current: Record<string, string[]>, gameKey: string, playerId: string) {
  const list = new Set(current[gameKey] ?? []);
  if (list.has(playerId)) list.delete(playerId);
  else list.add(playerId);
  return { ...current, [gameKey]: [...list] };
}
