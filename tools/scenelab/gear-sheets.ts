import { mkdirSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, type Backend } from './session';
import { runSpec } from './run';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

/** npm run gear:sheets -- --backend webgpu --tier high --out test-results/gear-sheets/webgpu-high
 * One browser: for both survivors and gear tiers 0-4, four hi-res PNG shots each (front 3/4 close, back 3/4 close, mid-bat-swing close,
 * game camera at the closest player zoom 0.5). compose.py-style tiling into JPG sheets happens outside (docs/reports/gear-art). */
const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const backend = (flag('backend') ?? 'webgpu') as Backend, tier = (flag('tier') ?? 'high') as 'high' | 'low', out = flag('out') ?? 'test-results/gear-sheets';
const base = readSpec('tests/scenes/catalog/courier-gear-tier4-swing-female.json');
const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, log: () => {} });
try {
  await session.open();
  for (const sex of ['female', 'male'] as const) for (const gearTier of [0, 1, 2, 3, 4]) for (const pose of ['front', 'back', 'swing', 'game'] as const) {
    const spec: SceneSpec = JSON.parse(JSON.stringify(base));
    spec.actors![0].look = { gearTier, model: sex } as never;
    const swing = pose === 'swing';
    spec.camera = pose === 'game' ? { mode: 'follow', actor: 'courier', zoom: .5 } as never
      : { mode: 'close', target: [swing ? .6 : 0, swing ? .75 : .85, 0], radius: swing ? 3.2 : 3.1, azimuth: pose === 'back' ? 220 : 40 } as never;
    if (!swing) { spec.actors = spec.actors!.slice(0, 1); delete spec.script; (spec.actors[0] as { loadout?: unknown }).loadout = [['weapon.fists'], ['weapon.fists']]; }
    spec.frames = swing ? 60 : 24; (spec as { expect?: unknown }).expect = {};
    const dir = `${out}/${sex}-t${gearTier}-${pose}`; mkdirSync(dir, { recursive: true });
    await runSpec(session, spec, { out: dir, shots: [swing ? 44 : 20], sheet: 0 });
  }
} finally { await session.close(); stopServer(); }
