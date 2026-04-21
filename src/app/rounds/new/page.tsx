'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/shared/card';
import { Button } from '@/components/shared/button';
import { generateRoundCode } from '@/lib/utils/round-code';
import { useRoundStore } from '@/stores/round-store';

const defaultPlayers = [
  { id: 'p1', name: '', handicap: 8 },
  { id: 'p2', name: '', handicap: 10 },
  { id: 'p3', name: '', handicap: 12 },
  { id: 'p4', name: '', handicap: 9 },
];

export default function NewRoundPage() {
  const router = useRouter();
  const createRound = useRoundStore((state) => state.createRound);
  const roundCode = useMemo(() => generateRoundCode(), []);
  const [title, setTitle] = useState('Saturday Group');
  const [courseName, setCourseName] = useState('Papago Golf Club');
  const [defaultBet, setDefaultBet] = useState(5);
  const [players, setPlayers] = useState(defaultPlayers);
  const [firstBankerPlayerId, setFirstBankerPlayerId] = useState('p1');

  function updatePlayer(
    playerId: string,
    field: 'name' | 'handicap',
    value: string
  ) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              [field]: field === 'name' ? value : Number(value) || 0,
            }
          : player
      )
    );
  }

  function handleCreateRound() {
    const sanitizedPlayers = players.map((player, index) => ({
      ...player,
      name: player.name.trim() || `Player ${index + 1}`,
    }));

    createRound({
      roundCode,
      title: title.trim() || 'Saturday Group',
      courseName: courseName.trim() || 'Golf Course',
      defaultBet: Number.isFinite(defaultBet) ? Math.max(0, defaultBet) : 0,
      players: sanitizedPlayers,
      firstBankerPlayerId,
      totalHoles: 18,
    });

    router.push(`/r/${roundCode}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Create Round</h1>
          <p className="mt-2 text-slate-600">
            Set up your group before the round, then share the live round link.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-[#2f8df3]">
          Back Home
        </Link>
      </div>

      <div className="space-y-4">
        <Card className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Round Title</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Course Name</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-3"
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Default Bet</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-300 px-3 py-3"
                value={defaultBet}
                onChange={(event) => setDefaultBet(Number(event.target.value) || 0)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Holes</label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-3 bg-slate-50 text-slate-500"
                value="18"
                readOnly
              />
            </div>
          </div>
          <p className="text-sm text-slate-500">Preview share code: {roundCode}</p>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Players and Handicaps</h2>
            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={firstBankerPlayerId}
              onChange={(event) => setFirstBankerPlayerId(event.target.value)}
            >
              {players.map((player, index) => (
                <option key={player.id} value={player.id}>
                  {(player.name || `Player ${index + 1}`).trim()} starts as Banker
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {players.map((player, index) => (
              <div key={player.id} className="grid grid-cols-[1fr_96px] gap-3 rounded-2xl border border-slate-200 p-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Player Name
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    value={player.name}
                    placeholder={`Player ${index + 1}`}
                    onChange={(event) => updatePlayer(player.id, 'name', event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Handicap
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    value={player.handicap}
                    onChange={(event) => updatePlayer(player.id, 'handicap', event.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Button className="w-full" onClick={handleCreateRound}>
          Create and Open Round
        </Button>
      </div>
    </main>
  );
}
