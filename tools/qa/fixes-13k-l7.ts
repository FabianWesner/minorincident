/** Q-127: real L7 departure throughout the shot, every requested zoom/tier/backend. Run under e2e-lock (one browser). */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VISUAL_OUT ?? 'test-results/fixes-13k/l7';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of (process.env.VISUAL_BACKENDS ?? 'webgl2,webgpu').split(',') as Backend[]) for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
    try {
      await session.open();
      await session.page.evaluate('globalThis.__name = fn => fn');
      const originalIds = await session.page.evaluate(async tier => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel('L7', { seed: 1, progression: 'L7-default' }); a.pause(); a.cheats.god(true); a.missions.begin();
        const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, departure = w.l7Departure!;
        w.l7Encounters!.state.started = true;
        a.cheats.completeObjective('rocket'); a.cheats.completeObjective('corridor');
        const ids = w.l7Encounters!.state.roster.map(r => r.id);
        // Every original follower is aboard; the production bus, city, camera and weather run unchanged.
        for (const r of w.l7Encounters!.state.roster) { const e = w.entities.get(r.id)!; e.hidden = true; e.passengerOf = departure.state.busId; departure.state.boarded.push(r.id); }
        a.teleport(1, { x: -70.5, z: 47.5 }); departure.state.phase = 'boarding'; departure.state.readyAt = w.tick - 60;
        g.view.settings({ cameraShake: false, cheapDof: false });
        await a.step(1);
        return ids;
      }, tier);
      const cells = new Map([.5, 1, 1.5].map(zoom => [zoom, [] as { frame: number; jpeg: Buffer }[]]));
      let previous = 0;
      for (const frame of [0, 120, 300, 450]) {
        await session.page.evaluate(n => window.__SS__!.step(n), frame - previous); previous = frame;
        for (const zoom of [.5, 1, 1.5]) {
          const proof = await session.page.evaluate(async zoom => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
            g.view.view.zoom(Math.log(zoom / g.view.view.getState().targetZoom), true);
            g.view.advance(0); g.view.update(1); await a.screenshotReady();
            return { backend: a.perf().backend, quality: a.getState().render.quality, camera: a.getState().render.camera, departure: a.getState().l7Departure, originalRoster: a.getState().l7!.roster.length };
          }, zoom);
          assert.equal(proof.backend, backend === 'webgl2' ? 'webgl' : 'webgpu'); assert.equal(proof.quality, tier);
          assert.deepEqual(proof.departure!.boarded, originalIds); assert.equal(proof.originalRoster, originalIds.length); assert.ok(originalIds.length > 0);
          const name = `${backend}-${tier}-z${zoom}-f${frame}`;
          const jpeg = await session.page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 88 });
          cells.get(zoom)!.push({ frame, jpeg }); rows.push({ name, ...proof, errors: session.errors });
        }
      }
      for (const [zoom, images] of cells) await session.makeSheet(images, `${out}/${backend}-${tier}-z${zoom}-sheet.jpg`, 640, 600);
      assert.deepEqual(session.errors, []);
      writeFileSync(`${out}/evidence.json`, JSON.stringify(rows, null, 2));
      console.log(`${backend} ${tier}: 12 full-city departure captures; ${originalIds.length}/${originalIds.length} passengers retained`);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
