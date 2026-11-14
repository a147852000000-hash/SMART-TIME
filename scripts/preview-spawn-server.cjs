// SMART-TIME preview server launcher (sandbox).
// Starts the production build on :3000 with sandbox demo auth so the
// forgot-password code shows on screen in the preview only.
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const child = spawn('node', ['dist/server.cjs'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: '3000',
    SANDBOX_DEMO_AUTH: 'true',
    NODE_ENV: 'production',
    TRIAL_MODE: 'true',
  },
  detached: true,
  stdio: ['ignore', 'ignore', 'ignore'],
});
child.unref();
console.log('spawned pid', child.pid);
