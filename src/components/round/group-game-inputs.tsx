import type { HoleGameData, HoleState, Player, RoundState } from '@/types/round';
import { formatCurrency } from '@/lib/utils/currency';
import { gameEnabled, gamePlayers, roundGroups, teamsFor, usesTeams, wolfOrder, SCORED_GROUP_GAMES, type GroupGameResult } from '@/lib/games/group-games';

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold disabled:opacity-50 ${active ? 'border-[#0f5132] bg-[#0f5132] text-white' : 'border-slate-300 bg-white text-slate-800'}`}
    >
      {children}
    </button>
  );
}

const names = (team: Player[]) => team.map((player) => player.name).join(' & ');

/** Per-hole picks for Wolf and Bingo Bango Bongo, plus the team choice for Vegas / Best Ball. */
export function GroupGameInputs({
  round,
  groupNumber,
  hole,
  canEdit,
  onChange,
}: {
  round: RoundState;
  groupNumber: number;
  hole: HoleState;
  canEdit: boolean;
  onChange: (holeNumber: number, patch: HoleGameData) => void;
}) {
  const everyone = roundGroups(round).find((group) => group.groupNumber === groupNumber)?.players ?? [];
  const wolfPlayers = gamePlayers(round, 'wolf', everyone);
  const bbbPlayers = gamePlayers(round, 'bingo_bango_bongo', everyone);
  const wolfOn = gameEnabled(round, 'wolf') && wolfPlayers.length === 4;
  const bbbOn = gameEnabled(round, 'bingo_bango_bongo') && bbbPlayers.length > 1;
  const teamGame = SCORED_GROUP_GAMES.find((key) => usesTeams(key) && gameEnabled(round, key));
  const players = teamGame ? gamePlayers(round, teamGame, everyone) : everyone;
  const teams = teamGame ? teamsFor(round, groupNumber, players) : null;
  if (!wolfOn && !bbbOn && !teams) return null;

  const wolf = wolfOn ? wolfOrder(round, groupNumber, wolfPlayers).wolves.get(hole.holeNumber) : undefined;
  const choice = hole.gameData?.wolfChoice ?? null;
  const pick = (patch: HoleGameData) => canEdit && onChange(hole.holeNumber, patch);

  return (
    <>
      {teams ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Teams</h2>
          <p className="mt-1 text-sm text-slate-600">
            {names(teams[0])} <span className="text-slate-400">vs</span> {names(teams[1])} · for the whole round
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{players[0].name}&apos;s partner:</span>
            {players.slice(1).map((player) => (
              <Chip
                key={player.id}
                active={teams[0].some((member) => member.id === player.id)}
                disabled={!canEdit}
                onClick={() => canEdit && onChange(1, { teamPartnerOfFirst: player.id })}
              >
                {player.name}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      {wolfOn && wolf ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Wolf: {wolf.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {round.totalHoles === 18 && hole.holeNumber >= 17 ? 'On 17 and 18 the player losing most at Wolf is the wolf. ' : ''}
            After the tee shots, who did {wolf.name} pick?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {wolfPlayers.filter((player) => player.id !== wolf.id).map((player) => (
              <Chip key={player.id} active={choice === player.id} disabled={!canEdit} onClick={() => pick({ wolfChoice: choice === player.id ? null : player.id })}>
                {player.name}
              </Chip>
            ))}
            <Chip active={choice === 'lone'} disabled={!canEdit} onClick={() => pick({ wolfChoice: choice === 'lone' ? null : 'lone' })}>
              Lone wolf (2×)
            </Chip>
          </div>
        </section>
      ) : null}

      {bbbOn ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Bingo Bango Bongo</h2>
          {([
            ['bingoPlayerId', 'Bingo', 'first on the green'],
            ['bangoPlayerId', 'Bango', 'closest once everyone is on'],
            ['bongoPlayerId', 'Bongo', 'first in the hole'],
          ] as const).map(([field, label, hint]) => {
            const current = hole.gameData?.[field] ?? null;
            return (
              <div key={field} className="mt-3">
                <p className="text-sm"><span className="font-semibold">{label}</span> <span className="text-slate-500">· {hint}</span></p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {bbbPlayers.map((player) => (
                    <Chip key={player.id} active={current === player.id} disabled={!canEdit} onClick={() => pick({ [field]: current === player.id ? null : player.id })}>
                      {player.name}
                    </Chip>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}

/** Running money for this group's side games. */
export function GroupGameStandings({ results, open = false }: { results: GroupGameResult[]; open?: boolean }) {
  if (!results.length) return null;
  return (
    <details open={open} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-lg font-bold">Side games so far</summary>
      <div className="mt-3 space-y-4">
        {results.map((result) => (
          <div key={`${result.key}-${result.groupNumber}`}>
            <h3 className="font-semibold">{result.label}</h3>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {[...result.standings].sort((a, b) => b.amount - a.amount).map((item) => (
                <div key={item.playerId} className="flex justify-between gap-2">
                  <span>{item.name}</span>
                  <span className={`font-semibold tabular-nums ${item.amount > 0 ? 'text-green-700' : item.amount < 0 ? 'text-red-700' : 'text-slate-500'}`}>
                    {item.amount > 0 ? '+' : item.amount < 0 ? '−' : ''}{formatCurrency(Math.abs(item.amount))}
                  </span>
                </div>
              ))}
            </div>
            {result.notes.map((note) => <p key={note} className="mt-1 text-xs text-amber-700">{note}</p>)}
          </div>
        ))}
      </div>
    </details>
  );
}
