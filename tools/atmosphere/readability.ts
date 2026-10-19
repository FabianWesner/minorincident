/** Bounded L6/L7 campaign capture batch. Use e2e-lock after a fresh production build. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import { companionReadability } from '../../tests/visual/companion-readability';
const phase = process.argv[2] ?? 'after', backend = (process.argv[3] ?? 'webgl2') as Backend;
const out = `docs/reports/readability-w6b/${phase}/${backend}`;
const rows: object[] = [];
mkdirSync(out, { recursive: true });
try {
  for (const tier of (process.env.READ_TIERS ?? 'high,low').split(',') as ('high' | 'low')[]) {
    const s = new SceneSession({ backend, tier, viewport: { width: 960, height: 540 } });
    try {
      await s.open();
      for (const level of ['L6', 'L7']) {
        await s.page.evaluate(async ({ level, tier }) => {
          const a = window.__SS__!; await a.loadLevel(level, { seed: 1 }); a.pause(); a.cheats.god(true); a.settings.set({ quality: tier, cameraShake: false });
          const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
          const dog = [...game.world.entities.iterate()].find(e => e.companion)!;
          // Stage the companion beside the player, beyond the courier's aura and the supply-crate pool.
          const p = a.getEntity(1)!.transform; a.teleport(dog.id, { x: p.x - 2.8, z: p.z + 1 });
          game.view.view.follow(); game.view.view.pull(0, 0, 0);
          for (let i = 0; i < 4; i++) game.view.update(1);
          await a.screenshotReady();
        }, { level, tier });
        await s.page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility:hidden!important }' });
        for (const zoom of (process.env.READ_ZOOMS ?? '0.5,1,1.5').split(',').map(Number)) {
          const perf = await s.page.evaluate(async zoom => {
            const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            const rig = game.view.view, target = window.__SS__!.getEntity(1)!.transform;
            rig.reset(target); rig.zoom(Math.log(zoom), true); rig.update(target, 0);
            for (let i = 0; i < 4; i++) game.view.update(1);
            await window.__SS__!.screenshotReady();
            const p = window.__SS__!.perf(); return { backend: p.backend, drawCalls: p.drawCalls, triangles: p.triangles };
          }, zoom);
          const file = `${out}/${level}-${tier}-z${zoom}.jpg`;
          await s.page.locator('canvas').first().screenshot({ path: file, type: 'jpeg', quality: 88 });
          const companion = await companionReadability(s.page);
          rows.push({ level, tier, zoom, file, companion, perf });
          console.log(`${phase} ${backend} ${level} ${tier} z${zoom}: corgi ${companion.contrast.toFixed(3)} (${companion.pixels}px), ${perf.drawCalls} draws/${perf.triangles} tris`);
        }
      }
      if (s.errors.length) throw new Error(s.errors.join('\n'));
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/index.json`, JSON.stringify(rows, null, 2)); }

const failed = rows.filter(row => { const r = row as { level: string; companion: { pixels: number; contrast: number }; tier: string; perf: { backend: string; drawCalls: number; triangles: number } }; return r.companion.pixels < 40 || r.companion.contrast < 3 || r.perf.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu') || r.perf.drawCalls > (r.tier === 'high' ? 600 : 300) || r.perf.triangles > (r.tier === 'high' ? 1500000 : 500000); });
if (failed.length) { console.error(`${failed.length} readability/budget rows failed`); process.exitCode = 1; }
