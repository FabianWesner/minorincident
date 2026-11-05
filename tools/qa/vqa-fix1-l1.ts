/** vqa-fix-1: L1 fire-station bay at the shutter finale (vqa-1 P2 #9 black interior, floating roof wedge).
 * Controlled courier spots relative to the bay trigger; presentation captures only (git-ignored test-results). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vqa-fix-1/l1';
const backends = (process.env.VQA_BACKENDS ?? 'webgpu').split(',') as ('webgl2' | 'webgpu')[];
const tiers = (process.env.VQA_TIERS ?? 'high,low').split(',') as ('high' | 'low')[];
const zooms = (process.env.VQA_ZOOMS ?? '0.5,1.5').split(',').map(Number);
const spots = (process.env.VQA_SPOTS ?? '0,0;0,2;0,-2').split(';').map(s => s.split(',').map(Number) as [number, number]);
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of backends) for (const tier of tiers) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
    try {
      await s.open();
      await s.page.evaluate('window.__name = f => f');
      await s.page.evaluate(async tier => {
        const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false });
        await a.loadLevel('L1', { seed: 1, checkpoint: 'bat' });
        a.pause(); a.cheats.god(true); a.camera.follow();
      }, tier);
      for (const zoom of zooms) for (const [dx, dz] of spots) {
        const info = await s.page.evaluate(async ({ dx, dz, zoom }) => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          const c = g.world.missions!.def.anchors['fire-bay-trigger'];
          a.teleport(1, { x: c.x + dx, z: c.z + dz }); await a.step(5); a.teleport(1, { x: c.x + dx, z: c.z + dz }); a.camera.zoom(zoom); await a.step(40); await a.screenshotReady();
          const p = g.world.entities.get(1)!.transform;
          const occ = (g.view as unknown as { districts?: { occlusion: { cutPlacements: Set<unknown>; lensPlacements: Set<unknown>; occluderId: string } } }).districts?.occlusion;
          return { anchor: [c.x, c.z], player: [+p.x.toFixed(1), +p.z.toFixed(1)], cut: occ?.cutPlacements.size, lens: occ?.lensPlacements.size, occluder: occ?.occluderId };
        }, { dx, dz, zoom });
        const file = `${out}/${backend}-${tier}-z${zoom}-${dx}_${dz}.png`;
        await s.page.screenshot({ path: file });
        rows.push({ backend, tier, zoom, ...info, file });
      }
      if (s.errors.length) rows.push({ errors: s.errors });
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
