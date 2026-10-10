import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const crypto = read("src/services/smartVoiceDnaCrypto.ts");
const service = read("src/services/smartVoiceDnaService.ts");
const client = read("src/services/smartVoiceDnaClient.ts");
const server = read("server.ts");
const provider = read("backend/voice/voiceDnaProvider.ts");
const manifest = JSON.parse(read("infra/smart-voice/phase11-voice-manifest.json"));

const checks = [
  ["manifest_phase_11", manifest.phase === 11],
  ["raw_audio_git_forbidden", manifest.raw_audio_commit_policy === "FORBIDDEN"],
  ["local_aes_gcm_256", /name: "AES-GCM", length: 256/.test(service)],
  ["local_iv_12_bytes", /getRandomValues\(new Uint8Array\(12\)\)/.test(service)],
  ["local_sample_ciphertext_storage", /ciphertext/.test(service) && /SAMPLE_STORE/.test(service)],
  ["recovery_pbkdf2_sha256", /PBKDF2-SHA-256/.test(crypto) && /hash: "SHA-256"/.test(crypto)],
  ["recovery_aes_gcm", /AES-GCM/.test(crypto)],
  ["recovery_passphrase_min_12", /length < 12/.test(crypto)],
  ["recovery_rotation_deletes_old_samples", /DELETE FROM voice_dna_recovery_samples WHERE user_id=\?/.test(server)],
  ["profile_owner_authz", /owner_user_id=\? AND revoked_at IS NULL/.test(server)],
  ["synthesis_requires_consent", /consentConfirmed !== true/.test(server)],
  ["synthesis_requires_profile", /!profileId \|\| !text \|\| !referenceAudioBase64/.test(server)],
  ["synthesis_revocation_check", /FROM voice_dna_profiles WHERE id=\? AND revoked_at IS NULL/.test(server)],
  ["synthesis_owner_or_active_share", /owns = String\(profile\.ownerUserId\)/.test(server) && /const shared = Boolean/.test(server) && /status='active'/.test(server) && /if \(!owns && !shared\)/.test(server)],
  ["profile_revoke_invalidates_shares", /UPDATE voice_dna_shares SET status='revoked'/.test(server)],
  ["profile_revoke_invalidates_sync", /UPDATE voice_dna_sync_packages SET revoked_at=/.test(server)],
  ["profile_revoke_deletes_recovery_copy", /DELETE FROM voice_dna_recovery_samples WHERE user_id=\? AND profile_id=\?/.test(server)],
  ["provider_credentials_server_side", /SMART_VOICE_DNA_PROVIDER_TOKEN/.test(server) && /Authorization = "Bearer "/.test(provider)],
  ["provider_profile_id_boundary", /profileId/.test(provider)],
  ["provider_no_remote_audio_url_input", !/referenceAudioUrl|audioUrl/.test(provider)],
  ["provider_timeout", /AbortController/.test(provider)],
  ["synthesis_no_store_response", /Cache-Control.*no-store/.test(server)],
  ["client_revoke_endpoint", /profiles\/.*\/revoke/.test(client) || /profiles\//.test(client) && /revoke/.test(client)],
];

const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error("PHASE 11 SECURITY + REPRODUCIBILITY: FAIL");
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}
console.log("PHASE 11 SECURITY + REPRODUCIBILITY: PASS");
console.log(JSON.stringify({ checks: checks.length, failures: 0 }, null, 2));
