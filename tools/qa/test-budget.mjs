// Test budget (docs/qa/test-strategy.md, PO 10-27): the suite must not regrow.
// Usage: node tools/qa/test-budget.mjs [--name test] [--max-seconds 240] [-- <command...>]
// 1. Counts test files under tests/ and the collected test cases (Vitest, all projects; Playwright e2e, perf and the
//    QA-invariant browser config). Fails above 150 cases or 45 files.
// 2. With a command, runs it and fails when it exits non-zero or takes longer than --max-seconds (default 240 s).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

export const LIMITS = { cases: 150, files: 45 };
const argv = process.argv.slice(2), split = argv.indexOf('--');
const options = split < 0 ? argv : argv.slice(0, split), command = split < 0 ? [] : argv.slice(split + 1);
const option = (name, fallback) => { const i = options.indexOf(`--${name}`); return i < 0 ? fallback : options[i + 1]; };
const name = option('name', 'test'), maxSeconds = Number(option('max-seconds', '240'));

function testFiles(dir = 'tests') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : testFiles(path);
    return /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}
function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function vitestCases() {
  const dir = mkdtempSync(join(tmpdir(), 'mi-test-budget-')), out = join(dir, 'list.json');
  try {
    run('npx', ['vitest', 'list', `--json=${out}`, '--configLoader', 'runner']);
    return JSON.parse(readFileSync(out, 'utf8')).length;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function playwrightCases(args) {
  const total = run('npx', ['playwright', 'test', '--list', ...args]).match(/Total: (\d+) tests?/);
  return total ? Number(total[1]) : 0;
}

const files = testFiles();
const counts = {
  vitest: vitestCases(),
  e2e: playwrightCases(['--project=chromium', '--project=perf']),
  invariantsBrowser: playwrightCases(['--config=tests/qa/invariants/playwright.config.ts']),
};
const cases = counts.vitest + counts.e2e + counts.invariantsBrowser;
const failures = [];
if (cases > LIMITS.cases) failures.push(`${cases} test cases exceed the budget of ${LIMITS.cases}`);
if (files.length > LIMITS.files) failures.push(`${files.length} test files exceed the budget of ${LIMITS.files}`);
console.log(`[test-budget] ${cases}/${LIMITS.cases} test cases (${JSON.stringify(counts)}), ${files.length}/${LIMITS.files} files`);

let receipt = { name, cases, counts, files: files.length, limits: { ...LIMITS, seconds: maxSeconds } };
if (!failures.length && command.length) {
  const start = performance.now(), result = spawnSync(command[0], command.slice(1), { stdio: 'inherit' });
  const seconds = (performance.now() - start) / 1000;
  receipt = { ...receipt, command, seconds, exitCode: result.status, signal: result.signal };
  console.log(`[test-budget] ${name}: ${seconds.toFixed(1)} s (budget ${maxSeconds} s)`);
  if (result.status !== 0) failures.push(`${name} failed (exit ${result.status ?? result.signal})`);
  if (seconds > maxSeconds) failures.push(`${name} took ${seconds.toFixed(1)} s, over the ${maxSeconds} s budget`);
}
mkdirSync('test-results/timings', { recursive: true });
writeFileSync(`test-results/timings/${name}.json`, JSON.stringify({ ...receipt, failures, at: new Date().toISOString() }, null, 2) + '\n');
for (const failure of failures) console.error(`[test-budget] FAIL: ${failure}`);
if (failures.length) console.error('[test-budget] See docs/qa/test-strategy.md: merge into an existing test or delete one before adding another.');
process.exitCode = failures.length ? 1 : 0;
