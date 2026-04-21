'use client';

import { Card } from '@/components/shared/card';
import { PressControl } from './press-control';
import { ScoreInput } from './score-input';
import { WagerControl } from './wager-control';

type Props = {
  playerName: string;
  bankerName: string;
  wager: number;
  presses: number;
  score: number | null;
  onWagerChange: (next: number) => void;
  onPress: () => void;
  onScoreChange: (next: number) => void;
};

export function MatchupCard({
  playerName,
  bankerName,
  wager,
  presses,
  score,
  onWagerChange,
  onPress,
  onScoreChange,
}: Props) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold">{playerName}</h3>
          <p className="text-sm text-slate-500">vs {bankerName}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Live matchup
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Wager</p>
          <WagerControl value={wager} onChange={onWagerChange} />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Presses</p>
          <PressControl count={presses} onPress={onPress} />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Net Score</p>
          <ScoreInput value={score} onChange={onScoreChange} />
        </div>
      </div>
    </Card>
  );
}
