/** Render actual completed L5 saves in L6 without relocating any actor. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { CampaignSave } from '../../src/sim/progression/Campaign';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const out = 'test-results/fix67-b/l6-carry-render'; mkdirSync(out, { recursive: true });
const rows = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const source = `test-results/fix67-b/l6-handover/${tier}-L5-save.json`;
    const save = JSON.parse(readFileSync(source, 'utf8')) as CampaignSave;
    const session = new SceneSession({ tier, backend: 'webgl2', query: { profile: '0', ui: '1' } });
    try {
      await session.open();
      await session.page.evaluate(async ({ save, tier }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(save);
        await a.loadLevel('L6', { seed: 1 }); a.pause(); a.missions.begin(); a.camera.follow(); a.camera.zoom(1.5);
        document.documentElement.setAttribute('data-scene-hud', '');
        for (const style of document.querySelectorAll('style')) if (style.textContent?.includes('#hud:not([data-scene-hud])')) style.remove();
      }, { save, tier });
      const captures = [];
      for (const label of ['opening', 'four-seconds', 'overview']) {
        if (label === 'four-seconds') await session.page.evaluate(async () => { await window.__SS__!.step(240); });
        if (label === 'overview') await session.page.evaluate(() => { window.__SS__!.camera.cinematic({ position: [28, 25, 21], target: [6, .6, -4] }, true); });
        await session.ready(); const file = `${out}/${tier}-${label}.png`; await session.page.screenshot({ path: file });
        captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
      }
      const state = await session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
        return { tier: w.infected!.director.tier, renderTier: g.view.getState().quality,
          roster: w.missions!.state.l6!.survivors.map(row => {
            const e = w.entities.get(row.id)!; return { id: e.id, routine: row.routine, at: e.transform,
              health: e.health, story: e.civilian!.story, allyWeapon: e.civilian!.ally?.weapon };
          }) };
      });
      assert.equal(state.tier, tier); assert.equal(state.roster.length, save.stationOccupants!.length + (save.survivors?.length ?? 0));
      rows.push({ tier, source, sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex'), state, captures, errors: session.errors });
      writeFileSync(`${out}/ledger.json`, JSON.stringify({ ...provenance(), rows }, null, 2) + '\n');
      console.log(tier, 'rendered', state.roster.length, 'carried actors');
    } finally { await session.close(); }
  }
} finally { stopServer(); }
