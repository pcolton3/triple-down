# Triple Down PWA Starter

A runnable Next.js starter for a mobile-first golf betting web app focused on the Banker game inside Triple Down.

## What is included

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zustand state store
- Banker settlement engine
- Landing page, games page, create round page, live round page, ledger page, and summary page
- Blue/gray design direction based on your reference

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`

## Main routes

- `/` home
- `/games` games grid
- `/rounds/new` create round
- `/r/BANK01` live round
- `/r/BANK01/ledger` ledger
- `/r/BANK01/summary` summary

## Notes

This starter uses in-memory demo state.

Next upgrades to add:
- Supabase persistence
- shareable round codes backed by the database
- multi-hole support
- real create-round form handling
- PWA manifest and install prompt
- permissions for friends joining from a link
