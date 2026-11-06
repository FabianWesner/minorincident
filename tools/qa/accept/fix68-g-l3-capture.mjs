/** Render the ordinary L3 opening through all three announced cohorts. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SceneSession, stopServer } from '../../scenelab/session.ts';
import { provenance } from './probe.ts';

const out = process.env.FIX68_G_CAPTURE_OUT ?? 'test-results/fix68-g/G-22-browser';
mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Ordinary production complete-bot input frames, 90 seconds from real L3 entry. Fixed simulation stepping; unchanged populations, camera and attack rules. Read-only cohort/pose observations and game-camera captures; no objective skips.', cells: [], errors: [] };
try {
  for (const tier of ['low', 'high']) {
    const session = new SceneSession({ backend: 'webgl2', tier, query: { ui: '1' } });
    try {
      await session.open();
      await session.page.evaluate(async tier => {
        const api = window.__SS__, game = window.__SCENE__.game;
        await api.loadLevel('L3', { seed: 1 });
        api.settings.set({ quality: tier }); api.cheats.god(true);
        game.ui.show(null); document.querySelector('.hud')?.setAttribute('data-scene-hud', '');
        document.documentElement.setAttribute('data-scene-hud', '');
        game.world.missions.begin(); api.pause(); api.bot.start('complete');
      }, tier);
      const captures = [], samples = [];
      for (let second = 0; second <= 90; second++) {
        if (second) await session.step(60);
        const sample = await session.page.evaluate(() => {
          const game = window.__SCENE__.game, w = game.world, state = w.missions.state.l3;
          return { tick: w.tick, phase: state.phase, attackAt: state.attackAt, player: { ...w.entities.get(1).transform },
            cohorts: [0, 1, 2].map(wave => ({ wave, planned: state.waves.filter(q => q.wave === wave).length, admitted: state.waves.filter(q => q.wave === wave && q.id).length })),
            active: w.missions.def.steps.filter(step => w.missions.state.steps[step.id].status === 'active').map(step => step.id),
            quality: game.quality.snapshot().tier, backend: window.__SS__.perf().backend };
        });
        samples.push(sample);
        const age = sample.attackAt ? (sample.tick - sample.attackAt) / 60 : -1;
        if (sample.attackAt && [1, 4, 19, 21, 24, 39, 41, 44, 59, 61].some(t => age >= t && age < t + 1)) {
          const file = `${out}/${tier}-age${Math.floor(age)}.png`;
          await session.screenshot(file);
          captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), sample });
        }
      }
      result.cells.push({ tier, samples, captures });
      result.errors.push(...session.errors);
    } catch (error) { result.errors.push({ tier, error: String(error) }); }
    finally { await session.close(); }
  }
} finally {
  stopServer();
  writeFileSync(process.env.FIX68_G_RECEIPT_OUT ?? 'docs/reports/fix68-g/G-22-browser.json', JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ cells: result.cells.map(c => ({ tier: c.tier, captures: c.captures.length })), errors: result.errors }));
process.exitCode = result.errors.length ? 1 : 0;
