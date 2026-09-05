const { readdirSync, mkdirSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

if (!process.env.DATABASE_URL?.includes('@127.0.0.1:55435/notenman_release_qa')) {
  throw new Error('Run through with-release-qa.cjs using the isolated QA database.');
}
const files = readdirSync('tests').filter(name => /\.test\.(ts|tsx|mjs)$/.test(name)).map(name => join('tests', name));
const result = spawnSync(process.execPath, ['--require', './scripts/test-server-only.cjs', '--import', 'tsx', '--test', '--test-concurrency=3', '--test-reporter=spec', ...files], {
  env: { ...process.env, RUN_FAQ_DB_INTEGRATION: '1' }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
});
const output = (result.stdout || '') + (result.stderr || '');
mkdirSync('.git/release-qa', { recursive: true });
writeFileSync('.git/release-qa/tests.log', output);
console.log(output.split(/\r?\n/).filter(line => /^[✖ℹ]/.test(line) || /^test at /.test(line)).map(line => line.slice(0, 500)).join('\n'));
console.log(`Full output: .git/release-qa/tests.log (${files.length} test files)`);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
