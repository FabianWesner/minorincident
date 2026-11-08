/** Explicit headlamp, follower-bar and Northgate presentation fixtures. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';
import type { CharacterView } from '../../src/render/characters/CharacterView';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const backend = process.env.L6_VISUAL_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const zoom = Number(process.env.L6_VISUAL_ZOOM ?? '1.5');
if (![1, 1.5].includes(zoom)) throw new Error('Expected zoom 1 or 1.5');
const out = process.env.L6_VISUAL_OUT ?? 'test-results/sweep-b/L6-render'; mkdirSync(`${out}/captures`, { recursive: true });
const rows = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend, query: { profile: '0', ui: '1' } });
    try {
      await session.open();
      const save = process.env.L6_VISUAL_SAVE_DIR ? JSON.parse(readFileSync(`${process.env.L6_VISUAL_SAVE_DIR}/${tier}-L5-save.json`, 'utf8')) as ReturnType<typeof preset> : preset('L6-default'); save.settings.quality = tier;
      await session.page.evaluate(async ({ tier, save, zoom }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier }); a.campaign.restore(save); await a.loadLevel('L6', { seed: 1 });
        a.pause(); a.missions.begin(); a.cheats.god(false); a.camera.follow(); a.camera.zoom(zoom);
        document.documentElement.setAttribute('data-scene-hud', '');
        for (const style of document.querySelectorAll('style')) if (style.textContent?.includes('#hud:not([data-scene-hud])')) style.remove();
      }, { tier, save, zoom });
      const captures: string[] = [];
      const capture = async (name: string) => { const p = `${out}/captures/${tier}-${name}.jpg`; await session.ready(); await session.page.screenshot({ path: p, type: 'jpeg', quality: 92 }); captures.push(p); };
      const shelter = [];
      for (let second = 0; second <= 4; second++) {
        if (second) await session.page.evaluate(async () => { await window.__SS__!.step(60); });
        shelter.push(await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
          return { tick: w.tick, roster: w.missions!.state.l6!.survivors.map(r => {
            const e = w.entities.get(r.id)!;
            return { ...r, at: { ...e.transform }, health: e.health, story: e.civilian?.story, activity: e.civilian?.schedule?.[e.civilian?.scheduleStep ?? 0]?.activity, weapons: e.weapons };
          }), figures: window.__SS__!.crowdFigures() };
        }));
        if (second === 0 || second === 4) await capture(`shelter-${second}`);
      }
      for (const spot of [{ name: 'seats', x: 0, z: -10 }, { name: 'care', x: 15, z: 3 }]) {
        await session.page.evaluate(async at => { const a = window.__SS__!; a.teleport(1, { x: at.x, z: at.z }); a.camera.follow(); await a.step(0); }, spot);
        await capture(`shelter-${spot.name}`);
      }
      await session.page.evaluate(async () => { const a = window.__SS__!; a.teleport(1, { x: 3, z: 0 }); a.camera.follow(); await a.step(0); });
      const lampState = () => session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
        const lighting = (g.view as unknown as { lighting: Lighting }).lighting;
        const character = (g.view as unknown as { character: CharacterView }).character;
        const lamp = [...w.entities.iterate()].find(e => e.archetype === 'pickup.headlamp');
        return { backend: window.__SS__!.perf().backend, camera: g.view.getState().camera, tick: w.tick, tier: w.infected!.director.tier, renderTier: g.view.getState().quality, player: { ...w.entities.get(1)!.transform }, flashlight: w.missions!.state.l6!.flashlight,
          lamp: lamp ? { id: lamp.id, at: { ...lamp.transform }, hidden: lamp.hidden, pickup: lamp.pickup } : null,
          newWeaponIds: [...w.entities.iterate()].filter(e => e.pickup && 'actionId' in e.pickup).map(e => e.id),
          headYaw: character.headYaw(), headlampOn: lighting.headlampOn.value, beam: [lighting.headlampAim.value.x, lighting.headlampAim.value.y], input: w.inputFrame };
      });
      const before = await lampState(); await capture('lamp-uncollected');
      await session.page.evaluate(async () => { await window.__SS__!.step(120); });
      const afterIdle = await lampState();
      await session.page.evaluate(async () => { const a = window.__SS__!; const w = (window.__SCENE__ as unknown as { game: Game }).game.world; const p = w.entities.get(1)!.transform, lamp = [...w.entities.iterate()].find(e => e.archetype === 'pickup.headlamp')!.transform; const d = Math.hypot(lamp.x - p.x, lamp.z - p.z); a.input.set({ move: { x: (lamp.x - p.x) / d, z: (lamp.z - p.z) / d } }); await a.step(45); a.input.clear(); });
      const afterApproach = await lampState(); await capture('lamp-approach');
      await session.page.evaluate(async () => { const a = window.__SS__!; a.teleport(1, { x: 40, z: 15 }); a.camera.follow(); a.input.set({ move: { x: 1, z: 0 }, aim: { x: -1, z: 0 }, aimSource: 'pointer', strafe: true }); await a.step(60); });
      const opposed = await lampState(); await capture('lamp-opposed');
      await session.page.evaluate(() => window.__SS__!.input.clear());
      if (process.env.L6_VISUAL_PREFIX_ONLY === '1') {
        rows.push({ tier, backend, zoom, shelter, headlamp: { before, afterIdle, afterApproach, opposed }, bars: [], open: null, night: [], captures, errors: session.errors });
        writeFileSync(`${out}/proof.json`, JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l6-render.ts')).digest('hex'), method: 'Carried shelter and actual headlamp presentation prefix only; follower and ending fixtures are separate. Original health/speeds/counts retained; no performance claim.', rows }, null, 2) + '\n');
        console.log(tier, 'shelter/headlamp prefix done', captures.length); continue;
      }
      const bars = [];
      for (let batch = 0; batch < 6; batch++) {
        const row = await session.page.evaluate(async batch => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l6!;
          if (batch === 0) { a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); await a.step(30); }
          // All29 original actors remain. Move a batch to an empty existing
          // lane for readable per-ID bars, then return it before the next batch.
          const ids = s.survivors.slice(batch * 5, batch * 5 + 5).map(r => r.id);
          const old = ids.map(id => ({ id, at: { ...w.entities.get(id)!.transform } }));
          a.teleport(1, { x: 113, z: 12.5 });
          s.leaderX = 116; s.leaderZ = 15;
          ids.forEach((id, i) => { const e = w.entities.get(id)!; w.solids.relocate(e, { x: 109 + i * 1.7, z: 15, y: 1.3 }, 'probe.bar-batch', 0, false); e.hidden = false; e.civilian!.survivor!.mode = 'follow'; });
          a.camera.follow(); await a.step(30); await a.screenshotReady();
          return { batch, ids, old, bars: g.view.getState().healthBars, figures: a.crowdFigures().filter(f => ids.includes(f.id)), rosterCount: s.survivors.length };
        }, batch);
        await capture(`bars-${batch}`); bars.push(row);
        await session.page.evaluate(old => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          for (const { id, at } of old) { const e = w.entities.get(id)!; Object.assign(e.transform, at); w.solids.forget(e); w.spatial.set(id, at.x, at.z); }
        }, row.old);
      }
      // Before any exit event the real passage must allow the player's capsule.
      const open = await session.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
        a.teleport(1, { x: 255.5, z: 15.9 }); a.camera.follow(); await a.step(5);
        const p = w.entities.get(1)!, before = { ...p.transform };
        a.input.set({ move: { x: 1, z: 0 } }); await a.step(90); a.input.clear();
        return { before, after: { ...p.transform }, gateAt: w.missions!.state.l6!.gateAt, open: w.solids.clear({ x: 258, z: 15.9, y: 3.9 }, .35, 1, false) };
      });
      await capture('northgate-open');
      const night = [];
      await session.page.evaluate(async () => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, s = w.missions!.state.l6!;
        a.cheats.completeObjective('retreat');
        s.survivors.forEach((r, i) => { const e = w.entities.get(r.id)!; r.status = 'following'; w.solids.relocate(e, { x: 265 + Math.floor(i / 3), z: 15 + (i % 3) * .8, y: 3.9 }, 'probe.northgate-roster', 0, false); });
        a.teleport(1, { x: 264, z: 15.9 }); await a.step(1);
      });
      for (let second = 0; second < 8; second++) {
        const state = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, m = w.missions!, s = m.state.l6;
          return { level: w.scenario, tick: w.tick, gateAt: s?.gateAt, closed: !w.solids.clear({ x: 258, z: 15.9, y: 3.9 }, .35, 1, false), cinematic: m.state.cinematic, result: m.state.result,
            caption: document.body.innerText.includes('Night. Still alive.'), camera: g.view.getState().camera, player: w.entities.get(1)?.transform, roster: s?.survivors.map(r => ({ id: r.id, status: r.status })) };
        });
        night.push(state); if ([0, 3, 6, 7].includes(second)) await capture(`night-${second}`);
        if (second < 7) await session.page.evaluate(async () => { await window.__SS__!.step(60); });
      }
      rows.push({ tier, backend, zoom, shelter, headlamp: { before, afterIdle, afterApproach, opposed }, bars, open, night, captures, errors: session.errors });
      writeFileSync(`${out}/proof.json`, JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l6-render.ts')).digest('hex'), method: 'Explicit controlled presentation fixtures, not a full route. Initial ordinary directional input approaches the existing headlamp without E, then moves opposite pointer aim. Bar batches relocate five existing identities at a time, retaining the original29-person roster. Northgate first receives ordinary input while open, then original29-person roster is staged beyond the exit and the production controller closes the gate and starts its actual night shot. No speeds, health, counts, timers or targets changed; no performance timing.', rows }, null, 2) + '\n');
      console.log(tier, 'done', captures.length);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
