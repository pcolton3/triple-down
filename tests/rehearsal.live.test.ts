// Full Birthday Cup dress rehearsal against the real Supabase project, through the app's own code:
// copy of BDAY27's setup -> 16 signups -> teams -> Day 1 + Day 2 rounds from the event -> 4 groups
// scoring at once (one catching up late) -> every money number checked against an independent
// calculation. Deletes everything it creates. Run with:
//   RUN_LIVE_TESTS=1 npx vitest run tests/rehearsal.live.test.ts
import { afterAll, describe, expect, it } from 'vitest';
import { buildEventRoundPrefill } from '@/lib/events/event-rounds';
import { eventMoney } from '@/lib/events/event-money';
import { checkFoursomes, suggestFoursomes } from '@/lib/events/foursomes';
import {
  createGolfEvent, dayChoice, deleteGolfEvent, loadGolfEvent, loadSignups, playerBuyIn, signUp, updateEvent, updateSignup,
  type EventDraft, type GolfEvent, type Signup, type SignupChoices,
} from '@/lib/events/golf-events';
import { buildAutoSinglesPairings, buildRyderRoundSummary } from '@/lib/events/ryder';
import {
  createSharedRoundFromLocalRound, loadSharedRoundByCode, replaceSharedHoleMatchups, sharedRoundBundleToRoundState,
  updateSharedCtpResult, updateSharedHole, updateSharedHoleGameData,
} from '@/lib/realtime/shared-rounds';
import { supabase } from '@/lib/supabase/client';
import { useRoundStore } from '@/stores/round-store';
import type { HoleConfig, HoleState, RoundState } from '@/types/round';
import { settlePage } from './helpers/settle-lines';

const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4] as const;
const INDEXES = [7, 11, 15, 1, 3, 13, 17, 9, 5, 8, 18, 2, 6, 14, 10, 16, 4, 12];
const HOLES: HoleConfig[] = PARS.map((par, i) => ({ holeNumber: i + 1, par, handicapIndex: INDEXES[i] }));
const WAGER = 10;

const created: { eventCode?: string; key?: string; rounds: string[] } = { rounds: [] };
const findings: string[] = [];
const report: Record<string, unknown> = {};

// Seeded random so a failure can be replayed.
let seed = 20270424;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const PLAYERS: Array<{ name: string; handicap: number; choices?: (event: GolfEvent) => SignupChoices }> = [
  { name: 'Rehearsal Paul', handicap: 10.4 }, { name: 'Rehearsal Tim', handicap: 8.2 },
  { name: 'Rehearsal Duane', handicap: 14.6 }, { name: 'Rehearsal Rich', handicap: 0.2 },
  { name: 'Rehearsal Mike', handicap: 18.0 }, { name: 'Rehearsal Dave', handicap: 22.7 },
  { name: 'Rehearsal Steve', handicap: 5.5 }, { name: 'Rehearsal Joe', handicap: 12.1 },
  { name: 'Rehearsal Kevin', handicap: 3.9 }, { name: 'Rehearsal Brian', handicap: 16.3 },
  { name: 'Rehearsal Chris', handicap: 9.0 }, { name: 'Rehearsal Matt', handicap: 27.4 },
  { name: 'Rehearsal Greg', handicap: 7.7 }, { name: 'Rehearsal Scott', handicap: 11.8 },
  // Plays Saturday only.
  { name: 'Rehearsal Jeff', handicap: 13.5, choices: (e) => ({ days: { '1': { playing: true, games: e.days[0].games!.map((g) => g.key) }, '2': { playing: false, games: [] } } }) },
  // Skips skins and Banker both days.
  { name: 'Rehearsal Andy', handicap: 6.6, choices: (e) => ({ days: Object.fromEntries(e.days.map((d) => [String(d.day), { playing: true, games: d.games!.map((g) => g.key).filter((k) => k !== 'skins' && k !== 'banker') }])) }) },
];

/* ---------- Independent calculations (house rules), not the app's code ---------- */
const strokes = (handicap: number, index: number) => {
  const h = Math.floor(Math.max(0, handicap) + 1e-9);
  return Math.floor(h / 18) + (index <= h % 18 ? 1 : 0);
};
const gross = (hole: HoleState, id: string) => (hole.bankerPlayerId === id ? hole.bankerGrossScore : hole.matchups.find((m) => m.playerId === id)?.grossScore) ?? null;
const net = (round: RoundState, hole: HoleState, id: string) => {
  const g = gross(hole, id);
  const p = round.players.find((x) => x.id === id)!;
  return g == null ? null : g - strokes(p.handicap, hole.handicapIndex);
};

function expectedBanker(round: RoundState) {
  const totals = new Map(round.players.map((p) => [p.id, 0]));
  for (const hole of round.holes.filter((h) => h.isSaved && h.bankerGrossScore != null)) {
    const banker = round.players.find((p) => p.id === hole.bankerPlayerId)!;
    for (const m of hole.matchups) {
      const p = round.players.find((x) => x.id === m.playerId)!;
      if (m.bankerParticipant === false || p.bankerParticipant === false || m.grossScore == null) continue;
      const diff = Math.round(Math.abs(p.handicap - banker.handicap) * 10) / 10;
      const pop = hole.par !== 3 && diff >= hole.handicapIndex;
      const pNet = m.grossScore - (pop && p.handicap > banker.handicap ? 1 : 0);
      const bNet = hole.bankerGrossScore! - (pop && banker.handicap > p.handicap ? 1 : 0);
      const pressX = hole.par === 3 ? 3 : 2;
      const pBirdie = m.grossScore <= hole.par - 1;
      const bBirdie = hole.bankerGrossScore! <= hole.par - 1;
      const mult = (m.pressed ? pressX : 1) * (hole.bankerPressed ? pressX : 1) * (pBirdie !== bBirdie ? 2 : 1);
      if (pNet === bNet) continue;
      const amount = m.baseWager * mult * (pNet < bNet ? 1 : -1);
      totals.set(p.id, totals.get(p.id)! + amount);
      totals.set(banker.id, totals.get(banker.id)! - amount);
    }
  }
  return totals;
}

function expectedSkins(round: RoundState) {
  const inSkins = round.players.filter((p) => p.skinsParticipant !== false);
  const counts = new Map(inSkins.map((p) => [p.id, 0]));
  for (let n = 1; n <= 18; n += 1) {
    const nets = inSkins.flatMap((p) => {
      const hole = round.holes.find((h) => h.holeNumber === n && h.isSaved && gross(h, p.id) != null);
      return hole ? [{ id: p.id, net: net(round, hole, p.id)! }] : [];
    });
    if (!nets.length) continue;
    const low = Math.min(...nets.map((x) => x.net));
    const winners = nets.filter((x) => x.net === low);
    if (winners.length === 1) counts.set(winners[0].id, counts.get(winners[0].id)! + 1);
  }
  return counts;
}

function expectedLowNet(round: RoundState) {
  const totals = round.players.filter((p) => p.lowNetParticipant !== false).map((p) => ({
    id: p.id, total: round.holes.filter((h) => h.isSaved && gross(h, p.id) != null).reduce((sum, h) => sum + net(round, h, p.id)!, 0),
  }));
  const low = Math.min(...totals.map((t) => t.total));
  return totals.filter((t) => t.total === low).map((t) => t.id);
}

/* ---------- Driving the app like the organizer and the scorekeepers ---------- */
function roundFromPrefill(event: GolfEvent, signups: Signup[], day: number) {
  const prefill = buildEventRoundPrefill(event, signups, day);
  const roundCode = `RH${Date.now().toString(36).slice(-5).toUpperCase()}${day}`;
  useRoundStore.getState().createRound({
    roundCode,
    ryderEventCode: prefill.teamMatch ? prefill.teamMatch.eventCode : null,
    ryderEventDay: prefill.teamMatch ? prefill.teamMatch.day : null,
    title: prefill.title,
    courseName: prefill.courseName,
    defaultBet: prefill.defaultBet,
    players: prefill.players,
    firstBankerPlayerId: prefill.players[0].id,
    groupSize: 4,
    // As the round setup page does: the organizer's planned foursomes.
    groupPlayers: prefill.groupOf
      ? prefill.players.map((p) => ({ playerId: p.id, groupNumber: prefill.groupOf![p.id], sortOrder: prefill.players.filter((o) => prefill.groupOf![o.id] === prefill.groupOf![p.id]).indexOf(p) }))
      : undefined,
    totalHoles: 18,
    holesConfig: HOLES,
    gameSettings: {
      ...prefill.settings,
      teamOneName: event.team_one_name,
      teamTwoName: event.team_two_name,
      ryderCupFormat: prefill.teamMatch?.format,
    },
  });
  return { round: useRoundStore.getState().round, prefill };
}

function playHole(round: RoundState, hole: HoleState): HoleState {
  const score = (id: string) => {
    const handicap = round.players.find((p) => p.id === id)!.handicap;
    const r = rand();
    const over = r < 0.06 ? -1 : r < 0.32 ? 0 : r < 0.32 + 0.4 + handicap / 100 ? 1 : r < 0.97 ? 2 : 3;
    return Math.max(2, hole.par + over);
  };
  return {
    ...hole,
    bankerGrossScore: score(hole.bankerPlayerId),
    bankerPressed: rand() < 0.1,
    isSaved: true,
    matchups: hole.matchups.map((m) => ({ ...m, baseWager: WAGER, grossScore: score(m.playerId), pressed: rand() < 0.15 })),
  };
}

async function saveLikeAPhone(roundId: string, hole: HoleState) {
  const common = { roundId, groupNumber: hole.groupNumber ?? 1, holeNumber: hole.holeNumber };
  await updateSharedHole({ ...common, bankerPlayerKey: hole.bankerPlayerId, bankerGrossScore: hole.bankerGrossScore, bankerPressed: hole.bankerPressed, isSaved: false });
  await replaceSharedHoleMatchups({ ...common, matchups: hole.matchups });
  if (hole.par === 3) await updateSharedCtpResult({ ...common, winnerPlayerKey: hole.ctpWinnerPlayerId ?? null });
  if (hole.gameData) await updateSharedHoleGameData({ ...common, gameData: hole.gameData });
  await updateSharedHole({ ...common, isSaved: true });
}

async function playDay(event: GolfEvent, signups: Signup[], day: number) {
  const { round: local, prefill } = roundFromPrefill(event, signups, day);
  created.rounds.push(local.roundCode); // before saving, so a failed save still gets cleaned up
  const shared = await createSharedRoundFromLocalRound(local);
  // Organizer page: the day now has a round, which locks that day's picks.
  const latest = (await loadGolfEvent(event.code))!;
  await updateEvent(event.code, created.key!, { days: latest.days.map((d) => (d.day === day ? { ...d, roundCode: local.roundCode } : d)) });

  // Realistic scores. CTP the way the group runs it on the course: groups play each par 3 in tee
  // order; the first group marks its closest player, a later group marks only if it beats the mark.
  const played = local.holes.map((hole) => playHole(local, hole));
  const ctpExpected = new Map<number, string>();
  for (const holeNumber of [...new Set(played.filter((h) => h.par === 3).map((h) => h.holeNumber))]) {
    played.filter((h) => h.holeNumber === holeNumber).sort((a, b) => (a.groupNumber ?? 1) - (b.groupNumber ?? 1)).forEach((h, order) => {
      if (order === 0 || rand() < 0.4) {
        const members = [h.bankerPlayerId, ...h.matchups.map((m) => m.playerId)].filter((id) => local.players.find((p) => p.id === id)?.ctpParticipant !== false);
        const closest = members[Math.floor(rand() * members.length)];
        if (!closest) return;
        h.ctpWinnerPlayerId = closest;
        h.gameData = { ...h.gameData, ctpMarkedAt: Date.parse('2027-04-24T15:00:00Z') + (h.groupNumber ?? 1) * 600_000 + holeNumber * 60_000 };
        ctpExpected.set(holeNumber, closest);
      }
    });
  }
  const byGroup = new Map<number, HoleState[]>();
  played.forEach((h) => byGroup.set(h.groupNumber ?? 1, [...(byGroup.get(h.groupNumber ?? 1) ?? []), h]));
  const groups = [...byGroup.keys()].sort((a, b) => a - b);
  const lateGroup = groups[groups.length - 1];
  const errors: string[] = [];
  const run = (g: number) => (async () => {
    for (const hole of byGroup.get(g)!.sort((a, b) => a.holeNumber - b.holeNumber)) {
      try { await saveLikeAPhone(shared.id, hole); } catch (e) { errors.push(`G${g} H${hole.holeNumber}: ${(e as Error).message}`); }
    }
  })();
  await Promise.all(groups.filter((g) => g !== lateGroup).map(run));
  await run(lateGroup); // lost signal all round, syncs at the end

  const loaded = sharedRoundBundleToRoundState((await loadSharedRoundByCode(local.roundCode))!);
  return { local, loaded, played, prefill, errors, groups, lateGroup, ctpExpected };
}

describe.skipIf(!process.env.RUN_LIVE_TESTS)('Birthday Cup rehearsal', () => {
  afterAll(async () => {
    for (const code of created.rounds) await supabase.rpc('delete_round', { p_round_code: code, p_device_id: null });
    if (created.eventCode && created.key) await deleteGolfEvent(created.eventCode, created.key).catch((e) => console.log('EVENT CLEANUP FAILED', e));
    console.log(`cleanup: ${created.rounds.length} rounds, event ${created.eventCode}`);
    console.log('REPORT', JSON.stringify(report, null, 1));
    console.log('FINDINGS', JSON.stringify(findings, null, 1));
  });

  it('runs the whole event and every number checks out', async () => {
    const real = (await loadGolfEvent('BDAY27'))!;
    const draft: EventDraft = {
      title: 'Rehearsal (delete me)', description: 'Automated rehearsal', days: real.days.map((d) => ({ ...d, roundCode: undefined })), agenda: [],
      buy_in: real.buy_in, team_bet: real.team_bet, team_one_name: 'Saguaros', team_two_name: 'Scorpions', max_players: real.max_players,
    };
    const { code, organizerKey } = await createGolfEvent(draft);
    created.eventCode = code;
    created.key = organizerKey;
    const event = (await loadGolfEvent(code))!;

    // Signups (players' own phones), then the organizer splits teams by snake draft on handicap.
    for (const [i, p] of PLAYERS.entries()) await signUp(code, p.name, `rehearsal+${i}@example.com`, p.handicap, p.choices?.(event));
    let signups = await loadSignups(code, organizerKey);
    expect(signups).toHaveLength(PLAYERS.length);
    const byHandicap = [...signups].sort((a, b) => a.handicap - b.handicap);
    for (const [i, s] of byHandicap.entries()) await updateSignup(code, organizerKey, s.id, { team: [0, 3].includes(i % 4) ? 'team_one' : 'team_two' });
    signups = await loadSignups(code, organizerKey);

    // Buy-ins: team bet split across the 2 team days + only the pots each player joined.
    const buyIns = Object.fromEntries(signups.map((s) => [s.name.replace('Rehearsal ', ''), playerBuyIn(event, s.choices)]));
    report.buyIns = buyIns;
    expect(buyIns.Paul).toBe(300);
    expect(buyIns.Jeff).toBe(150); // Saturday only: $50 team bet + $100 pots
    expect(buyIns.Andy).toBe(200); // no skins either day: 300 - 2 x $50
    const eventLow = Math.min(...signups.map((s) => s.handicap));
    const buyInsTotal = Object.values(buyIns).reduce((a, b) => a + b, 0);

    // Organizer marks 12 of 16 buy-ins paid.
    for (const s of signups.slice(0, 12)) await updateSignup(code, organizerKey, s.id, { paid: true });
    signups = await loadSignups(code, organizerKey);

    for (const day of [1, 2]) {
      // Organizer plans the day's foursomes ahead (Suggest), checks them and saves.
      let fresh = (await loadGolfEvent(code))!;
      const dayInfo = fresh.days.find((x) => x.day === day)!;
      const playing = signups.filter((x) => dayChoice(fresh, x.choices, day).playing).map((x) => ({ id: x.id, name: x.name, handicap: x.handicap, team: x.team }));
      const plan = suggestFoursomes(dayInfo.format, playing);
      const planCheck = checkFoursomes(dayInfo.format, playing, plan);
      report[`day${day}Plan`] = { groups: plan.groups.map((g) => g.length), problems: planCheck.problems, warnings: planCheck.warnings };
      if (dayInfo.format === 'singles_match') expect(planCheck.problems, 'singles plan problems').toEqual([]);
      else if (planCheck.problems.length) findings.push(`Day ${day} plan: ${planCheck.problems.join(' ')}`);
      await updateEvent(code, organizerKey, { days: fresh.days.map((x) => (x.day === day ? { ...x, foursomes: plan } : x)) });
      fresh = (await loadGolfEvent(code))!;
      const d = await playDay(fresh, signups, day);
      const label = `day${day}`;
      expect(d.errors, `${label} save errors`).toEqual([]);
      expect(d.loaded.holes.filter((h) => h.isSaved)).toHaveLength(d.played.length);

      // Every score the phones entered is what the server has.
      const wrong = d.played.filter((p) => {
        const got = d.loaded.holes.find((h) => (h.groupNumber ?? 1) === (p.groupNumber ?? 1) && h.holeNumber === p.holeNumber)!;
        return got.bankerGrossScore !== p.bankerGrossScore || p.matchups.some((m) => {
          const gm = got.matchups.find((x) => x.playerId === m.playerId);
          return gm?.grossScore !== m.grossScore || gm?.pressed !== m.pressed || gm?.baseWager !== m.baseWager;
        });
      });
      expect(wrong, `${label} scores differ from what was entered`).toEqual([]);

      // Handicaps: everyone plays off the event low.
      const lowPlayer = d.loaded.players.find((p) => p.handicap === 0);
      expect(lowPlayer, 'event-low player plays off 0').toBeTruthy();
      const paul = d.loaded.players.find((p) => p.name === 'Rehearsal Paul')!;
      expect(paul.handicap).toBe(Math.round(10.4 - eventLow)); // whole strokes off the event low

      // Money, recomputed independently.
      const s = settlePage(d.loaded);
      const runningBanker = new Map(s.runningTotals.map((t) => [t.playerId, t.amount]));
      const banker = expectedBanker(d.loaded);
      const bankerDiffs = [...banker].filter(([id, amount]) => Math.abs((runningBanker.get(id) ?? 0) - amount) > 0.005);
      expect(bankerDiffs, `${label} banker totals`).toEqual([]);
      expect(Math.abs([...banker.values()].reduce((a, b) => a + b, 0))).toBeLessThan(0.005);

      const skinsExpected = expectedSkins(d.loaded);
      const skinsApp = s.store.getSkinsSummary();
      for (const p of skinsApp.payouts) expect(p.skins, `${label} skins for ${p.playerName}`).toBe(skinsExpected.get(p.playerId));
      const skinsPaid = skinsApp.payouts.reduce((sum, p) => sum + p.amount, 0);
      if (skinsApp.skinsWon) expect(Math.round(skinsPaid * 100)).toBe(Math.round(skinsApp.pot * 100));

      const lowApp = s.store.getLowNetSummary().payouts.filter((p) => p.amount > 0).map((p) => p.playerId).sort();
      expect(lowApp, `${label} low net winner`).toEqual(expectedLowNet(d.loaded).sort());

      const ctp = s.store.getCtpSummary();
      const ctpPaid = ctp.payouts.reduce((sum, p) => sum + p.amount, 0);
      expect(Math.round(ctpPaid * 100), `${label} CTP pot fully paid`).toBe(Math.round(ctp.pot * 100));
      // The latest mark on each par 3 wins, even though the last group synced late.
      for (const item of ctp.par3Holes) expect(item.winnerPlayerId, `${label} CTP hole ${item.holeNumber}`).toBe(d.ctpExpected.get(item.holeNumber) ?? null);

      // Pots match what the buy-ins collected for the day.
      const dayPots = (fresh.days[day - 1].games ?? []).filter((g) => g.amount > 0);
      const inGame = (key: string) => d.loaded.players.filter((p) => ({ skins: p.skinsParticipant, ctp: p.ctpParticipant, low_net: p.lowNetParticipant } as Record<string, boolean | undefined>)[key] !== false).length;
      for (const g of dayPots) {
        const pot = { skins: skinsApp.pot, ctp: ctp.pot, low_net: s.store.getLowNetSummary().pot }[g.key as 'skins' | 'ctp' | 'low_net'];
        expect(pot, `${label} ${g.key} pot`).toBe(g.amount * inGame(g.key));
      }

      // Ryder Cup: teams balanced in each foursome (Day 1) / opponents in the same foursome (Day 2).
      const ryder = buildRyderRoundSummary(d.loaded);
      const team = (id: string) => d.loaded.gameSettings.teamAssignments?.[id];
      const groupOf = (id: string) => d.loaded.multiFoursome?.groupPlayers.find((g) => g.playerId === id)?.groupNumber;
      if (day === 1) {
        const unbalanced = d.groups.filter((g) => {
          const ids = d.loaded.multiFoursome!.groupPlayers.filter((x) => x.groupNumber === g).map((x) => x.playerId);
          return ids.filter((id) => team(id) === 'team_one').length !== ids.length / 2;
        });
        if (unbalanced.length) findings.push(`Day 1 (team match): groups ${unbalanced.map((g) => `#${g}`).join(', ')} aren't 2 v 2 (uneven team sizes).`);
      } else {
        const pairings = buildAutoSinglesPairings(d.loaded, d.loaded.players);
        const apart = Object.entries(pairings).filter(([a, b]) => a < b && groupOf(a) !== groupOf(b));
        expect(apart, 'singles opponents in the same group').toEqual([]);
        expect(ryder.rows.filter((r) => r.status === 'Not started'), 'every singles match scored').toEqual([]);
        const unpaired = d.loaded.players.filter((p) => !pairings[p.id]).map((p) => p.name.replace('Rehearsal ', ''));
        if (unpaired.length) findings.push(`Day 2 (singles): ${unpaired.join(', ')} had no opponent (odd number per team).`);
      }
      report[label] = {
        round: d.loaded.roundCode, groups: d.groups.length, playersPerGroup: d.groups.map((g) => d.loaded.multiFoursome!.groupPlayers.filter((x) => x.groupNumber === g).length),
        holesSaved: d.loaded.holes.filter((h) => h.isSaved).length, lateGroupSynced: d.lateGroup,
        ryder: { [ryder.teamOneName]: ryder.teamOnePoints, [ryder.teamTwoName]: ryder.teamTwoPoints, matches: ryder.rows.map((r) => `${r.label}: ${r.status}`) },
        skins: skinsApp.payouts.filter((p) => p.skins).map((p) => `${p.playerName.replace('Rehearsal ', '')} ${p.skins} ($${p.amount})`),
        lowNet: s.store.getLowNetSummary().payouts.filter((p) => p.amount > 0).map((p) => `${p.playerName.replace('Rehearsal ', '')} $${p.amount}`),
        ctp: ctp.payouts.filter((p) => p.wins).map((p) => `${p.playerName.replace('Rehearsal ', '')} ${p.wins} ($${p.amount})`),
        bankerTransfers: s.transfers.length,
        bankerBiggest: [...banker].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map(([id, amt]) => `${d.loaded.players.find((p) => p.id === id)!.name.replace('Rehearsal ', '')} ${amt > 0 ? '+' : ''}${amt}`),
      };

      // Day locked: a player changing that day's picks after the round started is ignored.
      if (day === 1) {
        const jeff = signups.find((x) => x.name === 'Rehearsal Jeff')!;
        await signUp(code, jeff.name, `rehearsal+14@example.com`, jeff.handicap, { days: { '1': { playing: false, games: [] }, '2': { playing: false, games: [] } } }).catch(() => undefined);
        const after = (await loadSignups(code, organizerKey)).find((x) => x.id === jeff.id)!;
        expect(after.choices?.days?.['1']?.playing, 'Day 1 picks locked once its round started').not.toBe(false);
        signups = await loadSignups(code, organizerKey);
      }
    }

    // End of the event: the organizer's money summary must balance.
    const final = (await loadGolfEvent(code))!;
    const dayRounds = await Promise.all(final.days.map(async (x) => ({ day: x.day, round: x.roundCode ? sharedRoundBundleToRoundState((await loadSharedRoundByCode(x.roundCode))!) : null })));
    const m = eventMoney(final, signups, dayRounds);
    const allPots = dayRounds.reduce((sum, x) => {
      const st = settlePage(x.round!).store;
      return sum + st.getSkinsSummary().payouts.reduce((a, p) => a + p.amount, 0) + st.getCtpSummary().payouts.reduce((a, p) => a + p.amount, 0) + st.getLowNetSummary().payouts.reduce((a, p) => a + p.amount, 0);
    }, 0);
    expect(m.cup.final).toBe(true);
    expect(m.unmatched).toEqual([]);
    expect(m.teamBetPot).toBe(1550);
    expect(m.totals.teamBetPaid).toBeCloseTo(1550, 2);
    expect(m.totals.potsPaid).toBeCloseTo(allPots, 2);
    expect(m.totals.buyInsDue).toBeCloseTo(buyInsTotal, 2);
    expect(m.totals.left).toBeCloseTo(m.totals.buyInsDue - m.totals.potsPaid - m.totals.teamBetPaid, 2);
    if (m.cup.leader !== 'tie') for (const row of m.rows) expect(row.teamBetWon > 0, `${row.name} team bet`).toBe(row.team === m.cup.leader);
    report.eventMoney = {
      cup: m.cup, teamBetPot: m.teamBetPot, totals: m.totals,
      payouts: [...m.rows].sort((a, b) => b.net - a.net).map((r) => `${r.name.replace('Rehearsal ', '')}: pots ${r.potTotal}, team bet ${r.teamBetWon}${r.paid ? '' : `, owes ${r.buyIn}`} -> ${r.net}`),
    };
  }, 900_000);
});
