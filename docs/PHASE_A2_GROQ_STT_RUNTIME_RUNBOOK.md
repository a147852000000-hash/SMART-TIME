# Phase A2 — Groq STT Runtime Evidence Runbook

Branch: `feat/v3-next`
Runtime target: `Microphone -> MediaRecorder -> authenticated /api/ai/stt -> Groq Whisper -> transcript`
Primary application locale contract: `ar-EG`. Groq receives the supported Arabic language code `ar` plus an Egyptian-Arabic transcription prompt.

## Preconditions
- Railway staging service: `SMART-TIME-AI-PREVIEW`
- Environment: `staging`
- Branch: `feat/v3-next`
- `GROQ_API_KEY` configured server-side.
- Real microphone and browser permission available.
- Do not inject synthetic transcripts.

## Required seven runtime cases

1. **Real Egyptian Arabic microphone**
   - Allow microphone.
   - Speak naturally in Egyptian Arabic.
   - PASS: non-empty observed transcript; no fabricated text; no action executes from STT alone.

2. **Egyptian Arabic + English code-switch**
   - Speak a natural sentence containing common English terms.
   - PASS: observed English terms remain when actually spoken; no invented words.

3. **Numbers and dates**
   - Speak Egyptian Arabic containing numbers, dates and/or times.
   - PASS: observed numeric/date content is preserved sufficiently for downstream parsing.

4. **Permission denial**
   - Deny microphone permission.
   - PASS: explicit `not-allowed`/permission error; no transcript; no STT request; no action.

5. **Provider/network failure**
   - Observe or deliberately induce an STT provider/network failure in staging.
   - PASS: explicit provider/network error; no fabricated transcript; no action.

6. **Noisy/ambiguous speech**
   - Use realistic background noise or ambiguous speech.
   - PASS: record only the observed transcript, including uncertainty/empty result where applicable; never invent an action from missing speech.

7. **SMART AI voice conversation**
   - Open SMART AI voice conversation and speak one multi-sentence Egyptian Arabic turn.
   - PASS: microphone capture -> Groq STT -> final transcript -> SMART AI response; microphone remains closed while the AI responds; interruption cancels stale turn and does not duplicate the next turn.

## Evidence per case
Record:
- timestamp
- browser + version
- OS
- application build/commit
- locale
- microphone permission state
- HTTP status for STT request where applicable
- provider/model metadata if exposed
- short transcript excerpt only
- PASS/FAIL
- screenshot or console/network evidence as appropriate

Never record:
- `GROQ_API_KEY`
- Authorization bearer tokens
- raw microphone audio in Git
- full sensitive transcripts in logs

## Security checks
- Secret exists only server-side.
- Client calls only `/api/ai/stt`.
- Server requires authenticated user.
- Audio is not persisted by SMART TIME.
- Payload size and per-user rate limits are enforced.
- Provider failures do not expose secrets.

## Closure
A2 remains OPEN until all seven runtime cases have reproducible evidence, the Phase 12 external audio/corpus evidence remains valid, security/privacy checks pass, and the phase-closing CI run is green.
