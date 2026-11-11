"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createPhoneOtpService, normalizePhone } = require("./phone-otp.cjs");

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-time-phone-"));
  const file = path.join(dir, "phone-otps.json");
  let time = 1_800_000_000_000;
  let sent = null;
  const service = createPhoneOtpService({
    file, secret: "test-secret-that-is-long-enough-for-hmac",
    sendCode: async (phone, code) => { sent = { phone, code }; },
    now: () => time,
    randomInt: () => 123456,
  });
  return { dir, file, service, get sent() { return sent; }, advance(ms) { time += ms; } };
}

test("normalizes Egyptian international and local phone forms", () => {
  assert.equal(normalizePhone(" +201001234567 "), "+201001234567");
  assert.equal(normalizePhone("01001234567"), "01001234567");
  assert.equal(normalizePhone("bad"), "");
});

test("issues a hashed code and verifies it once", async () => {
  const f = fixture();
  try {
    const issued = await f.service.request("+201001234567");
    assert.equal(issued.ok, true);
    assert.equal(f.sent.code, "123456");
    const stored = JSON.parse(fs.readFileSync(f.file, "utf8"));
    assert.equal(stored["+201001234567"].code, undefined);
    assert.equal(stored["+201001234567"].codeHash.length, 64);
    assert.equal(f.service.verify("+201001234567", "123456").ok, true);
    assert.equal(f.service.verify("+201001234567", "123456").ok, false);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test("enforces cooldown and five failed attempts", async () => {
  const f = fixture();
  try {
    await f.service.request("01001234567");
    assert.equal((await f.service.request("01001234567")).status, 429);
    for (let i = 0; i < 5; i++) assert.equal(f.service.verify("01001234567", "000000").ok, false);
    assert.equal(f.service.verify("01001234567", "123456").status, 429);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test("expires codes", async () => {
  const f = fixture();
  try {
    await f.service.request("01001234567");
    f.advance(5 * 60_000 + 1);
    assert.equal(f.service.verify("01001234567", "123456").status, 400);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});
