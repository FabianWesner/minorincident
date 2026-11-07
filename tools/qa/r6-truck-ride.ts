/** r6-truck: native L2 fire-engine ride captures (seated crew cutaway) at zoom 0.5/1/1.5, both tiers, both backends.
 * Pooled headless browser, Scene Lab dev server. R6_OUT, R6_BACKENDS (webgl2,webgpu), R6_TIERS (low,high), R6_SECONDS (3,12). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const out = process.env.R6_OUT ?? 'test-results/r6-truck/after';
const list = (name: string, fallback: string) => (process.env[name] ?? fallback).split(',').filter(Boolean);
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of list('R6_BACKENDS', 'webgl2,webgpu') as ('webgl2' | 'webgpu')[]) for (const tier of list('R6_TIERS', 'low,high') as ('low' | 'high')[]) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
    try {
      await s.open();
      await s.page.evaluate(async tier => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.bot.start('no-axe');
        for (let i = 0; i < 120 && a.missions.state()!.l2!.phase !== 'ride'; i++) await a.step(30);
        if (a.missions.state()!.l2!.phase !== 'ride') throw new Error('Native bot did not board');
      }, tier);
      for (const seconds of list('R6_SECONDS', '3,12').map(Number)) {
        await s.page.evaluate(async seconds => {
          const a = window.__SS__!;
          while (a.getState().tick - a.missions.state()!.l2!.departAt < seconds * 60) await a.step(1);
        }, seconds);
        for (const zoom of [.5, 1, 1.5]) {
          const details = await s.page.evaluate(async zoom => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            a.camera.zoom(zoom); await a.screenshotReady();
            const l2 = g.world.missions!.state.l2!, render = a.getState().render;
            const glass = (g as unknown as { scene: import('three').Object3D }).scene?.getObjectByName?.('crewGlassRoof');
            return { tick: g.world.tick, phase: l2.phase, seated: l2.seated, renderBackend: render.backend, quality: render.quality, glassRoof: glass?.visible ?? null };
          }, zoom);
          const file = `${out}/${backend}-${tier}-s${seconds}-z${zoom}.png`;
          await s.page.screenshot({ path: file });
          rows.push({ backend, tier, seconds, zoom, ...details, file });
        }
      }
    } finally { await s.close(); }
  }
} finally { writeFileSync(`${out}/rows.json`, JSON.stringify(rows, null, 2)); stopServer(); }
