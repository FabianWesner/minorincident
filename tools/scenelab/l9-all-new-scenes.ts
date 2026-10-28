/** L9 production-light rollout evidence. Each invocation owns one shared pool context. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AssetDef } from '../../src/assets/types';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import { runSpec } from './run';
import { SceneSession, readSpec, stopServer, writeJson } from './session';

const tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const variant = process.env.REVIEW_VARIANT ?? 'new', mode = process.env.L9_CAPTURE ?? 'crowd';
const out = resolve(`test-results/l9-all-new/${mode}-${variant}-${tier}-${backend}`);
const census = JSON.parse(readFileSync('docs/reports/l9-all-new/census.json', 'utf8')) as { identities: { id: string; migration: boolean }[] };
const migrated = census.identities.filter(row => row.migration).map(row => row.id);
const models = ['inf.common-worker', ...migrated];
const crowd: SceneSpec = {
  name: 'l9-street-crowd30', ground: 'district', time: 'L9-crossing', size: 100,
  layout: { district: 'D-CROSSING', bbox: [[-90, -45], [-40, -15]] },
  actors: Array.from({ length: 30 }, (_, i): ActorSpec => {
    const at: [number, number] = [-78 + i % 10 * 1.8, -33.5 + Math.floor(i / 10) * 3.5];
    if (i === 0) return { id: 'courier', kind: 'courier', at, yaw: -45, loadout: ['weapon.army-mg', 'weapon.fire-axe'] };
    return { id: `infected-${i}`, kind: 'infected', archetype: i === 1 ? 'infected.alpha' : 'infected.runner', at, yaw: -45,
      look: { model: i === 1 ? 'inf.alpha' : models[(i - 2) % models.length] }, state: 'idle' };
  }),
  camera: { mode: 'game', target: [-69, .6, -30], zoom: 1.5 }, frames: 3, shots: [3], expect: { consoleErrors: 0 },
};
const states: SceneSpec = {
  name: 'l9-infected-states', ground: 'asphalt', time: 'L9-crossing', size: 160,
  actors: [{ id: 'courier', kind: 'courier', at: [50, -50] }, ...[...models, 'inf.alpha'].flatMap((model, i): ActorSpec[] => ['live', 'corpse'].map((state, row) => ({
    id: `${state}-${i}`, kind: 'infected', archetype: model === 'inf.alpha' ? 'infected.alpha' : 'infected.runner', at: [-10.5 + i * 3, row * 18], yaw: -45, look: { model }, state: 'idle',
  })))],
  script: [...models, 'inf.alpha'].map((_, i) => ({ frame: 3, actor: `corpse-${i}`, do: { corpse: true as const } })),
  camera: { mode: 'game', target: [0, .6, 0], zoom: 1.5 }, frames: 150, shots: [150], expect: { consoleErrors: 0 },
};
const session = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
try {
  await session.open();
  await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  if (variant === 'old') {
    const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
    for (const def of manifest) if (migrated.includes(def.id)) {
      assert.ok(def.rigidBaseline, `${def.id} needs its old rigid baseline`);
      def.glb = def.rigidBaseline.glb; def.lods = def.rigidBaseline.lods;
      delete def.crowdSkin; delete def.textureMode; delete def.textureAtlasLow; delete def.lowGlb; delete def.corpseGlb;
    }
    await session.page.context().route('**/src/assets/manifest.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify(manifest)};` }));
    await session.page.context().route('**/src/assets/civilianBakes.json*', route => route.fulfill({ contentType: 'application/javascript', body: 'export default {};' }));
    await session.page.reload(); await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  }
  if (mode === 'story') {
    const files = (process.env.L9_STORY_FILES ?? 'l9-enc-alpha-group,l9-enc-shortcut-ram,l9-enc-zero-ram,l9-crash-sequence-1000,l9-crash-sequence-0,l9-crash-crawl').split(',');
    const receipts = [];
    for (const name of files) {
      const file = resolve(`specs/scenes/catalog/${name}.json`), spec = readSpec(file);
      const result = await runSpec(session, spec, { file, out: `${out}/${name}`, sheet: Math.max(60, Math.ceil((spec.frames ?? 180) / 12)) });
      receipts.push({ file, tier, ...result }); writeJson(`${out}/receipts.json`, receipts);
      assert.ok(result.pass, JSON.stringify(result.failed));
    }
  } else {
    const result = await runSpec(session, mode === 'states' ? states : crowd, { out, sheet: 0 });
    assert.ok(result.pass, JSON.stringify(result.failed));
    const metrics = await session.metrics();
    if (mode === 'crowd') {
      assert.equal(Object.keys(metrics.actors).length, 30);
      assert.ok(Object.values(metrics.actors).every(actor => actor.drawnFrames > 0), 'All 30 figures must be drawn');
      for (const zoom of [1, 1.5]) {
        await session.page.evaluate(zoom => window.__SS__!.camera.zoom(zoom), zoom); await session.ready(); await session.screenshot(`${out}/zoom-${zoom}.png`);
      }
      const resources = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game, textures = new Set<import('three').Texture>();
        game.view.scene.traverse(node => {
          const mesh = node as import('three').Mesh;
          if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
          for (const texture of node.userData.preRenderTextures ?? []) textures.add(texture);
        });
        let decodedBytes = 0;
        for (const texture of textures) {
          const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } };
          if (image?.width && image.height) decodedBytes += (texture.mipmaps as { data?: { byteLength: number } }[]).reduce((sum, mip) => sum + (mip.data?.byteLength ?? 0), 0) || image.data?.byteLength || Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1));
        }
        return { decodedBytes, textureCount: textures.size, perf: window.__SS__!.perf(), render: window.__SS__!.getState().render };
      });
      writeJson(`${out}/resources.json`, resources);
    } else {
      const proof = await session.page.evaluate(() => window.__SS__!.query({}).filter(e => e.infected || e.corpse).map(e => ({ id: e.id, model: e.appearance?.asset ?? e.infected?.variant, corpse: !!e.corpse, health: e.health.current })));
      assert.equal(proof.filter(e => e.corpse).length, 8);
      writeJson(`${out}/state-proof.json`, proof);
      for (const [row, label] of ['live', 'corpse'].entries()) {
        await session.page.evaluate(target => window.__SCENE__!.setCamera({ mode: 'game', target, zoom: 1.5 }), [0, .6, row * 18] as [number, number, number]);
        await session.ready(); await session.screenshot(`${out}/${label}.png`);
      }
    }
    writeJson(`${out}/receipt.json`, { variant, tier, backend, result, metrics, errors: session.errors });
  }
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
