/** Five fresh browser profiles per production build, with the real unflagged WebGPU menu flow. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { get } from 'node:http';
import { resolve } from 'node:path';
import { writeJson } from './session';

const root = process.cwd(), baseline = resolve(process.env.BASELINE_ROOT ?? '../l1-all-new-main');
const port = Number(process.env.SCENE_PORT ?? 4672), origin = `http://127.0.0.1:${port}`;
assert.notEqual(port, 3300);
const out = resolve(root, 'docs/reports/l1-all-new/cold-loads');
mkdirSync(out, { recursive: true });
const available = () => new Promise<boolean>(done => {
  const request = get(origin, { agent: false }, response => { response.resume(); done(response.statusCode === 200); });
  request.on('error', () => done(false)); request.setTimeout(1000, () => { request.destroy(); done(false); });
});
const exit = (child: ChildProcess) => new Promise<number>(done => { child.once('error', () => done(1)); child.once('exit', code => done(code ?? 1)); });
assert.equal(await available(), false, `port ${port} already occupied`);
const summary = [];
for (const variant of ['main', 'new']) {
  const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { cwd: variant === 'main' ? baseline : root, stdio: 'ignore' });
  try {
    for (let i = 0; i < 120 && !(await available()); i++) await new Promise(done => setTimeout(done, 500));
    assert.ok(await available(), 'preview failed to start');
    const target = resolve(out, variant);
    const child = spawn(process.execPath, ['--import', 'tsx', 'tools/perf/cold-load-time.ts', origin, 'webgpu', 'low', '5', 'L1', '0'], { cwd: root, env: { ...process.env, LOAD_OUT: target }, stdio: 'inherit' });
    assert.equal(await exit(child), 0, `${variant} cold load runner`);
    const rows = Array.from({ length: 5 }, (_, i) => JSON.parse(readFileSync(resolve(target, `L1-webgpu-low-${i}.json`), 'utf8')));
    assert.ok(rows.every(row => row.errors.length === 0 && row.contexts.includes('webgpu')), `${variant} requires clean native WebGPU samples`);
    summary.push({ variant, samples: rows.map(row => row.ms as number), worstMs: Math.max(...rows.map(row => row.ms as number)), bundles: [...new Set(rows.map(row => row.bundle))] });
  } finally {
    const stopped = exit(server); server.kill(); await stopped;
    for (let i = 0; i < 30 && await available(); i++) await new Promise(done => setTimeout(done, 100));
  }
}
const before = summary.find(row => row.variant === 'main')!, after = summary.find(row => row.variant === 'new')!;
const result = { summary, relative: after.worstMs / before.worstMs, pass: after.worstMs <= 6000 && after.worstMs <= before.worstMs * 1.1 };
writeJson(resolve(out, 'summary.json'), result);
console.log(JSON.stringify(result));
assert.ok(result.pass, 'five cold load budget');
