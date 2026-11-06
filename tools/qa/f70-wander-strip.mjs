/** fix70-v: moving strip of one infected body identity wandering (G-17 knee splay), game camera zoom 1.5.
 * usage: tsx tools/qa/f70-wander-strip.mjs <model> <tier low|high> <outDir> [backend webgl2|webgpu] */
import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session.ts';
const [model = 'npc.civilian-woman-b', tier = 'low', out = 'test-results/f70/wander', backend = 'webgl2'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend, tier, viewport: { width: 800, height: 600 } });
try {
  await s.open();
  const ped = model.startsWith('npc.');
  await s.load({ name: `f70-wander-${model}`, seed: 5, size: 100, ground: 'asphalt', time: 'L3', trace: true,
    actors: [{ id: 'courier', kind: 'courier', at: [35, 35] },
      ped ? { id: 'z', kind: 'pedestrian', at: [0, 0], look: { model }, state: { infect: { instant: true } } } : { id: 'z', kind: 'infected', archetype: 'infected.runner', at: [0, 0], look: { model }, state: 'idle' }],
    camera: { mode: 'follow', actor: 'z', zoom: 1.5 }, frames: 0 });
  await s.page.evaluate(() => { const lab = window.__SCENE__, g = lab.game, e = g.world.entities.get(lab.actors.get('z').entity); g.world.entities.get(1).hidden = true; delete e.noiseTarget; delete e.infected.scripted; e.infected.state = 'idle'; if (e.infected.l1) { const b = e.infected.l1; b.mode = 'wander'; b.targetId = 0; b.hasGoal = false; b.pauseUntil = g.world.tick; delete b.focusId; delete b.focusUntil; } });
  await s.step(45);
  for (let i = 0; i < 80; i++) { const moving = await s.page.evaluate(() => { const lab = window.__SCENE__, e = lab.game.world.entities.get(lab.actors.get('z').entity); return (e.motion?.speed ?? 0) > .1; }); if (moving) break; await s.step(15); }
  await s.step(90);
  for (let frame = 0; frame < 8; frame++) { await s.step(6); await s.ready(); await s.page.screenshot({ path: `${out}/${model}-${tier}-${frame}.jpg`, type: 'jpeg', quality: 85 }); }
  const m = await s.metrics(); console.log(JSON.stringify((m.actors?.z?.track ?? []).slice(-24).map(t => [t.clip, +t.torsoPitchDeg.toFixed(0), ...t.feet.map(f => [+(f.heel[0] - t.at[0]).toFixed(2), +f.heel[1].toFixed(2), +(f.heel[2] - t.at[1]).toFixed(2)])]))); console.log('errors', s.errors);
} finally { await s.close(); stopServer(); }
