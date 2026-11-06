/** Current production renderer census at the actual cellar-entry tick. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { preset } from '../../src/sim/progression/Campaign';
import { provenance } from './accept/probe';
const out = 'test-results/sweep-b/L4-render'; mkdirSync(`${out}/captures`, { recursive: true });
const rows = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { profile: '0', ui: '1' } });
    try {
      await session.open();
      const save = preset('L4-default'); save.settings.quality = tier;
      await session.page.evaluate(async ({ tier, save }) => {
        document.documentElement.setAttribute('data-scene-hud', '');
        const a = window.__SS__!; a.campaign.restore(save); await a.loadLevel('L4', { seed: 1 });
        a.pause(); a.settings.set({ quality: tier, cameraShake: false }); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5); a.bot.start('complete');
      }, { tier, save });
      const samples = [];
      let entry: unknown = null;
      for (let i = 0; i < 360; i++) {
        await session.page.evaluate(async () => { await window.__SS__!.step(60); });
        const state = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l4!;
          const render = g.view.getState();
          return { actualTier: w.infected!.director.tier, renderTier: render.quality, tick: w.tick, phase: s.phase, descendAt: s.descendAt, fires: s.fires, glass: s.glass.length, burningVehicleIds: s.burning,
            corpseLayout: window.__SS__!.debug.corpseLayout(), camera: render.camera, vfx: render.vfx,
            livingCourier: w.entities.get(1)!.health.current, source: w.scenario };
        });
        samples.push({ tick: state.tick, phase: state.phase, corpseLayout: state.corpseLayout, camera: state.camera });
        if (state.descendAt) { entry = state; break; }
      }
      if (!entry) throw new Error(`No actual cellar entry for ${tier}`);
      const file = `${out}/captures/${tier}-cellar-entry.jpg`; await session.page.screenshot({ path: file, type: 'jpeg', quality: 90 });
      rows.push({ tier, entry, samples, file, errors: session.errors });
      console.log(tier, JSON.stringify(entry));
      writeFileSync(`${out}/proof.json`, JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l4-render.ts')).digest('hex'), method: 'Controlled renderer supplement: ordinary production complete bot input with protected courier, no objective advance or actor relocation. Actual L4 descendAt ends the run. Real production VFX pool census, corpse layout and camera snapshots after each rendered second; no performance timing.', rows }, null, 2) + '\n');
    } finally { await session.close(); }
  }
} finally { stopServer(); }
