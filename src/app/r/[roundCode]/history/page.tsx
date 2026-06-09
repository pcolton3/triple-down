'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRoundStore } from '@/stores/round-store';
import { formatCurrency } from '@/lib/utils/currency';
import {
  loadSharedRoundByCode,
  replaceSharedHoleMatchups,
  sharedRoundBundleToRoundState,
  updateSharedHole,
} from '@/lib/realtime/shared-rounds';
import type { HoleState, Player, RoundState } from '@/types/round';

function formatAmount(value: number) {
  if (value > 0) return `Won ${formatCurrency(value)}`;
  if (value < 0) return `Lost ${formatCurrency(Math.abs(value))}`;
  return 'Push';
}

function ScoreTable({
  rows,
}: {
  rows: Array<{ playerId: string; playerName: string; grossTotal: number; netTotal: number }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[1fr_90px_90px] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <div>Player</div>
        <div className="text-right">Gross</div>
        <div className="text-right">Net</div>
      </div>
      {rows.map((item, index) => (
        <div key={item.playerId} className="grid grid-cols-[1fr_90px_90px] border-t border-slate-200 px-3 py-3 text-sm">
          <div className="font-medium">
            {index + 1}. {item.playerName}
          </div>
          <div className="text-right font-semibold">{item.grossTotal}</div>
          <div className="text-right font-semibold">{item.netTotal}</div>
        </div>
      ))}
    </div>
  );
}

function getPlayerGrossForHole(hole: HoleState, playerId: string) {
  if (!hole.isSaved) return null;
  if (hole.bankerPlayerId === playerId) return hole.bankerGrossScore;
  return hole.matchups.find((matchup) => matchup.playerId === playerId)?.grossScore ?? null;
}

function getScorecardHoles(round: RoundState) {
  const byHoleNumber = new Map<number, HoleState>();
  round.holes.forEach((hole) => {
    if (!byHoleNumber.has(hole.holeNumber)) {
      byHoleNumber.set(hole.holeNumber, hole);
    }
  });
  return [...byHoleNumber.values()].sort((a, b) => a.holeNumber - b.holeNumber);
}

function getPlayerHoleScore(round: RoundState, playerId: string, holeNumber: number) {
  return (
    round.holes
      .filter((hole) => hole.holeNumber === holeNumber)
      .map((hole) => getPlayerGrossForHole(hole, playerId))
      .find((score) => score != null) ?? null
  );
}

function getPlayerGroupNumber(round: RoundState, playerId: string) {
  const assignment = round.multiFoursome?.groupPlayers.find((item) => item.playerId === playerId);
  return assignment?.groupNumber ?? 1;
}

function getPlayerGroupIds(round: RoundState, groupNumber: number) {
  const assigned = round.multiFoursome?.groupPlayers
    .filter((item) => item.groupNumber === groupNumber)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.playerId);

  if (assigned && assigned.length > 0) return assigned;

  const groupSize = round.multiFoursome?.groupSize ?? 4;
  return round.players.slice((groupNumber - 1) * groupSize, groupNumber * groupSize).map((player) => player.id);
}

function getGroupHoleForPlayer(round: RoundState, playerId: string, holeNumber: number) {
  const groupNumber = getPlayerGroupNumber(round, playerId);
  return round.holes.find((hole) => (hole.groupNumber ?? 1) === groupNumber && hole.holeNumber === holeNumber) ?? null;
}

function sumScores(scores: Array<number | null>) {
  const entered = scores.filter((score): score is number => score != null);
  return entered.length > 0 ? entered.reduce((sum, score) => sum + score, 0) : null;
}

function ScorecardTable({
  round,
  players,
  editMode,
  scoreDrafts,
  onDraftChange,
}: {
  round: RoundState;
  players: Player[];
  editMode: boolean;
  scoreDrafts: Record<string, string>;
  onDraftChange: (playerId: string, holeNumber: number, value: string) => void;
}) {
  const holes = getScorecardHoles(round);
  const frontHoles = holes.filter((hole) => hole.holeNumber <= 9);
  const backHoles = holes.filter((hole) => hole.holeNumber > 9);
  const parOut = frontHoles.reduce((sum, hole) => sum + hole.par, 0);
  const parIn = backHoles.reduce((sum, hole) => sum + hole.par, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="sticky left-0 z-10 w-44 bg-slate-50 px-3 py-2 text-left">Player</th>
            {frontHoles.map((hole) => (
              <th key={hole.holeNumber} className="w-11 px-2 py-2 text-right tabular-nums">{hole.holeNumber}</th>
            ))}
            <th className="w-14 px-2 py-2 text-right tabular-nums">Out</th>
            {backHoles.map((hole) => (
              <th key={hole.holeNumber} className="w-11 px-2 py-2 text-right tabular-nums">{hole.holeNumber}</th>
            ))}
            <th className="w-14 px-2 py-2 text-right tabular-nums">In</th>
            <th className="w-16 px-2 py-2 text-right tabular-nums">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-200 bg-white text-slate-500">
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Par</th>
            {frontHoles.map((hole) => (
              <td key={hole.holeNumber} className="px-2 py-2 text-right tabular-nums">{hole.par}</td>
            ))}
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{parOut || '-'}</td>
            {backHoles.map((hole) => (
              <td key={hole.holeNumber} className="px-2 py-2 text-right tabular-nums">{hole.par}</td>
            ))}
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{parIn || '-'}</td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{parOut + parIn || '-'}</td>
          </tr>
          <tr className="border-t border-slate-200 bg-slate-50 text-slate-500">
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">Hole HCP</th>
            {frontHoles.map((hole) => (
              <td key={hole.holeNumber} className="px-2 py-2 text-right tabular-nums">{hole.handicapIndex}</td>
            ))}
            <td className="px-2 py-2 text-right tabular-nums">-</td>
            {backHoles.map((hole) => (
              <td key={hole.holeNumber} className="px-2 py-2 text-right tabular-nums">{hole.handicapIndex}</td>
            ))}
            <td className="px-2 py-2 text-right tabular-nums">-</td>
            <td className="px-2 py-2 text-right tabular-nums">-</td>
          </tr>
          {players.map((player) => {
            const frontScores = frontHoles.map((hole) => getPlayerHoleScore(round, player.id, hole.holeNumber));
            const backScores = backHoles.map((hole) => getPlayerHoleScore(round, player.id, hole.holeNumber));
            const outTotal = sumScores(frontScores);
            const inTotal = sumScores(backScores);
            const total = sumScores([...frontScores, ...backScores]);

            return (
              <tr key={player.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50/50">
                <th className="sticky left-0 z-10 max-w-44 bg-inherit px-3 py-2 text-left font-semibold">
                  <span className="block truncate">{player.name}</span>
                </th>
                {frontScores.map((score, index) => {
                  const holeNumber = frontHoles[index]?.holeNumber ?? index + 1;
                  const draftKey = `${player.id}:${holeNumber}`;
                  return (
                    <td key={`${player.id}-front-${index}`} className="px-1 py-1 text-right tabular-nums">
                      {editMode ? (
                        <input
                          className="h-8 w-11 rounded-lg border border-slate-300 px-1 text-right font-semibold tabular-nums"
                          inputMode="numeric"
                          value={scoreDrafts[draftKey] ?? ''}
                          onChange={(event) => onDraftChange(player.id, holeNumber, event.target.value)}
                        />
                      ) : (
                        <Link
                          className="inline-flex min-h-8 min-w-8 items-center justify-end rounded-lg px-2 font-semibold hover:bg-[#eaf3ff] hover:text-[#2f8df3]"
                          href={`/r/${round.roundCode}/group/${getPlayerGroupNumber(round, player.id)}?hole=${holeNumber}`}
                          title={`Edit ${player.name} hole ${holeNumber}`}
                        >
                          {score ?? '-'}
                        </Link>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{outTotal ?? '-'}</td>
                {backScores.map((score, index) => {
                  const holeNumber = backHoles[index]?.holeNumber ?? index + 10;
                  const draftKey = `${player.id}:${holeNumber}`;
                  return (
                    <td key={`${player.id}-back-${index}`} className="px-1 py-1 text-right tabular-nums">
                      {editMode ? (
                        <input
                          className="h-8 w-11 rounded-lg border border-slate-300 px-1 text-right font-semibold tabular-nums"
                          inputMode="numeric"
                          value={scoreDrafts[draftKey] ?? ''}
                          onChange={(event) => onDraftChange(player.id, holeNumber, event.target.value)}
                        />
                      ) : (
                        <Link
                          className="inline-flex min-h-8 min-w-8 items-center justify-end rounded-lg px-2 font-semibold hover:bg-[#eaf3ff] hover:text-[#2f8df3]"
                          href={`/r/${round.roundCode}/group/${getPlayerGroupNumber(round, player.id)}?hole=${holeNumber}`}
                          title={`Edit ${player.name} hole ${holeNumber}`}
                        >
                          {score ?? '-'}
                        </Link>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{inTotal ?? '-'}</td>
                <td className="px-2 py-2 text-right font-bold tabular-nums">{total ?? '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function HistoryPage() {
  const params = useParams<{ roundCode: string }>();
  const { round, hydrateRound, getHoleHistory, getGrossTotals, getSkinsSummary, getLowNetSummary, getCtpSummary } = useRoundStore();
  const [editScorecard, setEditScorecard] = useState(false);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState('');
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'not_found'>('idle');
  const history = getHoleHistory();
  const grossTotals = getGrossTotals().sort(
    (a, b) => a.grossTotal - b.grossTotal || b.holesCounted - a.holesCounted || a.playerName.localeCompare(b.playerName)
  );
  const skinsSummary = getSkinsSummary();
  const lowNetSummary = getLowNetSummary();
  const ctpSummary = getCtpSummary();
  const skinsGameEnabled = round.gameSettings?.skinsEnabled === true;
  const ctpGameEnabled = round.gameSettings?.ctpEnabled === true;
  const lowNetGameEnabled = round.gameSettings?.lowNetEnabled === true;
  const sideGameEnabled = skinsGameEnabled || ctpGameEnabled || lowNetGameEnabled;
  const routeRoundCode = params.roundCode?.toUpperCase() || round.roundCode;

  useEffect(() => {
    let cancelled = false;

    async function loadRound() {
      if (!routeRoundCode) return;
      setLoadStatus('loading');
      const bundle = await loadSharedRoundByCode(routeRoundCode);
      if (cancelled) return;
      if (!bundle) {
        setLoadStatus('not_found');
        return;
      }
      hydrateRound(sharedRoundBundleToRoundState(bundle));
      setLoadStatus('ready');
    }

    void loadRound().catch((error) => {
      console.error('Unable to load history round.', error);
      if (!cancelled) setLoadStatus('not_found');
    });

    return () => {
      cancelled = true;
    };
  }, [hydrateRound, routeRoundCode]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    round.players.forEach((player) => {
      for (let holeNumber = 1; holeNumber <= round.totalHoles; holeNumber += 1) {
        const score = getPlayerHoleScore(round, player.id, holeNumber);
        nextDrafts[`${player.id}:${holeNumber}`] = score == null ? '' : String(score);
      }
    });
    setScoreDrafts(nextDrafts);
  }, [round]);

  function updateScoreDraft(playerId: string, holeNumber: number, value: string) {
    const normalized = value.replace(/[^\d]/g, '').slice(0, 2);
    setScoreDrafts((current) => ({ ...current, [`${playerId}:${holeNumber}`]: normalized }));
  }

  async function saveScorecardChanges() {
    try {
      setSaveStatus('Saving scorecard...');
      const updates: Array<{ playerId: string; holeNumber: number; score: number | null }> = [];

      round.players.forEach((player) => {
        for (let holeNumber = 1; holeNumber <= round.totalHoles; holeNumber += 1) {
          const draftValue = scoreDrafts[`${player.id}:${holeNumber}`] ?? '';
          const draftScore = draftValue.trim() === '' ? null : Number(draftValue);
          const currentScore = getPlayerHoleScore(round, player.id, holeNumber);
          if (draftScore !== currentScore) {
            updates.push({ playerId: player.id, holeNumber, score: Number.isFinite(draftScore) ? draftScore : null });
          }
        }
      });

      if (updates.length === 0) {
        setSaveStatus('No scorecard changes to save.');
        setEditScorecard(false);
        return;
      }

      if (round.id.startsWith('round-')) {
        throw new Error('This round has not been saved to Supabase yet.');
      }

      const updatesByHole = new Map<
        string,
        {
          targetHole: HoleState;
          groupNumber: number;
          playerScores: Map<string, number | null>;
        }
      >();

      updates.forEach((update) => {
        const targetHole = getGroupHoleForPlayer(round, update.playerId, update.holeNumber);
        if (!targetHole) return;
        const groupNumber = targetHole.groupNumber ?? getPlayerGroupNumber(round, update.playerId);
        const key = `${groupNumber}:${targetHole.holeNumber}`;
        const existing = updatesByHole.get(key) ?? {
          targetHole,
          groupNumber,
          playerScores: new Map<string, number | null>(),
        };
        existing.playerScores.set(update.playerId, update.score);
        updatesByHole.set(key, existing);
      });

      for (const updateGroup of updatesByHole.values()) {
        const { targetHole, groupNumber, playerScores } = updateGroup;
        const bankerScore = playerScores.has(targetHole.bankerPlayerId)
          ? playerScores.get(targetHole.bankerPlayerId) ?? null
          : targetHole.bankerGrossScore;
        const groupPlayerIds = getPlayerGroupIds(round, groupNumber);
        const nextMatchups = groupPlayerIds
          .filter((playerId) => playerId !== targetHole.bankerPlayerId)
          .map((playerId) => {
            const existing = targetHole.matchups.find((matchup) => matchup.playerId === playerId);
            const player = round.players.find((item) => item.id === playerId);
            return {
              playerId,
              baseWager: existing?.baseWager ?? round.defaultBet,
              pressed: existing?.pressed ?? false,
              grossScore: playerScores.has(playerId) ? playerScores.get(playerId) ?? null : existing?.grossScore ?? null,
              bankerParticipant: existing?.bankerParticipant ?? player?.bankerParticipant !== false,
            };
          });

        await updateSharedHole({
          roundId: round.id,
          groupNumber,
          holeNumber: targetHole.holeNumber,
          bankerGrossScore: bankerScore,
          isSaved: true,
        });

        await replaceSharedHoleMatchups({
          roundId: round.id,
          groupNumber,
          holeNumber: targetHole.holeNumber,
          matchups: nextMatchups,
        });
      }

      const bundle = await loadSharedRoundByCode(routeRoundCode);
      if (bundle) hydrateRound(sharedRoundBundleToRoundState(bundle));
      setSaveStatus(`Saved ${updates.length} scorecard change${updates.length === 1 ? '' : 's'}.`);
      setEditScorecard(false);
    } catch (error) {
      console.error('Unable to save scorecard changes.', error);
      setSaveStatus(error instanceof Error ? error.message : 'Unable to save scorecard changes.');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hole History</h1>
          <p className="mt-2 text-slate-600">Review each updated hole by group, the Banker, matchup net scores, and hole results.</p>
        </div>
        <Link href={`/r/${round.roundCode}`} className="text-sm font-semibold text-[#2f8df3]">
          Back to Round
        </Link>
      </div>

      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        {loadStatus === 'loading' ? <p className="mb-3 text-sm text-slate-500">Loading latest round from Supabase...</p> : null}
        {loadStatus === 'not_found' ? <p className="mb-3 text-sm text-red-600">Unable to load this round from Supabase.</p> : null}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">Scorecard</h2>
          <div className="flex flex-wrap items-center gap-2">
            {saveStatus ? <span className="text-sm text-slate-500">{saveStatus}</span> : null}
            {editScorecard ? (
              <>
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                  onClick={() => setEditScorecard(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[#2f8df3] px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => void saveScorecardChanges()}
                >
                  Save Scorecard
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-xl border border-[#2f8df3] px-3 py-2 text-sm font-semibold text-[#2f8df3]"
                onClick={() => {
                  setSaveStatus('');
                  setEditScorecard(true);
                }}
              >
                Edit Scorecard
              </button>
            )}
          </div>
        </div>
        <ScorecardTable
          round={round}
          players={round.players}
          editMode={editScorecard}
          scoreDrafts={scoreDrafts}
          onDraftChange={updateScoreDraft}
        />
      </section>

      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Total Scoring</h2>
        <ScoreTable rows={grossTotals} />
      </section>

      {sideGameEnabled ? (
      <section className="mb-4 rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Side Game History</h2>

        {skinsGameEnabled ? (
        <div className="mb-4">
          <h3 className="mb-2 font-semibold">Skins by Hole</h3>
          <div className="space-y-2">
            {skinsSummary.holes.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No saved holes yet.</div>
            ) : (
              skinsSummary.holes.map((skin) => (
                <div key={skin.holeNumber} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <span>Hole {skin.holeNumber}</span>
                  <span className="font-semibold">
                    {skin.winnerName
                      ? `${skin.winnerName} won skin${skin.winningNetScore != null ? `, net ${skin.winningNetScore}` : ''}`
                      : skin.isTie
                        ? 'No skin, tied low net'
                        : 'No skin yet'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {ctpGameEnabled ? (
        <div className="mb-4">
          <h3 className="mb-2 font-semibold">Closest to the Pin</h3>
          <div className="space-y-2">
            {ctpSummary.par3Holes.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-slate-500">No par 3 holes found.</div>
            ) : (
              ctpSummary.par3Holes.map((ctp) => (
                <div key={ctp.holeNumber} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <span>Hole {ctp.holeNumber}</span>
                  <span className="font-semibold">{ctp.winnerName ?? 'No winner'}</span>
                </div>
              ))
            )}
          </div>
        </div>
        ) : null}

        {lowNetGameEnabled ? (
        <div>
          <h3 className="mb-2 font-semibold">Low Net Leaderboard</h3>
          <div className="space-y-2">
            {lowNetSummary.totals.map((item) => (
              <div key={item.playerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                <span>{item.playerName}</span>
                <span className="font-semibold">Net {item.netTotal}</span>
              </div>
            ))}
          </div>
        </div>
        ) : null}
      </section>
      ) : null}

      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="rounded-2xl border border-[#68aef7] bg-white p-4 text-slate-500 shadow-sm">
            No holes have been updated yet.
          </div>
        ) : (
          history.map((hole) => (
            <section key={`${hole.groupNumber}-${hole.holeNumber}`} className="rounded-2xl border border-[#68aef7] bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Group {hole.groupNumber} Hole {hole.holeNumber} Results</h2>
                  <p className="text-sm text-slate-500">
                    Par {hole.par} • Handicap {hole.handicapIndex} • Banker: {hole.bankerName}
                  </p>
                </div>
                <div className="text-right text-sm text-slate-500">
                  <Link
                    className="mb-2 inline-block rounded-xl border border-[#2f8df3] px-3 py-2 text-sm font-semibold text-[#2f8df3]"
                    href={`/r/${round.roundCode}/group/${hole.groupNumber}?hole=${hole.holeNumber}`}
                  >
                    Edit
                  </Link>
                  <div>Banker gross: {hole.bankerGrossScore ?? '-'}</div>
                  <div>Banker hcp: {hole.bankerHandicap}</div>
                  <div>{hole.bankerPressed ? `Banker ${hole.pressLabel}` : `No Banker ${hole.pressLabel.toLowerCase()}`}</div>
                  <div>{hole.matchups.some((matchup) => matchup.bankerGetsStroke) ? `Banker * from ${hole.matchups.filter((matchup) => matchup.bankerGetsStroke).map((matchup) => matchup.playerName).join(', ')}` : 'Banker no stroke'}</div>
                </div>
              </div>

              <div className="space-y-2">
                {hole.matchups.map((matchup) => (
                  <div key={matchup.playerId} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{matchup.playerName}{matchup.playerGetsStroke && matchup.bankerParticipant ? ' *' : ''}</p>
                        <p className="text-sm text-slate-500">
                          Bet {formatCurrency(matchup.baseWager)} • Gross {matchup.playerGrossScore ?? '-'} vs Banker {matchup.bankerGrossScore ?? '-'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {matchup.bankerParticipant ? `Net ${matchup.playerNetScore ?? '-'} vs Banker ${matchup.bankerNetScore ?? '-'}` : 'Not playing Banker'}
                          {matchup.playerGetsStroke ? ' • Player gets stroke' : ''}
                          {matchup.bankerGetsStroke ? ' • Banker gets stroke' : ''}
                          {matchup.playerPressed ? ` • Player ${hole.pressLabel}` : ''}
                          {hole.bankerPressed ? ` • Banker ${hole.pressLabel}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{matchup.bankerParticipant ? formatAmount(matchup.amount) : 'Score only'}</p>
                        <p className="text-xs text-slate-500">{matchup.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
