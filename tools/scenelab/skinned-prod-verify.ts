/** Production skin acceptance receipts. One headless browser at a time; no runtime query flag. */
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, writeJson, type Backend } from './session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import type { InstancedMesh } from 'three';
import { civilianClips, framesPerClip } from '../../src/render/characters/bakeInfected';

const out = resolve('docs/reports/skinned-prod'), receipts = [];
const backends = (process.env.BACKENDS ?? 'webgl2,webgpu').split(',') as Backend[];
const cases = new Set((process.env.CASES ?? 'humans,gore,details,clips,animals,infection,accessories,lod').split(','));
const spec: SceneSpec = {
  name: 'skinned-prod-humans', ground: 'asphalt', time: 'golden', size: 30, trace: true,
  actors: [
    { id: 'courier', kind: 'courier', at: [0, 7] },
    { id: 'woman', kind: 'pedestrian', at: [-2.5, 0], yaw: -30, look: { model: 'npc.civilian-woman-a', accessories: ['acc.hat-baseball-cap'] } },
    { id: 'man', kind: 'pedestrian', at: [-.8, 0], yaw: -30, look: { model: 'npc.civilian-man-b' } },
    { id: 'worker', kind: 'infected', archetype: 'infected.sprinter', at: [.8, 0], yaw: -30, state: 'idle', look: { model: 'inf.common-worker' } },
    { id: 'nurse', kind: 'infected', archetype: 'infected.sprinter', at: [2.5, 0], yaw: -30, state: 'idle', look: { model: 'inf.nurse' } },
  ],
  camera: { mode: 'pose', position: [7, 4.5, 10], target: [0, 1, 0] }, frames: 30,
};
try {
  for (const backend of backends) {
    const session = new SceneSession({ backend, tier: 'low', query: { crowdProbe: 'full' } });
    try {
      await session.open(); await session.load(spec); await session.step(30);
      if (cases.has('humans')) {
        await session.screenshot(resolve(out, `humans-${backend}.png`));
        const metrics = await session.metrics(), state = await session.page.evaluate(() => window.__SS__!.getState().render);
        receipts.push({ case: 'humans', backend, metrics, state, errors: [...session.errors] });
      }
      if (cases.has('gore')) {
        const gore: SceneSpec = { ...spec, name: 'skinned-prod-gore', barArchetypes: ['infected.sprinter'],
          actors: [{ id: 'courier', kind: 'courier', at: [0, 7], loadout: ['weapon.bat', 'weapon.fists'] },
            ...['arm', 'leg', 'head', 'flash'].map((id, i) => ({ id, kind: 'infected' as const, archetype: 'infected.sprinter', at: [i * 1.7 - 2.5, 0] as [number, number], yaw: -30, state: 'idle' as const, look: { model: 'inf.common-worker', accessories: [] } }))] };
        await session.load(gore); await session.step(1);
        const actors = (await session.metrics()).actors;
        const ids = Object.fromEntries(['arm', 'leg', 'head', 'flash'].map(id => [id, actors[id].entity]));
        await session.page.evaluate(ids => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          const crowd = (game.view as unknown as { crowd: { detach(id: number, limb: number): void; flash(id: number, strength: number): void } }).crowd;
          for (const id of [ids.arm, ids.leg, ids.head]) { const e = game.world.entities.get(id)!; e.health.current = 0; e.infected!.state = 'dead'; e.infected!.deadAt = game.world.tick; e.infected!.recoverAt = -1; }
          crowd.detach(ids.arm, 0); crowd.detach(ids.leg, 2); crowd.detach(ids.head, 4); crowd.flash(ids.flash, .45);
        }, ids);
        await session.screenshot(resolve(out, `severance-flash-${backend}.png`));
        const severed = await session.page.evaluate(() => window.__SS__!.getState().render);
        await session.page.evaluate(() => window.__SCENE__!.command('courier', { click: 'flash', part: 'chest' }));
        await session.step(1); const clicks = (await session.metrics()).clicks;
        await session.page.evaluate(() => { for (const id of ['arm', 'leg', 'head']) window.__SCENE__!.command(id, { corpse: true }); });
        await session.step(180); await session.screenshot(resolve(out, `severed-corpses-${backend}.png`));
        const corpses = await session.page.evaluate(() => window.__SS__!.getState().render);
        receipts.push({ case: 'gore', backend, ids, severed, clicks, corpses, errors: [...session.errors] });
      }
      if (cases.has('details')) {
        for (const [label, limb, height] of [['arm', 0, 1.25], ['leg', 2, .8], ['head', 4, 1.5]] as const) {
          await session.load({ ...spec, name: `skin-cap-${label}`, actors: [{ id: 'courier', kind: 'courier', at: [0, 12] },
            { id: 'cut', kind: 'infected', archetype: 'infected.sprinter', at: [0, 0], state: 'idle', look: { model: 'inf.common-worker', accessories: [] } }],
            camera: { mode: 'pose', position: [2.6, height + 1.2, -3.4], target: [0, height, 0] } });
          await session.step(1); const id = (await session.metrics()).actors.cut.entity;
          await session.page.evaluate(({ id, limb }) => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            const e = game.world.entities.get(id)!; e.health.current = 0; e.infected!.state = 'dead'; e.infected!.deadAt = game.world.tick; e.infected!.recoverAt = -1;
            (game.view as unknown as { crowd: { detach(id: number, limb: number): void } }).crowd.detach(id, limb);
          }, { id, limb });
          await session.screenshot(resolve(out, `cap-${label}-${backend}.png`));
          await session.page.evaluate(() => window.__SCENE__!.command('cut', { corpse: true })); await session.step(180);
          await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'pose', position: [2.6, 3.5, -3.4], target: [0, .3, 0] }));
          await session.screenshot(resolve(out, `frozen-${label}-${backend}.png`));
          const frozen = await session.page.evaluate(id => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            const crowd = (game.view as unknown as { crowd: { staticCorpses: { slots: Map<string, { page: { mesh: InstancedMesh }; index: number }> } } }).crowd;
            const slot = crowd.staticCorpses.slots.get(String(id)); if (!slot) throw Error('Corpse did not freeze');
            const g = slot.page.mesh.geometry, parts = g.getAttribute('_parts'), caps: Record<string, number> = {};
            const referenced = g.index ? new Set(Array.from(g.index.array)) : new Set(Array.from({ length: parts.count }, (_, i) => i));
            for (const i of referenced) if (parts.getW(i) >= 1024) caps[parts.getW(i) - 1024] = (caps[parts.getW(i) - 1024] ?? 0) + 1;
            return { caps, vertices: g.getAttribute('position').count, triangles: (g.index?.count ?? parts.count) / 3 };
          }, id);
          if (Object.keys(frozen.caps).length !== 1) throw Error(`${label}: missing or extra frozen caps`);
          receipts.push({ case: 'details', label, backend, frozen, errors: [...session.errors] });
        }
        await session.load({ ...spec, name: 'skin-hit-flash', actors: [{ id: 'courier', kind: 'courier', at: [0, 12] },
          { id: 'hit', kind: 'infected', archetype: 'infected.sprinter', at: [0, 0], state: 'idle', look: { model: 'inf.common-worker', accessories: [] } }],
          camera: { mode: 'pose', position: [3, 2.5, 4], target: [0, 1, 0] } });
        await session.step(1); await session.screenshot(resolve(out, `flash-before-${backend}.png`));
        const id = (await session.metrics()).actors.hit.entity;
        await session.page.evaluate(id => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          (game.view as unknown as { crowd: { flash(id: number, strength: number): void } }).crowd.flash(id, .45);
        }, id);
        await session.screenshot(resolve(out, `flash-after-${backend}.png`));
        const before = PNG.sync.read(readFileSync(resolve(out, `flash-before-${backend}.png`))), after = PNG.sync.read(readFileSync(resolve(out, `flash-after-${backend}.png`)));
        let pixels = 0, luminanceRise = 0;
        for (let i = 0; i < before.data.length; i += 4) {
          const delta = [0, 1, 2].map(c => after.data[i + c] - before.data[i + c]);
          if (Math.max(...delta.map(Math.abs)) > 4) { pixels++; luminanceRise += delta[0] * .2126 + delta[1] * .7152 + delta[2] * .0722; }
        }
        if (pixels < 100 || luminanceRise <= 0) throw Error('Hit flash did not brighten the visible body');
        receipts.push({ case: 'flash', backend, pixels, meanLuminanceRise: luminanceRise / pixels, errors: [...session.errors] });
        await session.page.evaluate(id => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          window.__SS__!.settings.set({ gore: 'Full' });
          game.world.combat!.damage.apply({ attackId: 9001, actionId: 'weapon.rocket-launcher', sourceId: 1, targetId: id,
            origin: { x: 0, z: 12 }, direction: { x: 0, z: -1 }, base: 10000, multiplier: 1, type: 'explosive', knockback: 0, stagger: 0 });
        }, id);
        await session.step(18); await session.screenshot(resolve(out, `explosive-severance-${backend}.png`));
        const effects = await session.page.evaluate(() => window.__SS__!.perf().effects);
        if (!effects || effects.detached < 5) throw Error('Explosive kill did not emit all five severed parts');
        receipts.push({ case: 'explosive-severance', backend, effects, errors: [...session.errors] });
      }
      if (cases.has('clips')) {
        const clips = civilianClips;
        for (let group = 0; group < clips.length; group += 8) {
          const names = clips.slice(group, group + 8);
          await session.load({ ...spec, name: `skin-civilian-clips-${group}`, actors: [{ id: 'courier', kind: 'courier', at: [0, 12] },
            ...names.map((_, i) => ({ id: `pose-${i}`, kind: 'pedestrian' as const, at: [(i % 4) * 2 - 3, Math.floor(i / 4) * 3] as [number, number], yaw: -25, look: { model: 'npc.civilian-man-b', accessories: [] } }))],
            camera: { mode: 'pose', position: [9, 8, 12], target: [0, .9, 1.5] } });
          await session.step(1);
          for (const phase of [5, 13, 21]) {
            const frames = names.map(name => civilianClips.indexOf(name) * framesPerClip + phase);
            const drawn = await session.page.evaluate(frames => {
              const game = (window.__SCENE__ as unknown as { game: Game }).game;
              let count = 0;
              game.view.scene.traverse(node => {
                const mesh = node as InstancedMesh, g = mesh.geometry;
                if (!mesh.count || !g?.hasAttribute('_clip_frame') || !g.hasAttribute('_skin')) return;
                count += mesh.count;
                const previous = mesh.onBeforeRender;
                mesh.onBeforeRender = function (...args) {
                  previous.apply(this, args);
                  for (let i = 0; i < mesh.count; i++) { g.getAttribute('_overlay').setW(i, frames[i % frames.length]); g.getAttribute('_clip_frame').setX(i, frames[i % frames.length]); g.getAttribute('_variant').setW(i, 1); }
                  for (const name of ['_overlay', '_clip_frame', '_variant']) g.getAttribute(name).needsUpdate = true;
                };
              }); return count;
            }, frames);
            if (drawn !== names.length) throw Error(`Civilian gallery lost actors ${drawn}/${names.length}`);
            await session.screenshot(resolve(out, `clips-${group}-${phase}-${backend}.png`));
            receipts.push({ case: 'clips', backend, names, phase, drawn, method: 'real civilian shader, authored atlas rows at three phases', errors: [...session.errors] });
          }
        }
      }
      if (cases.has('animals')) {
        await session.load({ ...spec, name: 'skin-quadrupeds', actors: [{ id: 'courier', kind: 'courier', at: [0, 12] },
          { id: 'healthy-zebra', kind: 'infected', archetype: 'infected.zebra', at: [-3, 0], yaw: -30, state: 'idle', look: { model: 'amb.zebra' } },
          { id: 'infected-zebra', kind: 'infected', archetype: 'infected.zebra', at: [0, 0], yaw: -30, state: 'idle', look: { model: 'inf.zebra' } },
          { id: 'dog', kind: 'infected', archetype: 'infected.dog', at: [3, 0], yaw: -30, state: 'idle', look: { model: 'inf.dog' } }],
          camera: { mode: 'pose', position: [8, 5, 11], target: [0, .7, 0] } });
        await session.step(30); await session.screenshot(resolve(out, `quadrupeds-${backend}.png`));
        receipts.push({ case: 'animals', backend, metrics: await session.metrics(), errors: [...session.errors] });
      }
      if (cases.has('infection') || cases.has('accessories')) {
        await session.load({ ...spec, name: 'skin-glasses-and-turning', actors: [{ id: 'courier', kind: 'courier', at: [0, 12] },
          { id: 'glasses', kind: 'pedestrian', at: [-1.2, 0], yaw: -30, look: { model: 'npc.civilian-woman-b', accessories: ['acc.hat-sun-hat'] } },
          { id: 'turning', kind: 'pedestrian', at: [1.2, 0], yaw: -30, look: { model: 'npc.civilian-man-b', accessories: [] } }],
          camera: { mode: 'pose', position: [4.5, 2.7, 5.5], target: [0, 1.2, 0] } });
        await session.step(1); await session.screenshot(resolve(out, `healthy-glasses-${backend}.png`));
        await session.page.evaluate(() => window.__SCENE__!.command('turning', { infect: {} })); await session.step(240);
        await session.screenshot(resolve(out, `turning-glasses-${backend}.png`));
        receipts.push({ case: 'infection-accessories', backend, metrics: await session.metrics(), errors: [...session.errors] });
      }
      if (cases.has('lod')) {
        await session.load({ ...spec, name: 'skin-lod', actors: [{ id: 'courier', kind: 'courier', at: [0, 12] },
          { id: 'figure', kind: 'infected', archetype: 'infected.sprinter', at: [0, 0], state: 'idle', look: { model: 'inf.nurse' } }] });
        for (const distance of [3, 14, 48]) {
          await session.page.evaluate(distance => { window.__SS__!.settings.set({ quality: 'high' }); window.__SCENE__!.setCamera({ mode: 'pose', position: [distance, distance * .7, distance], target: [0, .8, 0] }); }, distance);
          await session.step(2); await session.screenshot(resolve(out, `lod-${distance}-${backend}.png`));
          const drawn = await session.page.evaluate(() => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            const crowd = (game.view as unknown as { crowd: { batches: Map<string, { asset: string; count: number; mesh: InstancedMesh }> } }).crowd;
            return [...crowd.batches].filter(([, b]) => b.count).map(([key, b]) => ({ key, count: b.count, skin: b.mesh.geometry.hasAttribute('_skin') }));
          });
          receipts.push({ case: 'lod', backend, distance, drawn, errors: [...session.errors] });
        }
      }
      writeJson(resolve(out, 'visual-verification.json'), receipts);
      console.log(JSON.stringify({ backend, cases: [...cases], errors: session.errors }));
      if (session.errors.length) throw Error(`${backend}: browser console errors`);
    } finally { await session.close(); stopServer(); }
  }
} finally { stopServer(); }
