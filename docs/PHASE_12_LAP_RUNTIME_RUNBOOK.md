# Phase 12 — Laptop Runtime Evidence Runbook

This runbook is the final runtime gate for Phase 12. It must be executed in a real browser on a machine with a microphone.

## Preconditions
- Branch: `feat/v3-next`
- Browser and exact version recorded.
- Microphone available.
- Network available for the browser STT provider.
- Do not upload raw microphone recordings to Git.

## Required cases

| ID | Action | Required observation |
|---|---|---|
| ar-eg | Open voice search, allow microphone, speak Egyptian Arabic | `ar-EG` requested; final non-empty transcript appears |
| code-switch | Speak Egyptian Arabic with a common English phrase | final transcript reflects observed speech; no fabricated fallback |
| numbers-dates | Speak an utterance containing numbers and dates | returned final transcript contains the spoken numeric/date content |
| permission-denial | Deny microphone permission | `not-allowed` path is shown; no transcript; no AI action |
| provider-network-failure | Trigger/observe provider network failure | network/service error is shown; no transcript; no AI action |
| smart-ai-voice-conversation | Open SMART AI voice conversation, speak a multi-sentence Egyptian Arabic turn, then stop speaking | app waits for speech end, sends only the observed final transcript, SMART AI returns a response by voice, then listening resumes; no fabricated text or automatic action |

## For every case record
- timestamp
- browser name/version
- OS
- requested locale
- observed provider identity if exposed by the browser
- conversation mode status transitions: listening → processing → spoken response → listening
- result: PASS/FAIL
- short transcript excerpt only (never raw audio)
- screenshot or browser-console evidence reference when applicable

## Closure rule

Do not mark a case PASS from static code inspection. The result must come from the real browser session. Phase 12 remains IN_PROGRESS until all required cases, corpus pairing, security/reproducibility, CI, and owner sign-off are PASS.
