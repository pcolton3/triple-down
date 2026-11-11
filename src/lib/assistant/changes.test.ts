import { describe, expect, it } from 'vitest';
import { PLANNER_REPLY_SCHEMA, draftFromWire, draftOutline, planChanges, type AssistantChange } from '@/lib/assistant/changes';
import type { GolfEvent, Signup } from '@/lib/events/golf-events';

const event: GolfEvent = {
  id: 'e1',
  code: 'BDAY27',
  title: 'Birthday Cup 2027',
  description: 'Two days at the Wigwam.',
  days: [
    { day: 1, date: '2027-04-24', format: 'team_match', course: 'Wigwam Gold', games: [{ key: 'ctp', amount: 50 }, { key: 'skins', amount: 50 }] },
    { day: 2, date: '2027-04-25', format: 'team_match', course: 'Wigwam Gold', games: [{ key: 'ctp', amount: 50 }, { key: 'skins', amount: 50 }], roundCode: 'ABC123' },
  ],
  agenda: [{ id: 'dinner', date: '2027-04-24', time: '18:30', title: 'Dinner', location: "Fleming's" }],
  buy_in: 300,
  team_bet: 100,
  ctp_per_day: 0,
  skins_per_day: 0,
  team_one_name: 'Team One',
  team_two_name: 'Team Two',
  signups_open: true,
  max_players: null,
};

const signups: Signup[] = [
  { id: 's1', name: 'Paul', email: 'p@example.com', handicap: 10, team: null, paid: false, created_at: '2026-11-11T00:00:00Z' },
];

const updateDay = (patch: Partial<Extract<AssistantChange, { op: 'update_day' }>>): AssistantChange => ({
  op: 'update_day', day: 1, date: null, format: null, course: null, address: null, teeTime: null, website: null, notes: null, ...patch,
});

describe('planChanges', () => {
  it('sets a tee time and leaves other fields alone', () => {
    const plan = planChanges(event, signups, [updateDay({ teeTime: '07:40' })]);
    expect(plan.problems).toEqual([]);
    expect(plan.eventPatch.days?.[0]).toMatchObject({ teeTime: '07:40', course: 'Wigwam Gold' });
    expect(plan.eventPatch.days?.[1].roundCode).toBe('ABC123');
    expect(plan.lines).toEqual(['Day 1 (Sat, Apr 24) tee time → 7:40 AM']);
  });

  it('refuses edits to a day whose round started', () => {
    const plan = planChanges(event, signups, [updateDay({ day: 2, teeTime: '08:00' })]);
    expect(plan.problems[0]).toMatch(/already started/);
    expect(plan.eventPatch.days).toBeUndefined();
  });

  it('moves the buy-in with the games when it was covering them exactly', () => {
    const plan = planChanges(event, signups, [{ op: 'set_day_games', day: 1, games: [{ key: 'ctp', amount: 50 }, { key: 'skins', amount: 50 }, { key: 'birdie_pot', amount: 20 }] }]);
    expect(plan.problems).toEqual([]);
    expect(plan.eventPatch.buy_in).toBe(320);
  });

  it('adds a schedule item and updates a player', () => {
    const plan = planChanges(event, signups, [
      { op: 'add_agenda_item', date: '2027-04-25', time: '17:00', title: 'Awards', location: '', address: '', link: '', notes: '' },
      { op: 'update_player', signup_id: 's1', paid: true, team: 'team_one', handicap: null },
    ]);
    expect(plan.problems).toEqual([]);
    expect(plan.eventPatch.agenda?.map((item) => item.title)).toEqual(['Dinner', 'Awards']);
    expect(plan.signupPatches).toEqual([{ id: 's1', name: 'Paul', patch: { paid: true, team: 'team_one' } }]);
  });

  it('rejects unknown ids and bad times', () => {
    const plan = planChanges(event, signups, [{ op: 'remove_agenda_item', id: 'nope' }, updateDay({ teeTime: '7:40am' })]);
    expect(plan.problems).toHaveLength(2);
  });

  it('accepts the one-field-per-change format the model sends', () => {
    const plan = planChanges(event, signups, [
      { op: 'set_day_field', day: 1, field: 'teeTime', value: '07:40' },
      { op: 'set_player_paid', signup_id: 's1', paid: true },
      { op: 'set_player_team', signup_id: 's1', team: 'team_two' },
      { op: 'set_max_players', value: 0 },
    ]);
    expect(plan.problems).toEqual([]);
    expect(plan.eventPatch.days?.[0].teeTime).toBe('07:40');
    expect(plan.signupPatches[0].patch).toEqual({ paid: true, team: 'team_two' });
    expect(plan.eventPatch.max_players).toBeUndefined();
  });

  it('drops no-op changes', () => {
    const plan = planChanges(event, signups, [{ op: 'set_signups_open', open: true }, updateDay({ course: 'Wigwam Gold' })]);
    expect(plan.lines).toEqual([]);
    expect(plan.eventPatch).toEqual({});
  });
});

describe('draftFromWire', () => {
  it('turns a planner plan into a valid form draft and drops bad values', () => {
    const draft = draftFromWire({
      title: ' Scottsdale Cup ', description: 'Two days.', team_one_name: '', team_two_name: 'Blue', buy_in: 150, team_bet: 50, max_players: 0,
      days: [
        { date: '2027-04-24', format: 'team_match', course: 'Troon North', address: '', teeTime: '08:10', website: '', notes: '', games: [{ key: 'skins', amount: 50 }, { key: 'skins', amount: 10 }, { key: 'made_up', amount: 5 }] },
        { date: 'next sat', format: 'weird', course: '', address: '', teeTime: '8am', website: '', notes: '', games: [] },
      ],
      agenda: [{ date: '2027-04-24', time: '18:30', title: 'Dinner', location: "Mastro's", address: '', link: '', notes: '' }, { date: '', time: '', title: ' ', location: '', address: '', link: '', notes: '' }],
    });
    expect(draft.title).toBe('Scottsdale Cup');
    expect(draft.team_one_name).toBe('Team 1');
    expect(draft.max_players).toBeNull();
    expect(draft.days[0]).toMatchObject({ day: 1, teeTime: '08:10', games: [{ key: 'skins', amount: 50 }] });
    expect(draft.days[1]).toMatchObject({ day: 2, date: '', format: 'casual' });
    expect(draft.days[1].teeTime).toBeUndefined();
    expect(draft.agenda).toHaveLength(1);
    expect(draftOutline(draft)[0]).toBe('Scottsdale Cup');
  });

  it('keeps the planner schema within the API union limit', () => {
    let unions = 0;
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') {
        const record = node as Record<string, unknown>;
        if (Array.isArray(record.type) || record.anyOf) unions += 1;
        Object.values(record).forEach(walk);
      }
    };
    walk(PLANNER_REPLY_SCHEMA);
    expect(unions).toBeLessThanOrEqual(16);
  });
});
