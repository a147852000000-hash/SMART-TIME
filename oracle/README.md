# Oracle single-process candidate

This directory contains a **candidate**, not a production replacement.

## What it does
- Keeps the existing Oracle JSON-backed authentication implementation as the only auth authority.
- Serves the Vite `dist/` output from the same Express process and origin.
- Returns JSON 404 for unknown `/api/*` paths rather than returning the React HTML shell.
- Does not start `server.ts`, SQLite, or a second authentication process.

## Build
From the repository root:

```bash
npm run build:oracle-web
```

This runs Vite only. Do not use the existing `npm run build` for this candidate because that also bundles the separate `server.ts` backend.

## Candidate entry point
`oracle/index.oracle.cjs` expects the project layout to remain:

- `oracle/index.oracle.cjs`
- `dist/index.html`
- `users.json`, `reset-codes.json`, and `sessions.json` in the project root (or explicit existing environment paths)

When installed under `/home/ubuntu/smart-time-ai/oracle/`, its project root resolves to `/home/ubuntu/smart-time-ai/`, preserving the current default auth data-file locations.

## Not yet complete
This first integration step only connects same-origin static hosting with the existing auth routes. It does **not** implement the app's remaining finance, AI, chat, trips, voice, settings, or other API endpoints. Those must be ported or adapted to the existing auth middleware before calling the app fully functional.

Do not copy this candidate over the live entry point, restart PM2, or change production routing until the missing API work is complete, tested, backed up, and explicitly approved.
