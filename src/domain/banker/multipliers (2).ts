export function getPressBase(par: 3 | 4 | 5) {
  return par === 3 ? 3 : 2;
}

export function getPressMultiplier(par: 3 | 4 | 5, pressCount: number) {
  return Math.pow(getPressBase(par), pressCount);
}
