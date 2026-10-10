# SMART-TIME — Phase 11 Shubra Voice Foundation Specification

Status: FORMALLY_CLOSED
Phase: 11 — Voice Foundation — Shubra Voice Specification
Branch: feat/v3-next

## Purpose

Define the approved Egyptian/Shubra voice profile contract before any real STT/TTS/E2E work begins.

Phase 11 is a specification and voice-profile foundation phase. It does not claim that real STT, production TTS, voice cloning, or Voice E2E are complete.

## Target voice characteristics

The target profile is Egyptian Arabic with a natural Shubra/Cairo conversational character.

Required linguistic characteristics:
- Egyptian Arabic as the primary language.
- Natural Egyptian vocabulary and sentence rhythm.
- Comfortable code-switching with common English product/technical terms.
- Conversational, direct, warm delivery without exaggerated announcer-style prosody.
- Clear pronunciation at normal conversational speed.
- The specification must remain provider-neutral.

## Voice-profile identity contract

Each approved profile must have:
- stable profile ID;
- owner-controlled display name;
- locale: ar-EG;
- dialect label: Egyptian/Shubra;
- explicit owner consent;
- guardian consent when the profile represents a child;
- sample inventory with per-sample checksum and metadata;
- approval status;
- creation/update timestamps;
- revocation status.

Raw audio must not be committed to GitHub.

## Approved sample package

Phase 11 requires an actual owner-approved sample package before formal closure.

The package should contain recordings that cover:
1. neutral conversational speech;
2. natural Shubra/Egyptian conversational speech;
3. a short paragraph containing numbers, dates, names, and common English terms;
4. a short spontaneous conversational sample.

Sample requirements:
- WAV preferred;
- lossless PCM;
- single speaker only;
- no background music;
- minimal room noise;
- no other person's speech;
- no private credentials, passwords, or sensitive account information;
- explicit owner approval for every sample.

The exact recordings and hashes belong in the private/encrypted voice-sample store, not GitHub.

## Measurable acceptance criteria

Phase 11 voice-profile readiness is PASS only when:

1. Profile contract
   - profile ID is stable and unique;
   - locale is ar-EG;
   - dialect is explicitly Egyptian/Shubra;
   - consent state is recorded;
   - child profiles include guardian consent.

2. Sample integrity
   - every approved sample has a checksum;
   - every sample has duration and MIME/format metadata;
   - sample inventory is reproducible without exposing raw audio;
   - no raw sample is stored in Git.

3. Recording quality
   - sample is single-speaker;
   - speech is intelligible without repeated manual interpretation;
   - no clipping or severe distortion;
   - no persistent competing speech;
   - sample is long enough to contain natural phrasing rather than isolated words.

4. Privacy/security
   - raw audio is encrypted at rest;
   - access is owner/share-policy controlled;
   - raw audio is never sent to SMART AI prompts;
   - raw audio is not written to application logs;
   - revocation is supported;
   - sample deletion/revocation has an auditable state transition.

5. Provider boundary
   - the AI/data layer sends text only to the TTS abstraction;
   - personalized synthesis requires an approved profile ID;
   - provider credentials remain server-side;
   - provider integration does not accept arbitrary remote audio URLs as authorization.

## Out of scope for Phase 11

- real microphone STT;
- ASR corpus creation;
- production TTS provider validation;
- Voice DNA cloning quality benchmark;
- full Voice → STT → AI → TTS E2E;
- training SMART AI on customer voice recordings.

Those belong to Phases 12–14 or later according to the canonical 35-phase plan.

## Closure rule

Phase 11 was formally closed after:
- this specification is committed;
- the profile/consent contract is represented in a versioned manifest;
- acceptance checks pass;
- an actual owner-approved sample package exists with hashes and metadata;
- security/privacy checks pass;
- reproducibility evidence is recorded;
- owner sign-off is recorded.

No raw audio is fabricated or committed to satisfy closure. Owner approval and the approved sample manifest are recorded in the Phase 11 closure record.
