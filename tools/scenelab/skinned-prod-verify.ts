/** Production skin acceptance receipts. One headless browser at a time; no runtime query flag. */
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, writeJson, type Backend } from './session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import type { InstancedMesh } from 'three';
import { authoredClips, strides } from '../../src/render/characters/clips';
import { idleOffset } from '../../src/render/npc/waitingIdle';
import { civilianClips } from '../../src/render/characters/bakeInfected';
import type { CrowdPosePalette } from '../../src/render/characters/CrowdPosePalette';

/** Aim at the actual posed wound surface, including underside-facing cuts. */
async function focusCap(session: SceneSession, id: number, cap: number, frozen: boolean) {
  return session.page.evaluate(({ id, cap, frozen }) => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    game.view.update(1);
    const crowd = (game.view as unknown as { crowd: {
      batches: Map<string, { mesh: InstancedMesh; poses: CrowdPosePalette; probe: { figures: { id: number }[] } }>;
      staticCorpses: { slots: Map<string, { page: { mesh: InstancedMesh }; index: number }> };
    } }).crowd;
    const batch = [...crowd.batches.values()].find(b => b.mesh.count && b.probe.figures.some(f => f.id === id));
    const slot = crowd.staticCorpses.slots.get(String(id));
    const mesh = frozen ? slot?.page.mesh : batch?.mesh;
    if (!mesh) throw Error('Missing wound surface');
    const index = frozen ? slot!.index : batch!.probe.figures.findIndex(f => f.id === id), instance = mesh.matrix.clone(); mesh.getMatrixAt(index, instance);
    const geometry = mesh.geometry, position = geometry.getAttribute('position'), parts = geometry.getAttribute('_parts'), skin = geometry.getAttribute('_skin');
    const state = geometry.getAttribute('_state'), variant = geometry.getAttribute('_variant'), packedBlend = variant?.getW(index) ?? 1;
    const matrices = new Map<number, typeof instance>();
    const pointAt = (i: number) => {
      const point = mesh.position.clone().fromBufferAttribute(position, i);
      if (frozen) return point.applyMatrix4(instance);
      const packed = skin.getX(i), joints = [parts.getX(i), packed % 32, Math.floor(packed / 32) % 32, Math.floor(packed / 1024)];
      const weights = [1 - skin.getY(i) - skin.getZ(i) - skin.getW(i) % 1, skin.getY(i), skin.getZ(i), skin.getW(i) % 1], result = point.clone().set(0, 0, 0);
      for (let k = 0; k < 4; k++) if (weights[k] > 0) {
        let matrix = matrices.get(joints[k]);
        if (!matrix) { matrix = instance.clone(); batch!.poses.part(state.getX(index), Math.floor(packedBlend / 2), packedBlend % 2, joints[k], matrix); matrix.multiply(instance.clone().fromArray(batch!.poses.clip.binds!, joints[k] * 16)).premultiply(instance); matrices.set(joints[k], matrix); }
        result.addScaledVector(point.clone().applyMatrix4(matrix), weights[k]);
      }
      return result;
    };
    const centre = mesh.position.clone().set(0, 0, 0), normal = centre.clone(); let triangles = 0;
    const indices = geometry.index, count = indices?.count ?? position.count;
    for (let t = 0; t < count; t += 3) {
      const ids = [0, 1, 2].map(k => indices ? indices.getX(t + k) : t + k);
      if (ids.some(i => parts.getW(i) !== 1024 + cap)) continue;
      const [a, b, c] = ids.map(pointAt); centre.add(a).add(b).add(c); normal.add(b.clone().sub(a).cross(c.clone().sub(a))); triangles++;
    }
    if (!triangles || normal.lengthSq() < 1e-12) throw Error('Degenerate wound surface');
    centre.divideScalar(triangles * 3); normal.normalize(); const camera = centre.clone().addScaledVector(normal, 3); camera.y = Math.max(.12, camera.y);
    window.__SCENE__!.setCamera({ mode: 'pose', position: [camera.x, camera.y, camera.z], target: [centre.x, centre.y, centre.z] });
    return { triangles, centre: centre.toArray(), normal: normal.toArray(), camera: camera.toArray(), frozen };
  }, { id, cap, frozen });
}

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
      await session.open();
      await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
      await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
      await session.load(spec); await session.step(30);
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
          const capIndex = limb === 0 ? 1 : limb === 2 ? 5 : 0;
          const liveCamera = await focusCap(session, id, capIndex, false);
          await session.screenshot(resolve(out, `cap-${label}-${backend}.png`));
          await session.page.evaluate(() => window.__SCENE__!.command('cut', { corpse: true })); await session.step(180);
          const frozenCamera = await focusCap(session, id, capIndex, true);
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
          receipts.push({ case: 'details', label, backend, frozen, liveCamera, frozenCamera, errors: [...session.errors] });
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
          const actors = (await session.metrics()).actors;
          const ids = names.map((_, i) => actors[`pose-${i}`].entity);
          const descriptions = names.map((name, i) => ({ name, id: ids[i], duration: authoredClips.get(name)!.duration, stride: !!strides[name], offset: idleOffset(ids[i]), looping: ['npc-wave-in', 'npc-glance', 'npc-bang', 'npc-plead', 'npc-press', 'npc-cower', 'npc-hug', 'ff-pry', 'npc-stand-back'].includes(name) }));
          await session.page.evaluate(rows => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            for (const [i, row] of rows.entries()) {
              window.__SCENE__!.command(`pose-${i}`, { idle: true });
              const c = game.world.entities.get(row.id)!.civilian!;
              c.story = { clip: row.name, start: game.world.tick,
                ...(row.name === 'npc-carry' ? { prop: 'parcel' as const } : row.name === 'npc-cane' ? { prop: 'cane' as const } : row.name === 'npc-water' ? { prop: 'watering-can' as const } : {}) };
            }
          }, descriptions);
          await session.step(24);
          for (const phase of [5, 13, 21]) {
            await session.page.evaluate(({ rows, phase }) => {
              const game = (window.__SCENE__ as unknown as { game: Game }).game;
              const gait = (game.view as unknown as { npcs: { civilians: { gait: { states: Map<number, { distance: number; phase: number }> } } } }).npcs.civilians.gait;
              for (const row of rows) {
                const e = game.world.entities.get(row.id)!, c = e.civilian!;
                c.state = 'calm'; c.story!.start = game.world.tick - (phase / 23 * row.duration - (row.looping ? row.offset : 0)) * 60;
                if (e.motion) { e.motion.moving = row.stride; e.motion.speed = row.stride ? 1 : 0; }
                if (row.stride) gait.states.set(row.id, { distance: e.motion?.distance ?? 0, phase: phase / 23 });
              }
            }, { rows: descriptions, phase });
            await session.screenshot(resolve(out, `clips-${group}-${phase}-${backend}.png`));
            const figures = await session.page.evaluate(() => window.__SS__!.getState().render.npcs?.civilians.figures ?? []);
            const drawn = figures.filter(f => ids.includes(f.id) && f.drawn);
            if (drawn.length !== names.length || descriptions.some(row => drawn.find(f => f.id === row.id)?.clip !== row.name)) throw Error('Civilian gallery did not select the requested production clips');
            receipts.push({ case: 'clips', backend, names, phase, drawn, method: 'production story clips and gait phase; attached props/accessories use the same pose', errors: [...session.errors] });
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
          { id: 'turning', kind: 'pedestrian', at: [1.2, 0], yaw: -30, look: { model: 'npc.civilian-man-b', accessories: ['acc.hair-short-crop'] } }],
          camera: { mode: 'pose', position: [4.5, 2.7, 5.5], target: [0, 1.2, 0] } });
        await session.step(1); await session.screenshot(resolve(out, `healthy-glasses-${backend}.png`));
        await session.page.evaluate(() => window.__SCENE__!.command('turning', { infect: {} })); await session.step(240);
        const turningId = (await session.metrics()).actors.turning.entity;
        await session.page.evaluate(id => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game, e = game.world.entities.get(id)!;
          window.__SCENE__!.setCamera({ mode: 'pose', position: [e.transform.x + Math.cos(e.transform.yaw) * 3, 1.7, e.transform.z - Math.sin(e.transform.yaw) * 3], target: [e.transform.x, 1.3, e.transform.z] });
        }, turningId);
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
