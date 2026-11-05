/** L6 production crowd/state/story review. Run each shared browser job serially. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const mode = process.env.L6_CAPTURE ?? 'crowd', variant = 'v2';
const base = 'fe434da85', out = resolve(`test-results/l6-all-new/${mode}-${variant}-${tier}-${backend}`);
const census = JSON.parse(readFileSync('docs/reports/l6-all-new/census.json', 'utf8')) as { converted: string[]; figures: { id: string }[] };
const models = census.figures.map(f => f.id).filter(id => id.startsWith('npc.'));
const converted = census.converted;
const crowd: SceneSpec = {
  name: 'l6-street-crowd30', ground: 'district', time: 'L6', tier: 0, size: 100,
  layout: { level: 'L6', district: 'D-SUBWAY', bbox: [[-3, -12], [40, 20]] },
  actors: Array.from({ length: 30 }, (_, i): ActorSpec => ({
    id: i === 0 ? 'courier' : `body-${i}`, kind: i === 0 ? 'courier' : 'pedestrian',
    at: [5 + i % 10 * 1.8, -3 + Math.floor(i / 10) * 3.5], yaw: -45,
    ...(i ? { look: { model: models[(i - 1) % models.length], accessories: [] }, state: 'idle' as const } : {}),
  })),
  camera: { mode: 'game', target: [13, .6, 1], zoom: 1.5 }, frames: 3, shots: [3], expect: { consoleErrors: 0 },
};
const states: SceneSpec = {
  name: 'l6-body-states', ground: 'asphalt', time: 'L6', size: 100,
  actors: [{ id: 'courier', kind: 'courier', at: [40, 40] }, ...converted.flatMap((model, i): ActorSpec[] => ['live', 'turned', 'dead'].map((state, row) => ({
    id: `${state}-${i}`, kind: 'pedestrian', at: [-6 + i * 4, row * 18 - 18], yaw: -45, look: { model, accessories: [] }, state: 'idle',
  })))],
  script: converted.flatMap((_, i) => [{ frame: 1, actor: `turned-${i}`, do: { infect: { instant: true } } }, { frame: 1, actor: `dead-${i}`, do: { infect: { instant: true } } }, { frame: 3, actor: `dead-${i}`, do: { corpse: true as const } }]),
  camera: { mode: 'game', target: [0, .6, -18], zoom: 1.5 }, frames: 120, shots: [120], expect: { consoleErrors: 0 },
};
const session = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
try {
  await session.open();
  session.page.on('response', response => { if (/\.gl[bt](\?|$)/.test(response.url()) && response.headers()['content-type']?.includes('text/html')) console.error(`Missing GLB: ${response.url()}`); });
  await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  const actual = await session.page.evaluate(() => window.__SS__!.getState().render);
  assert.equal(actual.backend, backend === 'webgl2' ? 'webgl' : 'webgpu'); assert.equal(actual.quality, tier);
  if (mode === 'story' || mode === 'beats') {
    const receipts = [];
    const files = mode === 'beats' ? ['tests/scenes/catalog/l6-tunnel-group.json', 'tests/scenes/catalog/l6-tunnel-hatch.json', 'specs/scenes/catalog/l6-station-portal.json'] : readdirSync('tests/scenes/catalog').filter(n => n.startsWith('qa-l6-') && n.endsWith('.json')).sort().map(name => `tests/scenes/catalog/${name}`);
    for (const path of files) {
      const file = resolve(path), spec = readSpec(file);
      const result = await runSpec(session, spec, { file, out: resolve(out, spec.name!), sheet: Math.max(60, Math.ceil((spec.frames ?? 180) / 12)) });
      receipts.push({ file, tier, ...result }); writeJson(`${out}/receipts.json`, receipts);
      assert.ok(result.pass, JSON.stringify({ scene: spec.name, failed: result.failed }));
    }
  } else {
    const result = await runSpec(session, mode === 'states' ? states : crowd, { out, sheet: 0 });
    assert.ok(result.pass, JSON.stringify(result.failed));
    const metrics = await session.metrics();
    if (mode === 'crowd') {
      assert.equal(Object.keys(metrics.actors).length, 30);
      assert.ok(Object.values(metrics.actors).every(a => a.drawnFrames > 0), 'All thirty figures submitted');
      await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        for (const e of game.world.entities.values()) if (e.civilian && e.appearance?.asset === 'npc.marcus.aftermath') e.civilian.story = { clip: 'idle', start: game.world.tick, prop: 'pistol' };
      });
      await session.step(1); await session.ready();
      for (const zoom of [1, 1.5]) { await session.page.evaluate(zoom => window.__SS__!.camera.zoom(zoom), zoom); await session.ready(); await session.screenshot(`${out}/zoom-${zoom}.png`); }
      const resources = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game, textures = new Set<import('three').Texture>();
        game.view.scene.traverse(node => {
          const mesh = node as import('three').Mesh;
          if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
          for (const texture of node.userData.preRenderTextures ?? []) textures.add(texture);
        });
        let decodedBytes = 0;
        for (const texture of textures) {
          const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } }, mips = texture.mipmaps as { data?: { byteLength: number } }[];
          if (image?.width && image.height) decodedBytes += mips.reduce((n, m) => n + (m.data?.byteLength ?? 0), 0) || image.data?.byteLength || Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1));
        }
        const marcus = [...game.world.entities.values()].filter(e => e.appearance?.asset === 'npc.marcus.aftermath').map(e => ({ id: e.id, at: [e.transform.x, e.transform.y, e.transform.z], muzzle: game.view.labProbes().npcs?.muzzle(e.id)?.toArray() }));
        return { decodedBytes, textureCount: textures.size, marcus, heldProps: game.view.labProbes().heldProps.map(p => ({ entity: p.entity, prop: p.prop })), render: window.__SS__!.getState().render, perf: window.__SS__!.perf() };
      });
      assert.equal(resources.marcus.length, 2); assert.ok(resources.marcus.every(e => e.muzzle), 'Both Marcus pistols use the live gun path');
      writeJson(`${out}/resources.json`, resources);
      const guard = resources.marcus[0];
      for (const side of ['front', 'back']) {
        await session.page.evaluate(({ at, side }) => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          const target: [number, number, number] = [at[0], at[1] + .1, at[2]];
          window.__SCENE__!.setCamera({ mode: 'game', target, zoom: .45 });
          if (side === 'back') {
            const p = game.view.camera.position;
            window.__SCENE__!.setCamera({ mode: 'pose', target, position: [2 * target[0] - p.x, p.y, 2 * target[2] - p.z] });
          }
        }, { ...guard, side });
        await session.step(1); await session.ready(); await session.screenshot(`${out}/marcus-${side}.png`);
      }
    } else {
      const proof = await session.page.evaluate(models => window.__SS__!.query({}).filter(e => models.includes(e.appearance?.asset ?? '')).map(e => ({ id: e.id, model: e.appearance!.asset, health: e.health.current, corpse: !!e.corpse, infected: !!e.infected })), converted);
      assert.equal(proof.filter(e => e.corpse).length, 4); assert.equal(proof.filter(e => e.infected && e.health > 0).length, 4); assert.equal(proof.filter(e => !e.infected && e.health > 0).length, 4);
      writeJson(`${out}/state-proof.json`, proof);
      for (const [row, label] of ['live', 'turned', 'corpse'].entries()) {
        await session.page.evaluate(target => window.__SCENE__!.setCamera({ mode: 'game', target, zoom: 1.5 }), [0, .6, row * 18 - 18] as [number, number, number]); await session.ready(); await session.screenshot(`${out}/${label}.png`);
      }
      for (const state of ['turned', 'corpse']) for (let i = 0; i < converted.length; i++) {
        const id = metrics.actors[`${state === 'corpse' ? 'dead' : 'turned'}-${i}`].entity;
        await session.page.evaluate(id => {
          const e = window.__SS__!.getEntity(id)!;
          window.__SCENE__!.setCamera({ mode: 'game', target: [e.transform.x, .55, e.transform.z], zoom: .42 });
        }, id);
        await session.ready(); await session.screenshot(`${out}/${state}-${i}-close.png`);
      }
    }
    writeJson(`${out}/receipt.json`, { base, variant, tier, backend, result, metrics, errors: session.errors });
  }
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
