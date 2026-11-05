/** Native boarding/ride captures; pooled headless browser, private preview. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const out = process.env.FIX54_OUT ?? 'test-results/fix54-a/ride';
mkdirSync(`${out}/captures`, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['low', 'high'] as const) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
    try {
      await s.open();
      await s.page.evaluate(async tier => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.bot.start('no-axe');
        document.documentElement.setAttribute('data-scene-hud',''); document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));
        for (let i = 0; i < 120 && a.missions.state()!.l2!.phase !== 'ride'; i++) await a.step(30);
        if (a.missions.state()!.l2!.phase !== 'ride') throw new Error('Native bot did not board');
      }, tier);
      for (const seconds of (process.env.RIDE_FULL_PHASES === '1' ? [0, 3, 12, 22, 26] : [3, 12, 22])) {
        await s.page.evaluate(async seconds => {
          const a = window.__SS__!;
          while (a.getState().tick - a.missions.state()!.l2!.departAt < seconds * 60) await a.step(1);
        }, seconds);
        for (const zoom of [.5, 1.5]) {
          const details = await s.page.evaluate(async zoom => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            a.camera.zoom(zoom); await a.screenshotReady();
            const l2 = g.world.missions!.state.l2!, render = a.getState().render;
            return { tick: g.world.tick, phase: l2.phase, seated: l2.seated, departAt: l2.departAt,
              actualZoom: g.view.view.playerZoom, render: { backend: render.backend, quality: render.quality, camera: render.camera }, occupants: a.getState().render.vehicles.find(r => r.id === l2.truckId) };
          }, zoom);
          const file = `${out}/captures/${backend}-${tier}-s${seconds}-z${zoom}.png`;
          await s.page.screenshot({ path: file });
          rows.push({ backend, tier, seconds, zoom, ...details, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
        }
      }
      if (s.errors.length) throw new Error(s.errors.join('\n'));
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), method: 'Native no-axe InputFrame bot boards normally, no objective skips; paused fixed ticks and actual follow camera; no performance timing', rows }, null, 2)); }
