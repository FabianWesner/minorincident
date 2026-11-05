/** vqa-fix-1: L3 street smoke vs attackers near the courier (vqa-1 P2, probe ticks 6156-7989, Grove Blvd).
 * Native sim bot, fixed ticks, production follow camera. Captures in git-ignored test-results. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vqa-fix-1/l3';
const backends = (process.env.VQA_BACKENDS ?? 'webgpu').split(',') as ('webgl2' | 'webgpu')[];
const tiers = (process.env.VQA_TIERS ?? 'high').split(',') as ('high' | 'low')[];
const zooms = (process.env.VQA_ZOOMS ?? '1').split(',').map(Number);
const ticks = (process.env.VQA_TICKS ?? '6150,6750,7350,7950').split(',').map(Number);
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of backends) for (const tier of tiers) for (const zoom of zooms) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
    try {
      await s.open();
      await s.page.evaluate('window.__name = f => f');
      await s.page.evaluate(async ({ tier, zoom }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
        a.missions.begin(); a.pause(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(zoom); a.bot.start('complete');
      }, { tier, zoom });
      for (const tick of ticks) {
        const info = await s.page.evaluate(async tick => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          while (g.world.tick < tick) await a.step(Math.min(30, tick - g.world.tick));
          await a.screenshotReady();
          const p = g.world.entities.get(1)!.transform;
          let near = 0; for (const e of g.world.entities.iterate()) if (e.infected && e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 12) near++;
          return { tick: g.world.tick, player: [+p.x.toFixed(1), +p.z.toFixed(1)], infectedWithin12m: near, zoom: g.view.view.playerZoom };
        }, tick);
        const file = `${out}/${backend}-${tier}-z${zoom}-t${tick}.png`;
        await s.page.screenshot({ path: file });
        rows.push({ backend, tier, ...info, requestedZoom: zoom, file });
      }
      if (s.errors.length) rows.push({ errors: s.errors });
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
