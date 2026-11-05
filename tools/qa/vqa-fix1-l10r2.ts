/** vqa-fix-1: L10 R2 near-side houses at max zoom; infected fighting the courier under a see-through roof (vqa-1 P2).
 * Controlled spots on the road, infected spawned around her; presentation captures only (git-ignored test-results). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vqa-fix-1/l10r2';
const backends = (process.env.VQA_BACKENDS ?? 'webgpu').split(',') as ('webgl2' | 'webgpu')[];
const tiers = (process.env.VQA_TIERS ?? 'high').split(',') as ('high' | 'low')[];
const zooms = (process.env.VQA_ZOOMS ?? '1.5').split(',').map(Number);
const spots = (process.env.VQA_SPOTS ?? '900,84;960,84;1010,84').split(';').map(s => s.split(',').map(Number) as [number, number]);
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
        await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-residential' });
        a.pause(); a.cheats.god(true); a.camera.follow();
      }, tier);
      for (const zoom of zooms) for (const [x, z] of spots) {
        const info = await s.page.evaluate(async ({ x, z, zoom, after }) => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          a.teleport(1, { x, z }); a.camera.zoom(zoom); await a.step(90);
          const p = g.world.entities.get(1)!.transform;
          for (let i = 0; i < 5; i++) { const t = i * 1.2566; a.spawn('infected.runner', { x: p.x + Math.cos(t) * 2.4, z: p.z + Math.sin(t) * 2.4 }); }
          await a.step(after); await a.screenshotReady();
          const v = g.view.view.getState();
          return { player: [+p.x.toFixed(1), +p.z.toFixed(1)], radius: +v.radius.toFixed(1), region: +v.regionScale.toFixed(2), actualZoom: +v.zoom.toFixed(2) };
        }, { x, z, zoom, after: Number(process.env.VQA_AFTER ?? 30) });
        const file = `${out}/${backend}-${tier}-z${zoom}-${x}_${z}.png`;
        await s.page.screenshot({ path: file });
        rows.push({ backend, tier, zoom, ...info, file });
      }
      if (s.errors.length) rows.push({ errors: s.errors });
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
