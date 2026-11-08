import { Card } from '@/components/shared/card';
import { GAME_HELP, type GameHelp } from '@/lib/games/help';

function GameCard({ game }: { game: GameHelp }) {
  return (
    <Card>
      <h3 className="text-lg font-bold">{game.label}</h3>
      <p className="mt-1 text-sm text-slate-700">{game.summary}</p>
      {game.money ? <p className="mt-1 text-sm text-slate-600">{game.money}</p> : null}
    </Card>
  );
}

export function GameGrid() {
  const games = Object.values(GAME_HELP);
  const scored = games.filter((game) => game.scored);
  const recorded = games.filter((game) => !game.scored);
  const extras = recorded.filter((game) => game.summary.startsWith('Recorded with the round'));
  const classics = recorded.filter((game) => !extras.includes(game));
  return (
    <section className="mx-auto max-w-2xl space-y-4 px-4 pb-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">How the games work</h1>
        <p className="mt-2 text-slate-600">Net scores use each golfer&apos;s handicap strokes on the hardest holes first.</p>
      </div>

      <h2 className="px-1 pt-2 text-sm font-bold uppercase tracking-wide text-[#0f5132]">Scored and settled by the app</h2>
      {scored.map((game) => <GameCard key={game.label} game={game} />)}

      <h2 className="px-1 pt-4 text-sm font-bold uppercase tracking-wide text-slate-500">Recorded only: settle these yourselves</h2>
      <p className="px-1 text-sm text-slate-600">You can turn these on so everyone knows they&apos;re being played, but the app doesn&apos;t calculate them yet.</p>
      {classics.map((game) => <GameCard key={game.label} game={game} />)}
      {extras.length ? (
        <Card>
          <h3 className="font-bold">Also available to record</h3>
          <p className="mt-1 text-sm text-slate-600">{extras.map((game) => game.label).join(', ')}</p>
        </Card>
      ) : null}
    </section>
  );
}
