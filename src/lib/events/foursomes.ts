import type { DayFormat, TeamKey } from './golf-events';

/** A day's planned foursomes (signup ids) and, for singles days, who plays whom. */
export type FoursomePlan = { groups: string[][]; pairings: Array<[string, string]> };
export type PlanPlayer = { id: string; name: string; handicap: number; team: TeamKey | null };

/** Group sizes for n players: as many 4s as possible, never fewer than 3 (15 -> 4,4,4,3; 13 -> 4,3,3,3). */
export function groupSizes(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 5) return [count];
  const groups = Math.ceil(count / 4);
  const base = Math.floor(count / groups);
  const extra = count % groups;
  return Array.from({ length: groups }, (_, index) => base + (index < extra ? 1 : 0));
}

const byHandicap = (a: PlanPlayer, b: PlanPlayer) => a.handicap - b.handicap || a.name.localeCompare(b.name);

function chunk(ids: string[], sizes: number[]) {
  const groups: string[][] = [];
  let start = 0;
  for (const size of sizes) {
    groups.push(ids.slice(start, start + size));
    start += size;
  }
  return groups.filter((group) => group.length);
}

/**
 * A starting plan the organizer can adjust.
 * - Team match: every foursome is 2 v 2, with players of similar handicap in the same group.
 * - Singles: each player meets the other team's player of the same handicap rank, two matches per foursome.
 * - Other formats: groups of similar handicap.
 */
export function suggestFoursomes(format: DayFormat, players: PlanPlayer[]): FoursomePlan {
  const one = players.filter((player) => player.team === 'team_one').sort(byHandicap);
  const two = players.filter((player) => player.team === 'team_two').sort(byHandicap);
  const noTeam = players.filter((player) => !player.team).sort(byHandicap);

  if (format === 'singles_match') {
    const pairs = Math.min(one.length, two.length);
    const pairings: Array<[string, string]> = Array.from({ length: pairs }, (_, index) => [one[index].id, two[index].id]);
    const leftovers = [...one.slice(pairs), ...two.slice(pairs), ...noTeam].map((player) => player.id);
    const groups: string[][] = [];
    for (let index = 0; index < pairings.length; index += 2) groups.push([...pairings[index], ...(pairings[index + 1] ?? [])]);
    // Unpaired players join the smallest groups (they still play skins, Banker etc.).
    for (const id of leftovers) {
      const smallest = groups.length && groups.reduce((min, group) => (group.length < min.length ? group : min), groups[0]);
      if (smallest && smallest.length < 5) smallest.push(id);
      else groups.push([id]);
    }
    return { groups, pairings };
  }

  if (format === 'team_match') {
    const groups: string[][] = [];
    const take = Math.min(one.length, two.length);
    for (let index = 0; index + 1 < take; index += 2) groups.push([one[index].id, one[index + 1].id, two[index].id, two[index + 1].id]);
    // Whoever is left can't make another 2 v 2 (uneven teams). Three or more make their own group;
    // one or two join the smallest groups. The check below flags any group that isn't balanced.
    const rest = [...one.slice(groups.length * 2), ...two.slice(groups.length * 2), ...noTeam].sort(byHandicap).map((player) => player.id);
    if (rest.length >= 3) groups.push(...chunk(rest, groupSizes(rest.length)));
    else for (const id of rest) {
      const smallest = groups.reduce<string[] | null>((min, group) => (!min || group.length < min.length ? group : min), null);
      if (smallest && smallest.length < 5) smallest.push(id);
      else groups.push([id]);
    }
    return { groups, pairings: [] };
  }

  const sorted = [...players].sort(byHandicap).map((player) => player.id);
  return { groups: chunk(sorted, groupSizes(sorted.length)), pairings: [] };
}

export type PlanCheck = { problems: string[]; warnings: string[] };

/** Everything that would make the day's matches or groups not work, in plain English. */
export function checkFoursomes(format: DayFormat, players: PlanPlayer[], plan: FoursomePlan): PlanCheck {
  const problems: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(players.map((player) => [player.id, player]));
  const name = (id: string) => byId.get(id)?.name ?? 'someone';
  const groupOf = new Map<string, number>();
  plan.groups.forEach((group, index) => group.forEach((id) => {
    if (groupOf.has(id)) problems.push(`${name(id)} is in two groups.`);
    groupOf.set(id, index + 1);
  }));

  const placed = new Set(groupOf.keys());
  const missing = players.filter((player) => !placed.has(player.id));
  if (missing.length) problems.push(`Not in a group yet: ${missing.map((player) => player.name).join(', ')}.`);
  const gone = [...placed].filter((id) => !byId.has(id));
  if (gone.length) warnings.push(`${gone.length} player${gone.length === 1 ? ' is' : 's are'} no longer playing this day and will be left out.`);

  plan.groups.forEach((group, index) => {
    const ids = group.filter((id) => byId.has(id));
    if (!ids.length) return;
    if (ids.length > 5) problems.push(`Group ${index + 1} has ${ids.length} players; the most is 5.`);
    if (ids.length === 1) warnings.push(`Group ${index + 1} is just ${name(ids[0])}.`);
    if (format === 'team_match') {
      const one = ids.filter((id) => byId.get(id)?.team === 'team_one').length;
      const two = ids.filter((id) => byId.get(id)?.team === 'team_two').length;
      if (one !== two) problems.push(`Group ${index + 1} is ${one} v ${two}; a team match needs the same number from each team.`);
    }
  });

  if (format === 'team_match' || format === 'singles_match') {
    const noTeam = players.filter((player) => !player.team);
    if (noTeam.length) problems.push(`No team yet: ${noTeam.map((player) => player.name).join(', ')}.`);
  }

  if (format === 'singles_match') {
    const opponents = new Map<string, string>();
    for (const [a, b] of plan.pairings) {
      if (!byId.has(a) || !byId.has(b)) continue;
      if (opponents.has(a) || opponents.has(b)) problems.push(`${opponents.has(a) ? name(a) : name(b)} has two opponents.`);
      opponents.set(a, b);
      opponents.set(b, a);
      if (byId.get(a)?.team && byId.get(a)?.team === byId.get(b)?.team) problems.push(`${name(a)} and ${name(b)} are on the same team.`);
      if (groupOf.get(a) !== groupOf.get(b)) problems.push(`${name(a)} and ${name(b)} are matched but in different groups, so they won't play each other.`);
    }
    const unmatched = players.filter((player) => !opponents.has(player.id));
    if (unmatched.length) warnings.push(`No singles opponent: ${unmatched.map((player) => player.name).join(', ')} (they still play the other games).`);
  }
  return { problems, warnings };
}
