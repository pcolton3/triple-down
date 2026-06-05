export type HandicapScore = {
  adjustedGrossScore: number;
  courseRating: number;
  slopeRating: number;
  pcc?: number;
};

export function calculateScoreDifferential(score: HandicapScore) {
  const pcc = Number.isFinite(score.pcc) ? score.pcc ?? 0 : 0;
  if (!Number.isFinite(score.adjustedGrossScore) || !Number.isFinite(score.courseRating) || !Number.isFinite(score.slopeRating)) {
    return null;
  }
  if (score.slopeRating <= 0) return null;
  return Number((((score.adjustedGrossScore - score.courseRating - pcc) * 113) / score.slopeRating).toFixed(1));
}

function handicapIndexRule(scoreCount: number) {
  if (scoreCount < 3) return null;
  if (scoreCount === 3) return { count: 1, adjustment: -2 };
  if (scoreCount === 4) return { count: 1, adjustment: -1 };
  if (scoreCount === 5) return { count: 1, adjustment: 0 };
  if (scoreCount === 6) return { count: 2, adjustment: -1 };
  if (scoreCount <= 8) return { count: 2, adjustment: 0 };
  if (scoreCount <= 11) return { count: 3, adjustment: 0 };
  if (scoreCount <= 14) return { count: 4, adjustment: 0 };
  if (scoreCount <= 16) return { count: 5, adjustment: 0 };
  if (scoreCount <= 18) return { count: 6, adjustment: 0 };
  if (scoreCount === 19) return { count: 7, adjustment: 0 };
  return { count: 8, adjustment: 0 };
}

export function calculateHandicapIndex(differentials: number[]) {
  const recent = differentials.filter(Number.isFinite).slice(0, 20);
  const rule = handicapIndexRule(recent.length);
  if (!rule) return null;

  const best = [...recent].sort((a, b) => a - b).slice(0, rule.count);
  const average = best.reduce((sum, value) => sum + value, 0) / best.length;
  return Math.min(54, Number((average + rule.adjustment).toFixed(1)));
}
