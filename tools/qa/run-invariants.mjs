import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
const env = { ...process.env, E2E_PORT: '4191', SCENE_PORT: '4192', E2E_UNITS: '1', E2E_ADMISSION_TIMEOUT_SECONDS: '3600' };
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
  receipts.push({ stage, code, seconds: (Date.now() - start) / 1000, revision, log });
  writeFileSync('test-results/qa-invariants/run.json', JSON.stringify(receipts, null, 2) + '\n');
  return code;
}
// A red sim check must not prevent the other invariants from being measured.
await run('remote-sim', 'npm', ['run', 'qa:invariants:sim:remote']);
if (await run('build', 'npm', ['run', 'build']) === 0) await run('Mac-WebGPU-low', 'sh', ['tools/perf/quiet-run.sh', 'sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--config=tests/qa/invariants/playwright.config.ts', '--project=chromium', '--workers=1']);
mkdirSync('test-results/qa-invariants', { recursive: true });
writeFileSync('test-results/qa-invariants/run.json', JSON.stringify(receipts, null, 2) + '\n');
console.log(JSON.stringify(receipts));
process.exitCode = receipts.some(r => r.code !== 0) ? 1 : 0;
