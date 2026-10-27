import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogFlag } from './catalog-args';
import { validateGateSelection } from './gate-arguments';

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
  const res = spawnSync('sh', ['tools/e2e-lock.sh', 'tsx', 'tools/scenelab/catalog.ts', '--matrix', '--backend', b.backend, '--tier', b.tier, '--out', dir, '--only', b.rows.map(r => r.name).join(',')],
    { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, E2E_UNITS: process.env.E2E_UNITS ?? '2' } });
  const index = `${dir}/index.json`;
  return { code: res.status, seconds: (Date.now() - t0) / 1000, rows: existsSync(index) ? JSON.parse(readFileSync(index, 'utf8')).rows : [] };
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
const state: State = args.includes('--resume') && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const t0 = Date.now();
console.error(`[scene-${mode}] ${rows.length} rows in ${batches.length} batches (<= ${maxRows} rows each)${shard ? `, shard ${shard.join('/')}` : ''}`);
for (const b of batches) {
  if (state[b.id]?.rows.length === b.rows.length) { console.error(`[scene-${mode}] ${b.id}: resumed (already ran)`); continue; }
  console.error(`[scene-${mode}] ${b.id}: ${b.rows.length} rows (${b.backend}, ${b.tier})`);
  state[b.id] = runBatch(b);
  writeFileSync(statePath, JSON.stringify(state, null, 1));
}
// Summary: unexpected failures, known (triaged) failures, rows that never ran (batch timeout or crash).
const done = new Map(Object.values(state).flatMap(s => s.rows.map(r => [r.name, r] as const)));
const wanted = batches.flatMap(b => b.rows);
const missing = wanted.filter(r => !done.has(r.name)), failed = wanted.filter(r => done.has(r.name) && !done.get(r.name)!.pass);
const unexpected = failed.filter(r => !known.has(r.name)), knownFailed = failed.filter(r => known.has(r.name));
const lines = [`# scene-${mode}`, '', `${wanted.length - failed.length - missing.length}/${wanted.length} rows pass, ${knownFailed.length} known, ${missing.length} not run; ${((Date.now() - t0) / 60000).toFixed(1)} min this run (batch s: ${batches.map(b => `${b.id}=${(state[b.id]?.seconds ?? 0).toFixed(0)}`).join(' ')}).`, '',
  ...unexpected.map(r => `- **FAIL** ${r.name}: ${done.get(r.name)!.error ?? done.get(r.name)!.failed.join(', ')}`),
  ...knownFailed.map(r => `- known ${r.name}: ${known.get(r.name)} (${done.get(r.name)!.failed.join(', ')})`),
  ...missing.map(r => `- **NOT RUN** ${r.name} (batch timeout or crash; rerun with --resume)`)];
writeFileSync(`${out}/summary.md`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`sheets: ${out}/<batch>/<row>/sheet.jpg`);
process.exit(unexpected.length || missing.length ? 1 : 0);
