import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogFlag } from './catalog-args';
import { validateGateSelection } from './gate-arguments';
import { childFailedUnexpectedly } from './gate-child';
import { resultKey, sameWork } from './gate-identity';

/** Shared batch runner for `npm run scene:gate` (curated list) and `npm run scene:matrix:nightly` (full matrix, sharded, resumable).
 * Every batch is one `catalog.ts --matrix --only <rows>` command under tools/e2e-lock.sh, so each browser reservation stays well
 * inside the 10-minute cap (exit 124 = "split the batch"). A batch that times out is reported and the run goes on.
 * Usage: tsx tools/scenelab/gate-run.ts gate|nightly [--out dir] [--batch 12] [--shard i/n] [--resume] [--filter glob] [--backend webgpu] */
interface Row { name: string; scene: string; tier: 'high' | 'low'; backend: string }
interface Batch { id: string; backend: string; tier: string; rows: Row[] }
interface CatalogRow { name: string; pass: boolean; error?: string; failed: string[]; sheet?: string }
const args = process.argv.slice(2), mode = args[0], flag = (n: string) => catalogFlag(args, n);
const out = resolve(flag('out') ?? (mode === 'gate' ? 'test-results/scene-gate' : 'test-results/scene-nightly'));
const maxRows = Number(flag('batch') ?? (mode === 'gate' ? 15 : 12));
if (mode !== 'gate' && mode !== 'nightly') throw new Error(`Unknown scene gate mode: ${String(mode)}`);
if (!Number.isSafeInteger(maxRows) || maxRows < 1) throw new Error('--batch must be a finite positive integer');

/** Row name as catalog.ts --matrix writes it. */
const rowName = (scene: string, tier: string, zoom: number | null) => `${scene}@${tier}${zoom === null ? '' : `-z${zoom}`}`;

function toBatches(rows: Row[], max: number): Batch[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(`${r.backend}-${r.tier}`, [...(groups.get(`${r.backend}-${r.tier}`) ?? []), r]);
  return [...groups].flatMap(([key, list]) => {
    const n = Math.ceil(list.length / max), size = Math.ceil(list.length / n);
    return Array.from({ length: n }, (_, i) => ({ id: `${key}-${i + 1}`, backend: list[0].backend, tier: list[0].tier, rows: list.slice(i * size, (i + 1) * size) }));
  });
}

function runBatch(b: Batch): { code: number | null; seconds: number; rows: CatalogRow[] } {
  const dir = `${out}/${b.id}`, t0 = Date.now();
  // A previous index must never be mistaken for output from this child.
  rmSync(dir, { recursive: true, force: true });
  const res = spawnSync('sh', ['tools/e2e-lock.sh', 'tsx', 'tools/scenelab/catalog.ts', '--matrix', '--jobs', '1', '--backend', b.backend, '--tier', b.tier, '--out', dir, '--only', b.rows.map(r => r.name).join(',')],
    { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, E2E_UNITS: process.env.E2E_UNITS ?? '1' } });
  const index = `${dir}/index.json`;
  let rows: CatalogRow[] = [];
  try {
    const value: unknown = existsSync(index) ? JSON.parse(readFileSync(index, 'utf8')) : null;
    const candidate = (value as { rows?: unknown } | null)?.rows;
    if (Array.isArray(candidate) && candidate.every(r => r && typeof r.name === 'string' && typeof r.pass === 'boolean' && Array.isArray(r.failed))) rows = candidate;
  } catch { /* Malformed/incomplete output is rejected as a failed child below. */ }
  return { code: res.status, seconds: (Date.now() - t0) / 1000, rows };
}

function selectRows(): { rows: Row[]; known: Map<string, string> } {
  if (mode === 'gate') {
    const list = JSON.parse(readFileSync('specs/scenes/gate-list.json', 'utf8')) as { rows: { scene: string; tier: 'high' | 'low'; zoom: number | null; backend: string }[]; known?: Record<string, string> };
    return { rows: list.rows.map(r => ({ name: rowName(r.scene, r.tier, r.zoom), scene: r.scene, tier: r.tier, backend: r.backend })), known: new Map(Object.entries(list.known ?? {})) };
  }
  const backend = flag('backend') ?? 'webgpu';
  const filter = flag('filter') ?? /--filter '([^']+)'/.exec(JSON.parse(readFileSync('package.json', 'utf8')).scripts['scene:matrix'] as string)![1];
  const res = spawnSync('npx', ['tsx', 'tools/scenelab/catalog.ts', '--matrix', '--list', '--filter', filter], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (res.status !== 0) { console.error(res.stderr); process.exit(2); }
  return { rows: res.stdout.split('\n').filter(Boolean).map(name => ({ name, scene: name.split('@')[0], tier: name.includes('@low') ? 'low' as const : 'high' as const, backend })), known: new Map() };
}

const { rows, known } = selectRows();
if (!rows.length) throw new Error('Scene gate selection is empty');
let batches = toBatches(rows, maxRows);
const shard = flag('shard')?.split('/').map(Number);
if (validateGateSelection(mode, maxRows, flag('shard'), rows.length)) throw new Error('--shard must be i/n with 1 <= i <= n');
if (shard) batches = batches.filter((_, i) => i % shard[1] === shard[0] - 1);
if (!batches.length) throw new Error('Scene gate shard selected no work');
mkdirSync(out, { recursive: true });
const statePath = `${out}/state.json`;
type State = Record<string, { code: number | null; seconds: number; rows: CatalogRow[] }>;
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const inputHash = createHash('sha256');
const sceneInputs = rows.map(row => ['specs/scenes/catalog', 'tests/scenes/catalog']
  .map(dir => `${dir}/${row.scene}.json`).find(existsSync));
if (sceneInputs.some(file => !file)) throw new Error('A selected scene spec is missing from the catalog');
for (const file of ['tools/scenelab/catalog.ts', 'specs/scenes/gate-list.json', ...new Set(sceneInputs as string[])].sort()) {
  inputHash.update(file).update(readFileSync(file));
}
const dirty = spawnSync('git', ['diff', 'HEAD', '--binary'], { maxBuffer: 1 << 26 });
if (dirty.status !== 0 || !revision) throw new Error('Cannot establish scene gate source identity');
inputHash.update(dirty.stdout);
inputHash.update(JSON.stringify(Object.entries(process.env).filter(([key]) => /^(SCENE_|VITE_|BUILD_)/.test(key)).sort()));
const identity = JSON.stringify({ revision, inputs: inputHash.digest('hex'), mode, rows: rows.map(r => [r.backend, r.tier, r.name]), maxRows, shard, filter: flag('filter'), backend: flag('backend') });
type StateFile = { identity: string; batches: State };
const prior = args.includes('--resume') && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) as StateFile : undefined;
const state: State = prior?.identity === identity ? prior.batches : {};
if (prior && prior.identity !== identity) console.error('[scene-' + mode + '] resume state identity changed; starting fresh');
const t0 = Date.now();
console.error(`[scene-${mode}] ${rows.length} rows in ${batches.length} batches (<= ${maxRows} rows each)${shard ? `, shard ${shard.join('/')}` : ''}`);
for (const b of batches) {
  const priorRows = state[b.id]?.rows ?? [];
  if (sameWork(priorRows.map(r => ({ name: r.name, tier: b.tier, backend: b.backend })), b.rows)) { console.error(`[scene-${mode}] ${b.id}: resumed (already ran)`); continue; }
  console.error(`[scene-${mode}] ${b.id}: ${b.rows.length} rows (${b.backend}, ${b.tier})`);
  state[b.id] = runBatch(b);
  writeFileSync(statePath, JSON.stringify({ identity, batches: state }, null, 1));
}
// Summary: unexpected failures, known (triaged) failures, rows that never ran (batch timeout or crash).
const done = new Map(Object.entries(state).flatMap(([id, s]) => s.rows.map(r => [resultKey(r.name, id.split('-')[0]), r] as const)));
const wanted = batches.flatMap(b => b.rows);
const missing = wanted.filter(r => !done.has(resultKey(r.name, r.backend))), failed = wanted.filter(r => done.has(resultKey(r.name, r.backend)) && !done.get(resultKey(r.name, r.backend))!.pass);
const unexpected = failed.filter(r => !known.has(r.name)), knownFailed = failed.filter(r => known.has(r.name));
const badChildren = batches.filter(b => {
  const child = state[b.id];
  return !!child && childFailedUnexpectedly(child.code, b.rows.map(r => r.name), child.rows, new Set(known.keys()));
});
const lines = [`# scene-${mode}`, '', `${wanted.length - failed.length - missing.length}/${wanted.length} rows pass, ${knownFailed.length} known, ${missing.length} not run; ${((Date.now() - t0) / 60000).toFixed(1)} min this run (batch s: ${batches.map(b => `${b.id}=${(state[b.id]?.seconds ?? 0).toFixed(0)}`).join(' ')}).`, '',
  ...unexpected.map(r => `- **FAIL** ${r.name}: ${done.get(resultKey(r.name, r.backend))!.error ?? done.get(resultKey(r.name, r.backend))!.failed.join(', ')}`),
  ...knownFailed.map(r => `- known ${r.name}: ${known.get(r.name)} (${done.get(resultKey(r.name, r.backend))!.failed.join(', ')})`),
  ...missing.map(r => `- **NOT RUN** ${r.name} (batch timeout or crash; rerun with --resume)`)];
lines.splice(3, 0, ...badChildren.map(b => `- **CHILD FAILED** ${b.id} (exit ${state[b.id]?.code ?? 'signal'})`));
writeFileSync(`${out}/summary.md`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`sheets: ${out}/<batch>/<row>/sheet.jpg`);
process.exit(unexpected.length || missing.length || badChildren.length ? 1 : 0);
