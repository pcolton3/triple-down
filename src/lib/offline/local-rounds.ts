import type { HoleState, RoundState } from '@/types/round';

const ROUND_PREFIX = 'triple-track-round:';
export type RecentRound = { code: string; title: string; course: string; group: number; hole: number };
export type Correction = { id: string; roundId: string; group: number; actor: string; at: string; before: HoleState; after: HoleState; undoes?: string };
export function cacheRound(round: RoundState) {
  localStorage.setItem(`${ROUND_PREFIX}${round.roundCode.toUpperCase()}`, JSON.stringify(round));
}
export function cachedRound(code: string): RoundState | null {
  const raw = localStorage.getItem(`${ROUND_PREFIX}${code.toUpperCase()}`);
  return raw ? JSON.parse(raw) : null;
}
export function rememberRound(round: RoundState, group: number, hole: number) {
  const recent: RecentRound = { code: round.roundCode, title: round.title, course: round.courseName, group, hole };
  localStorage.setItem('triple-track-recent', JSON.stringify(recent));
}
export function readRecent(): RecentRound | null {
  const raw = localStorage.getItem('triple-track-recent');
  return raw ? JSON.parse(raw) : null;
}
export function corrections(roundId: string, group: number): Correction[] {
  return JSON.parse(localStorage.getItem(`triple-track-corrections:${roundId}:${group}`) ?? '[]');
}
export function recordCorrection(entry: Correction) {
  const key = `triple-track-corrections:${entry.roundId}:${entry.group}`;
  localStorage.setItem(key, JSON.stringify([...corrections(entry.roundId, entry.group), entry]));
}
export function describeScores(hole: HoleState, players: RoundState['players']) {
  const scores = [{ playerId: hole.bankerPlayerId, grossScore: hole.bankerGrossScore }, ...hole.matchups]
    .map((score) => `${players.find((player) => player.id === score.playerId)?.name ?? score.playerId}: ${score.grossScore ?? '—'}`).join(', ');
  const banker = players.find((player) => player.id === hole.bankerPlayerId)?.name ?? hole.bankerPlayerId;
  const bets = hole.matchups.filter((item) => item.bankerParticipant !== false).map((item) => `${players.find((player) => player.id === item.playerId)?.name ?? item.playerId} bet ${item.baseWager}${item.pressed ? ' (pressed)' : ''}`).join(', ');
  return `${scores}. Banker: ${banker}${hole.bankerPressed ? ' (pressed)' : ''}. ${bets}${hole.ctpWinnerPlayerId ? `. CTP: ${players.find((player) => player.id === hole.ctpWinnerPlayerId)?.name ?? hole.ctpWinnerPlayerId}` : ''}`;
}

/** Clears a deleted round from this phone: cached copy, "Resume your round", unsent scores, corrections. */
export function forgetRound(roundCode: string, roundId: string) {
  const code = roundCode.toUpperCase();
  localStorage.removeItem(`${ROUND_PREFIX}${code}`);
  if (readRecent()?.code.toUpperCase() === code) localStorage.removeItem('triple-track-recent');
  const doomed: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && (key.startsWith(`triple-track-pending:${roundId}:`) || key.startsWith(`triple-track-corrections:${roundId}:`) || key.startsWith(`triple-track-paid:${roundId}:`) || key === `triple-track-me:${roundId}`)) doomed.push(key);
  }
  doomed.forEach((key) => localStorage.removeItem(key));
}
