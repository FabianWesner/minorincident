import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const stage = process.env.L6_CAPTURE_STAGE ?? 'after';
const out = `test-results/l6-po/${stage}`;
mkdirSync(out, { recursive: true });
const rows = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, query: { level: 'L6' } });
    try {
      await session.open();
      await session.page.evaluate(async () => {
        const a = window.__SS__!; await a.ready; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' });
        a.pause(); a.missions.begin(); a.cheats.god(true);
      });
      await session.page.evaluate(async () => {
        const a=window.__SS__!, lamp=a.query({}).find(e=>e.archetype==='pickup.headlamp');
        if(lamp){a.teleport(1,{x:lamp.transform.x+1.3,z:lamp.transform.z}); await a.step(1); const lab=window.__SCENE__ as unknown as {game:import('../../src/Game').Game}; const rig=lab.game.view.view, p=a.getEntity(1)!.transform;rig.focus.set(p.x,p.y-.7,p.z);rig.update(p,0);await a.screenshotReady();}
      });
      await session.page.screenshot({path:`${out}/${backend}-${tier}-pickup.png`});
      for (const spot of ['shelter', 'gate'] as const) {
        await session.page.evaluate(async spot => {
          const a = window.__SS__!;
          if (spot === 'gate') { a.missions.completeObjective('shelter'); a.missions.completeObjective('stop'); }
          const lamp = a.query({}).find(e => e.pickup && 'kind' in e.pickup && e.pickup.item === 'headlamp');
          if (lamp) { a.teleport(1, lamp.transform); a.input.set({ interact: true }); await a.step(24); a.input.set({ interact: false }); await a.step(2); }
          a.teleport(1, { x: spot === 'gate' ? 91.3 : 0, z: spot === 'gate' ? 15 : -2 });
          a.camera.follow(); await a.step(2); await a.screenshotReady();
        }, spot);
        for (const zoom of [.5, 1, 1.5]) {
          await session.page.evaluate(async zoom => {
            const lab = window.__SCENE__ as unknown as { game: import('../../src/Game').Game };
            const rig = lab.game.view.view, hero = window.__SS__!.getEntity(1)!.transform;
            rig.focus.set(hero.x, hero.y - .7, hero.z); rig.update(hero, 0); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true);
            await window.__SS__!.step(1); await window.__SS__!.screenshotReady();
          }, zoom);
          const name = `${backend}-${tier}-${spot}-z${zoom}`;
          await session.page.screenshot({ path: `${out}/${name}.png` });
          rows.push({ name, camera: await session.page.evaluate(() => window.__SS__!.getState().render.camera), perf: await session.page.evaluate(() => window.__SS__!.perf()), errors: session.errors });
        }
        if(spot==='shelter'){
          await session.page.evaluate(async()=>{const a=window.__SS__!;a.survivor.select('male',0);await a.step(1);await a.screenshotReady();});
          await session.page.screenshot({path:`${out}/${backend}-${tier}-male-headlamp.png`});
          await session.page.evaluate(async()=>{window.__SS__!.survivor.select('female',0);await window.__SS__!.step(1);});
        }
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/evidence.json`, JSON.stringify(rows, null, 2)); }
