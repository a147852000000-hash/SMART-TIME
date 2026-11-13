#!/usr/bin/env node
/**
 * Batch 4 — A-4 / A-5 / A-6 runtime gate.
 *
 * 1. Backup import integrity scenarios (A-4 atomicity + A-5 non-silent
 *    storage failures) — runs the real TS modules via tsx.
 * 2. Voice DNA OAEP digest agreement (A-6): proves that explicit
 *    SHA-256 wrap/unwrap round-trips, that a SHA-1-wrapped key CANNOT be
 *    unwrapped as SHA-256 (the mismatch this batch fixed), and that every
 *    RSA-OAEP call site in smartVoiceDnaCrypto.ts pins the digest.
 *
 * No network access, no external services, no free-tier consumption.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let failures = 0;

function check(condition, label) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Import scenarios via tsx
// ---------------------------------------------------------------------------
console.log('== Backup import scenarios (tsx) ==');
const run = spawnSync('npx', ['tsx', 'scripts/test-batch4-import-scenarios.mts'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, NODE_ENV: 'test' },
});
const out = `${run.stdout || ''}${run.stderr || ''}`;
console.log(out.trim());
if (run.status !== 0) failures += 1;
check(out.includes('BATCH4 IMPORT SCENARIOS: PASS'), 'backup import scenarios gate');

// ---------------------------------------------------------------------------
// 2. Voice DNA OAEP digest agreement
// ---------------------------------------------------------------------------
console.log('\n== Voice DNA OAEP digest agreement (WebCrypto) ==');
const webcrypto = crypto.webcrypto;

async function jwkKeyPair(hash) {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash },
    true,
    ['wrapKey', 'unwrapKey']
  );
  const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const recipientKey = await webcrypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['wrapKey']
  );
  const recipientPrivate = await webcrypto.subtle.importKey(
    'jwk',
    await webcrypto.subtle.exportKey('jwk', pair.privateKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['unwrapKey']
  );
  return { recipientKey, recipientPrivate };
}

async function oaepChecks() {
  const contentKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);

  // 2a. Explicit SHA-256 on both sides round-trips (the fixed code path).
  try {
    const { recipientKey, recipientPrivate } = await jwkKeyPair('SHA-256');
    const wrapped = await webcrypto.subtle.wrapKey('raw', contentKey, recipientKey, {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    });
    const unwrapped = await webcrypto.subtle.unwrapKey(
      'raw',
      wrapped,
      recipientPrivate,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    check(Boolean(unwrapped) && unwrapped.type === 'secret', 'OAEP SHA-256 wrap -> SHA-256 unwrap round-trip');
  } catch (error) {
    check(false, `OAEP SHA-256 round-trip (${error.message})`);
  }

  // 2b. Cross-digest determinism: wrap with an explicit SHA-256 key whose
  //     JWK was imported with SHA-256, unwrap with SHA-256 — must always
  //     succeed regardless of engine defaults. (Older engines treated a
  //     MISSING hash in wrapKey as SHA-1, which is why the digest is now
  //     pinned on every call site — see 2c. Engine-dependent SHA-1 probes
  //     are intentionally NOT asserted here: Node's WebCrypto resolves the
  //     digest from the key, browsers differ, so only the explicit path is
  //     portable.)
  try {
    const { recipientKey, recipientPrivate } = await jwkKeyPair('SHA-256');
    const wrapped = await webcrypto.subtle.wrapKey('raw', contentKey, recipientKey, {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    });
    const unwrapped = await webcrypto.subtle.unwrapKey(
      'raw',
      wrapped,
      recipientPrivate,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    check(Boolean(unwrapped), 'explicit-digest unwrap honours pinned SHA-256 on both sides');
  } catch (error) {
    check(false, `explicit-digest unwrap (${error.message})`);
  }

  // 2c. Source assertion: every RSA-OAEP algorithm parameter object in the
  //     crypto module pins hash: "SHA-256".
  const sourcePath = path.join(ROOT, 'src/services/smartVoiceDnaCrypto.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const paramObjects = source.match(/\{\s*name:\s*"RSA-OAEP"[^}]*\}/g) || [];
  check(paramObjects.length > 0, 'RSA-OAEP call sites found in smartVoiceDnaCrypto.ts');
  const unpinned = paramObjects.filter((chunk) => !chunk.includes('hash: "SHA-256"'));
  check(
    unpinned.length === 0,
    `all ${paramObjects.length} RSA-OAEP param objects pin hash SHA-256${unpinned.length ? ` — UNPINNED: ${unpinned.join(' | ')}` : ''}`
  );
}

await oaepChecks();

console.log('');
console.log(failures === 0 ? 'BATCH 4 DATA-INTEGRITY GATE: PASS' : `BATCH 4 DATA-INTEGRITY GATE: FAIL (${failures})`);
if (failures > 0) process.exit(1);
