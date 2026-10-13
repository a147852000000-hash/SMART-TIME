const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const walletView = fs.readFileSync('src/components/WalletView.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

test('wallet UI fails closed without a configured payment target', () => {
  assert.match(walletView, /الشحن غير متاح حاليًا لعدم تفعيل وسيلة دفع معتمدة/);
  assert.doesNotMatch(walletView, /OWNER_WALLET_NUMBER|OWNER_INSTAPAY_ADDRESS|Railway/);
  assert.match(walletView, /disabled=\{!paymentTarget \|\| loading\}/);
});

test('top-up API returns a JSON unavailable response instead of accepting requests', () => {
  assert.match(server, /app\.post\(['"]\/api\/wallet\/topup-request['"]/);
  assert.match(server, /TOPUP_UNAVAILABLE/);
  assert.match(server, /status\(503\)\.json\(/);
});
