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
