import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const env = { ...process.env, E2E_PORT: process.env.E2E_PORT ?? '4325', SCENE_PORT: process.env.SCENE_PORT ?? '4326', E2E_UNITS: '1', E2E_ADMISSION_TIMEOUT_SECONDS: '3600' };
const receipts = [];
mkdirSync('test-results/qa-invariants', { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
async function run(stage, command, args) {
  const start = Date.now();
  const log = `test-results/qa-invariants/${stage}.log`; writeFileSync(log, '');
  const code = await new Promise(resolve => {
    const child = spawn(command, args, { env, stdio: ['inherit', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { process.stdout.write(data); appendFileSync(log, data); });
    child.stderr.on('data', data => { process.stderr.write(data); appendFileSync(log, data); });
    child.on('error', error => { console.error(error); resolve(1); });
    child.on('exit', code => resolve(code ?? 1));
  });
  receipts.push({ stage, code, seconds: (Date.now() - start) / 1000, revision, log, ...(stage === 'Mac-WebGPU-low' ? { quietAdmission: process.env.QA_INVARIANTS_NO_QUIET !== '1' } : {}) });
  writeFileSync('test-results/qa-invariants/run.json', JSON.stringify(receipts, null, 2) + '\n');
  return code;
}
// A red sim check must not prevent the other invariants from being measured.
if (process.env.QA_INVARIANTS_RESUME_SIM === '1') {
  const sources = ['src', 'tests', 'public', 'tools', 'package.json', 'package-lock.json', ':(exclude)tools/qa/run-invariants.mjs'];
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...sources], { stdio: 'ignore' });
  if (execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...sources], { encoding: 'utf8' }).trim()) throw new Error('Cannot resume invariants with untracked runtime or test sources');
  const prior = JSON.parse(readFileSync('test-results/qa-invariants/run.json', 'utf8')).find(r => r.stage === 'remote-sim');
  const sim = JSON.parse(readFileSync('test-results/qa-invariants/sim.json', 'utf8'));
  if (!prior || prior.code !== 0 || prior.revision !== revision || !sim.success || sim.numFailedTests || !sim.numTotalTests || sim.numPassedTests !== sim.numTotalTests || sim.numPendingTests) throw new Error('Cannot resume invariants: no complete passing simulation receipt for this revision');
  receipts.push(prior);
  console.log(`Resuming the same-revision passing ${sim.numPassedTests}-test remote simulation receipt.`);
} else await run('remote-sim', 'npm', ['run', 'qa:invariants:sim:remote']);
// Rebuilding dist must wait for every browser using its current asset set.
// The orchestrator can defer native timing while retaining every browser assertion.
// A one-slot build is opt-in after all readers of this worktree's dist have closed. It launches no browser.
const quietAdmission = process.env.QA_INVARIANTS_NO_QUIET === '1' ? [] : ['tools/perf/quiet-run.sh', 'sh'];
if (await run('build', 'env', [`E2E_UNITS=${process.env.QA_INVARIANTS_BUILD_UNITS ?? '2'}`, 'sh', 'tools/e2e-lock.sh', 'npm', 'run', 'build:qa']) === 0) await run('Mac-WebGPU-low', 'sh', [...quietAdmission, 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--config=tests/qa/invariants/playwright.config.ts', '--project=chromium', '--workers=1']);
mkdirSync('test-results/qa-invariants', { recursive: true });
writeFileSync('test-results/qa-invariants/run.json', JSON.stringify(receipts, null, 2) + '\n');
console.log(JSON.stringify(receipts));
process.exitCode = receipts.some(r => r.code !== 0) ? 1 : 0;
