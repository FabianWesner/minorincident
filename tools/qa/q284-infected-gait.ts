/** Q-284 ("This type of Zombie looks strange and walks strange"): each human infected look chasing a running courier
 * (Scene Lab follow camera on the infected; spec zoom 0.5 = closest player zoom, 1.5 = far) plus a close attack, at both zooms, high and low.
 * SCENE_PORT=4894 E2E_PORT=4893 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/q284-infected-gait.ts <outDir> [high|low] [model,...]
 * Writes JPEG frames and rows.json to <outDir> (git-ignored test-results/ by default).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const out = process.argv[2] ?? 'test-results/q284';
const tiers = (process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['high', 'low']) as ('high' | 'low')[];
const models = process.argv[4] ? process.argv[4].split(',') : ['inf.nurse'];
/** Q284_FAST=1: close run + idle only (the per-variant sweep). */
const fast = !!process.env.Q284_FAST;
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const shot = async (s: SceneSession, name: string) => { await s.ready(); await s.page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82 }); };
try {
  for (const tier of tiers) {
    const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    try {
      await s.open();
      for (const entry of models) {
        // `turned:inf.x` forces the turned-pedestrian path (e.g. a civilian who turns with the inf.nurse body).
        const model = entry.replace(/^turned:/, '');
        const archetype = model === 'inf.nurse' ? 'infected.nurse' : model === 'inf.sprinter' ? 'infected.sprinter' : model === 'inf.screamer' ? 'infected.screamer' : 'infected.runner';
        const tag = entry.replace(/^inf\./, '').replace('turned:inf.', 'turned-'), turned = entry.startsWith('turned:') || model !== 'inf.nurse' && model !== 'inf.common-worker';
        // Run: the courier runs along a long straight line, the infected chases from behind (side-on to the iso camera).
        const run = {
          name: `q284-${tag}-run`, seed: 3, ground: 'grass', size: 60, time: 'L1', trace: true,
          actors: [
            { id: 'courier', kind: 'courier', at: [-14, 0], yaw: 0, state: { run: [[-14, 0], [26, 0]] } },
            // inf.* looks other than the nurse/common worker are turned pedestrians that keep their body (CivilianCrowd), not CrowdView archetypes.
            turned ? { id: 'z', kind: 'pedestrian', look: { model }, at: [-20, 0], yaw: 0, state: { infect: { instant: true } } }
              : { id: 'z', kind: 'infected', archetype, look: { model }, at: [-20, 0], yaw: 0, state: { chase: 'courier' } },
          ],
          camera: { mode: 'follow', actor: 'z', zoom: 1.5 }, frames: 0,
        } as unknown as SceneSpec;
        for (const z of fast ? [0.5] : [0.5, 1.5]) {
          await s.load({ ...run, camera: { mode: 'follow', actor: 'z', zoom: z } } as SceneSpec);
          await s.step(60);
          for (const k of z === 0.5 ? fast ? [0, 1] : [0, 1, 2, 3] : [0]) { await s.step(5); await shot(s, `${tag}-${tier}-run-z${z}-${k}`); }
          const m = await s.metrics() as { actors?: Record<string, unknown> };
          rows.push({ tier, model, phase: 'run', zoom: z, z: m.actors?.z ?? null, errors: [...s.errors] });
        }
        // Standing idle by day and at night (the UAT screenshot was at night).
        for (const [label, extra] of [['idle', { state: 'idle' }], ['night', { state: 'idle' }]] as const) {
          if (fast && label !== 'idle') continue;
          const spec = { ...run, name: `${run.name}-${label}`, time: label === 'night' ? 'night' : 'L1', camera: { mode: 'follow', actor: 'z', zoom: 0.5 },
            actors: [{ ...run.actors![0], at: [20, 20], state: 'idle' }, { ...run.actors![1], ...extra }] } as unknown as SceneSpec;
          await s.load(spec);
          await s.step(60);
          for (const k of [0, 1]) { await s.step(5); await shot(s, `${tag}-${tier}-${label}-z0.5-${k}`); }
          const m = await s.metrics() as { actors?: Record<string, unknown> };
          rows.push({ tier, model, phase: label, zoom: 0.5, z: m.actors?.z ?? null, errors: [...s.errors] });
        }
        // Attack: courier stands, the infected closes the last metres and swings.
        const attack = {
          name: `q284-${tag}-attack`, seed: 4, ground: 'grass', size: 30, time: 'L1',
          actors: [
            { id: 'courier', kind: 'courier', at: [0, 0], yaw: 180, state: 'idle' },
            { id: 'z', kind: 'infected', archetype, look: { model }, at: [-4, 0], yaw: 0, state: { chase: 'courier' } },
          ],
          camera: { mode: 'follow', actor: 'z', zoom: 1.5 }, frames: 0,
        } as unknown as SceneSpec;
        for (const z of fast ? [] : [0.5, 1.5]) {
          await s.load({ ...attack, camera: { mode: 'follow', actor: 'z', zoom: z } } as SceneSpec);
          await s.step(70); await shot(s, `${tag}-${tier}-attack-z${z}`);
        }
        console.log(tier, model, s.errors.length);
      }
    } finally { await s.close(); }
  }
} finally { writeFileSync(`${out}/rows-${tiers.join('-')}.json`, JSON.stringify(rows, null, 1)); stopServer(); }
