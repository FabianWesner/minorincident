/**
 * fix68-a (L3-13): static deck poses on the raised corridor ramp (kit.highway-onramp:991) at x 150/154/158/163, zoom list from RAMP_ZOOMS.
 * Usage: RAMP_TIER=low|high RAMP_OUT=test-results/fix68/x SCENE_PORT=... sh tools/e2e-lock.sh npx tsx tools/qa/fix68/l3-ramp-poses.ts
 */
import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../../scenelab/session';
import type { Game } from '../../../src/Game';

const tier = (process.env.RAMP_TIER ?? 'high') as 'low' | 'high', out = process.env.RAMP_OUT ?? `test-results/fix68/ramp-${tier}`;
const zooms = (process.env.RAMP_ZOOMS ?? '0.5,1.5').split(',').map(Number);
mkdirSync(out, { recursive: true });
// Authored deck centreline of the +x ramp (t = 0.4..0.9): x = 167.5 - 24 t, z = 4.3 sin(2 pi t).
const poses = [150, 154, 158, 163].map(x => { const t = (167.5 - x) / 24; return { x, z: -4.3 * Math.sin(2 * Math.PI * t) }; });
const s = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
try {
  await s.open(); await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async tier => {
    const a = window.__SS__!; a.settings.set({ quality: tier });
    await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
    a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true);
  }, tier);
  for (const { x, z } of poses) {
    const y = await s.page.evaluate(async ({ x, z }) => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.teleport(1, { x, z }); g.view.view.reset(g.world.entities.get(1)!.transform);
      for (let i = 0; i < 12; i++) { await a.step(15); g.view.frame(.25); }
      return g.world.entities.get(1)!.transform;
    }, { x, z });
    console.log(x, JSON.stringify(y));
    for (const zoom of zooms) {
      await s.page.evaluate(async zoom => { const g = (window.__SCENE__ as unknown as { game: Game }).game; window.__SS__!.camera.zoom(zoom); g.view.frame(.25); g.view.update(1); await window.__SS__!.screenshotReady(); }, zoom);
      await s.page.screenshot({ path: `${out}/x${x}-z${zoom}.png` });
    }
  }
} finally { await s.close(); stopServer(); }
