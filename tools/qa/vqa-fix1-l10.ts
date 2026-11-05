/** vqa-fix-1: L10 courier readability at the dispersal console (hold ring around the tanks), R2 near-side roofs,
 * Mega death flash. Fixed ticks, production follow camera, presentation captures only (git-ignored test-results). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vqa-fix-1/l10';
const backends = (process.env.VQA_BACKENDS ?? 'webgpu,webgl2').split(',') as ('webgl2' | 'webgpu')[];
const tiers = (process.env.VQA_TIERS ?? 'high,low').split(',') as ('high' | 'low')[];
const zooms = (process.env.VQA_ZOOMS ?? '0.5,1.5').split(',').map(Number);
/** Offsets from the console (metres): the vqa-1 P1 spot (6.4, -20.2) and the ring around both bullet tanks. */
const spots = (process.env.VQA_SPOTS ?? '6.4,-20.2;14,-21;22,-12;-14,24;-22,14;4.5,-3').split(';').map(s => s.split(',').map(Number) as [number, number]);
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of backends) for (const tier of tiers) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
    try {
      await s.open();
      await s.page.evaluate('window.__name = f => f');
      await s.page.evaluate(async tier => {
        const a = window.__SS__!;
        a.settings.set({ quality: tier, cameraShake: false });
        await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-disperse-ready' });
        a.pause(); a.cheats.god(true); a.camera.follow();
      }, tier);
      for (const zoom of zooms) for (const [dx, dz] of spots) {
        const info = await s.page.evaluate(async ({ dx, dz, zoom }) => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          const c = g.world.missions!.def.anchors['cure-console'];
          a.teleport(1, { x: c.x + dx, z: c.z + dz }); a.camera.zoom(zoom); await a.step(30); await a.screenshotReady();
          const v = g.view.view.getState(), p = g.world.entities.get(1)!.transform;
          const occ = (g.view as unknown as { districts?: { occlusion: { courierOccluded: boolean; cutPlacements: Set<unknown> } } }).districts?.occlusion;
          return { console: [c.x, c.z], player: [+p.x.toFixed(1), +p.z.toFixed(1)], radius: +v.radius.toFixed(1), actualZoom: +v.zoom.toFixed(2), region: v.regionScale, occluded: occ?.courierOccluded, cut: occ?.cutPlacements.size };
        }, { dx, dz, zoom });
        const file = `${out}/${backend}-${tier}-z${zoom}-${dx}_${dz}.png`;
        await s.page.screenshot({ path: file });
        rows.push({ backend, tier, zoom, spot: [dx, dz], ...info, file });
        // vqa-1 P2: a Mega killed by a rocket 4 m from her (death flash, then the body).
        if (process.env.VQA_MEGA) for (const [after, i] of [[2, 0], [5, 1], [12, 2], [40, 3], [150, 4]] as const) {
          await s.page.evaluate(async ({ after, first }) => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!.transform;
            if (first) {
              const id = g.world.megaPursuit!.introduce({ x: p.x + 3.5, z: p.z + 1.5 }); await a.step(20);
              const m = g.world.entities.get(id)!, at = { x: m.transform.x, z: m.transform.z };
              a.explosions.blast('explosion.rocket', at);
              g.world.combat!.damage.apply({ attackId: 9e5, actionId: 'weapon.rocket-launcher', sourceId: 1, targetId: id, origin: { x: p.x, z: p.z }, direction: { x: 1, z: 0 }, base: 1e6, multiplier: 1, type: 'explosive', knockback: 0, stagger: 0 });
            }
            await a.step(after); await a.screenshotReady();
          }, { after, first: i === 0 });
          const f = `${out}/${backend}-${tier}-z${zoom}-${dx}_${dz}-mega${i}.png`;
          await s.page.screenshot({ path: f }); rows.push({ backend, tier, zoom, spot: [dx, dz], mega: i, file: f });
        }
        // vqa-1 P1: a point-blank rocket beside her at the hold (frames +2/+6/+12 ticks after the blast).
        if (process.env.VQA_BLAST) for (const [after, i] of [[2, 0], [4, 1], [6, 2]] as const) {
          await s.page.evaluate(async ({ after, first }) => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!.transform;
            if (first) a.explosions.blast('explosion.rocket', { x: p.x - 1.8, z: p.z + .6 });
            await a.step(after); await a.screenshotReady();
          }, { after, first: i === 0 });
          const f = `${out}/${backend}-${tier}-z${zoom}-${dx}_${dz}-blast${i}.png`;
          await s.page.screenshot({ path: f }); rows.push({ backend, tier, zoom, spot: [dx, dz], blast: i, file: f });
        }
      }
      if (s.errors.length) rows.push({ errors: s.errors });
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
