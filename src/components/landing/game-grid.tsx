import { Card } from '@/components/shared/card';
import { games } from '@/lib/constants/games';

export function GameGrid() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-bold text-slate-900">Game</h2>
        <p className="mt-3 text-slate-600">
          Triple Down is currently focused on Banker only.
        </p>
      </div>
      <div className="mx-auto max-w-sm">
        {games.map((game) => (
          <Card key={game} className="py-5 text-center text-xl font-bold">
            {game}
          </Card>
        ))}
      </div>
    </section>
  );
}
