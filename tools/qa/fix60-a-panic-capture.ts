/** L2-05: production framing plus explicitly controlled close/wide inspection of the same panic ticks. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const out = process.env.PANIC_CAPTURE_OUT ?? 'test-results/fix60-a/panic';
mkdirSync(`${out}/captures`, { recursive: true });
const rows = [];
try {
  for (const backend of ['webgpu', 'webgl2'] as const) for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
    try {
      await session.open();
      await session.page.evaluate('window.__name = f => f');
      await session.page.evaluate(async tier => {
        const a = window.__SS__!;
        document.documentElement.setAttribute('data-scene-hud', '');
        a.settings.set({ quality: tier }); await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1); a.bot.start('no-axe');
        for (let i = 0; i < 240 && a.missions.state()!.l2!.phase !== 'doors'; i++) await a.step(30);
        if (a.missions.state()!.l2!.phase !== 'doors') throw new Error('Native no-axe input did not reach forcing');
        a.bot.stop(); a.input.clear(); await a.screenshotReady();
      }, tier);
      await session.page.addStyleTag({ content: '.story-bubble{visibility:visible!important}' });
      for (let sample = 0; sample < 3; sample++) {
        if (sample) await session.page.evaluate(async () => { await window.__SS__!.step(60); await window.__SS__!.screenshotReady(); });
        const state = await session.page.evaluate(() => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game, world = game.world, state = world.missions!.state.l2!, view = game.view.view;
          if (state.doorsOpenAt) throw new Error('Panic sample crossed doorsOpen');
          const figures = window.__SS__!.crowdFigures();
          return { tick: world.tick, phase: state.phase, expected: window.__SS__!.getState().render.quality === 'low' ? 20 : 30,
            quality: window.__SS__!.getState().render.quality, backend: window.__SS__!.getState().render.backend,
            playerZoom: view.playerZoom, position: view.camera.position.toArray(), target: view.cameraTarget.toArray(),
            actors: state.trappedIds.map(id => { const e = world.entities.get(id)!; return { id, hidden: !!e.hidden, pending: e.pendingAdmission,
              at: { ...e.transform }, clip: e.civilian?.story?.clip, drawn: figures.find(figure => figure.id === id)?.drawn ?? false }; }) };
        });
        const captures = [];
        for (const inspectionScale of [null, .5, 1.5]) {
          if (inspectionScale !== null) await session.page.evaluate(({ scale, position, target }) => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            // Camera-only inspection of the market, preserving this native tick,
            // actor states, direction and production camera distance at scale1.
            const focus: [number, number, number] = [-55.6, 1.3, -42.2];
            game.view.view.inspectionPose = { target: focus, position: focus.map((v, i) => v + (position[i] - target[i]) * scale) as [number, number, number] };
            game.view.update(1);
          }, { scale: inspectionScale, position: state.position, target: state.target });
          await session.page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
          const file = `${out}/captures/${backend}-${tier}-t${state.tick}-${inspectionScale === null ? 'production' : `inspection-${inspectionScale}`}.png`;
          await session.page.screenshot({ path: file });
          const camera = await session.page.evaluate(() => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game, view = game.view.view;
            return { tick: game.world.tick, position: view.camera.position.toArray(), target: view.cameraTarget.toArray(), distance: view.camera.position.distanceTo(view.cameraTarget) };
          });
          assert.equal(camera.tick, state.tick);
          captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), inspectionScale, camera });
        }
        await session.page.evaluate(() => { const game = (window.__SCENE__ as unknown as { game: Game }).game; game.view.view.inspectionPose = null; game.view.update(1); });
        rows.push({ ...state, captures });
      }
      assert.deepEqual(session.errors, []);
      console.log(JSON.stringify({ backend, tier, samples: rows.filter(row => row.quality === tier && row.backend === (backend === 'webgl2' ? 'webgl' : backend)).length }));
    } finally { await session.close(); }
  }
} finally {
  stopServer();
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
    method: 'Native no-axe InputFrames from fresh L2 to forcing, then three closed-door samples60ticks apart. Each has unmodified production framing and two explicitly camera-only inspection scales at the same tick; these are not claimed as unlocked gameplay zooms. No performance timing.', rows }, null, 2) + '\n');
}
