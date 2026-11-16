/** Bounded real keyboard input at a fixture encounter; no zombie stat edits. Run under e2e-lock. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { readFixture } from '../qa/fixture-io';
import { loadFixtureInPage } from '../qa/load-fixture';
import type { Game } from '../../src/Game';
const tier = process.env.SCREAM_TIER === 'low' ? 'low' : 'high';
const backend = process.env.SCREAM_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const zoom = Number(process.env.SCREAM_ZOOM ?? 1);
const before = process.env.SCREAM_BEFORE === '1';
const out = `test-results/s137-native-${tier}-${backend}-${zoom}-${before ? 'before' : 'after'}`; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier });
try {
 await session.open();
 await loadFixtureInPage(session.page, readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz'));
 const setup = await session.page.evaluate(({ tier, zoom, before }) => {
  const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
  a.settings.set({ quality: tier as 'high' | 'low' }); a.camera.follow(); a.camera.zoom(zoom);
  if (before) {
   const fx = g.view.vfx!, original = fx.effect.bind(fx);
   fx.effect = (kind, x, z, radius = 2, height = .7) => {
    if (kind !== 'screamer') return original(kind,x,z,radius,height);
    const ground = g.world.districts?.groundHeight(x,z) ?? 0;
    const first = fx.waves.spawn(fx.time,.34,x,ground+2,z,0,0,0,2.8,8,0xd66bff,1); fx.waves.opacity(first,.92);
    const second = fx.waves.spawn(fx.time,.42,x,ground+2.25,z,0,0,0,4.8,8,0xb94cff,1); fx.waves.opacity(second,.82);
    const slot = fx.waves.spawn(fx.time,1,x,.03,z,0,0,0,radius*2,8,0xef92ff,1);fx.waves.opacity(slot,.25);
   };
  }
  const p = g.world.entities.get(1)!;
  const id = g.world.infected!.spawn('infected.screamer', { x:p.transform.x - 4, z:p.transform.z - 4 }, { state: 'chase' });
  const events: unknown[] = [];
  g.world.events.on('noise', e => { if(e.type === 'noise' && e.kind === 'scream') events.push({ ...e, player: { ...g.world.entities.get(1)!.transform } }); });
  (window as unknown as { screamEvents: unknown[] }).screamEvents = events;
  return { sourceId:id, player:{...p.transform}, backend:g.view.renderer.backend.constructor.name };
 }, { tier, zoom, before });
 await session.page.evaluate(() => window.__SS__!.resume());
 await session.page.keyboard.down('KeyD');
 const rows = [];
 for(let i=0;i<40;i++) {
  const started = Date.now();
  const state = await session.page.evaluate(id => ({ source: window.__SS__!.getEntity(id)?.transform, projection: window.__SS__!.camera.project(...Object.values(window.__SS__!.getEntity(id)!.transform).slice(0,3) as [number,number,number]), tick:window.__SS__!.tick(), player:window.__SS__!.getEntity(1)!.transform, events:(window as unknown as {screamEvents:unknown[]}).screamEvents }), setup.sourceId);
  const file = `${out}/${i}.jpg`; await session.page.screenshot({path:file,type:'jpeg',quality:70}); rows.push({file,wall:started,...state});
  await new Promise(r=>setTimeout(r,Math.max(0,250-(Date.now()-started))));
 }
 await session.page.keyboard.up('KeyD');
 writeFileSync(`${out}/rows.json`,JSON.stringify({setup,rows,errors:session.errors},null,2));
} finally { await session.close(); stopServer(); }
