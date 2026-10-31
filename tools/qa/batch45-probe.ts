/** Batch 45 VQA follow-up: targeted shots + nearby placement dump.
 * SHOTS='[{"level":"L6","tier":"low","x":283,"z":14,"zoom":1.5,"box":[279,288,19,27]}]' SCENE_PORT=4882 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch45-probe.ts
 */
import { writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const out = 'test-results/batch45-vqa';
const shots = JSON.parse(process.env.SHOTS!) as { level: string; tier: 'high' | 'low'; x: number; z: number; zoom: number; box?: [number, number, number, number] }[];
const s = new SceneSession({ tier: shots[0].tier, backend: 'webgpu', viewport: { width: 1280, height: 720 } });
try {
  await s.open();
  let loaded = '';
  for (const sh of shots) {
    if (loaded !== sh.level) {
      await s.page.evaluate(async ({ level, tier }) => {
        const a = window.__SS__!;
        await a.loadLevel(level, { seed: 45, progression: `${level}-default` });
        a.pause(); a.cheats.god(true); a.settings.set({ quality: tier }); a.camera.follow();
        if (a.missions.state()?.phase === 'briefing') a.missions.begin();
        if (level === 'L6') { for (const id of ['shelter', 'stop', 'retreat']) a.cheats.completeObjective(id); a.teleport(1, { x: 273, z: 15 }); await a.step(2); }
        await a.screenshotReady();
      }, { level: sh.level, tier: sh.tier });
      await s.page.addStyleTag({ content: '#hud,.hud,.mission-tracker,.mission-minimap,.mission-marker,.story-bubble,.mission-toast,.mission-subtitle,[data-testid=mission-button]{visibility:hidden!important}' });
      loaded = sh.level;
    }
    const near = await s.page.evaluate(async ({ x, z, zoom, box }) => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      a.teleport(1, { x, z }); await a.step(1);
      const hero = a.getEntity(1)!.transform, rig = game.view.view;
      rig.focus.set(hero.x, hero.y - .7, hero.z); rig.update(hero, 0);
      rig.zoom(Math.log(zoom / rig.getState().targetZoom), true);
      await a.step(1); await a.screenshotReady();
      if (!box) return null;
      return game.world.districts!.districts.flatMap(d => d.decay.placements.filter(p => !d.decay.removed.includes(p.id)).map(p => ({ id: p.id, asset: p.assetId, decor: !!p.decor, pos: p.position.map(v => +v.toFixed(2)), min: p.visualAabb.min.map(v => +v.toFixed(2)), max: p.visualAabb.max.map(v => +v.toFixed(2)), o: d.origin, district: d.id })))
        .filter(p => p.max[0] + p.o[0] > box[0] && p.min[0] + p.o[0] < box[1] && p.max[2] + p.o[1] > box[2] && p.min[2] + p.o[1] < box[3]);
    }, sh);
    const name = `probe-${sh.level}-${sh.tier}-${sh.x}_${sh.z}-z${sh.zoom}`;
    await s.page.screenshot({ path: `${out}/${name}.png` });
    if (near) writeFileSync(`${out}/${name}.json`, JSON.stringify(near, null, 1));
    console.log(name);
  }
} finally { await s.close(); stopServer(); }
