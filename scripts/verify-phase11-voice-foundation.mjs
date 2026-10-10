import fs from 'node:fs';

const specPath = 'docs/SHUBRA_VOICE_SPEC.md';
const manifestPath = 'infra/smart-voice/phase11-voice-manifest.json';

const spec = fs.readFileSync(specPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const requiredSpecTerms = [
  'Egyptian Arabic',
  'Shubra',
  'owner-approved sample package',
  'Measurable acceptance criteria',
  'Raw audio must not be committed to GitHub',
  'real microphone STT',
  'production TTS provider validation',
  'Voice → STT → AI → TTS E2E'
];

for (const term of requiredSpecTerms) {
  if (!spec.includes(term)) throw new Error(`Missing Phase 11 spec term: ${term}`);
}

if (manifest.phase !== 11) throw new Error('Manifest phase must be 11');
if (manifest.status !== 'FORMALLY_CLOSED') throw new Error('Phase 11 manifest must be formally closed');
if (manifest.sample_package.status !== 'APPROVED_OWNER_SIGNOFF') throw new Error('Approved sample package sign-off is required for closure');
if (!Array.isArray(manifest.sample_package.samples) || manifest.sample_package.samples.length !== 4) throw new Error('Exactly four approved Phase 11 samples are required');
if (manifest.profile_contract.locale !== 'ar-EG') throw new Error('Locale must be ar-EG');
if (manifest.profile_contract.dialect !== 'Egyptian/Shubra') throw new Error('Dialect must be Egyptian/Shubra');
if (manifest.profile_contract.owner_consent_required !== true) throw new Error('Owner consent must be required');
if (manifest.profile_contract.guardian_consent_required_for_child !== true) throw new Error('Guardian consent must be required for child profiles');
if (manifest.training_authorized_by_phase !== false) throw new Error('Phase 11 must not authorize training');
if (manifest.raw_audio_commit_policy !== 'FORBIDDEN') throw new Error('Raw audio Git policy must be FORBIDDEN');
for (const sample of manifest.sample_package.samples) {
  if (!sample.sha256 || !sample.duration_ms || !sample.mime_type || sample.speaker_count !== 1) {
    throw new Error(`Incomplete Phase 11 sample metadata: ${sample.sample_id}`);
  }
  if (sample.approval_status !== 'APPROVED_OWNER_SIGNOFF') throw new Error(`Unapproved Phase 11 sample: ${sample.sample_id}`);
}

const requiredTypes = new Set(manifest.sample_package.required_sample_types);
for (const type of [
  'neutral_conversational',
  'natural_shubra_conversation',
  'numbers_dates_names_code_switching',
  'spontaneous_conversation'
]) {
  if (!requiredTypes.has(type)) throw new Error(`Missing required sample type: ${type}`);
}

const requiredAcceptance = new Set(manifest.acceptance_suite.required);
for (const item of [
  'stable_profile_id',
  'ar_EG_locale',
  'egyptian_shubra_dialect_declared',
  'owner_consent_recorded',
  'sample_checksums_present',
  'sample_metadata_present',
  'raw_audio_encrypted_at_rest',
  'raw_audio_excluded_from_ai_prompts',
  'raw_audio_excluded_from_logs',
  'revocation_supported',
  'provider_credentials_server_side',
  'profile_id_required_for_personalized_synthesis'
]) {
  if (!requiredAcceptance.has(item)) throw new Error(`Missing acceptance criterion: ${item}`);
}

console.log('PHASE 11 VOICE FOUNDATION SPEC: PASS');
console.log('APPROVED SAMPLE PACKAGE: PASS');
console.log('PHASE 11 CLOSURE CONTRACT: PASS');
