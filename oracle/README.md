# Oracle single-process candidate

This directory contains a **candidate**, not a production replacement.

## What it does
- Keeps the existing Oracle JSON-backed authentication implementation as the only auth authority.
- Serves the Vite `dist/` output from the same Express process and origin.
- Returns JSON 404 for unknown `/api/*` paths rather than returning the React HTML shell.
- Does not start `server.ts`, SQLite, or a second authentication process.
- `auth-bridge.cjs` is a read-only adapter for validating the existing JSON session tokens; it does not issue sessions, create users, or write auth files.
- `auth-bridge.test.cjs` covers valid sessions, expiry, auth-version invalidation, suspended users, malformed tokens, and the single-owner invariant.

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

## Auth bridge validation

Run `npm run test:oracle-auth-bridge` from the repository root. Set `SMART_TIME_ORACLE_AUTH_BRIDGE=true` only when intentionally running the domain server in bridge mode. In that mode:
- `server.ts` validates bearer tokens through the existing Oracle JSON session store.
- Its legacy `/api/auth/*` credential/session lifecycle routes are blocked (HTTP 410), except read-only `GET /api/auth/me`; the Oracle candidate remains the sole login/register/reset/logout authority.
- `backend/chatServer.ts` also validates chat identity through the same bridge.

This is still **not a complete app integration**. Several domain handlers query SQLite `users` for profile, phone, activation, or wallet fields, and the chat API lists users from SQLite. Those are domain/profile dependencies, not an alternative login authority, but they need a deliberate profile/data migration or adapter before the chat and account-dependent features can work correctly. Do not enable this mode in production yet.

## Not yet complete
This first integration step only connects same-origin static hosting with the existing auth routes. It does **not** yet connect the complete finance, AI, chat, trips, voice, settings, or other API surface to Oracle. The legacy domain server also contains wallet-related code; do not mount or re-enable it. The agreed removals (Secure Vault, Welcome Gift, Wallet, and Vodafone Cash as an expense payment method) remain excluded from the Oracle candidate.

Do not copy this candidate over the live entry point, restart PM2, or change production routing until the missing API work is complete, tested, backed up, and explicitly approved.
