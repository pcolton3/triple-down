import { formatCurrency } from '@/lib/utils/currency';
import { dayChoice, formatEventDate, gameDefinition, isDayLocked, playerBuyIn, type DayChoice, type GolfEvent, type SignupChoices } from '@/lib/events/golf-events';

const UNIT_TEXT: Record<string, string> = { banker: 'per bet', match_play: 'per match', sixes: 'per match', best_ball: 'per match', medal_play: 'per stroke', rabbit: 'per nine', aces_and_deuces: 'per hole' };

/** One line summary, e.g. "Day 1: Banker, Skins · Day 2: not playing". */
export function choicesSummary(event: Pick<GolfEvent, 'days'>, choices?: SignupChoices) {
  return event.days
    .map((day) => {
      const choice = dayChoice(event, choices, day.day);
      const prefix = event.days.length > 1 ? `Day ${day.day}: ` : '';
      if (!choice.playing) return `${prefix}not playing`;
      const games = choice.games.map((key) => gameDefinition(key).label);
      return `${prefix}${games.length ? games.join(', ') : 'golf only'}`;
    })
    .join(' · ');
}

/**
 * Lets a player (or the organizer) pick which golf days they're playing and which games they're in.
 * Days whose round has started are locked unless `allowLocked` (organizer).
 */
export function ChoicesEditor({
  event,
  value,
  onChange,
  disabled = false,
  allowLocked = false,
}: {
  event: GolfEvent;
  value: SignupChoices;
  onChange: (next: SignupChoices) => void;
  disabled?: boolean;
  allowLocked?: boolean;
}) {
  const setDay = (dayNumber: number, next: DayChoice) => onChange({ ...value, days: { ...value.days, [String(dayNumber)]: next } });
  if (!event.days.length) return null;

  return (
    <div className="space-y-3">
      {event.days.map((day) => {
        const choice = dayChoice(event, value, day.day);
        const locked = isDayLocked(day) && !allowLocked;
        const games = day.games ?? [];
        return (
          <fieldset key={day.day} className="rounded-xl border border-slate-200 p-3" disabled={disabled || locked}>
            <legend className="px-1 text-sm font-bold">
              {event.days.length > 1 ? `Day ${day.day} · ` : ''}
              {day.date ? formatEventDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBA'}
              {day.course ? ` · ${day.course}` : ''}
            </legend>
            {locked ? <p className="mb-2 text-xs font-semibold text-amber-700">This round has started. Ask the organizer if you need a change.</p> : null}
            <label className="flex min-h-[48px] items-center gap-3 text-base font-semibold">
              <input
                type="checkbox"
                className="h-6 w-6 accent-[#0f5132]"
                checked={choice.playing}
                onChange={(event2) => setDay(day.day, event2.target.checked ? { playing: true, games: games.map((game) => game.key) } : { playing: false, games: [] })}
              />
              I&apos;m playing this day
            </label>
            {choice.playing && games.length ? (
              <div className="mt-1 space-y-1 border-t border-slate-100 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Games I&apos;m in</p>
                {games.map((game) => {
                  const definition = gameDefinition(game.key);
                  const checked = choice.games.includes(game.key);
                  return (
                    <label key={game.key} className="flex min-h-[44px] items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 accent-[#0f5132]"
                        checked={checked}
                        onChange={() => setDay(day.day, { playing: true, games: checked ? choice.games.filter((key) => key !== game.key) : [...choice.games, game.key] })}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{definition.label}</span>
                        <span className="text-slate-500">
                          {' '}· {definition.kind === 'pot' ? `${formatCurrency(game.amount)} into the pot` : game.amount ? `${formatCurrency(game.amount)} ${UNIT_TEXT[game.key] ?? 'per point'}, in your group` : 'in your group'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </fieldset>
        );
      })}
      <p className="text-sm font-semibold">
        Your buy-in: {formatCurrency(playerBuyIn(event, value))}
        <span className="font-normal text-slate-500"> · group games are settled after each round</span>
      </p>
    </div>
  );
}
