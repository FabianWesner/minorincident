// Test budget (docs/qa/test-strategy.md, PO 10-27): the suite must not regrow.
// Usage: node tools/qa/test-budget.mjs [--name test] [--max-seconds 240] [-- <command...>]
// 1. Counts test files under tests/ and the collected test cases (Vitest, all projects; Playwright e2e, perf and the
//    QA-invariant browser config). Fails above 150 cases or 45 files.
// 2. With a command, runs it and fails when it exits non-zero or takes longer than --max-seconds (default 240 s).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parsePlaywrightTotal } from './test-budget-count.mjs';

export const LIMITS = { cases: 150, files: 45 };
const argv = process.argv.slice(2), split = argv.indexOf('--');
const options = split < 0 ? argv : argv.slice(0, split), command = split < 0 ? [] : argv.slice(split + 1);
const option = (name, fallback) => { const i = options.indexOf(`--${name}`); return i < 0 ? fallback : options[i + 1]; };
const name = option('name', 'test'), maxSeconds = Number(option('max-seconds', '240'));
if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) throw new Error('--max-seconds must be finite and positive');
const started = performance.now();
let activeChild, cancelled;
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => {
  cancelled ??= signal;
  activeChild?.kill(signal);
});

function testFiles(dir = 'tests') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : testFiles(path);
    return /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}
async function bounded(cmd, args, options) {
  if (cancelled) throw new Error(`${name} cancelled by ${cancelled}`);
  const remaining = maxSeconds - (performance.now() - started) / 1000;
  if (remaining <= 0) throw new Error(`${name} exhausted its ${maxSeconds}s budget during collection`);
  // Existing owned-process watchdog forwards cancellation and kills descendants
  // that ignore TERM; spawnSync's timeout alone can leave those children alive.
  const executable = cmd === 'node' ? process.execPath : cmd;
  const path = [dirname(process.execPath), options.env?.PATH ?? process.env.PATH].filter(Boolean).join(delimiter);
  const env = { ...process.env, ...options.env, PATH: path, MI_TEST_BUDGET_PROCESS_PID: String(process.pid) };
  const child = spawn('python3', ['tools/browser-job.py', '--seconds', String(Math.ceil(remaining)), '--', executable, ...args], {
    ...options, env,
  });
  activeChild = child;
  let stdout = '', stderr = '';
  child.stdout?.on('data', data => { stdout += data; });
  child.stderr?.on('data', data => { stderr += data; });
  try {
    return await new Promise(resolve => {
      child.once('error', error => resolve({ status: null, error, stdout, stderr }));
      child.once('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
    });
  } finally { activeChild = undefined; }
}
async function run(cmd, args) {
  const result = await bounded(cmd, args, { env: { ...process.env, FORCE_COLOR: '0' } });
  if (result.error || result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed${result.error ? `: ${result.error.message}` : ''}:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
async function vitestCases() {
  const dir = mkdtempSync(join(tmpdir(), 'mi-test-budget-')), out = join(dir, 'list.json');
  try {
    // Bypass npx's shim process: if Vitest outlives the wrapper during a budget
    // timeout, it can be reparented before browser-job's descendant sweep sees it.
    await run(process.execPath, [process.env.MI_TEST_BUDGET_VITEST_CLI ?? 'node_modules/vitest/vitest.mjs', 'list', `--json=${out}`, '--configLoader', 'runner']);
    const listed = JSON.parse(readFileSync(out, 'utf8'));
    if (!Array.isArray(listed)) throw new Error('Vitest collection did not report a test array');
    return listed.length;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
async function playwrightCases(args) {
  const cli = process.env.MI_TEST_BUDGET_PLAYWRIGHT_CLI;
  try { return parsePlaywrightTotal(await run(cli ? process.execPath : 'npx', cli ? [cli, 'playwright', 'test', '--list', ...args] : ['playwright', 'test', '--list', ...args])); }
  catch (error) { throw new Error(`${error instanceof Error ? error.message : String(error)} (${args.join(' ')})`); }
}

let files, counts, cases, failures = [];
try {
  files = testFiles();
  counts = {
    vitest: await vitestCases(),
    e2e: await playwrightCases(['--project=chromium', '--project=perf']),
    invariantsBrowser: await playwrightCases(['--config=tests/qa/invariants/playwright.config.ts']),
  };
  cases = counts.vitest + counts.e2e + counts.invariantsBrowser;
  if (cases > LIMITS.cases) failures.push(`${cases} test cases exceed the budget of ${LIMITS.cases}`);
  if (files.length > LIMITS.files) failures.push(`${files.length} test files exceed the budget of ${LIMITS.files}`);
  console.log(`[test-budget] ${cases}/${LIMITS.cases} test cases (${JSON.stringify(counts)}), ${files.length}/${LIMITS.files} files`);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  files ??= [];
  counts ??= { vitest: 0, e2e: 0, invariantsBrowser: 0 };
  cases ??= 0;
}

const collectionSeconds = (performance.now() - started) / 1000;
if (collectionSeconds > maxSeconds) failures.push(`collection took ${collectionSeconds.toFixed(1)} s, over the ${maxSeconds} s budget`);
let receipt = { name, cases, counts, files: files.length, limits: { ...LIMITS, seconds: maxSeconds } };
if (!failures.length && command.length) {
  let result;
  try { result = await bounded(command[0], command.slice(1), { stdio: 'inherit' }); }
  catch (error) { failures.push(error.message); result = { status: 1 }; }
  const seconds = (performance.now() - started) / 1000;
  receipt = { ...receipt, command, seconds, exitCode: result.status, signal: result.signal, error: result.error?.message };
  console.log(`[test-budget] ${name}: ${seconds.toFixed(1)} s (budget ${maxSeconds} s)`);
  if (result.status !== 0) failures.push(`${name} failed (exit ${result.status ?? result.signal})`);
  if (seconds > maxSeconds) failures.push(`${name} took ${seconds.toFixed(1)} s, over the ${maxSeconds} s budget`);
}
mkdirSync('test-results/timings', { recursive: true });
writeFileSync(`test-results/timings/${name}.json`, JSON.stringify({ ...receipt, seconds: (performance.now() - started) / 1000, failures, at: new Date().toISOString() }, null, 2) + '\n');
for (const failure of failures) console.error(`[test-budget] FAIL: ${failure}`);
if (failures.length) console.error('[test-budget] See docs/qa/test-strategy.md: merge into an existing test or delete one before adding another.');
process.exitCode = cancelled ? 128 + { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[cancelled] : failures.length ? 1 : 0;
