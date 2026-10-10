import assert from "node:assert/strict";
import { verifyTurnstileToken } from "./turnstile.js";

const originalFetch = globalThis.fetch;

try {
  {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        success: true,
        hostname: "smart-time-ai-preview-staging.up.railway.app",
        action: "smart-time-auth",
        "error-codes": [],
      }), { status: 200, headers: { "Content-Type": "application/json" } })) as any;

    const result = await verifyTurnstileToken("valid-token", "test-secret", "127.0.0.1");
    assert.equal(result.success, true);
    assert.deepEqual(result.errorCodes, []);
    assert.equal(result.action, "smart-time-auth");
  }

  {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        success: false,
        "error-codes": ["timeout-or-duplicate"],
      }), { status: 200, headers: { "Content-Type": "application/json" } })) as any;

    const result = await verifyTurnstileToken("replayed-token", "test-secret");
    assert.equal(result.success, false);
    assert.deepEqual(result.errorCodes, ["timeout-or-duplicate"]);
  }

  {
    const result = await verifyTurnstileToken("token-without-secret", "");
    assert.equal(result.success, false);
    assert.deepEqual(result.errorCodes, ["missing-secret"]);
  }

  {
    const result = await verifyTurnstileToken("x".repeat(2049), "test-secret");
    assert.equal(result.success, false);
    assert.deepEqual(result.errorCodes, ["invalid-input-response"]);
  }

  {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as any;

    const result = await verifyTurnstileToken("token", "test-secret");
    assert.equal(result.success, false);
    assert.deepEqual(result.errorCodes, ["provider-unreachable"]);
  }

  console.log("Turnstile server verification tests: PASS");
} finally {
  globalThis.fetch = originalFetch;
}
