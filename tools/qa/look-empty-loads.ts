/** Matched public-build menu loads, interleaved through the existing shared-pool cold-load probe.
 * Run after the capture servers stop: node --import tsx tools/qa/look-empty-loads.ts [rounds=5]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { quietConditions, delay } from '../browser-pool/host';

const rounds = Number(process.argv[2] ?? 5), out = process.env.LOOK_LOAD_OUT ?? 'test-results/look-empty/loads';
const waitQuiet = process.env.LOOK_LOAD_WAIT_QUIET === '1';
const admissionDeadline = Date.now() + 60 * 60 * 1000;
async function awaitQuiet() {
  if (!waitQuiet) return;
  while (true) {
    const health = await fetch('http://127.0.0.1:4329/health').then(r => r.json()) as { browsers: { pid: number }[]; leases: unknown[]; waiting: number; exclusive: unknown[] };
    const host = await quietConditions(new Set(health.browsers.map(b => b.pid)));
    const conditions = { at: new Date().toISOString(), ...host, leases: health.leases.length, waiting: health.waiting, exclusive: health.exclusive.length };
    console.log('Shared quiet preflight:', JSON.stringify(conditions));
    writeFileSync(`${out}/conditions.jsonl`, JSON.stringify(conditions) + '\n', { flag: 'a' });
    if (host.quiet && !health.leases.length && !health.waiting && !health.exclusive.length) return;
    assert.ok(Date.now() < admissionDeadline, 'natural shared quiet window not available within one hour');
    await delay(30_000);
  }
}
const servers: Awaited<ReturnType<typeof preview>>[] = [];
const rows: { level: string; tier: string; phase: string; round: number; ms: number; errors: string[] }[] = existsSync(`${out}/samples.json`) ? JSON.parse(readFileSync(`${out}/samples.json`, 'utf8')) : [];
mkdirSync(out, { recursive: true });
const identity = JSON.stringify({ rounds, builds: ['test-results/look-empty/dist-before-public/index.html', 'test-results/look-empty/dist-after-public/index.html'].map(file => createHash('sha256').update(readFileSync(file)).digest('hex')) });
if (existsSync(`${out}/identity.json`)) assert.equal(readFileSync(`${out}/identity.json`, 'utf8'), identity, 'load resume builds changed');
else writeFileSync(`${out}/identity.json`, identity);
try {
  for (const [port, dir] of [[4873, 'test-results/look-empty/dist-before-public'], [4874, 'test-results/look-empty/dist-after-public']] as const)
    servers.push(await preview({ configFile: false, build: { outDir: resolve(dir) }, preview: { host: '127.0.0.1', port, strictPort: true } }));
  for (const tier of ['low', 'high']) for (const level of ['L6', 'L7', 'L10']) for (let round = 0; round < rounds; round++) {
    await awaitQuiet();
    const phases = round % 2 ? ['after', 'before'] : ['before', 'after'];
    for (const phase of phases) {
      if (rows.some(r => r.level === level && r.tier === tier && r.phase === phase && r.round === round)) continue;
      const dir = `${out}/${level}-${tier}-${phase}-${round}`;
      const child = spawn('sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx', 'tools/perf/cold-load-time.ts', `http://127.0.0.1:${phase === 'before' ? 4873 : 4874}`, 'webgpu', tier, '1', level, '0'], { env: { ...process.env, E2E_UNITS: '1', LOAD_OUT: dir }, stdio: 'inherit' });
      const code = await new Promise<number>(done => { child.once('error', () => done(1)); child.once('exit', code => done(code ?? 1)); });
      assert.equal(code, 0, `${level}/${tier}/${phase}/${round}`);
      const sample = JSON.parse(readFileSync(`${dir}/${level}-webgpu-${tier}-0.json`, 'utf8'));
      rows.push({ level, tier, phase, round, ms: sample.ms, errors: sample.errors });
      writeFileSync(`${out}/samples.json`, JSON.stringify(rows, null, 2));
    }
  }
} finally { for (const server of servers) await new Promise<void>((done, reject) => server.httpServer.close(error => error ? reject(error) : done())); }
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const groups = ['L6', 'L7', 'L10'].flatMap(level => ['low', 'high'].map(tier => {
  const before = rows.filter(r => r.level === level && r.tier === tier && r.phase === 'before').map(r => r.ms);
  const after = rows.filter(r => r.level === level && r.tier === tier && r.phase === 'after').map(r => r.ms);
  return { level, tier, beforeMedian: median(before), afterMedian: median(after), deltaMs: median(after) - median(before), beforeMax: Math.max(...before), afterMax: Math.max(...after) };
}));
const pass = groups.every(g => Math.abs(g.deltaMs) <= 300 && g.afterMax <= 6000) && rows.every(r => !r.errors.length);
writeFileSync(`${out}/summary.json`, JSON.stringify({ method: `Matched local public bundles, fresh isolated contexts, shared native GPU pool, ${rounds} interleaved menu-click-to-loading-card-closure pairs per tier and level; median delta <= 300 ms, every candidate sample <= 6 s.`, rounds, groups, pass }, null, 2));
console.log(JSON.stringify({ groups, pass }));
assert.ok(pass, 'load delta or absolute limit exceeded');
