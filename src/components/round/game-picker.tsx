import { BEEZER_EXTRA_GAMES } from '@/lib/games/catalog';
import { gameHelp } from '@/lib/games/help';

export type GameOption = { label: string; checked: boolean; onToggle: () => void };

const isExtra = (label: string) => BEEZER_EXTRA_GAMES.some((game) => game.label === label);

/** Always-visible game checklist, split into games the app scores and games it only records. */
export function GamePicker({ options }: { options: GameOption[] }) {
  const renderOption = (option: GameOption) => {
    const help = gameHelp(option.label);
    return (
      <label
        key={option.label}
        className={`flex min-h-[52px] items-start gap-3 rounded-xl border px-3 py-3 ${option.checked ? 'border-[#0f5132] bg-[#eef7f0]' : 'border-slate-200 bg-white'}`}
      >
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#0f5132]" checked={option.checked} onChange={option.onToggle} />
        <span className="min-w-0">
          <span className="block font-semibold">{option.label}</span>
          {help.summary && !help.summary.startsWith('Recorded with the round') ? (
            <span className="mt-0.5 block text-xs text-slate-600">
              {help.summary}
              {help.money ? ` ${help.money}` : ''}
            </span>
          ) : null}
        </span>
      </label>
    );
  };

  return (
    <>
      {[
        { title: 'Scored by the app', scored: true },
        { title: 'Record only: settle these yourselves', scored: false },
      ].map((section) => {
        const sectionOptions = options.filter((option) => gameHelp(option.label).scored === section.scored);
        const classic = sectionOptions.filter((option) => !isExtra(option.label));
        const extras = sectionOptions.filter((option) => isExtra(option.label));
        return (
          <div key={section.title} className="space-y-2">
            <h3 className={`text-sm font-bold uppercase tracking-wide ${section.scored ? 'text-[#0f5132]' : 'text-slate-500'}`}>{section.title}</h3>
            {!section.scored ? (
              <p className="text-xs text-slate-500">These show on the round so everyone knows they&apos;re on, but the app doesn&apos;t calculate them yet.</p>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{classic.map(renderOption)}</div>
            {extras.length ? (
              <details open={extras.some((option) => option.checked)}>
                <summary className="cursor-pointer py-2 text-sm font-semibold text-slate-600">More games ({extras.length})</summary>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{extras.map(renderOption)}</div>
              </details>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
