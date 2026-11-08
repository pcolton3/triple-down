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
