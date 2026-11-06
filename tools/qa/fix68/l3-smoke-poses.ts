/**
 * fix68-a (L3-16): static street poses on Oak (z 28) and Commerce (z 0) at x -110/-85/-60/-35, zoom list from SMOKE_ZOOMS.
 * Usage: SMOKE_TIER=low|high SMOKE_OUT=test-results/fix68/x SCENE_PORT=... sh tools/e2e-lock.sh npx tsx tools/qa/fix68/l3-smoke-poses.ts
 */
import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../../scenelab/session';
import type { Game } from '../../../src/Game';

const tier = (process.env.SMOKE_TIER ?? 'low') as 'low' | 'high', out = process.env.SMOKE_OUT ?? `test-results/fix68/${tier}`;
const zooms = (process.env.SMOKE_ZOOMS ?? '1').split(',').map(Number);
mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
try {
  await s.open(); await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async tier => {
    const a = window.__SS__!; a.settings.set({ quality: tier });
    await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
    a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true);
  }, tier);
  for (const [name, z] of [['oak', 28], ['commerce', 0]] as const) for (const x of [-110, -85, -60, -35]) {
    await s.page.evaluate(async ({ x, z }) => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.teleport(1, { x, z }); g.view.view.reset(g.world.entities.get(1)!.transform);
      for (let i = 0; i < 24; i++) { await a.step(15); g.view.frame(.25); }
    }, { x, z });
    for (const zoom of zooms) {
      await s.page.evaluate(async zoom => { const g = (window.__SCENE__ as unknown as { game: Game }).game; window.__SS__!.camera.zoom(zoom); g.view.frame(.25); g.view.update(1); await window.__SS__!.screenshotReady(); }, zoom);
      await s.page.screenshot({ path: `${out}/${name}-x${x}-z${zoom}.png` });
    }
  }
} finally { await s.close(); stopServer(); }
