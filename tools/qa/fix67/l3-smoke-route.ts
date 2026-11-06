/**
 * fix67-a (L3-16): default-zoom street frames along the native `complete` route (ordinary InputFrames, courier damage off),
 * one frame every 25 m from x -110 to 115, both tiers. Records the chosen street smoke columns for each frame.
 * Usage: SMOKE_TIER=low|high SCENE_PORT=... sh tools/e2e-lock.sh npx tsx tools/qa/fix67/l3-smoke-route.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../scenelab/session';
import type { Game } from '../../../src/Game';

const tier = (process.env.SMOKE_TIER ?? 'low') as 'low' | 'high', out = `test-results/fix67/smoke-${tier}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
const frames: unknown[] = [];
try {
  await s.open(); await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async tier => {
    const a = window.__SS__!; a.settings.set({ quality: tier });
    await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
    a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1); a.cheats.god(true); a.bot.start('complete', { street: 'auto' });
  }, tier);
  const pending = Array.from({ length: 10 }, (_, i) => -110 + i * 25);
  for (let step = 0; step < 3000 && pending.length; step++) {
    const x = await s.page.evaluate(async () => { await window.__SS__!.step(15); const g = (window.__SCENE__ as unknown as { game: Game }).game; g.view.frame(.25); return g.world.entities.get(1)!.transform.x; });
    if (x < pending[0]) continue;
    const gate = pending.shift()!;
    await s.page.evaluate(async () => { const g = (window.__SCENE__ as unknown as { game: Game }).game; g.view.update(1); await window.__SS__!.screenshotReady(); });
    const file = `${out}/x${gate}.png`;
    await s.page.screenshot({ path: file });
    frames.push({ file, gate, ...(await s.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const blasts = g.view.vfx!.blasts as unknown as { cloudColumns: Map<number, { x: number; z: number; street?: boolean }> };
      const p = g.world.entities.get(1)!.transform;
      return { tick: g.world.tick, zoom: g.view.view.playerZoom, player: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }, columns: [...blasts.cloudColumns].filter(([, c]) => c.street).map(([id, c]) => ({ id, x: c.x, z: c.z })) };
    })) });
  }
} finally { writeFileSync(`${out}/frames.json`, JSON.stringify(frames, null, 1)); await s.close(); stopServer(); }
console.log(frames.length);
