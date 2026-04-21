import { GameGrid } from '@/components/landing/game-grid';
import { Hero } from '@/components/landing/hero';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <GameGrid />
    </main>
  );
}
