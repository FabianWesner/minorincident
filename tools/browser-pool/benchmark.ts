import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cpus, totalmem, loadavg } from 'node:os';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { delay, windowServerSnapshot } from './host';

const phase = process.argv[2];
if (phase !== 'before' && phase !== 'after') throw new Error('usage: tsx tools/browser-pool/benchmark.ts before|after [clients comma-separated]');
const counts = (process.argv[3] ?? '1,2,4,6').split(',').map(Number);
const benchRoot = resolve(process.env.BROWSER_POOL_BENCH_ROOT ?? 'test-results/browser-pool/benchmark');
const out = resolve(benchRoot, phase); mkdirSync(out, { recursive: true });
const fixtures = ['bench-sitter', 'house', 'courier-turns', 'qa-grove-east-south'];
const children = new Set<ChildProcess>();
let daemonLog = '';
const env = { ...process.env, SCENE_PORT: '4321', E2E_PORT: '4321', SCENE_SERVER: 'preview', E2E_UNITS: '1', BROWSER_POOL_BACKEND: 'gpu', BROWSER_POOL_URL: 'http://127.0.0.1:4329' };
const alive = async (url: string) => { try { return (await fetch(url, { signal: AbortSignal.timeout(500) })).ok; } catch { return false; } };
const start = (args: string[], extra = {}) => {
  const child = spawn(process.execPath, args, { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(child); child.once('exit', () => children.delete(child)); return child;
};
async function stop(child?: ChildProcess) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  const exited = new Promise<void>(r => child.once('exit', () => r())); child.kill('SIGTERM'); await exited;
}
const until = async (check: () => Promise<boolean>, what: string) => {
  const deadline = Date.now() + 30_000;
  while (!(await check())) { if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`); await delay(100); }
};
function telemetry() {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,time=,command='], { encoding: 'utf8' }).split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line); return m ? [{ pid: +m[1], parent: +m[2], rss: +m[3], time: m[4], command: m[5] }] : [];
  });
  const owned = new Set([process.pid]); let previous = -1;
  while (previous !== owned.size) { previous = owned.size; for (const r of rows) if (owned.has(r.parent)) owned.add(r.pid); }
  const chrome = rows.filter(r => owned.has(r.pid) && /chrome-headless-shell|Google Chrome/.test(r.command));
  const roots = rows.filter(r => /chrome-headless-shell|Google Chrome/.test(r.command) && /--headless/.test(r.command) && !r.command.includes('--type='));
  const window = rows.find(r => /\/WindowServer(?: |$)/.test(r.command));
  const windowTime = window?.time.split('-');
  const windowSeconds = windowTime ? (windowTime.length > 1 ? Number(windowTime[0]) * 86400 : 0) + windowTime.at(-1)!.split(':').reduce((n, part) => n * 60 + Number(part), 0) : null;
  return { at: Date.now(), windowServerPid: window?.pid, windowServerSeconds: windowSeconds, chromeRssMiB: chrome.reduce((n, r) => n + r.rss, 0) / 1024, ownedChromeRoots: roots.filter(r => owned.has(r.pid)).map(r => r.pid), gpuRootsTotal: roots.filter(r => !r.command.includes('--use-angle=swiftshader')).length, load: loadavg() };
}
function sceneEvidence(dir: string) {
  return fixtures.map(name => {
    const folder = resolve(dir, name), metrics = JSON.parse(readFileSync(resolve(folder, 'metrics.json'), 'utf8'));
    const captures = readdirSync(folder).filter(p => p.endsWith('.png')).map(file => {
      const path = resolve(folder, file), png = PNG.sync.read(readFileSync(path));
      const basePath = resolve(benchRoot, 'before/scenes-n1-c0', name, file);
      const base = PNG.sync.read(readFileSync(phase === 'before' && dir.endsWith('scenes-n1-c0') ? path : basePath));
      let changedPixels = 0;
      for (let i = 0; i < png.data.length; i += 4) if (png.data[i] !== base.data[i] || png.data[i + 1] !== base.data[i + 1] || png.data[i + 2] !== base.data[i + 2] || png.data[i + 3] !== base.data[i + 3]) changedPixels++;
      return { file, width: png.width, height: png.height, rgbaHash: createHash('sha256').update(png.data).digest('hex'), changedPixels };
    });
    return { name, backend: metrics.backend, pass: metrics.checks.pass, failed: metrics.checks.checks.filter((c: { pass: boolean }) => !c.pass), consoleErrors: metrics.consoleErrors, timing: metrics.timing, captures };
  });
}
const summaryPath = resolve(out, 'summary.json');
const previous = existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, 'utf8')) : undefined;
if (previous && process.env.BROWSER_POOL_RESUME !== '1') throw new Error('Existing measurements: set BROWSER_POOL_RESUME=1 to run only missing groups, or choose a fresh BROWSER_POOL_BENCH_ROOT');
const groups: { kind: string; clients: number; [key: string]: unknown }[] = previous?.groups ?? [];
let preview: ChildProcess | undefined, daemon: ChildProcess | undefined;
const began = previous?.began ?? Date.now(), windowBefore = previous?.windowBefore ?? await windowServerSnapshot();
try {
  if (await alive('http://127.0.0.1:4321')) throw new Error('Port 4321 is already in use');
  if (await alive(`${env.BROWSER_POOL_URL}/health`)) throw new Error('Stop the existing pool before an isolated benchmark');
  preview = start(['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4321', '--strictPort', '--configLoader', 'runner']);
  preview.stdout!.on('data', () => {}); preview.stderr!.on('data', () => {});
  await until(() => alive('http://127.0.0.1:4321'), 'private preview');
  if (phase === 'after') {
    daemon = start(['--import', 'tsx', 'tools/browser-pool/daemon.ts'], { BROWSER_POOL_SHARED_LIMIT: process.env.BROWSER_POOL_SHARED_LIMIT ?? '6', BROWSER_POOL_PORT: '4329' });
    daemon.stdout!.on('data', b => { daemonLog += b; }); daemon.stderr!.on('data', b => { daemonLog += b; });
    await until(() => alive(`${env.BROWSER_POOL_URL}/health`), 'pool');
    if (groups.length) {
      const health = await (await fetch(`${env.BROWSER_POOL_URL}/health`)).json() as { endpoints: { gpu: string } };
      const primer = await chromium.connect(health.endpoints.gpu, { timeout: 1_800_000 });
      const context = await primer.newContext(); await context.close(); await primer.close();
    }
  }
  for (const kind of ['scenes', 'smoke', 'lanes']) for (const n of kind === 'lanes' ? [4] : counts) {
    if (groups.some(g => g.kind === kind && g.clients === n)) continue;
    const groupStart = Date.now(), samples = [telemetry()], windowStart = await windowServerSnapshot();
    const sampler = setInterval(() => samples.push(telemetry()), 1000);
    try {
      const results = await Promise.all(Array.from({ length: n }, async (_, client) => {
        const id = `${kind}-n${n}-c${client}`, dir = resolve(out, id); mkdirSync(dir, { recursive: true });
        const admission = resolve(dir, 'admission.json'), report = resolve(dir, 'smoke.json');
        const command = kind === 'scenes'
          ? [process.execPath, '--import', 'tsx', 'tools/scenelab/cli.ts', ...fixtures.map(f => `specs/scenes/${f}.json`), '--out', dir]
          : kind === 'smoke' ? [process.execPath, 'node_modules/playwright/cli.js', 'test', '--config=tools/browser-pool/benchmark.config.ts', '--workers=1']
          : [process.execPath, '--import', 'tsx', 'tools/browser-pool/lane-load.ts', resolve(dir, 'lanes.json')];
        const args = phase === 'before' ? ['--import', 'tsx', 'tools/browser-pool/legacy-run.ts', ...command] : ['--import', 'tsx', 'tools/browser-pool/wrapper.ts', 'shared', ...command];
        const requestedAt = Date.now();
        const child = start(args, { BROWSER_POOL_JOB_ID: id, BROWSER_POOL_ADMISSION_FILE: admission, BENCH_REPORT: report, BENCH_ARTIFACTS: resolve(dir, 'artifacts'), ...(phase === 'before' ? { BROWSER_POOL: 'off' } : {}) });
        let log = ''; child.stdout!.on('data', b => { log += b; }); child.stderr!.on('data', b => { log += b; });
        const code = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
        writeFileSync(resolve(dir, 'command.log'), log);
        const admittedAt = phase === 'before' ? JSON.parse(readFileSync(admission, 'utf8')).at : daemonLog.split('\n').flatMap(line => { try { const e = JSON.parse(line); return e.kind === 'lease-acquire' && e.job === id ? [Date.parse(e.at)] : []; } catch { return []; } })[0];
        const evidence = kind === 'scenes' ? sceneEvidence(dir) : kind === 'smoke' ? JSON.parse(readFileSync(report, 'utf8')).stats : JSON.parse(readFileSync(resolve(dir, 'lanes.json'), 'utf8'));
        if (kind !== 'scenes' && code !== 0) throw new Error(`${id} exited ${code}: ${log.slice(-2000)}`);
        return { id, code, wallMs: Date.now() - requestedAt, admissionWaitMs: admittedAt - requestedAt, evidence };
      }));
      samples.push(telemetry());
      const windowEnd = await windowServerSnapshot(), seconds = (Date.now() - groupStart) / 1000;
      const group = { kind, clients: n, wallSeconds: seconds, scenesPerMinute: kind === 'scenes' ? n * fixtures.length * 60 / seconds : undefined, chromePeakRssMiB: Math.max(...samples.map(s => s.chromeRssMiB)), maxGpuRoots: Math.max(...samples.map(s => s.gpuRootsTotal)), windowServerPeakCpu: Math.max(0, ...samples.slice(1).map((s, i) => s.windowServerSeconds !== null && samples[i].windowServerSeconds !== null && s.windowServerPid === samples[i].windowServerPid ? (s.windowServerSeconds - samples[i].windowServerSeconds!) * 100000 / (s.at - samples[i].at) : 0)), windowServerCpu: windowStart && windowEnd?.pid === windowStart.pid ? (windowEnd.seconds - windowStart.seconds) * 100 / seconds : null, results, samples };
      groups.push(group); writeFileSync(resolve(out, 'summary.json'), JSON.stringify({ phase, began, host: { cpu: cpus()[0].model, cores: cpus().length, memoryGiB: totalmem() / 2 ** 30 }, groups, windowBefore, windowAfter: windowEnd }, null, 2));
      console.log(JSON.stringify({ phase, kind, n, wallSeconds: seconds, scenesPerMinute: group.scenesPerMinute, chromePeakRssMiB: group.chromePeakRssMiB, windowServerCpu: group.windowServerCpu }));
    } finally { clearInterval(sampler); }
  }
} finally {
  await stop(daemon); await stop(preview);
  await Promise.all([...children].map(stop));
  if (daemonLog) writeFileSync(resolve(out, 'daemon.log'), daemonLog);
  console.log(`${phase} benchmark finished in ${((Date.now() - began) / 1000).toFixed(1)} s`);
}
