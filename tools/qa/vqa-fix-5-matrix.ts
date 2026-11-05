/** Real-input L4-L6 cells, two shared-pool contexts at most. No performance timing. */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { provenance } from './accept/probe';
const pass = process.argv[2] ?? 'vf5r', levels = process.argv[3]?.split(',') ?? ['L5', 'L4', 'L6'];
if (!/^[a-z0-9-]+$/.test(pass) || levels.some(l => !['L4', 'L5', 'L6'].includes(l))) throw new Error('Invalid matrix pass/levels');
const source = provenance(), root = `test-results/vqa-fix-5-matrix/${pass}`; mkdirSync(root, { recursive: true });
const cells = levels.flatMap(level => ['webgpu', 'webgl2'].flatMap(backend => [1.5, .5].flatMap(zoom => ['low', 'high'].map(tier => ({ level, backend, zoom, tier })))));
const results: unknown[] = [];
async function run(cell: typeof cells[number]) {
  const tag = `${pass}-${cell.level}-${cell.backend}-${cell.tier}-z${cell.zoom}`;
  const started = new Date().toISOString(), log = createWriteStream(`${root}/${tag}.log`);
  const child = spawn(process.execPath, ['--import', 'tsx', 'tools/qa/vqa-1b-run.ts', cell.level, cell.tier, cell.backend, String(cell.zoom), cell.level === 'L6' ? 'fresh' : 'preset', tag, process.env.VQA_SAMPLE_SECONDS ?? (cell.level === 'L5' ? '420' : '300'), 'weapon.army-mg', cell.tier === 'low' ? 'male' : 'female'], {
    env: { ...process.env, PLAYTEST_COMPANION_TRACE: '1', PLAYTEST_REVEAL_AUDIT: '1', PLAYTEST_ACCEPTANCE_CAPTURES: '0', PLAYTEST_SHOT_SECONDS: '15', PLAYTEST_AUDIO_CUES: '1', PLAYTEST_L5_TRUCK_PHOTO: '1', PLAYTEST_L5_ORDER: 'mia,rosa,sam,okafor,dale' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log); child.stderr.pipe(log);
  const exit = await new Promise<number | null>(resolve => child.once('exit', resolve));
  log.end(); results.push({ ...cell, tag, sourceHash: source.sourceHash, revision: source.revision, started, ended: new Date().toISOString(), exit });
  writeFileSync(`${root}/results.json`, JSON.stringify({ source, headless: true, noFrameTiming: true, cells: results }, null, 2));
  console.log(JSON.stringify(results.at(-1)));
}
for (let i = 0; i < cells.length; i += 2) {
  if (existsSync(`${root}/STOP`)) break;
  if (provenance().sourceHash !== source.sourceHash) throw new Error('Game source changed; rebuild and start a new matrix pass');
  await Promise.all(cells.slice(i, i + 2).map(run));
}
