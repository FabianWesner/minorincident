/** L4 rollout evidence through the production crowd renderer, one pooled job. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { loadavg } from 'node:os';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const mode = process.env.L4_CAPTURE ?? 'crowd', variant = process.env.REVIEW_VARIANT ?? 'new';
const base = process.env.REVIEW_BASE ?? '83503eb18';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = resolve(`test-results/l4-all-new/${mode}-${variant}-${tier}-${backend}`);
const converted = ['inf.crawler', 'inf.riot-cop', 'inf.firefighter', 'inf.hazmat', 'inf.alpha', 'inf.alpha-worker', 'inf.alpha-hoodie', 'inf.alpha-fire', 'inf.alpha-suit'];
const civilians = ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'];
const archetype = (model: string) => model.startsWith('inf.alpha') ? 'infected.alpha' : model === 'inf.crawler' ? 'infected.crawler' : model === 'inf.riot-cop' ? 'infected.riot' : model === 'inf.firefighter' ? 'infected.firefighter' : model === 'inf.hazmat' ? 'infected.hazmat' : 'infected.runner';
const crowd30: SceneSpec = {
  name: 'l4-street-crowd30', ground: 'district', time: 'L4', size: 100,
  layout: { district: 'D-FAIR', level: 'L4', bbox: [[-34, -13], [-6, 12]] },
  actors: Array.from({ length: 30 }, (_, i): ActorSpec => {
    const at: [number, number] = [-28.1 + i % 10 * 1.8, -3.5 + Math.floor(i / 10) * 3.5];
    if (i === 0) return { id: 'courier', kind: 'courier', at, yaw: -45 };
    if (i === 1) return { id: 'corgi', kind: 'corgi', at, yaw: -45 };
    if (i < 5) return { id: `guard-${i}`, kind: 'pedestrian', at, yaw: -45, look: { model: 'npc.national-guard', role: 'soldier', handProp: 'rifle' }, state: 'idle' };
    if (i < 13) return { id: `civilian-${i}`, kind: 'pedestrian', at, yaw: -45, look: { model: civilians[(i - 5) % 5], handProp: i < 8 ? ['pistol', 'hunting-rifle', 'bat'][i - 5] : null }, state: 'idle' };
    const model = i < 22 ? converted[i - 13] : ['inf.common-worker', 'npc.national-guard', ...civilians][(i - 22) % 7];
    if (model.startsWith('npc.')) return { id: `civilian-${i}`, kind: 'pedestrian', at, yaw: -45, look: { model }, state: 'idle' };
    return { id: `infected-${i}`, kind: 'infected', at, yaw: -45, archetype: archetype(model), look: { model }, state: 'idle' };
  }),
  camera: { mode: 'game', target: [-19, .6, 1], zoom: 1.5 }, frames: 3, shots: [3], expect: { consoleErrors: 0 },
};
const corpses: SceneSpec = {
  name: 'l4-converted-corpses', ground: 'asphalt', time: 'L4', size: 100,
  actors: [{ id: 'courier', kind: 'courier', at: [-14, 8] }, ...converted.flatMap((model, i): ActorSpec[] => [
    { id: `live-${i}`, kind: 'infected', archetype: archetype(model), at: [-4 + i % 3 * 4, -9 + Math.floor(i / 3) * 8], yaw: -45, look: { model }, state: 'idle' },
    { id: `dead-${i}`, kind: 'infected', archetype: archetype(model), at: [-4 + i % 3 * 4, -5 + Math.floor(i / 3) * 8], yaw: -45, look: { model }, state: 'idle' },
  ])],
  script: converted.map((_, i) => ({ frame: 3, actor: `dead-${i}`, do: { corpse: true as const } })),
  camera: { mode: 'game', target: [0, .4, 0], zoom: 1.5 }, frames: 120, shots: [120], trace: true,
  expect: { consoleErrors: 0, groundingCorpsesMin: 9 },
};
function resourceSnapshot() {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const textures = new Set<import('three').Texture>();
      game.view.scene.traverse(node => {
        const mesh = node as import('three').Mesh;
        if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
        for (const texture of node.userData.preRenderTextures ?? []) textures.add(texture);
      });
      let decodedBytes = 0, rgbaUpperBoundBytes = 0;
      for (const texture of textures) {
        const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } };
        if (!image?.width || !image.height) continue;
        const mips = texture.mipmaps as { data?: { byteLength: number } }[];
        decodedBytes += mips.reduce((n, mip) => n + (mip.data?.byteLength ?? 0), 0) || image.data?.byteLength || Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1));
        rgbaUpperBoundBytes += image.data?.byteLength ?? Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps || mips.length > 1 ? 4 / 3 : 1));
      }
      const render = window.__SS__!.getState().render;
      return { textureCount: textures.size, decodedBytes, rgbaUpperBoundBytes, render: { crowd: render.crowd ? { batches: render.crowd.batches.map(({ id, instances, lod, source }) => ({ id, instances, lod, source })) } : null } };
}
const session = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
const receipts: unknown[] = [];
try {
  await session.open();
  await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  if (variant === 'old') {
    // Substitute immutable baseline data over the wire. No second checkout or
    // copy, and no mutation of the active manifest or production source files.
    for (const file of ['src/assets/manifest.json', 'src/assets/civilianBakes.json']) {
      const data = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
      await session.page.context().route(`**/${file}*`, route => route.fulfill({ contentType: 'application/javascript', body: `export default ${data};` }));
    }
    const bakes = JSON.parse(execFileSync('git', ['show', `${base}:src/assets/civilianBakes.json`], { encoding: 'utf8' })) as Record<string, string>;
    for (const path of new Set(Object.values(bakes))) await session.page.context().route(`**${path}`, route => route.fulfill({ contentType: 'application/octet-stream', body: execFileSync('git', ['show', `${base}:public${path}`], { maxBuffer: 8 * 1024 * 1024 }) }));
    await session.page.reload();
    await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  }
  const actual = await session.page.evaluate(() => window.__SS__!.getState().render);
  assert.equal(actual.backend, backend === 'webgl2' ? 'webgl' : 'webgpu'); assert.equal(actual.quality, tier);
  const files = mode === 'story' ? ['specs/scenes/qa-l4-plaza-safe.json', 'specs/scenes/qa-l4-gate-convoy.json', 'specs/scenes/qa-l4-war-line.json', 'specs/scenes/qa-l4-fuel-chain.json', 'specs/scenes/qa-l4-tank-heli.json', 'specs/scenes/qa-l4-kessler-cellar.json', 'tests/scenes/catalog/l4-finale-cellar.json'] : [];
  for (const file of files) {
    const spec = readSpec(resolve(file));
    const result = await runSpec(session, spec, { file, out: resolve(out, spec.name!), sheet: Math.max(60, Math.ceil((spec.frames ?? 180) / 12)) });
    receipts.push({ revision, backend, tier, file, ...result }); writeJson(`${out}/receipts.json`, receipts);
    assert.ok(result.pass, `${spec.name}: ${JSON.stringify(result.failed)}`);
  }
  if (mode === 'guns') {
    const holders = [['npc.national-guard', 'hmg'], ['npc.national-guard', 'rifle'], ['npc.civilian-man-a', 'hunting-rifle'], ['npc.civilian-woman-a', 'pistol'], ['npc.civilian-man-b', 'shotgun']] as const;
    const fixtures = holders.flatMap(([model, prop], row) => [-45, 45, 135, 225].map((yaw, col) => ({ model, prop, yaw, at: [-30 + col * 20, -40 + row * 20] as [number, number], id: `holder-${row}-${col}` })));
    const fixture: SceneSpec = { name: 'l4-authored-weapons', time: 'L4', ground: 'asphalt', size: 160,
      actors: [{ id: 'courier', kind: 'courier', at: [70, 70] }, ...fixtures.map(({ id, model, prop, yaw, at }): ActorSpec => ({ id, kind: 'pedestrian', at, yaw,
        look: { model, handProp: prop === 'hmg' ? 'rifle' : prop }, state: prop === 'hmg' ? { ally: { role: 'soldier', weapon: 'hmg' } } : 'idle' }))],
      camera: { mode: 'game', target: [0, .9, 0], zoom: .55 }, frames: 3, expect: { consoleErrors: 0 } };
    const result = await runSpec(session, fixture, { out, sheet: 0 });
    assert.ok(result.pass, JSON.stringify(result.failed));
    for (const { model, prop, yaw, at, id } of fixtures) {
      await session.page.evaluate(at => window.__SCENE__!.setCamera({ mode: 'game', target: [at[0], .9, at[1]], zoom: .55 }), at);
      await session.ready(); const file = `${out}/${prop}-${yaw}.png`; await session.screenshot(file);
      receipts.push({ revision, model, prop, yaw, actor: id, file, result }); writeJson(`${out}/receipts.json`, receipts);
    }
  }
  if (mode === 'battle') {
    await session.page.evaluate(async () => {
      const api = window.__SS__!; await api.loadLevel('L4', { seed: 3, checkpoint: 'turn', progression: 'L4-default' });
      api.pause(); api.cheats.god(true); api.teleport('player', { x: -29, z: 4 }); api.camera.follow(); api.camera.zoom(1);
    });
    for (const seconds of [30, 60, 120, 180]) {
      await session.page.evaluate(async seconds => {
        const api = window.__SS__!, target = api.missions.state()!.l4!.turnAt + seconds * 60;
        while (api.tick() < target) { api.teleport('player', { x: -29, z: 4 }); await api.step(Math.min(60, target - api.tick())); }
        await api.screenshotReady();
      }, seconds);
      const state = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game, snapshot = game.world.getState();
        return { tick: snapshot.tick, mission: window.__SS__!.missions.state(), layout: window.__SS__!.debug.corpseLayout(), figures: window.__SS__!.crowdFigures(),
          gameplay: { tick: snapshot.tick, entities: snapshot.entities, collision: snapshot.collision, mission: snapshot.mission, rng: snapshot.rng } };
      });
      const { gameplay, ...capture } = state;
      const gameplaySha256 = createHash('sha256').update(JSON.stringify(gameplay)).digest('hex');
      const resources = await session.page.evaluate(resourceSnapshot);
      receipts.push({ revision, seconds, state: capture, gameplaySha256, resources }); writeJson(`${out}/receipts.json`, receipts); await session.screenshot(`${out}/${seconds}s.png`);
    }
    await session.page.evaluate(() => window.__SS__!.camera.zoom(1.5)); await session.ready(); await session.screenshot(`${out}/180s-zoom1.5.png`);
    if (process.env.L4_TIMING === '1') {
      const hostLoad = loadavg();
      const cadence = await session.page.evaluate(async () => {
        const api = window.__SS__!; api.resume(); const frames: number[] = []; let previous = 0, warm: Record<string, number> = {};
        for (let i = 0; i < 720; i++) { const now = await new Promise<number>(requestAnimationFrame); if (i === 119) warm = { ...api.perf().nodeBuildMaterials }; if (i >= 120 && previous) frames.push(now - previous); previous = now; }
        api.pause(); frames.sort((a, b) => a - b);
        return { count: frames.length, p95: frames[Math.ceil(frames.length * .95) - 1], max: frames.at(-1), over200: frames.filter(t => t > 200).length, builds: Object.entries(api.perf().nodeBuildMaterials).filter(([key, count]) => count !== (warm[key] ?? 0)), perf: api.perf() };
      });
      writeJson(`${out}/cadence.json`, { revision, variant, tier, backend, hostLoad, cadence, timingStatus: 'Shared-host diagnostic; quiet p95/main and PROD five-cold-load comparison pending' });
      assert.equal(cadence.over200, 0); assert.deepEqual(cadence.builds, []);
    }
  }
  if (mode === 'crowd' || mode === 'corpses' || mode === 'perf') {
    const spec = mode === 'corpses' ? corpses : crowd30;
    const result = await runSpec(session, spec, { out, sheet: 0 });
    receipts.push(result); assert.ok(result.pass, JSON.stringify(result.failed));
    const metrics = await session.metrics();
    const resources = await session.page.evaluate(resourceSnapshot);
    if (mode === 'crowd' || mode === 'perf') {
      assert.equal(Object.keys(metrics.actors).length, 30);
      assert.ok(Object.values(metrics.actors).every(a => a.drawnFrames > 0), 'Every street-crowd figure submitted');
      const active = new Set(resources.render.crowd?.batches.filter(b => b.instances > 0).map(b => b.id));
      for (const id of converted) assert.ok(active.has(id === 'inf.riot-cop' ? 'infected.riot' : id), `${id}: distinct model batch submitted`);
    }
    writeJson(`${out}/receipt.json`, { revision, base, variant, tier, backend, result, metrics, resources, errors: session.errors });
    if (mode === 'perf') {
      const hostLoad = loadavg(), pool = await fetch('http://127.0.0.1:4329/status').then(r => r.json());
      const cadence = await session.page.evaluate(async () => {
        const api = window.__SS__!; api.resume(); const frames: number[] = []; let previous = 0, warm: Record<string, number> = {};
        for (let i = 0; i < 720; i++) { const now = await new Promise<number>(requestAnimationFrame); if (i === 119) warm = { ...api.perf().nodeBuildMaterials }; if (i >= 120 && previous) frames.push(now - previous); previous = now; }
        api.pause(); frames.sort((a, b) => a - b);
        return { count: frames.length, p95: frames[Math.ceil(frames.length * .95) - 1], max: frames.at(-1), over200: frames.filter(t => t > 200).length, builds: Object.entries(api.perf().nodeBuildMaterials).filter(([key, count]) => count !== (warm[key] ?? 0)) };
      });
      writeJson(`${out}/cadence.json`, { revision, variant, tier, backend, hostLoad, pool, cadence, timingStatus: 'shared-pool diagnostic; final quiet p95 and PROD five-cold-load comparison pending' });
      assert.equal(cadence.over200, 0); assert.deepEqual(cadence.builds, []);
    }
    for (const zoom of [1, 1.5]) { await session.page.evaluate(({ zoom, corpses }) => window.__SCENE__!.setCamera({ mode: 'game', target: corpses ? [0, .4, 0] : [-19, .6, 1], zoom }), { zoom, corpses: mode === 'corpses' }); await session.ready(); await session.screenshot(`${out}/zoom-${zoom}.png`); }
    if (mode === 'corpses') {
      for (let group = 0; group < 3; group++) {
        await session.page.evaluate(group => window.__SCENE__!.setCamera({ mode: 'game', target: [0, .6, -7 + group * 8], zoom: 1 }), group);
        await session.ready(); await session.screenshot(`${out}/group-${group}.png`);
      }
      const proof = await session.page.evaluate(async () => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const path = '/src/sim/world/SolidRegistry.ts', { solidLargeCorpse, actorRadius } = await import(path);
        const bodies = window.__SS__!.query({}).filter(e => e.corpse && e.archetype === 'infected.alpha');
        return bodies.map(e => ({ id: e.id, model: e.infected?.variant, solid: solidLargeCorpse(e), radius: actorRadius(e), occupancyBlocked: !game.world.solids.clear(e.transform, .28, 1), staticsClear: game.world.solids.clear(e.transform, .28, 1, false) }));
      });
      assert.equal(proof.length, 5); assert.ok(proof.every(p => p.solid && p.radius === 1 && p.occupancyBlocked && p.staticsClear));
      const cut = await session.page.evaluate(async () => {
        const api = window.__SS__!, body = api.query({}).find(e => e.corpse && e.archetype === 'infected.alpha')!;
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const player = game.world.entities.get(1)!;
        const relocated = game.world.solids.relocate(player, { x: body.transform.x - 1.2, y: body.transform.y, z: body.transform.z - 1.2 }, 'l4.review-corpse', 0, false);
        window.__SCENE__!.setCamera({ mode: 'game', target: [player.transform.x, .6, player.transform.z], zoom: 1.5 });
        await api.screenshotReady();
        const path = '/src/render/SeeThrough.ts', { seeThrough } = await import(path);
        return { relocated, player: player.transform, corpse: body.transform, cutStrength: seeThrough.corpse.value, radius: seeThrough.solidRadius.value };
      });
      assert.ok(cut.relocated && cut.cutStrength > 0);
      await session.screenshot(`${out}/courier-cut.png`); writeJson(`${out}/corpse-proof.json`, { revision, backend, tier, variant, proof, cut });
    }
  }
  assert.equal(session.errors.length, 0);
} finally { await session.close(); stopServer(); }
console.log(JSON.stringify({ revision, mode, variant, tier, backend, completedFixtures: receipts.length }));
