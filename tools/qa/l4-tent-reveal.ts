/** Q-229: same-frame courier visibility behind the reception tents and under the triage gazebo at zoom 1.5.
 * SCENE_PORT=4734 sh tools/e2e-lock.sh npx tsx tools/qa/l4-tent-reveal.ts
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { measureCourierShare, measureCut } from '../scenelab/run';
import type { Game } from '../../src/Game';
const out = process.env.TENT_OUT ?? 'test-results/l10-perf/tent-reveal';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of (process.env.TENT_LOW_ONLY ? ['low'] as const : ['low', 'high'] as const)) {
    const s = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
    try {
      await s.open();
      await s.page.evaluate('globalThis.__name = fn => fn');
      await s.page.evaluate(async phase => {
        const a = window.__SS__!;
        await a.loadLevel('L4', { seed: 1, ...(phase === 'collapse' ? { checkpoint: 'line-break' } : {}) }); a.pause(); a.missions.begin(); a.cheats.god(true);
        if (phase !== 'collapse') { a.cheats.completeObjective('ride'); await a.step(1); }
        if (phase === 'war') { a.cheats.completeObjective('quartermaster'); await a.step(1800); await a.screenshotReady(); }
      }, process.env.TENT_PHASE);
      for (const spot of [{ name: 'tent', x: -30.65, z: 10.5 }, { name: 'gazebo', x: -22.3, z: -12.3 }, { name: 'plaza-south-tent', x: -30.1, z: -7.7 }, { name: 'plaza-north-tent', x: -30.1, z: -14.3 }]) {
        const pose = await s.page.evaluate(async spot => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          a.teleport(1, spot); g.view.view.reset(g.world.entities.get(1)!.transform, true); a.camera.zoom(1.5);
          await a.screenshotReady();
          return { player: a.getEntity(1)!.transform, camera: a.getState().render.camera, audit: g.view.labProbes().districts!.seeThroughAudit() };
        }, spot);
        const name = `${backend}-${tier}-${spot.name}`;
        const cut = await measureCut(s), visible = await measureCourierShare(s);
        await s.screenshot(`${out}/${name}-reveal.png`);
        await s.page.evaluate(() => window.__SS__!.settings.set({ seeThroughReference: true }));
        const reference = await measureCourierShare(s);
        await s.page.evaluate(() => window.__SS__!.settings.set({ seeThroughReference: false }));
        await s.page.evaluate(() => window.__SCENE__!.cutProbe(true));
        const uncut = await measureCourierShare(s);
        await s.screenshot(`${out}/${name}-uncut.png`);
        await s.page.evaluate(() => window.__SCENE__!.cutProbe(false));
        const row = { name, pose, cut, visible, reference, uncut, errors: [...s.errors] }; rows.push(row);
        writeFileSync(`${out}/evidence.json`, JSON.stringify(rows, null, 2));
        console.log(`${name}: courier ${visible.visible}/${reference.visible} forced-open pixels, uncut ${(uncut.share * 100).toFixed(1)}%, cut ${cut.inside} px`);
        assert.ok(visible.reference > 100, `${name}: a real courier silhouette`);
        assert.ok(visible.visible >= reference.visible * .99, `${name}: roof must reveal the courier as fully as the forced-open reference`);
        assert.ok(uncut.share < visible.share, `${name}: the roof actually occludes without reveal`);
        assert.ok(cut.inside > 100, `${name}: the roof opens around the courier`);
        assert.deepEqual(s.errors, []);
      }
    } finally { await s.close(); }
  }
} finally { stopServer(); }
