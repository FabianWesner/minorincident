/** Read-only diagnosis of the existing T-E07-12 formula; does not replace or relax that test. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Object3D, InstancedMesh } from 'three/webgpu';
import type { Game } from '../../src/Game';
import { infectedDefinitions } from '../../src/data/infected';
import { SceneSession, stopServer } from '../scenelab/session';
const out = 'test-results/ac-close-shared/object-audit'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1600, height: 900 } });
try {
  await session.open();
  await session.page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('horde-arena'); api.pause(); api.cheats.god(true);
    for (let i = 0; i < 200; i++) api.spawn('infected.runner', i === 199 ? { x: 50, z: 50 } : { x: i % 20 * .8 - 8, z: Math.floor(i / 20) * .8 - 4 }, { state: 'chase' });
    await api.step(0); await api.screenshotReady();
  });
  async function audit(label: string) {
    const result = await session.page.evaluate(() => {
      const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      const crowd = (game.view as unknown as { crowd: Object3D & {
        batches: Map<string, { mesh: Object3D }>; heroSlots: Map<string, Object3D>;
        staticCorpses: Object3D & { snapshot(): unknown }; caps: Object3D; shadows: Object3D;
      } }).crowd;
      const accessories = (game.view as unknown as { accessories: Object3D & { batches: Map<string, Object3D> } }).accessories;
      const accessoryOwners = new Map([...accessories.batches].map(([key, mesh]) => [mesh.id, key]));
      const accessoryNodes: { id: number; owner: string | null; instanced: boolean }[] = [];
      accessories.traverse(o => { if (o !== accessories) accessoryNodes.push({ id: o.id, owner: accessoryOwners.get(o.id) ?? null, instanced: o instanceof (crowd.caps.constructor as typeof InstancedMesh) }); });
      const owned = new Map<number, string>();
      for (const [key, batch] of crowd.batches) owned.set(batch.mesh.id, `batch:${key}`);
      for (const [key, mesh] of crowd.heroSlots) owned.set(mesh.id, `reserved:${key}`);
      owned.set(crowd.staticCorpses.id, 'corpse-group'); owned.set(crowd.caps.id, 'caps'); owned.set(crowd.shadows.id, 'shadows');
      const pages = crowd.staticCorpses.children.map(o => ({ id: o.id, name: o.name, count: (o as InstancedMesh).count, instanced: o instanceof (crowd.caps.constructor as typeof InstancedMesh), instancedFlag: (o as InstancedMesh).isInstancedMesh, capacity: (o as InstancedMesh).instanceMatrix.count, parent: o.parent?.id }));
      for (const page of pages) owned.set(page.id, `corpse-page:${page.name}`);
      const nodes: { id: number; name: string; owner: string | null }[] = [];
      crowd.traverse(o => { if (o !== crowd) nodes.push({ id: o.id, name: o.name, owner: owned.get(o.id) ?? null }); });
      const offscreen = api.query({ kind: 'infected' }).find(e => e.transform.x === 50);
      return { tick: api.tick(), ai: api.getState().ai, crowd: api.getState().render.crowd!, perf: { drawCalls: api.perf().drawCalls, profile: api.perf().profile, profileAssets: api.perf().profileAssets },
        accessoryNodes, accessoryObjects: accessoryNodes.length, accessoryBatchCount: accessories.batches.size, accessoryUnowned: accessoryNodes.filter(o => !o.owner), actualBatches: crowd.batches.size, reservedSlots: crowd.heroSlots.size, pages, nodes,
        corpseState: crowd.staticCorpses.snapshot(), corpses: api.query({ kind: 'infected' }).filter(e => e.corpse).length,
        unowned: nodes.filter(o => !o.owner), offscreen: offscreen ? { projected: api.camera.project(offscreen.transform.x, offscreen.transform.y, offscreen.transform.z), drawn: api.crowdFigures().some(f => f.id === offscreen.id && f.drawn) } : null };
    });
    assert.equal(result.accessoryUnowned.length, 0); assert.equal(result.accessoryObjects, result.accessoryBatchCount); assert.ok(result.accessoryNodes.every(o => o.instanced));
    writeFileSync(`${out}/${label}.json`, JSON.stringify(result, null, 2) + '\n');
    return result;
  }
  function combinedDraws(state: Awaited<ReturnType<typeof audit>>) {
    const accessories = Object.entries(state.perf.profileAssets ?? {}).filter(([key]) => key.startsWith('view:other/crowd-accessories/')).reduce((sum, [,v]) => sum + v.drawCalls, 0);
    return (state.perf.profile?.crowd?.drawCalls ?? 0) + accessories;
  }
  const alive = await audit('alive');
  assert.equal(alive.crowd.meshDrawCalls, combinedDraws(alive));
  assert.equal(alive.ai!.count, 200); assert.equal(alive.unowned.length, 0);
  assert.equal(alive.nodes.length, alive.actualBatches + alive.reservedSlots + 3 + alive.pages.length);
  assert.ok(alive.pages.every(page => page.count === 0 && page.instanced && page.capacity === 128));
  assert.ok(alive.crowd.meshDrawCalls <= 30); assert.equal(alive.crowd.nonInstancedMeshes, 0);
  assert.ok(Math.max(...alive.offscreen!.projected.map(Math.abs).slice(0, 2)) > 1.5); assert.equal(alive.offscreen!.drawn, false);
  await session.screenshot(`${out}/alive.png`);
  await session.page.evaluate(async () => { const api = window.__SS__!; api.cheats.killAll(); await api.step(121); await api.screenshotReady(); });
  const settled = await audit('settled'); assert.equal(settled.corpses, 200); assert.equal(settled.ai!.count, 0); assert.equal(settled.unowned.length, 0);
  await session.page.evaluate(async () => { const api = window.__SS__!; await api.loadScenario('horde-arena'); api.pause(); await api.screenshotReady(); });
  const empty = await audit('empty'); const delta = alive.perf.drawCalls - empty.perf.drawCalls;
  assert.ok(delta > 0 && delta <= 30);
  await session.page.evaluate(async roles => {
    const api = window.__SS__!;
    for (let i = 0; i < 190; i++) api.spawn(roles[i % roles.length], { x: i % 20 * 1.2 - 12, z: Math.floor(i / 20) * 1.2 - 6 }, { state: 'idle', perched: false });
    api.spawn('infected.crow', { x: -8, z: -4 }); api.spawn('infected.crow', { x: 8, z: -4 });
    await api.step(0); await api.screenshotReady();
  }, infectedDefinitions.filter(def => def.id !== 'infected.crow').map(def => def.id));
  const mixed = await audit('mixed'); assert.equal(mixed.crowd.meshDrawCalls, combinedDraws(mixed)); assert.equal(mixed.accessoryObjects, alive.accessoryObjects); assert.equal(mixed.ai!.count, 200); assert.equal(mixed.unowned.length, 0);
  assert.equal(mixed.nodes.length, mixed.actualBatches + mixed.reservedSlots + 3 + mixed.pages.length);
  assert.ok(mixed.crowd.meshDrawCalls <= 30); assert.equal(mixed.crowd.nonInstancedMeshes, 0);
  await session.screenshot(`${out}/mixed.png`);
  const proof = { alive, settled, empty, mixed, crowdDrawDelta: delta,
    originalObjectFormula: { expected: alive.crowd.batches.length + 3, actual: alive.crowd.objects },
    originalMixedEquality: { expected: alive.crowd.objects, actual: mixed.crowd.objects }, errors: session.errors };
  writeFileSync(`${out}/proof.json`, JSON.stringify(proof, null, 2) + '\n');
  assert.deepEqual(session.errors, []);
  console.log(JSON.stringify({ alive: alive.nodes.length, alivePages: alive.pages.length, mixed: mixed.nodes.length, mixedPages: mixed.pages.length, unowned: [alive, settled, empty, mixed].map(s => s.unowned.length), crowdDrawDelta: delta }));
} finally { await session.close(); stopServer(); }
