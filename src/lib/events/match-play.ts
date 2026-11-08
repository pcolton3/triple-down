/**
 * Ryder Cup scoring: each match is worth 1 point (½ each if halved). A match only
 * awards points once it is decided (lead > holes left) or every hole is played.
 */
export function scoreMatch(firstHoles: number, secondHoles: number, holesPlayed: number, totalHoles: number, firstName: string, secondName: string) {
  const lead = firstHoles - secondHoles;
  const remaining = Math.max(0, totalHoles - holesPlayed);
  const leader = lead > 0 ? firstName : secondName;
  const up = Math.abs(lead);
  if (holesPlayed > 0 && up > remaining) {
    return {
      firstPoints: lead > 0 ? 1 : 0,
      secondPoints: lead > 0 ? 0 : 1,
      status: remaining === 0 ? `${leader} wins ${up} up` : `${leader} wins ${up} & ${remaining}`,
    };
  }
  if (remaining === 0 && holesPlayed > 0) return { firstPoints: 0.5, secondPoints: 0.5, status: 'Halved' };
  if (holesPlayed === 0) return { firstPoints: 0, secondPoints: 0, status: 'Not started' };
  return {
    firstPoints: 0,
    secondPoints: 0,
    status: lead === 0 ? `All square thru ${holesPlayed}` : `${leader} ${up} up thru ${holesPlayed}${up === remaining ? ' (dormie)' : ''}`,
  };
}
