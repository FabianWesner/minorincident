/** Ordinary mortal L5 route; current resident introduction camera/census. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const out = 'test-results/fix67-b/l5-metro'; mkdirSync(out, { recursive: true }); const rows = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { profile: '0', ui: '1' } });
    try {
      await session.open(); const save = preset('L5-default'); save.settings.quality = tier;
      await session.page.evaluate(async ({ save, tier }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false }); a.campaign.restore(save);
        await a.loadLevel('L5', { seed: 1 }); a.pause(); a.missions.begin(); a.cheats.god(false); a.camera.follow(); a.camera.zoom(1.5);
        document.documentElement.setAttribute('data-scene-hud', '');
        for (const style of document.querySelectorAll('style')) if (style.textContent?.includes('#hud:not([data-scene-hud])')) style.remove();
        a.bot.start('complete');
      }, { save, tier });
      const samples = [], captures = [], seen = new Set<string>();
      for (let step = 0; step < 900; step++) {
        await session.page.evaluate(async () => { await window.__SS__!.step(30); });
        const state = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions?.state.l5;
          if (!s) return null;
          const figures = window.__SS__!.crowdFigures();
          return { tick: w.tick, phase: s.phase, metroAt: s.metroAt, shutterAt: s.shutterAt, doneAt: s.doneAt,
            tier: w.infected!.director.tier, renderTier: g.view.getState().quality, camera: g.view.getState().camera,
            player: { ...w.entities.get(1)!.transform }, god: w.combat!.damage.god,
            residents: s.stationIds.map(id => { const e = w.entities.get(id)!, p = e.transform;
              return { id, at: { ...p }, drawn: figures.some(f => f.id === id && f.drawn),
                feet: g.view.project(p.x, p.y - .7, p.z), head: g.view.project(p.x, p.y + .7, p.z) };
            }) };
        });
        if (!state) break;
        if (state.metroAt) {
          samples.push(state);
          const age = Math.floor((state.tick - state.metroAt) / 60), label = state.shutterAt ? 'closed' : `arrival-${age}`;
          if (!seen.has(label) && (state.shutterAt || age <= 2)) {
            seen.add(label); await session.ready(); const file = `${out}/${tier}-${label}.png`;
            await session.page.screenshot({ path: file }); captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
          }
        }
        if (state.doneAt) break;
      }
      rows.push({ tier, samples, captures, errors: session.errors });
      writeFileSync(`${out}/ledger.json`, JSON.stringify({ ...provenance(), rows }, null, 2) + '\n');
      console.log(tier, 'metro samples', samples.length, 'captures', captures.length,
        'peak drawn', Math.max(0, ...samples.map(s => s.residents.filter(r => r.drawn).length)));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
