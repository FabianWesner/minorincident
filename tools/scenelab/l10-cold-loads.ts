/** Five fresh shared-pool contexts for PROD and the unflagged local L10 build. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeJson } from './session';

const port = Number(process.env.SCENE_PORT ?? 4733);
assert.notEqual(port, 3300);
const local = `http://127.0.0.1:${port}`, root = process.cwd();
const out = resolve('test-results/l10-all-new/cold-loads');
const up = async () => { try { return (await fetch(local)).ok; } catch { return false; } };
assert.equal(await up(), false, `port ${port} occupied`);
const exit = (child: ChildProcess) => new Promise<number>(done => {
  child.once('error', () => done(1)); child.once('exit', code => done(code ?? 1));
});
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const rows = [];
try {
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(done => setTimeout(done, 500));
  assert.ok(await up(), 'local preview did not start');
  for (const [variant, origin] of [['prod', 'https://minor-incident.pages.dev'], ['new', local]]) {
    const child = spawn('sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx', 'tools/perf/cold-load-time.ts', origin, 'webgpu', 'low', '5', 'L10', '0'], {
      cwd: root, env: { ...process.env, E2E_UNITS: '1', LOAD_OUT: `${out}/${variant}` }, stdio: 'inherit',
    });
    assert.equal(await exit(child), 0, `${variant} cold loads`);
    const summary = JSON.parse(readFileSync(`${out}/${variant}/L10-webgpu-low-summary.json`, 'utf8'));
    const samples = Array.from({ length: 5 }, (_, i) => JSON.parse(readFileSync(`${out}/${variant}/L10-webgpu-low-${i}.json`, 'utf8')));
    assert.deepEqual(summary.errors, []);
    assert.ok(samples.every(s => s.contexts.includes('webgpu') && s.adapter?.fallback !== true && s.adapter?.architecture === 'metal-3'));
    rows.push({ variant, summary, samples: samples.map(s => ({ sampledAt: s.sampledAt, ms: s.ms, bundle: s.bundle, adapter: s.adapter, contexts: s.contexts, load: s.load, errors: s.errors })) });
  }
} finally { const stopped = exit(server); server.kill(); await stopped; }
const ratio = rows[1].summary.max / rows[0].summary.max;
const result = { rows, ratio, limit: 1.1, pass: ratio <= 1.1,
  method: 'Five empty contexts per build, shared native Metal WebGPU low, real menu click to loading-card closure. Remote PROD versus local public build; network and browser/device caches differ. Final matched-host uncapped performance remains pending the PO quiet window.' };
writeJson(`${out}/summary.json`, result);
console.log(JSON.stringify(result));
assert.ok(result.pass, 'worst of five cold loads must remain within PROD +10%');
