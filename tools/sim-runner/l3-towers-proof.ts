/** Reproducible game-camera comparison and authored LOD review, headless behind e2e-lock.sh. */
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import manifest from '../../src/assets/manifest.json';
import { l3, l3ArmyOffset, l3Anchors } from '../../src/data/l3';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer, writeJson } from '../scenelab/session';
import { runSpec } from '../scenelab/run';

const out = resolve(process.env.L3_TOWERS_OUT ?? 'test-results/l3-towers');
mkdirSync(out, { recursive: true });
const base = JSON.parse(readFileSync('specs/scenes/qa-l3-army-checkpoint.json', 'utf8')) as SceneSpec;
base.layout!.bbox = base.layout!.bbox!.map(([x,z]) => [x + l3ArmyOffset,z]) as [[number, number], [number, number]];
for (const actor of base.actors ?? []) {
  if (actor.at) actor.at = [actor.at[0] + l3ArmyOffset, actor.at[1]];
  if (typeof actor.state === 'object' && 'run' in actor.state) actor.state.run = actor.state.run.map(([x,z]) => [x + l3ArmyOffset,z]);
}
base.camera = { mode: 'game', target: [136 + l3ArmyOffset, 0], zoom: 1.25 };
base.frames = 60; base.shots = [0, 7, 30, 60]; base.trace = true;
base.expect = { consoleErrors: 0, undrawnFramesMax: 0 };
try {
  for (const lod of ['before', 'lod0', 'lod1', 'lod2'] as const) {
    const session = new SceneSession();
    try {
      console.log(`opening ${lod}`);
      await session.open();
      const spec = structuredClone(base);
      if (lod === 'before') {
        spec.layout!.assets = manifest.filter(a => a.id !== 'kit.guard-tower').map(a => a.id);
        spec.frames = 0; spec.shots = [0];
      } else {
        // Same game camera, each delivered tower tier forced through the normal GLB loader.
        const bytes = readFileSync(`public/assets/models/kit.guard-tower${lod === 'lod0' ? '' : `.${lod}`}.glb`);
        await session.page.route('**/assets/models/kit.guard-tower*.glb', route => route.fulfill({ body: bytes, contentType: 'model/gltf-binary' }));
        for (const actor of spec.actors ?? []) if (actor.id?.startsWith('soldier-')) {
          const n = actor.id.slice('soldier-'.length);
          actor.at = [...l3Anchors[`l3-soldier-${n}`]]; actor.floorY = l3.soldiers.deckY;
          actor.look!.handProp = 'rifle'; actor.state = { ally: { role: 'soldier', weapon: 'rifle' } };
        }
        spec.actors = spec.actors!.filter(a => a.kind !== 'infected');
        spec.actors.push({ id: 'approach', kind: 'infected', at: [124 + l3ArmyOffset, 0], count: 6, spread: 1.5, state: 'chase' });
      }
      console.log(`loading ${lod}`);
      const result = await runSpec(session, spec, { out: `${out}/${lod}` });
      const state = await session.page.evaluate(() => window.__SS__!.getState());
      writeJson(`${out}/${lod}/state.json`, state);
      writeJson(`${out}/${lod}/spec.json`, spec);
      console.log(JSON.stringify({ lod, pass: result.pass, files: result.files, shotCount: state.render.vfx?.shots.length }));
      if (!result.pass) process.exitCode = 1;
      if (lod !== 'before' && !state.render.vfx?.shots.length) throw new Error(`${lod}: guards did not fire`);
    } catch (error) { console.log(String(error)); throw error; } finally { await session.close(); }
  }
} finally { stopServer(); }
