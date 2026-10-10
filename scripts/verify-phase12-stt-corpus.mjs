import fs from 'node:fs';

const manifestPath = 'infra/smart-voice/phase12-asr-corpus-manifest.json';
const docPath = 'docs/PHASE_12_REAL_STT_ASR_CORPUS.md';
const voicePath = 'src/components/VoiceSearchModal.tsx';
const appPath = 'src/App.tsx';
const aiPath = 'src/components/AiCenterView.tsx';
const evidenceSchemaPath = 'docs/PHASE_12_RUNTIME_EVIDENCE_SCHEMA.json';
const voiceConversationPath = 'src/components/SmartAiVoiceConversationModal.tsx';
const smartAiDemoPath = 'components/smart-ai/SmartAIDemo.tsx';
const sttClientPath = 'src/services/groqSttService.ts';

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const doc = fs.readFileSync(docPath, 'utf8');
const voice = fs.readFileSync(voicePath, 'utf8');
const app = fs.readFileSync(appPath, 'utf8');
const ai = fs.readFileSync(aiPath, 'utf8');
const evidenceSchema = JSON.parse(fs.readFileSync(evidenceSchemaPath, 'utf8'));
const voiceConversation = fs.readFileSync(voiceConversationPath, 'utf8');
const smartAiDemo = fs.readFileSync(smartAiDemoPath, 'utf8');

if (manifest.phase !== 12) throw new Error('Phase 12 manifest mismatch');
if (manifest.training_authorized_by_phase !== false) throw new Error('Phase 12 must not silently authorize training');
if (manifest.corpus_policy.raw_corpus_in_git !== false) throw new Error('Raw corpus Git policy must be false');
if (manifest.corpus_policy.user_recordings_added_to_corpus_by_default !== false) throw new Error('User recordings must not enter corpus by default');
if (manifest.stt_contract.primary_locale !== 'ar-EG') throw new Error('Primary STT locale must remain ar-EG');
if (manifest.stt_contract.fake_transcript_forbidden !== true) throw new Error('Fake transcript path must be forbidden');
if (manifest.stt_contract.timer_driven_transcript_forbidden !== true) throw new Error('Timer transcript path must be forbidden');
if (manifest.stt_contract.raw_microphone_audio_logged !== false) throw new Error('Raw microphone logging must remain disabled');
if (manifest.stt_contract.raw_microphone_audio_persisted_by_app !== false) throw new Error('Raw microphone persistence must remain disabled');

const serverPath = fs.readFileSync('server.ts', 'utf8');
const provider = fs.readFileSync('backend/ai/providers/groqProvider.ts', 'utf8');
const sttClient = fs.readFileSync('src/services/groqSttService.ts', 'utf8');

if (!serverPath.includes('app.post("/api/ai/stt"')) throw new Error('Groq STT endpoint is missing');
if (!serverPath.includes('groqProvider.transcribeAudio')) throw new Error('Groq STT provider call is missing');
if (!serverPath.includes('STT_MAX_AUDIO_BYTES')) throw new Error('STT payload limit is missing');
if (!serverPath.includes('consumeSttQuota')) throw new Error('STT quota protection is missing');
if (!serverPath.includes('persisted: false')) throw new Error('STT non-persistence contract is missing');
if (!provider.includes('/audio/transcriptions')) throw new Error('Groq Whisper transcription transport is missing');
if (!provider.includes('GROQ_STT_MODEL')) throw new Error('Groq STT model configuration is missing');
if (!provider.includes('whisper-large-v3-turbo')) throw new Error('Groq Whisper default model is missing');
if (!provider.includes('language')) throw new Error('Groq STT language routing is missing');
if (!sttClient.includes("language: 'ar'")) throw new Error('Arabic client STT routing is missing');

if (!voice.includes('MediaRecorder')) throw new Error('Real MediaRecorder implementation is missing');
if (!voice.includes('RECORDING_MAX_MS')) throw new Error('Recording duration bound is missing');
if (!voice.includes('التسجيل يُرسل للتحويل فقط ولا يتم حفظ ملف الصوت')) throw new Error('Arabic Groq STT privacy disclosure is missing');
if (voice.includes('SpeechRecognition') || voice.includes('webkitSpeechRecognition')) throw new Error('Legacy browser STT must not remain in the production voice modal');
if (voice.includes('Simulated Voice recognition speech stream')) throw new Error('Simulated voice recognition path is still present');
if (voice.includes('Compare ride prices to work')) throw new Error('Hard-coded fake transcript is still present');
if (voice.includes('console.log') || voice.includes('console.error') || voice.includes('console.warn')) throw new Error('Voice STT component must not log microphone/transcript/provider data');

if (!voiceConversation.includes('MediaRecorder')) throw new Error('SMART AI voice conversation must use MediaRecorder');
if (!voiceConversation.includes('transcribeVoiceBlob')) throw new Error('SMART AI voice conversation must use the shared Groq STT client');
if (voiceConversation.includes('SpeechRecognition') || voiceConversation.includes('webkitSpeechRecognition')) throw new Error('SMART AI voice conversation must not use browser SpeechRecognition');
if (!voiceConversation.includes('onTurnRef.current(text)')) throw new Error('Voice conversation must await the AI response boundary');
if (!voiceConversation.includes('turnGenerationRef')) throw new Error('Voice conversation must guard interrupted turns from reopening the microphone');
if (!voiceConversation.includes('onInterrupt')) throw new Error('Voice conversation must expose an explicit AI interruption boundary');
if (!voiceConversation.includes('if (!activeRef.current || generation !== turnGenerationRef.current) return;')) throw new Error('Voice conversation must guard stale turn results');
if (voiceConversation.includes('console.log') || voiceConversation.includes('console.error') || voiceConversation.includes('console.warn')) throw new Error('Voice conversation component must not log microphone/transcript/provider data');

if (!smartAiDemo.includes('SmartAiVoiceConversationModal')) throw new Error('SMART AI service demo is missing the voice conversation modal');
if (!smartAiDemo.includes('setVoiceConversationOpen(true)')) throw new Error('SMART AI service demo voice conversation entry button is missing');
if (!smartAiDemo.includes('sendMessage(undefined, transcript)')) throw new Error('SMART AI service demo must route final voice turns into its AI send boundary');

if (!evidenceSchema.required_cases || evidenceSchema.required_cases.length !== 7) throw new Error('Phase 12 runtime evidence schema is incomplete');

for (const required of [
  'Real STT capture',
  'Egyptian Arabic routing',
  'Transcript integrity',
  'ASR corpus provenance',
  'Corpus quality',
  'Privacy/security',
  'Reproducibility',
  'Behavioral evidence'
]) {
  if (!doc.includes(required)) throw new Error(`Missing Phase 12 gate: ${required}`);
}

for (const source of manifest.sources) {
  if (!source.id || !source.name || !source.language || !source.acquisition_status) {
    throw new Error('Every corpus source needs identity, language and acquisition status');
  }
}

console.log('PHASE 12 STATIC CONTRACT: PASS');

if (!smartAiDemo.includes('/api/ai/egyptian-tts')) throw new Error('SMART AI demo must use the server Egyptian TTS runtime');
if (!fs.readFileSync('server.ts', 'utf8').includes('app.post("/api/ai/egyptian-tts"')) throw new Error('Egyptian TTS endpoint is missing');
if (!fs.readFileSync('infra/smart-voice/voicetut-provider/app.py', 'utf8').includes('speaker: str = ""')) throw new Error('VoiceTuT provider must support built-in Egyptian speakers');
if (!fs.readFileSync('infra/smart-voice/voicetut-provider/app.py', 'utf8').includes('allowed_speakers')) throw new Error('VoiceTuT provider must allowlist built-in speakers');
if (!smartAiDemo.includes('speaker: "Mohamed"')) throw new Error('SMART AI must request an explicit Egyptian built-in speaker');

console.log('PHASE 12 CLOSURE: BLOCKED UNTIL REAL-STT + CORPUS + SECURITY + REPRO + BEHAVIORAL EVIDENCE PASS');
