export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Splits a pot into whole cents in proportion to `weights` (e.g. skins won), so the shares always
 * add up to the pot exactly. Leftover cents go to the largest remainders, then to earlier entries.
 */
export function splitCents(total: number, weights: number[]): number[] {
  const totalCents = Math.round(total * 100);
  const weightSum = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (!(totalCents > 0) || !(weightSum > 0)) return weights.map(() => 0);
  const exact = weights.map((weight) => (Math.max(0, weight) * totalCents) / weightSum);
  const shares = exact.map((value) => Math.floor(value + 1e-9));
  let left = totalCents - shares.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - shares[index] }))
    .filter((item) => weights[item.index] > 0)
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; left > 0 && order.length; i = (i + 1) % order.length, left -= 1) shares[order[i].index] += 1;
  return shares.map((share) => share / 100);
}
