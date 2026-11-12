import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const server = read('../server.ts');
const database = read('../backend/database.ts');
const worker = read('../cloudflare/worker.ts');
const app = read('../src/App.tsx');
const routes = read('../src/types.ts');
const dashboard = read('../src/components/DashboardView.tsx');
const trips = read('../src/components/TripsView.tsx');
const expenseForm = read('../src/components/expenses/AddExpenseModal.tsx');
const ownerPanel = read('../src/components/OwnerAdminPanel.tsx');

const registerStart = server.indexOf("app.post('/api/auth/register'");
const registerEnd = server.indexOf("app.post('/api/auth/register/verify-phone'", registerStart);
assert.ok(registerStart >= 0 && registerEnd > registerStart, 'registration route must exist');
const registerRoute = server.slice(registerStart, registerEnd);
assert.match(registerRoute, /email===PROGRAM_OWNER_EMAIL/);
assert.ok(registerRoute.indexOf('OWNER_EMAIL_RESERVED') < registerRoute.indexOf('INSERT INTO users'), 'owner email must be rejected before insertion');

const activationStart = server.indexOf("app.post('/api/auth/owner/activate'");
const activationEnd = server.indexOf("app.post('/api/auth/phone-login/request-otp'", activationStart);
assert.ok(activationStart >= 0 && activationEnd > activationStart, 'owner activation route must exist');
const activationRoute = server.slice(activationStart, activationEnd);
assert.match(activationRoute, /authUser\(req\)/);
assert.match(activationRoute, /sessionAccountRole\(actor\)!=='owner'/);
assert.doesNotMatch(activationRoute, /activationKey|PROGRAM_OWNER_ACTIVATION_KEY/);

assert.doesNotMatch(server, /TRIP_SEARCH_COST_EGP|wallet_balance|wallet_transactions|ALLOWED_TOPUP_METHODS|OWNER_WALLET_NUMBER/);
assert.doesNotMatch(database, /CREATE TABLE IF NOT EXISTS wallet_(topups|transactions|admin_actions)/);
assert.match(database, /Legacy wallet columns\/tables.*preserved/);

assert.match(worker, /API_ORIGIN/);
assert.match(worker, /status: 503/);
assert.doesNotMatch(worker, /new URL\(["']https:\/\/smart-time-ai\.duckdns\.org/);

assert.doesNotMatch(app, /WalletView|AdminWalletPanel|admin-wallet|'wallet'/);
const appView = routes.slice(routes.indexOf('export type AppView'), routes.indexOf('export interface TickerPreferences'));
assert.doesNotMatch(appView, /'admin-wallet'|'wallet'/);
assert.doesNotMatch(dashboard, /id: 'wallet'|Smart Wallet|محفظة/);
assert.doesNotMatch(trips, /WalletService|walletBalance|tripCost|onOpenWallet|INSUFFICIENT_BALANCE|شحن الرصيد/);
assert.doesNotMatch(expenseForm, /فودافون\s*كاش|vodafone_cash/i);
assert.match(expenseForm, /محفظة إلكترونية أخرى/);

assert.match(app, /sessionRole === 'owner'/, 'owner sessions must open the owner management panel');
assert.match(app, /<OwnerAdminPanel/, 'owner panel must be mounted by the app');
assert.match(ownerPanel, /\/api\/owner\/admins\?view=users/);
assert.match(ownerPanel, /\/api\/owner\/admins\?view=admins/);
assert.match(ownerPanel, /\/api\/auth\/owner\/activate/);
assert.match(ownerPanel, /action: action/);


console.log('Auth, owner activation, wallet removal, trip comparison, and expense payment regression checks passed.');
