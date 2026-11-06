/** Current-source ordinary-input evidence, at most two pooled contexts. */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { provenance } from './accept/probe';
const level = process.argv[2], seconds = process.argv[3] ?? '420';
if (!['L4', 'L5', 'L6'].includes(level)) throw new Error('Expected L4/L5/L6');
const source = provenance(), root = `test-results/sweep-b/input-${level}`;
mkdirSync(root, { recursive: true });
const results: unknown[] = [];
for (const zoom of [1.5, .5]) {
  await Promise.all((['low', 'high'] as const).map(async tier => {
    const tag = `sweep-b-${level}-${tier}-z${zoom}`, log = createWriteStream(`${root}/${tag}.log`);
    const started = new Date().toISOString();
    const child = spawn(process.execPath, ['--import', 'tsx', 'tools/qa/vqa-1b-run.ts', level, tier, 'webgl2', String(zoom), 'preset', tag, seconds, 'weapon.army-mg', 'female'], {
      env: { ...process.env, PLAYTEST_ACCEPTANCE_LEDGER: '1', PLAYTEST_AUDIO_CUES: '1', PLAYTEST_METRO_AUDIT: '1', PLAYTEST_ACCEPTANCE_CAPTURES: '1', PLAYTEST_ACCEPTANCE_CAPTURE_TIERS: 'single', PLAYTEST_SHOT_SECONDS: '15', PLAYTEST_L5_TOUR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log); child.stderr.pipe(log);
    const exit = await new Promise<number | null>(resolve => child.once('exit', resolve));
    log.end(); results.push({ tag, tier, zoom, started, ended: new Date().toISOString(), exit });
    writeFileSync(`${root}/matrix.json`, JSON.stringify({ ...source, method: 'Physical WASD/mouse/E, progressed preset, protected courier, mortal followers; shared headless Metal WebGL2; no performance timing; L5 authored-map tour is not caption-only evidence.', results }, null, 2) + '\n');
    console.log(JSON.stringify(results.at(-1)));
  }));
}
