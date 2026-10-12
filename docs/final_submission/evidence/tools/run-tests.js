// Runs every backend/tests/*.check.js suite plus the frontend build, saving raw output per suite.
// Run with the evidence environment exported so dotenv loads nothing from a real backend/.env.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../../..');
const out = path.resolve(__dirname, '../test-runs');
fs.mkdirSync(out, { recursive: true });
const suites = fs.readdirSync(path.join(root, 'backend/tests')).filter(name => name.endsWith('.check.js')).sort()
  .map(name => ({ name, command: process.execPath, args: [`backend/tests/${name}`] }));
// The optional live mode of the concurrency suite uses its own throwaway cs_test_* database and drops it.
if (process.env.TEST_MONGO_URI) suites.push({ name: 'concurrency.check.js --live', command: process.execPath, args: ['backend/tests/concurrency.check.js', '--live'] });
suites.push({ name: 'frontend build', command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['--prefix', 'frontend', 'run', 'build'], shell: true });

const results = [];
for (const suite of suites) {
  const started = Date.now();
  const run = spawnSync(suite.command, suite.args, { cwd: root, encoding: 'utf8', shell: suite.shell, timeout: 300000 });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const file = `${suite.name.replace(/[^\w.-]+/g, '_')}.txt`;
  const text = `$ ${[path.basename(suite.command), ...suite.args].join(' ')}\n# exit ${run.status} signal ${run.signal} in ${seconds}s\n\n${run.stdout || ''}${run.stderr ? `\n--- stderr ---\n${run.stderr}` : ''}`;
  // Keep local machine paths out of the public repo.
  fs.writeFileSync(path.join(out, file), text.split(root).join('<repo>').split(os.homedir()).join('<home>'));
  results.push({ suite: suite.name, file, exit: run.status, seconds });
  console.log(run.status === 0 ? 'PASS' : 'FAIL', suite.name, `${seconds}s`);
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version,
  os: `${os.type()} ${os.release()} ${os.arch()}`, results }, null, 2));
