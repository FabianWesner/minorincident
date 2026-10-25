import { mkdirSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, type Backend } from './session';
import { runSpec } from './run';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

/** npm run scene:gear-close -- --backend webgpu --tier high --out test-results/gear-close/webgpu-high [--sex female] [--tiers 0,1,2,3,4]
 * Q-183 evidence, one browser: for each survivor and gear tier, close views of the hands, torso and knees (idle), and the game camera
 * at the closest zoom 1.5 idle, running and mid bat swing. One PNG per view; sheets are tiled outside (montage). */
const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const backend = (flag('backend') ?? 'webgpu') as Backend, tier = (flag('tier') ?? 'high') as 'high' | 'low', out = flag('out') ?? 'test-results/gear-close';
const sexes = (flag('sex') ?? 'female,male').split(',') as ('female' | 'male')[];
const tiers = (flag('tiers') ?? '0,1,2,3,4').split(',').map(Number);
const views = (flag('views') ?? 'hands,torso,knees,idle,run,swing').split(',');
const base = readSpec('tests/scenes/catalog/courier-gear-tier4-swing-female.json');
const session = new SceneSession({ backend, tier, viewport: { width: 960, height: 720 }, log: () => {} });
try {
  await session.open();
  for (const sex of sexes) for (const gearTier of tiers) for (const view of views) {
    const spec: SceneSpec = JSON.parse(JSON.stringify(base));
    spec.actors![0].look = { gearTier, model: sex } as never;
    let shot = 20;
    if (view === 'swing') { spec.camera = { mode: 'follow', actor: 'courier', zoom: Number(flag('zoom') ?? .5) } as never; spec.frames = 60; shot = 44; }
    else {
      spec.actors = spec.actors!.slice(0, 1); delete spec.script; (spec.actors[0] as { loadout?: unknown }).loadout = [['weapon.fists'], ['weapon.fists']];
      spec.frames = 40;
      if (view === 'run') { spec.actors[0].state = { run: [[0, 0], [12, 0]] } as never; shot = 36; }
      // explicit camera poses (position, target) around the courier at the origin; game camera at the closest player zoom (0.5)
      const pose: Record<string, [[number, number, number], [number, number, number]]> = {
        hands: [[.75, .85, .95], [0, .62, .05]], torso: [[1.05, 1.25, .75], [0, .86, 0]], knees: [[.85, .62, .55], [0, .36, 0]],
        ...Object.fromEntries(args.filter(a => a.startsWith('pose:')).map(a => { const [k, v] = a.slice(5).split('='); const n = v.split(',').map(Number); return [k, [[n[0], n[1], n[2]], [n[3], n[4], n[5]]]]; })) };
      spec.camera = pose[view] ? { mode: 'pose', position: pose[view][0], target: pose[view][1] } as never
        : { mode: 'follow', actor: 'courier', zoom: Number(flag('zoom') ?? .5) } as never;
    }
    (spec as { expect?: unknown }).expect = {};
    const dir = `${out}/${sex}-t${gearTier}-${view}`; mkdirSync(dir, { recursive: true });
    await runSpec(session, spec, { out: dir, shots: [shot], sheet: 0 });
  }
} finally { await session.close(); stopServer(); }
