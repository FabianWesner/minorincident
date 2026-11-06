/** Both-tier production Northgate closure, actual night shot and result accounting. Explicit exit fixture. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';

const out = 'test-results/fix67-b/northgate-active'; mkdirSync(out, { recursive: true });
const rows = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { profile: '0', ui: '1' } });
    try {
      await session.open();
      const save = preset('L6-default'); save.settings.quality = tier;
      await session.page.evaluate(async ({ tier, save }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false }); a.campaign.restore(save);
        await a.loadLevel('L6', { seed: 1 }); a.pause(); a.missions.begin(); a.camera.follow(); a.camera.zoom(1.5);
        document.documentElement.setAttribute('data-scene-hud', '');
        for (const style of document.querySelectorAll('style')) if (style.textContent?.includes('#hud:not([data-scene-hud])')) style.remove();
        a.teleport(1, { x: 255.5, z: 15.9 }); await a.step(2);
      }, { tier, save });
      const captures = [];
      const capture = async (label: string) => {
        await session.ready(); const file = `${out}/${tier}-${label}.png`;
        await session.page.screenshot({ path: file });
        captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
      };
      await capture('open');
      await session.page.evaluate(async () => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); a.cheats.completeObjective('retreat');
        const s = w.missions!.state.l6!;
        for (const [i, row] of s.survivors.entries()) {
          const e = w.entities.get(row.id)!; row.status = 'following';
          w.solids.relocate(e, { x: 265 + Math.floor(i / 3), z: 15 + (i % 3) * .8, y: 4.62 }, 'qa.northgate-roster', 0, false);
        }
        a.teleport(1, { x: 264, z: 15.9 }); await a.step(2); a.resume();
      });
      const samples = [];
      for (let second = 0; second <= 12; second++) {
        const sample = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, m = w.missions!, s = m.state.l6!;
          return { tick: w.tick, tier: w.infected!.director.tier, renderTier: g.view.getState().quality, gateAt: s.gateAt,
            phase: m.state.phase, caption: document.body.innerText.includes('Night. Still alive.'),
            camera: g.view.getState().camera, result: m.state.result,
            roster: s.survivors.map(r => ({ id: r.id, status: r.status })),
            gate: [...w.entities.iterate()].find(e => e.barricade?.slot.id === 'l6-night-exit') };
        });
        samples.push(sample);
        if ([0, 2, 5, 7, 12].includes(second)) await capture(`night-${second}`);
        if (second < 12) await session.page.waitForTimeout(1000);
      }
      assert.equal(samples[0].tier, tier); assert.ok(samples[0].gateAt);
      assert.ok(samples.some(s => s.caption), 'actual night caption must appear');
      rows.push({ tier, samples, captures, errors: session.errors });
      writeFileSync(`${out}/ledger.json`, JSON.stringify({ ...provenance(), rows }, null, 2) + '\n');
      console.log(tier, 'night captures', captures.length, 'last phase', samples.at(-1)!.phase);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
