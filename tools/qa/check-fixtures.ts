/* eslint-disable @typescript-eslint/no-explicit-any -- QA tool inspects untyped save JSON */
// Native (no browser) check of QA checkpoint fixtures at the current source.
//   npx tsx tools/qa/check-fixtures.ts [dir=tests/fixtures/saves/qa]
// campaign-save: decodeSave must be ok with nothing dropped, then loadLevel + (L10) loadResume + 300 ticks.
// mission-resume: loadLevel(level, campaign), begin, loadResume(resume), 300 ticks.
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel, type RunnerLevel } from '../sim-runner/levels';
import { readFixture } from './fixture-io';

const dir = resolve(process.argv[2] ?? 'tests/fixtures/saves/qa');
let failed = 0;
for (const name of readdirSync(dir).filter(f => /\.json\.(gz|br)$/.test(f)).sort()) {
  const f = readFixture(`${dir}/${name}`), row: Record<string, unknown> = { fixture: f.label, kind: f.kind, level: f.level };
  try {
    const decoded = decodeSave(JSON.stringify(f.campaign));
    if (decoded.status !== 'ok' || decoded.dropped) throw new Error(`decode ${decoded.status} dropped=${decoded.status === 'ok' ? decoded.dropped : ''}`);
    const world = await loadLevel(f.level as RunnerLevel, 1, decoded.save);
    try {
      const m = world.missions!;
      if (f.kind === 'mission-resume') { m.begin(); m.loadResume(f.resume as Parameters<typeof m.loadResume>[0]); }
      else if (decoded.save.cureResume) m.loadResume(decoded.save.cureResume);
      const player = world.entities.get(1)!, start = { x: player.transform.x, z: player.transform.z };
      for (let i = 0; i < 300; i++) world.update();
      Object.assign(row, { start, player: { x: +player.transform.x.toFixed(1), z: +player.transform.z.toFixed(1), hp: Math.round(player.health.current) }, checkpoint: m.state.checkpoint, phase: m.state.phase, l8Arenas: m.l8 ? Object.fromEntries(Object.entries((m.state as any).l8?.arenas ?? {}).map(([k, v]: any) => [k, v.phase])) : undefined, l9: m.l9 ? { phase: m.l9.state.phase, checkpoints: m.l9.state.driving?.checkpoints, stallAt: m.l9.state.driving?.stallAt } : undefined, cureInstalled: m.state.states['cure-installed'] });
      if (player.health.current <= 0 || m.state.phase !== 'playing') throw new Error(`bad state hp=${player.health.current} phase=${m.state.phase}`);
    } finally { world.dispose(); }
    row.result = 'ok';
  } catch (err) { row.result = `FAIL ${String(err).slice(0, 200)}`; failed++; }
  console.log(JSON.stringify(row));
}
process.exit(failed ? 1 : 0);
