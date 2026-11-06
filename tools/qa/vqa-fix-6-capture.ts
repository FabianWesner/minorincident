/** vqa-fix-6: before/after captures for the vqa-3 findings (L2 engine on foot, L3 ramp ghost, worn arrows, street smoke, bars).
 * Production levels (preset saves), production follow camera, captures to test-results only (git-ignored).
 *   VQA_OUT=test-results/vf6/x VQA_BACKENDS=webgpu,webgl2 VQA_TIERS=low,high VQA_ZOOMS=0.5,1.5 VQA_PARTS=l3,l2 \
 *   SCENE_PORT=3361 sh tools/e2e-lock.sh npx tsx tools/qa/vqa-fix-6-capture.ts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vf6/capture';
const backends = (process.env.VQA_BACKENDS ?? 'webgpu,webgl2').split(',') as ('webgl2' | 'webgpu')[];
const tiers = (process.env.VQA_TIERS ?? 'low,high').split(',') as ('high' | 'low')[];
const zooms = (process.env.VQA_ZOOMS ?? '0.5,1.5').split(',').map(Number);
const parts = (process.env.VQA_PARTS ?? 'l3,l2').split(',');
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
// Raised corridor ramp deck (fix68-a poses) plus the vqa-3 reveal-audit points; then a junction with turn paint and Maple Hardware smoke.
const ramp = [150, 154, 158, 163].map(x => { const t = (167.5 - x) / 24; return { name: `ramp${x}`, x, z: -4.3 * Math.sin(2 * Math.PI * t) }; });
const spotFilter = process.env.VQA_SPOTS?.split(',');
const spots = [...ramp, { name: 'arrows-west', x: -93, z: 2 }, { name: 'arrows-east', x: -17, z: 16 }, { name: 'maple', x: -112, z: 2 }].filter(spot => !spotFilter || spotFilter.includes(spot.name));
const state = (s: SceneSession) => s.page.evaluate(() => {
  const g = (window.__SCENE__ as unknown as { game: Game }).game, r = window.__SS__!.getState().render as unknown as { courierForeground: boolean; courierOccluder: string; healthBars?: { count: number } };
  const p = g.world.entities.get(1)!.transform;
  return { tick: g.world.tick, at: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)], foreground: r.courierForeground, occluder: r.courierOccluder, bars: r.healthBars?.count ?? 0 };
});
try {
  for (const backend of backends) for (const tier of tiers) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
    try {
      await s.open(); await s.page.evaluate('window.__name = f => f');
      const shot = async (label: string) => { const file = `${out}/${label}-${backend}-${tier}.png`; await s.page.screenshot({ path: file }); return file; };
      if (parts.includes('l3')) {
        await s.page.evaluate(async tier => {
          const a = window.__SS__!; a.settings.set({ quality: tier });
          await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
          a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true);
        }, tier);
        for (const spot of spots) {
          await s.page.evaluate(async ({ x, z }) => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
            a.teleport(1, { x, z }); g.view.view.reset(g.world.entities.get(1)!.transform);
            // Six seconds of game time: street smoke columns refill their bounded puff pool around the new focus.
            for (let i = 0; i < 24; i++) await a.step(15);
          }, spot);
          for (const zoom of zooms) {
            await s.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); for (let i = 0; i < 4; i++) await a.step(15); await a.screenshotReady(); }, zoom);
            rows.push({ backend, tier, zoom, spot: spot.name, ...(await state(s)), file: await shot(`L3-${spot.name}-z${zoom}`) });
          }
        }
      }
      if (parts.includes('l2')) for (const zoom of zooms) {
        await s.page.evaluate(async ({ tier, zoom }) => {
          const a = window.__SS__!; a.settings.set({ quality: tier });
          await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
          a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(zoom); a.cheats.god(true); a.bot.start('no-axe');
          for (let i = 0; i < 4000 && a.missions.state()!.l2!.phase !== 'doors'; i++) await a.step(6);
        }, { tier, zoom });
        // Doors phase: the courier stands on the far side of the parked engine from the lens (vqa-3 t2950-t3960).
        for (let k = 0; k < 6; k++) {
          await s.page.evaluate(async k => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
            if (k === 0) a.bot.stop();
            const truck = g.world.entities.get(g.world.missions!.state.l2!.truckId!)!.transform, lens = (g.view as unknown as { camera: { position: { x: number; z: number } } }).camera.position;
            const dx = lens.x - truck.x, dz = lens.z - truck.z, d = Math.hypot(dx, dz) || 1, side = [0, .9, -.9, 1.8, -1.8, 0][k];
            a.teleport(1, { x: truck.x - dx / d * 3 - dz / d * side, z: truck.z - dz / d * 3 + dx / d * side });
            await a.step(90); await a.screenshotReady();
          }, k);
          const hull = await s.page.evaluate(() => {
            const g = (window.__SCENE__ as unknown as { game: Game }).game as unknown as { view: { vehicles: { reveal: Map<number, { on: { value: number } }>; courierOccluded: boolean } } };
            return { hullOn: [...g.view.vehicles.reveal].filter(([, r]) => r.on.value > .5).map(([id, r]) => [id, r.on.value]), vehicleOccluded: g.view.vehicles.courierOccluded };
          });
          rows.push({ backend, tier, zoom, spot: `L2-doors-${k}`, ...(await state(s)), ...hull, file: await shot(`L2-doors${k}-z${zoom}`) });
        }
      }
      if (s.errors.length) rows.push({ backend, tier, errors: s.errors.slice(0, 5) });
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
