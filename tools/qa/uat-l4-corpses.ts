/** Same real-L4 corpse fixture in this lane and b0aac03dd; run with UAT_CORPSE_OUT and SCENE_PORT. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = resolve(process.env.UAT_CORPSE_OUT ?? 'test-results/uat-l4-infected/corpses-current');
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
const evidence: unknown[] = [];
try {
  await session.open();
  if (process.env.UAT_CORPSE_PROD === '1') {
    const meshes = new Map<string, Buffer>();
    for (const id of ['inf.riot-cop', 'inf.firefighter', 'inf.hazmat', 'npc.national-guard']) for (const lod of ['lod0', 'lod1', 'lod2']) {
      const path = `assets/models/skinned/${id}.${lod}.glb`;
      meshes.set(`/${path}`, execFileSync('git', ['show', `b0aac03dd:public/${path}`], { maxBuffer: 10_000_000 }));
    }
    await session.page.route('**/assets/models/skinned/**', async route => {
      const body = meshes.get(new URL(route.request().url()).pathname);
      if (body) await route.fulfill({ body, contentType: 'model/gltf-binary' }); else await route.continue();
    });
    const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string }[];
    const original = JSON.parse(execFileSync('git', ['show', 'b0aac03dd:src/assets/manifest.json'], { maxBuffer: 10_000_000 }).toString()) as { id: string }[];
    const ids = ['inf.riot-cop', 'inf.firefighter', 'inf.hazmat', 'npc.national-guard'];
    const comparison = manifest.map(def => ids.includes(def.id) ? original.find(old => old.id === def.id)! : def);
    await session.page.route('**/src/assets/manifest.json*', route => route.fulfill({ body: `export default ${JSON.stringify(comparison)}`, contentType: 'application/javascript' }));
    await session.page.reload();
    await session.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  }
  await session.page.addInitScript('window.__name = fn => fn');
  await session.page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L4', { seed: 1, progression: 'L4-default', checkpoint: 'turn' }); a.pause();
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    for (const e of [...g.world.infected!.active]) g.world.infected!.release(e);
    for (const e of g.world.entities.iterate()) if (e.civilian) e.hidden = true;
    a.teleport(1, { x: -17, z: 6 }); g.world.combat!.damage.god = true;
  });
  for (const [name, archetype, model] of [
    ['riot', 'infected.riot', 'inf.riot-cop'], ['firefighter', 'infected.firefighter', 'inf.firefighter'],
    ['soldier', 'infected.runner', 'npc.national-guard'], ['hazmat', 'infected.hazmat', 'inf.hazmat'],
  ]) {
    const actor = await session.page.evaluate(async ({ archetype, model }) => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
      for (const e of [...w.infected!.active]) w.infected!.release(e);
      for (const e of w.entities.iterate()) if (e.corpse) e.hidden = true;
      const id = w.infected!.spawn(archetype, { x: -17, z: 3 }, { variant: model, yaw: .5 }), e = w.entities.get(id)!;
      delete e.emerging; delete e.infectionRise; delete e.pendingAdmission;
      e.health.current = 0; w.infected!.down(e, true); e.infected!.state = 'dead'; e.infected!.deadAt = w.tick - 200;
      await a.step(2);
      const body = w.entities.get(id)!;
      if (!body.corpse) throw new Error(`Corpse ${id} did not settle`);
      return { id, archetype, model, at: body.transform, health: body.health, corpse: body.corpse, recoverAt: body.infected!.recoverAt };
    }, { archetype, model });
    for (const zoom of [1, 1.5]) {
      await session.page.evaluate(zoom => window.__SS__!.camera.zoom(zoom), zoom);
      await session.screenshot(`${out}/${name}-z${zoom}.png`);
      evidence.push({ ...actor, zoom });
    }
  }
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ samples: evidence, errors: session.errors }, null, 2));
  if (session.errors.length) throw new Error(JSON.stringify(session.errors));
} finally { await session.close(); stopServer(); }
