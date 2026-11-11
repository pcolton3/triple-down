# Triple Track

A mobile-first golf event scoring app for live multi-group rounds, side games, Banker, and Ryder Cup style events.

## What is included

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zustand state store
- Banker settlement engine
- Multi-group scorekeeping
- Event leaderboard, history, setup, settle-up, and Ryder Cup event pages
- PWA manifest, service worker, and install button

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`

## Test scoring

Run the fast local scoring checks:

```bash
npm run test:scoring
```

This verifies core scoring calculations without touching Supabase.

Run the Supabase multi-scorekeeper concurrency check:

```bash
npm run test:concurrency
```

This creates a temporary test event in the configured Supabase project, saves multiple groups at the same time, reloads the round, and confirms the saved group scores did not overwrite each other.

## Main routes

- `/` home
- `/games` games grid
- `/rounds/new` create round
- `/r/BANK01` event leaderboard
- `/r/BANK01/group/1` group scoring
- `/r/BANK01/history` round history and scorecard
- `/r/BANK01/setup` round setup edits
- `/r/BANK01/settle` settle up
- `/e/RYDER1` Ryder Cup event

## Scoring without reception

Open your group scoring page once while connected, then claim scorekeeper on that device.
Scores are saved immediately to a device queue and retried while the app is open, on reconnect,
and every 15 seconds. The fixed scoring footer distinguishes pending device saves from synced
scores and includes Retry now. Keep the app open after reconnecting until it says all changes
are synced. Previously visited scoring pages can reopen offline after the service worker has
installed. The home page includes a shortcut to the most recently opened group.

Scores are never prefilled as completed: tapping either score stepper on a blank field starts
at par. Entering gross scores still drives the existing handicap and game calculations.

Past-hole edits require Save Correction. Correction history records the scorekeeper name,
time, scores, bets, presses, and CTP selection on the device that made the correction. The
latest correction can be undone if its hole has no newer local changes. This device history
is not a shared server audit log; clearing browser storage removes it and any unsynced scores.

The settlement page starts with a shareable payment summary. Banker transfers, pot payouts,
and individual hole-in-one obligations remain separate. Paid/unpaid checkmarks are device
records, not payment processing; they are specific to the round, obligation, and amount.
Expand the game details to review the original scoring calculations and finalized snapshot.

Run `npm test` for scoring and offline recovery checks, or `npm run test:offline` for just the
queue tests. These tests use local mocks and do not write to Supabase.

## Golf events and signups

Run `supabase-golf-events.sql` once in the Supabase SQL editor. It adds events, private signups,
and organizer-only functions (emails are never readable with the public key).

- `/join/CODE` — invite page: schedule, course details, agenda, buy-in breakdown, signup form, roster.
- `/join/CODE/organize#key=…` — organizer page (the key is saved on the device, then removed from
  the address bar): signups with emails, team assignment, paid tracking, open/close signups, and
  editing event details, golf days and the weekend agenda.

## Event assistant

An AI assistant (Claude Opus 5.5) on the invite page answers players' questions, and on the organizer
page also drafts changes (tee times, games, schedule, paid/teams) that only take effect when the
organizer taps Apply. Setup:

1. Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables and redeploy.
2. Run `supabase-assistant.sql` once in the Supabase SQL editor. It caps usage per event per day and
   stops the assistant once it has spent $20 in a month (also set a spend limit in the Anthropic Console).

Player emails are never sent to the model. Code: `src/app/api/assistant/route.ts`, `src/lib/assistant/`.

Ryder Cup events score 1 point per match (½ each when halved); a match counts once it is decided.
