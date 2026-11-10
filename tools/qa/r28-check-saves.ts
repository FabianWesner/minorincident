// Decode every save in a directory at the CURRENT source and resume it natively (no browser).
//   npx tsx tools/qa/r28-check-saves.ts <dir> [--no-resume] [--json out.json]
// Files: `<label>.json.gz` = gzip of the localStorage string (see make-checkpoint.ts) or of plain save JSON.
// Resume: campaign -> loadLevel(level, save); l9Crash -> begin() restores the crash record; cureResume -> loadResume(), then 120 ticks.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { basename, resolve } from 'node:path';
import { decodeSave, migrate, validateSave } from '../../src/sim/progression/Save';
import { loadLevel, type RunnerLevel } from '../sim-runner/levels';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'no-resume': { type: 'boolean', default: false }, json: { type: 'string' } } });
const dir = resolve(positionals[0] ?? '.');
const files = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();
const rows: Record<string, unknown>[] = [];
let failed = 0;
for (const f of files) {
  const text = gunzipSync(readFileSync(`${dir}/${f}`)).toString();
  const r = decodeSave(text), label = basename(f, '.json.gz');
  const row: Record<string, unknown> = { label, decode: r.status };
  if (r.status !== 'ok') {
    failed++;
    try { const m = migrate(JSON.parse(text)); row.validate = validateSave(m); } catch { row.validate = 'not-json'; }
    rows.push(row); console.log('FAIL decode', label, row); continue;
  }
  const save = r.save;
  Object.assign(row, { unlocked: save.unlockedLevel, completed: save.completedLevels, l9Crash: !!save.l9Crash, cureResume: save.cureResume?.current.state.checkpoint, dropped: r.dropped });
  if (!values['no-resume']) {
    try {
      const level = `L${save.unlockedLevel}` as RunnerLevel;
      const world = await loadLevel(level, 1, save);
      try {
        if (save.cureResume) world.missions!.loadResume(save.cureResume);
        const before = world.tick;
        for (let i = 0; i < 120; i++) world.update();
        const player = world.entities.get(1)!;
        Object.assign(row, { resume: 'ok', ticks: world.tick - before, playerHp: player.health.current, checkpointAfter: world.missions!.state.checkpoint, phase: world.missions!.state.phase });
        if (save.cureResume && world.missions!.state.checkpoint !== save.cureResume.current.state.checkpoint) { row.resume = 'checkpoint-mismatch'; failed++; }
        if (player.health.current <= 0) { row.resume = 'player-dead'; failed++; }
      } finally { world.dispose(); }
    } catch (err) { row.resume = `error: ${String(err).slice(0, 200)}`; failed++; }
  }
  rows.push(row); console.log(row.resume && row.resume !== 'ok' ? 'FAIL' : 'ok  ', JSON.stringify(row));
}
if (values.json) writeFileSync(values.json, JSON.stringify(rows, null, 1));
console.log(`${files.length} saves, ${failed} failures`);
process.exit(failed ? 1 : 0);
