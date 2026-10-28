/** L7 production-light crowd/state and authored story captures, one shared context per job. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import type { AssetDef } from '../../src/assets/types';
import type { Game } from '../../src/Game';

const tier: 'high' | 'low' = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const mode = process.env.L7_CAPTURE ?? 'crowd', variant = process.env.REVIEW_VARIANT ?? 'new';
const out = resolve(`test-results/l7-all-new/${mode}-${variant}-${tier}-${backend}`);
const review = (JSON.parse(readFileSync('docs/reports/l7-all-new/census.json', 'utf8')) as { review: string[] }).review;
const people = review.filter(id => id.startsWith('npc.')), alphas = review.filter(id => id.startsWith('inf.'));
const crowd: SceneSpec = {
  name: 'l7-street-crowd30', ground: 'district', time: 'L6', tier: 6, size: 100,
  layout: { district: 'D-FAIR', level: 'L7', bbox: [[-35, -13], [-5, 13]] },
  actors: Array.from({ length: 30 }, (_, i): ActorSpec => {
    const at: [number, number] = [-33.1 + i % 10 * 1.8, -3.5 + Math.floor(i / 10) * 3.5];
    if (i === 0) return { id: 'courier', kind: 'courier', at, yaw: -45, loadout: ['weapon.rocket-launcher', 'weapon.fire-axe'], state: 'idle' };
    if (i === 1) return { id: 'corgi', kind: 'corgi', at, yaw: -45 };
    if (i >= 22 && i < 27) return { id: `alpha-${i}`, kind: 'infected', archetype: 'infected.alpha', at, yaw: -45, look: { model: alphas[i - 22] }, state: 'idle' };
    return { id: `person-${i}`, kind: 'pedestrian', at, yaw: -45, look: { model: i < 22 ? people[(i - 2) % 5] : i === 29 ? 'npc.marcus.aftermath' : people[i - 22], accessories: [] }, state: 'idle' };
  }),
  script: Array.from({ length: 20 }, (_, i) => ({ frame: 1, actor: `person-${i + 2}`, do: { infect: { instant: true } } })),
  camera: { mode: 'game', target: [-24, .6, 1], zoom: 1.5 }, frames: 3, shots: [3], expect: { consoleErrors: 0 },
};
const states: SceneSpec = {
  name: 'l7-current-body-states', ground: 'asphalt', time: 'L6', size: 160,
  actors: [{ id: 'courier', kind: 'courier', at: [40, -40] },
    ...people.flatMap((model, i): ActorSpec[] => ['live', 'turned', 'corpse'].map((state, row) => ({ id: `${state}-${i}`, kind: 'pedestrian', at: [-9 + i * 3, row * 18 - 18], yaw: -45, look: { model, accessories: [] }, state: 'idle' }))),
    ...alphas.flatMap((model, i): ActorSpec[] => ['alpha', 'alpha-corpse'].map((state, row) => ({ id: `${state}-${i}`, kind: 'infected', archetype: 'infected.alpha', at: [-8 + i * 4, 36 + row * 18], yaw: -45, look: { model }, state: 'idle' })))],
  script: [...people.flatMap((_, i) => [{ frame: 1, actor: `turned-${i}`, do: { infect: { instant: true } } }, { frame: 1, actor: `corpse-${i}`, do: { infect: { instant: true } } }, { frame: 3, actor: `corpse-${i}`, do: { corpse: true as const } }]),
    ...alphas.map((_, i) => ({ frame: 3, actor: `alpha-corpse-${i}`, do: { corpse: true as const } }))],
  camera: { mode: 'game', target: [0, .6, 0], zoom: 1.5 }, frames: 120, shots: [120], expect: { consoleErrors: 0 },
};
const session = new SceneSession({ backend, tier, viewport: mode === 'portraits' ? { width: 800, height: 600 } : { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
try {
  await session.open();
  await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  if (variant === 'old') {
    const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
    for (const def of manifest) if (review.includes(def.id) && def.rigidBaseline) {
      def.glb = def.rigidBaseline.glb; def.lods = def.rigidBaseline.lods; def.sourceGlb = `assets/${def.id}/model.glb`;
      delete def.crowdSkin; delete def.textureMode; delete def.textureAtlasLow; delete def.lowGlb; delete def.corpseGlb;
    }
    await session.page.context().route('**/src/assets/manifest.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify(manifest)};` }));
    await session.page.context().route('**/src/assets/civilianBakes.json*', route => route.fulfill({ contentType: 'application/javascript', body: 'export default {};' }));
    await session.page.reload(); await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  }
  if (variant === 'main') {
    const base = '93d73c529';
    for (const file of ['src/assets/manifest.json', 'src/assets/civilianBakes.json']) {
      const data = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
      await session.page.context().route(`**/${file}*`, route => route.fulfill({ contentType: 'application/javascript', body: `export default ${data};` }));
    }
    const bakes = JSON.parse(execFileSync('git', ['show', `${base}:src/assets/civilianBakes.json`], { encoding: 'utf8' })) as Record<string, string>;
    const files = [...new Set(Object.entries(bakes).filter(([key]) => key.startsWith('npc.civilian-man-b:')).map(([, path]) => `public${path}`)), ...[0, 1, 2].flatMap(lod => [false, true].map(low => `public/assets/models/skinned/npc.civilian-man-b.lod${lod}${low ? '.low' : ''}.glb`))];
    for (const file of files) await session.page.context().route(`**/${file.replace(/^public\//, '')}`, route => route.fulfill({ contentType: 'application/octet-stream', body: execFileSync('git', ['show', `${base}:${file}`], { maxBuffer: 8 * 1024 * 1024 }) }));
    await session.page.reload(); await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  }
  const actual = await session.page.evaluate(() => window.__SS__!.getState().render);
  assert.equal(actual.backend, backend === 'webgl2' ? 'webgl' : 'webgpu'); assert.equal(actual.quality, tier);
  if (mode === 'population') {
    const result = await session.page.evaluate(async (tier: 'high' | 'low') => {
      const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      api.settings.set({ quality: tier }); await api.loadLevel('L7', { seed: 29, progression: 'L7-default' }); api.pause();
      api.setLoadout(['weapon.bat'], ['weapon.rocket-launcher']);
      await api.step(2); api.teleport('player', { x: -48, z: 46 });
      api.getState().l7!.roster.forEach((r, i) => api.teleport(r.id, { x: -45 + Math.floor(i / 3) * 1.2, z: 46 + (i % 3 - 1) * 1.2 }));
      api.camera.cinematic({ position: [-22, 24, 68], target: [-48, 0, 46] }, true);
      await api.step(180); api.pause(); await api.screenshotReady();
      const textures = new Set<import('three').Texture>();
      game.view.scene.traverse(node => {
        const mesh = node as import('three').Mesh;
        if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
        for (const texture of node.userData.preRenderTextures ?? []) textures.add(texture);
      });
      let decodedBytes = 0;
      for (const texture of textures) { const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } }; if (image?.width && image.height) decodedBytes += (texture.mipmaps as { data?: { byteLength: number } }[]).reduce((n, m) => n + (m.data?.byteLength ?? 0), 0) || image.data?.byteLength || Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1)); }
      return { decodedBytes, textureCount: textures.size, perf: api.perf(), render: api.getState().render, population: api.query({}).filter(e => e.infected || e.appearance || e.companion || e.survivor).map(e => ({ id: e.id, model: e.appearance?.asset ?? e.infected?.variant ?? e.archetype, infected: !!e.infected, corpse: !!e.corpse })) };
    }, tier);
    writeJson(`${out}/resources.json`, { variant, tier, backend, ...result, errors: session.errors });
    await session.screenshot(`${out}/population.png`);
    assert.equal(result.perf.infected?.liveCount, tier === 'high' ? 200 : 100, 'Exercise the full L7 population cap');
  } else if (mode === 'portraits') {
    const selected = people.filter(id => !process.env.L7_PORTRAIT_IDS || process.env.L7_PORTRAIT_IDS.split(',').includes(id));
    const receiptPath = `${out}/receipts.json`;
    const receipts: unknown[] = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')).filter((r: { id: string }) => !selected.includes(r.id)) : [];
    for (const model of selected) for (const yaw of [-45, 135]) {
      const infected = people.indexOf(model) < 5;
      await session.load({ name: 'l7-runtime-portrait', ground: 'asphalt', time: 'L6', size: 60, actors: [{ id: 'courier', kind: 'courier', at: [20, 20] }, { id: 'subject', kind: 'pedestrian', at: [0, 0], yaw, look: { model, accessories: [] }, state: 'idle' }], script: infected ? [{ frame: 1, actor: 'subject', do: { infect: { instant: true } } }] : [], camera: { mode: 'game', target: [0, .8, 0], zoom: .8 }, frames: 3 });
      await session.step(3); await session.ready();
      const entity = (await session.metrics()).actors.subject.entity;
      for (const pixels of [120, 400]) {
      const framing = await session.page.evaluate(async ({ entity, pixels, infected }) => {
        const threePath = '/node_modules/three/build/three.webgpu.js', bodiesPath = '/src/render/characters/PickBodies.ts';
        const { Box3, Matrix4, Vector3 } = await import(threePath);
        const { pickBodies } = await import(bodiesPath);
        const game = (window.__SCENE__ as unknown as { game: Game }).game, e = game.world.entities.get(entity)!;
        if (!e.appearance || infected !== !!e.infected) throw Error('Portrait does not have its L7 production state');
        if (infected) e.appearance.bornInfected = true;
        await window.__SCENE__!.ready();
        const box = pickBodies.bounds(entity, new Box3()); if (!box) throw Error('Portrait body was not drawn');
        const target = box.getCenter(new Vector3()); let distance = 10, bounds: number[] = [];
        for (let iteration = 0; iteration < 12; iteration++) {
          const position = target.clone().add(new Vector3().setFromSphericalCoords(distance, Math.PI * .3, Math.PI / 4));
          window.__SCENE__!.setCamera({ mode: 'pose', target: target.toArray(), position: position.toArray() }); await window.__SCENE__!.ready();
          const camera = game.view.camera, projection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
          const projected = pickBodies.bounds(entity, new Box3(), projection); if (!projected) throw Error('Portrait projection is absent');
          bounds = [(projected.min.x + 1) * 400, (1 - projected.max.y) * 300, (projected.max.x + 1) * 400, (1 - projected.min.y) * 300];
          distance *= (bounds[3] - bounds[1]) / pixels;
        }
        const appearancePath = '/src/render/characters/CrowdAppearance.ts', { resolveCrowdAppearance } = await import(appearancePath);
        return { bounds, actualPixels: bounds[3] - bounds[1], actualState: { model: e.appearance.asset, infected: !!e.infected, bornInfected: e.appearance.bornInfected, look: resolveCrowdAppearance(e) } };
      }, { entity, pixels, infected });
      const file = `${out}/${model}-${variant}-${pixels}-${yaw}.png`; await session.screenshot(file);
      receipts.push({ id: model, variant, tier, backend, file, targetPixels: pixels, yaw, ...framing }); writeJson(`${out}/receipts.json`, receipts);
      }
    }
  } else if (mode === 'story') {
    const files = ['catalog/qa-l7-entry-night-exit.json', 'catalog/qa-l7-entry-rocket.json', 'l7-rocket/qa-l7-rocket-crowd.json', 'l7-rocket/qa-l7-rocket-alpha.json', 'l7-district/plaza-w6.json', 'catalog/qa-l7-entry-corridor.json', 'l7-encounters/qa-l7-horde-passage.json', 'catalog/qa-l7-entry-bus.json', 'l7-departure/departure.json', 'l7-departure/departure-city.json'];
    const selected = files.filter(file => !process.env.L7_STORY_FILES || process.env.L7_STORY_FILES.split(',').includes(file));
    const receiptPath = `${out}/receipts.json`;
    const receipts: unknown[] = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')).filter((r: { file: string }) => !selected.map(file => resolve('tests/scenes', file)).includes(r.file)) : [];
    for (const relative of selected) {
      const file = resolve('tests/scenes', relative), spec = readSpec(file);
      // The authored passage fixture has the high-tier 120 regulars. Match
      // production low's 60 without changing the game or its director cap.
      if (tier === 'low' && relative === 'l7-encounters/qa-l7-horde-passage.json') spec.actors = spec.actors!.filter(actor => !actor.id?.startsWith('crowd-') || Number(actor.id.slice(6)) % 2 === 0);
      const result = await runSpec(session, spec, { file, out: resolve(out, spec.name!), sheet: Math.max(60, Math.ceil((spec.frames ?? 180) / 12)) });
      receipts.push({ file, tier, ...result }); writeJson(`${out}/receipts.json`, receipts);
    }
  } else {
    const result = await runSpec(session, mode === 'states' ? states : crowd, { out, sheet: 0 });
    assert.ok(result.pass, JSON.stringify(result.failed));
    const metrics = await session.metrics();
    if (mode === 'crowd') {
      assert.equal(Object.keys(metrics.actors).length, 30); assert.ok(Object.values(metrics.actors).every(a => a.drawnFrames > 0));
      await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        for (const e of game.world.entities.values()) {
          if (e.infected && e.appearance) e.appearance.bornInfected = true;
          if (e.civilian && e.appearance?.asset === 'npc.marcus.aftermath') e.civilian.story = { clip: 'idle', start: game.world.tick, prop: 'pistol' };
        }
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
        for (const texture of textures) { const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } }; if (image?.width && image.height) decodedBytes += (texture.mipmaps as { data?: { byteLength: number } }[]).reduce((n, m) => n + (m.data?.byteLength ?? 0), 0) || image.data?.byteLength || Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1)); }
        const probes = game.view.labProbes();
        const marcus = [...game.world.entities.values()].filter(e => e.appearance?.asset === 'npc.marcus.aftermath').map(e => ({ id: e.id, muzzle: probes.npcs?.muzzle(e.id)?.toArray() }));
        const render = window.__SS__!.getState().render;
        return { decodedBytes, textureCount: textures.size, marcus, courier: render.actions?.attachments.find(a => a.visible && !a.holstered), gunMeshes: probes.gunMeshes.map(g => ({ entity: g.entity, vertices: g.geometry.getAttribute('position').count })), heldProps: probes.heldProps.map(p => ({ entity: p.entity, prop: p.prop })), perf: window.__SS__!.perf(), render };
      });
      writeJson(`${out}/resources.json`, resources);
      // Idle NPC guns are excluded from the aim-only collision mesh probe.
      // RoutineProps publishes a muzzle only for its live authored weapon path.
      assert.equal(resources.marcus.length, 1); assert.ok(resources.marcus[0].muzzle, 'Marcus pistol has a live authored muzzle');
      assert.equal(resources.courier?.actionId, 'weapon.rocket-launcher'); assert.ok(resources.courier?.muzzle); assert.equal(resources.courier?.source, 'glb');
      writeJson(`${out}/resources.json`, resources);
      const marcus = await session.page.evaluate(() => window.__SS__!.query({}).find(e => e.appearance?.asset === 'npc.marcus.aftermath')!.transform);
      for (const side of ['front', 'back']) {
        await session.page.evaluate(({ at, side }) => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game, target: [number, number, number] = [at.x, at.y + .1, at.z];
          window.__SCENE__!.setCamera({ mode: 'game', target, zoom: .45 });
          if (side === 'back') { const p = game.view.camera.position; window.__SCENE__!.setCamera({ mode: 'pose', target, position: [2 * target[0] - p.x, p.y, 2 * target[2] - p.z] }); }
        }, { at: marcus, side });
        await session.ready(); await session.screenshot(`${out}/marcus-${side}.png`);
      }
    } else {
      const proof = await session.page.evaluate(() => window.__SS__!.query({}).filter(e => e.appearance || e.infected).map(e => ({ id: e.id, model: e.appearance?.asset ?? e.infected?.model ?? e.infected?.variant, corpse: !!e.corpse, infected: !!e.infected, health: e.health.current })));
      assert.equal(proof.filter(e => e.corpse).length, 12); assert.equal(proof.filter(e => e.infected && e.health > 0).length, 12);
      writeJson(`${out}/state-proof.json`, proof);
      for (const [row, label] of ['live', 'turned', 'corpse', 'alpha', 'alpha-corpse'].entries()) {
        await session.page.evaluate(target => window.__SCENE__!.setCamera({ mode: 'game', target, zoom: 1.5 }), [0, .6, row * 18 - 18] as [number, number, number]); await session.ready(); await session.screenshot(`${out}/${label}.png`);
      }
    }
    writeJson(`${out}/receipt.json`, { variant, tier, backend, result, metrics, errors: session.errors });
  }
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
