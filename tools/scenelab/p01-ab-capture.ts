import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';

const side = process.env.P01_AB_SIDE;
if (side !== 'before' && side !== 'after') throw new Error('P01_AB_SIDE must be before or after');
const scenes = [
  ['crowd-infected-20', 'tests/scenes/crowd-variety/infected-20.json'],
  ['crowd-l7-rocket', 'tests/scenes/l7-rocket/qa-l7-rocket-crowd.json'],
  ['corpses-l9', 'tests/scenes/l9-residency/corpse.json'],
  ['l4-breach-north', 'tests/scenes/l4-district/emergence-north.json'],
  ['l8-zoo-lion', 'tests/scenes/l8-systems/lion.json'],
  ['l10-mega-slam', 'tests/scenes/l10-mega-moves/l10-mega-slam.json'],
] as const;
const out = resolve(`docs/reports/p01-rigid-retire/pixels/${side}`);
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 }, seed: 1 });
const receipts: unknown[] = [];
try {
  await session.open();
  for (const [name, file] of scenes) {
    const spec = readSpec(file);
    const frames = 60;
    const result = await runSpec(session, spec, { file, out: `${out}/${name}`, frames, shots: [frames], sheet: 0 });
    receipts.push({ name, file, frame: frames, result });
    console.log(`${name}: ${result.pass ? 'PASS' : 'FAIL'}`);
    writeJson(`${out}/receipts.json`, receipts);
  }
  if (session.errors.length) throw new Error(JSON.stringify(session.errors));
} finally { await session.close(); stopServer(); }
