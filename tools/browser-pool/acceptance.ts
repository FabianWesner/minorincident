import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { delay } from './host';

const out = resolve('test-results/browser-pool/acceptance'); mkdirSync(out, { recursive: true });
const env: NodeJS.ProcessEnv = { ...process.env, BROWSER_POOL_URL: 'http://127.0.0.1:4329', BROWSER_POOL_BACKEND: 'gpu', SCENE_PORT: '4321', SCENE_SERVER: 'preview' };
const children = new Set<ChildProcess>();
const receipts: { name: string; code: number; seconds: number; [key: string]: unknown }[] = [];
const start = (command: string, args: string[], extra: NodeJS.ProcessEnv = {}) => {
  const c = spawn(command, args, { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(c); c.once('exit', () => children.delete(c)); return c;
};
const ended = (c: ChildProcess) => new Promise<number>((resolve, reject) => { c.once('error', reject); c.once('exit', code => resolve(code ?? 1)); });
const stop = async (c?: ChildProcess) => { if (!c || c.exitCode !== null || c.signalCode) return; const end = ended(c); c.kill('SIGTERM'); await end; };
const up = async (url: string) => { try { return (await fetch(url, { signal: AbortSignal.timeout(500) })).ok; } catch { return false; } };
const until = async (check: () => Promise<boolean>, timeout: number, message: string) => { const end = Date.now() + timeout; while (!(await check())) { if (Date.now() > end) throw new Error(message); await delay(100); } };
function record(receipt: typeof receipts[number]) { receipts.push(receipt); writeFileSync(resolve(out, 'receipts.json'), JSON.stringify(receipts, null, 2)); console.log(JSON.stringify(receipt)); }
async function run(name: string, command: string, args: string[], extra: NodeJS.ProcessEnv = {}) {
  const started = Date.now(), c = start(command, args, extra); let log = '';
  c.stdout!.on('data', b => { log += b; }); c.stderr!.on('data', b => { log += b; });
  const code = await ended(c); writeFileSync(resolve(out, `${name}.log`), log);
  record({ name, code, seconds: (Date.now() - started) / 1000 }); assert.equal(code, 0, `${name}: ${log.slice(-5000)}`);
}
let daemon: ChildProcess | undefined, preview: ChildProcess | undefined;
try {
  assert.equal(await up(`${env.BROWSER_POOL_URL}/health`), false, 'own the acceptance pool');
  assert.equal(await up('http://127.0.0.1:4321'), false, 'own the private preview');
  preview = start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4321', '--strictPort', '--configLoader', 'runner']);
  preview.stdout!.resume(); preview.stderr!.resume(); await until(() => up('http://127.0.0.1:4321'), 30000, 'preview did not start');
  daemon = start(process.execPath, ['--import', 'tsx', 'tools/browser-pool/daemon.ts'], { BROWSER_POOL_SHARED_LIMIT: '4' });
  let daemonLog = ''; daemon.stdout!.on('data', b => { daemonLog += b; writeFileSync(resolve(out, 'daemon.log'), daemonLog); }); daemon.stderr!.on('data', b => { daemonLog += b; });
  await until(() => up(`${env.BROWSER_POOL_URL}/health`), 30000, 'pool did not start');
  await run('full-smoke', 'sh', ['tools/e2e-lock.sh', process.execPath, 'node_modules/playwright/cli.js', 'test', '--grep', '@smoke', '--project=chromium', '--project=pixel-7', '--project=pixel-7-landscape', '--project=iphone-14', '--project=iphone-14-landscape', '--workers=2'], { E2E_PORT: '4322' });
  writeFileSync(resolve(out, 'full-smoke.json'), readFileSync('test-results/playwright/results.json'));
  await run('catalog', 'sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx', 'tools/scenelab/catalog.ts', '--dir', 'specs/scenes', '--filter', 'bench-sitter,house,courier-turns,qa-grove-east-south', '--jobs', '2', '--size', '1280x720', '--out', resolve(out, 'catalog')]);
  await run('invariants-Mac', 'sh', ['tools/e2e-lock.sh', process.execPath, 'node_modules/playwright/cli.js', 'test', '--config=tests/qa/invariants/playwright.config.ts', '--project=chromium', '--grep', 'scripted cast', '--workers=1'], { E2E_PORT: '4325', SCENE_PORT: '4326' });
  const mcpStart = Date.now();
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'tools/scenelab/mcp.ts'], env: env as Record<string, string>, stderr: 'pipe' });
  const client = new Client({ name: 'browser-pool-acceptance', version: '1' });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: 'run_spec', arguments: { path: 'specs/scenes/house.json', sheet: 5 } });
    assert.notEqual(result.isError, true);
    const summary = JSON.parse((result.content as { type: string; text: string }[]).find(c => c.type === 'text')!.text);
    assert.equal(summary.pass, true);
    const status = await (await fetch(`${env.BROWSER_POOL_URL}/status`)).json() as { leases: unknown[] };
    assert.equal(status.leases.length, 0, 'MCP run_spec releases context before returning');
    record({ name: 'MCP', code: 0, seconds: (Date.now() - mcpStart) / 1000 });
  } finally { await client.close(); }
  await run('playtest-session', 'sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx', 'tools/playtest/session.ts', JSON.stringify({ origin: 'http://127.0.0.1:4321', out: resolve(out, 'playtest'), profile: resolve(out, 'profile'), tag: 'pool', levels: ['L1'], heroine: 'female', quality: 'low', zoom: 1.5, levelMinutes: 1, entry: 'new', stopAfterLevel: true, noSkip: true, sampleSeconds: 2 })]);
  assert.ok(existsSync(resolve(out, 'profile/pool-storage.json')), 'playtest saves portable lease storage');
  mkdirSync('test-results/live', { recursive: true });
  const liveStart = Date.now(), live = start('sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx', 'tools/playtest/live.ts', '--step', '--autofight'], { E2E_PORT: '4321', LIVE_PORT: '4324', BROWSER_POOL_IDLE_MS: '2000' });
  const liveEnd = ended(live); let liveLog = '';
  live.stdout!.on('data', b => { liveLog += b; }); live.stderr!.on('data', b => { liveLog += b; });
  try {
    await until(() => up('http://127.0.0.1:4324/look'), 120000, 'live server did not start');
    assert.equal((await fetch('http://127.0.0.1:4324/act', { method: 'POST', body: JSON.stringify({ move: 'd', ms: 50 }) })).ok, true);
    assert.equal((await fetch('http://127.0.0.1:4324/shot')).ok, true);
    await until(async () => { await up('http://127.0.0.1:4324/look'); return live.exitCode !== null; }, 15000, 'look monitoring/autofight prevented idle release');
    assert.equal(await liveEnd, 0); assert.match(liveLog, /Live session idle/);
    record({ name: 'playtest-live-idle', code: 0, seconds: (Date.now() - liveStart) / 1000 });
  } finally { await stop(live); writeFileSync(resolve(out, 'playtest-live.log'), liveLog); }
  await run('qa-ab', 'sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx', 'tools/qa/ab.ts', '--baseline', 'http://127.0.0.1:4321', '--candidate', 'http://127.0.0.1:4321', '--levels', 'L1', '--stops', 'l1-park', '--out', resolve(out, 'ab')]);
} finally { await stop(daemon); await stop(preview); await Promise.all([...children].map(stop)); }
