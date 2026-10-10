import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const server = read("server.ts");
const modal = read("src/components/VoiceSearchModal.tsx");
const conversationModal = read("src/components/SmartAiVoiceConversationModal.tsx");
const provider = read("backend/ai/providers/groqProvider.ts");

assert.match(server, /app\.post\("\/api\/ai\/stt"/);
assert.match(server, /authUser\(req\)/);
assert.match(server, /audioBase64/);
assert.match(server, /STT_MAX_AUDIO_BYTES/);
assert.match(server, /maxBase64Chars/);
assert.match(server, /rawAudio\.replace\(\/\^data:\[\^,\]\*;base64,\/i/);

assert.match(server, /persisted: false/);
assert.match(server, /consumeSttQuota/);
assert.match(server, /groqProvider\.transcribeAudio/);
assert.match(server, /persisted: false/);

assert.match(provider, /audio\/transcriptions/);
assert.match(provider, /GROQ_STT_MODEL/);
assert.match(provider, /whisper-large-v3-turbo/);
assert.match(provider, /language/);

assert.match(modal, /navigator\.mediaDevices\.getUserMedia/);
assert.match(modal, /MediaRecorder/);
const sharedStt = read("src/services/groqSttService.ts");
assert.match(sharedStt, /apiUrl\('\/api\/ai\/stt'\)/);
assert.match(sharedStt, /authHeaders\(\)/);
assert.match(sharedStt, /audioBase64/);
assert.match(conversationModal, /MediaRecorder/);
assert.match(conversationModal, /connectLiveKitVoice/);
assert.match(conversationModal, /LiveKitVoiceSession/);
assert.match(conversationModal, /disconnectLiveKitVoice/);
assert.match(conversationModal, /turnGenerationRef/);
assert.match(conversationModal, /isLikelyDuplicate/);
assert.doesNotMatch(conversationModal, /SpeechRecognition|webkitSpeechRecognition/);
assert.doesNotMatch(modal, /SpeechRecognition|webkitSpeechRecognition/);
assert.doesNotMatch(modal, /setTimeout\([^)]*transcript|fake transcript/i);

console.log("Phase A2 Groq STT static contract: PASS");
