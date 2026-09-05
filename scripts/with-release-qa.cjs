// Run a command with synthetic local settings, never the workspace's live secrets.
const { readFileSync, existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const databaseUrl = process.env.RELEASE_QA_DATABASE_URL;
let target;
try { target = new URL(databaseUrl); } catch { throw new Error('Set RELEASE_QA_DATABASE_URL to the isolated local QA database.'); }
if (!['127.0.0.1', 'localhost'].includes(target.hostname)
    || target.port !== '55435' || target.pathname !== '/notenman_release_qa') {
  throw new Error('Release QA refuses any database except localhost:55435/notenman_release_qa.');
}
const commandArgs = process.argv.slice(2);
const appMode = commandArgs[0] === '--app';
if (appMode) commandArgs.shift();
const [command, ...args] = commandArgs;
if (!command) throw new Error('Pass a command and its arguments.');

const env = {};
for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData']) {
  if (process.env[key]) env[key] = process.env[key];
}
// Explicit empty values stop Next's dotenv loader from restoring live integrations.
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local', '.env.test', '.env.test.local']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) env[match[1]] = '';
  }
}
Object.assign(env, {
  DATABASE_URL: databaseUrl,
  SITE_URL: 'http://localhost:3105',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3105',
  CDN_BASE_URL: 'https://storage.googleapis.com/notenbucket',
  ADMIN_SESSION_SECRET: 'release-qa-synthetic-admin-session-secret',
  BUSINESS_SESSION_SECRET: 'release-qa-synthetic-business-session-secret',
  NODE_OPTIONS: '--max-old-space-size=4096',
  NODE_TLS_REJECT_UNAUTHORIZED: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  UNLIMITED_STOCK: 'true',
});
// Let Next/Node select their mode; empty NODE_ENV causes warnings in Next.
delete env.NODE_ENV;
if (appMode) Object.assign(env, {
  MAILCHIMP_API_KEY: 'synthetic-local-qa-not-a-real-key-us0',
  MAILCHIMP_SERVER_PREFIX: 'us0',
  MAILCHIMP_AUDIENCE_ID: 'synthetic-local-qa',
  MAILCHIMP_WEBHOOK_SECRET: 'synthetic-local-qa-webhook-secret',
});
const result = spawnSync(command === 'node' ? process.execPath : command, args, { env, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
