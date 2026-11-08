/** Fresh game-camera gate prompts and physical E/click closure, with declared cohort setup. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Game } from '../../src/Game';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const out = 'test-results/l6-visual/gates'; mkdirSync(out, { recursive: true });
const rows = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ backend, tier, query: { ui: '1', profile: '0' } });
    try {
      await session.open();
      await session.page.evaluate(async ({ tier, save }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(save); await a.loadLevel('L6', { seed: 1 });
        a.pause(); a.missions.begin(); a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); a.input.clear();
        document.documentElement.setAttribute('data-scene-hud', '');
        for (const style of document.querySelectorAll('style')) if (style.textContent?.includes('#hud:not([data-scene-hud])')) style.remove();
      }, { tier, save: preset('L6-default') });
      for (const x of [90, 150, 210]) {
        await session.page.evaluate(async x => {
          const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, s = w.missions!.state.l6!;
          s.leaderX = x + 12; s.leaderZ = 15;
          for (const [i, r] of s.survivors.entries()) {
            r.status = 'following';
            w.solids.relocate(w.entities.get(r.id)!, { x: x + 5 + i * .7, z: 15, y: 1.3 }, 'probe.gate-roster', 0, false);
          }
          const dog = [...w.entities.iterate()].find(e => e.companion)!;
          w.solids.relocate(dog, { x: x + 3.5, z: 17.3, y: 1.3 }, 'probe.gate-corgi', 0, false);
          a.teleport(1, { x: x + 2.4, z: 17.3 }); a.camera.follow(); await a.step(1);
        }, x);
        const capture = async (phase: string, zoom: number) => {
          await session.page.evaluate(async zoom => { window.__SS__!.camera.zoom(zoom); await window.__SS__!.step(0); }, zoom);
          await session.ready();
          const file = `${out}/${backend}-${tier}-gate${x}-${phase}-z${zoom}.png`; await session.page.screenshot({ path: file });
          const state = await session.page.evaluate(x => {
            const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, m = w.missions!, s = m.state.l6!, gate = s.gates.find(g => g.x === x)!;
            return { tick: w.tick, backend: a.perf().backend, quality: a.getState().render.quality, camera: a.getState().render.camera, gate: { ...gate }, anchor: m.def.anchors['l6-next'], marker: m.state.marker, prompt: m.l6!.gateStatus(gate.id), through: s.survivors.filter(r => r.status === 'following' && w.entities.get(r.id)!.transform.x > x + 2).length, roster: s.survivors.length, player: { ...w.entities.get(1)!.transform } };
          }, x);
          return { file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), state };
        };
        const open = []; for (const zoom of [1, 1.5]) open.push(await capture('open', zoom));
        const input = x === 150 ? 'click' : 'E';
        if (input === 'E') {
          await session.page.keyboard.down('e'); await session.page.evaluate(() => window.__SS__!.step(65)); await session.page.keyboard.up('e');
        } else {
          const p = await session.page.evaluate(x => window.__SS__!.input.project({ x, z: 15 }), x);
          await session.page.mouse.move(p.x, p.y); await session.page.mouse.down(); await session.page.evaluate(() => window.__SS__!.step(1)); await session.page.mouse.up(); await session.page.evaluate(() => window.__SS__!.step(65));
        }
        const closed = []; for (const zoom of [1, 1.5]) closed.push(await capture('closed', zoom));
        rows.push({ backend, tier, x, input, open, closed, errors: [...session.errors] });
        writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), method: 'Explicit presentation fixture: original29-person roster and corgi placed beyond each gate, unchanged production gates and player stats. Actual physical E or mouse click triggers the ordinary controller; paused clocks are stepped, so no performance claim.', rows }, null, 2) + '\n');
        assert.ok(closed.every(c => c.state.gate.closedAt > 0), `${backend}/${tier}/${x}: physical ${input} did not close gate`);
        assert.deepEqual(session.errors, []); console.log(backend, tier, x, input, 'closed');
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
