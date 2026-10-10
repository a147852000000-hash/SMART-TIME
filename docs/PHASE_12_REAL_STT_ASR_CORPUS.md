# Phase 12 — Real STT + ASR Corpus

Status: IN_PROGRESS
Branch: feat/v3-next
Phase: 12
Previous phase: 11 — FORMALLY_CLOSED
Next phase: 13 — not authorized

## Scope

Phase 12 establishes a real speech-to-text boundary and a provenance-controlled Egyptian Arabic ASR corpus. It does not claim TTS, Voice E2E, voice cloning, or ASR model training completion.

## Current baseline audit

- The previous voice UI used simulated recognition with fixed transcript text and timers.
- Phase 11 explicitly left real microphone STT out of scope.
- No Phase 12 closure record existed before this implementation.
- The approved Phase 11 voice samples remain private voice-profile assets and are not automatically training data.
- Final STT text is now routed into the SMART AI input field; no AI action is executed automatically from speech.

## Phase 12 gate

All items below must PASS before closure:

1. Real STT capture
   - browser microphone permission is requested explicitly;
   - real audio is captured from the microphone;
   - the STT engine receives live speech;
   - no hard-coded transcript or timer-driven fake transcript remains on the production voice path.

2. Egyptian Arabic routing
   - locale is ar-EG;
   - the STT request is explicitly configured for Egyptian Arabic where the provider supports it;
   - provider capability and fallback behavior are documented.

3. Transcript integrity
   - interim and final transcript states are distinct;
   - final transcript is the only value passed to the SMART AI input boundary;
   - no AI action is executed automatically from speech;
   - empty/error/cancel states are represented explicitly;
   - no fabricated transcript is generated on provider failure.

4. ASR corpus provenance
   - every corpus source has source URL, license, language/dialect, recording style, format, duration/size, and acquisition status;
   - source restrictions are preserved;
   - paid/restricted corpora are not copied into the repository without authorization;
   - public corpus audio is kept outside Git unless licensing explicitly permits it and project policy allows it.

5. Corpus quality
   - transcript/audio pairing is validated;
   - invalid or missing pairs are rejected;
   - sample rate/channel/format are recorded;
   - duplicate utterances are detectable;
   - train/validation/test speaker leakage is prevented when speaker metadata is available.

6. Privacy/security
   - microphone audio is not written to application logs;
   - raw audio is not included in prompts;
   - corpus credentials/tokens are never committed;
   - user recordings are not silently added to the training corpus;
   - consent and retention policy are explicit.

7. Reproducibility
   - corpus manifest is versioned;
   - downloaded artifacts have SHA-256 checksums;
   - preprocessing version and normalization rules are recorded;
   - STT provider/model/version is recorded for each real evaluation.

8. Behavioral evidence
   - real microphone test;
   - Egyptian Arabic utterance;
   - English code-switch utterance;
   - number/date utterance;
   - noisy/ambiguous utterance;
   - provider failure/permission denial path.

## Initial corpus candidates

- ASR-EgArbCSC: 5.5 hours, spontaneous Egyptian Arabic, 16 kHz/16-bit mono WAV + UTF-8 TXT, CC BY-NC-ND 4.0. Acquisition requires checking the provider's current access terms.
- ArzEn: 12 hours, spontaneous Egyptian Arabic-English code-switching, 6,216 utterances, recorded/transcribed/validated/segmented. Acquisition and license terms must be verified before use.
- A-SpeechDB: about 20 hours, 205 native Egyptian speakers, 16 kHz/16-bit PCM with revised transcriptions; ELRA licensed.
- Egyptian Arabic Speecon: 550 adults + 50 children, multiple environments/channels, 16 kHz/16-bit; ELRA licensed.

The first implementation may use an external/restricted corpus as a provenance reference, but the repository must not imply that restricted audio has been acquired.

## Explicit non-goals

- no ASR fine-tuning during this phase unless a separate training gate is opened and documented;
- no use of Phase 11 personal voice samples as general corpus data;
- no Phase 13 TTS implementation;
- no Phase 14 full Voice E2E closure.

## Closure invariant

Phase 13 cannot be authorized until this document, the corpus manifest, real-STT verifier, behavioral evidence, security/reproducibility evidence, CI, and owner sign-off are all PASS.


## Runtime evidence artifact

`docs/PHASE_12_RUNTIME_EVIDENCE_SCHEMA.json` is the canonical structure for the required runtime and corpus-validation evidence. It intentionally records metadata/results rather than raw microphone audio.

## STT provider capability note

The current implementation uses the browser Web Speech API `SpeechRecognition` / `webkitSpeechRecognition` boundary. Browser support is limited and provider behavior is user-agent dependent; `start()` listens to microphone input when no audio track is supplied, and documented error classes include `not-allowed`, `audio-capture`, `network`, `no-speech`, and service-denial cases. citeturn0search5turn0search6turn0search10

For Egyptian Arabic the runtime request is explicitly `ar-EG`. The project does not claim universal browser/provider support for that locale; the real runtime test must record the actual browser and observed result.

## Runtime evidence policy

The repository verifier proves the implementation contract and transcript boundary. It does not manufacture microphone evidence. Closure requires a real browser session with microphone permission and documented results for the required utterance/error cases. If the current execution environment cannot provide microphone access, Phase 12 remains open.
