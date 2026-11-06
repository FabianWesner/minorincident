import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';

const backend = (process.argv[2] ?? 'webgl2') as Backend, tier = (process.argv[3] ?? 'low') as 'low' | 'high';
if (!['webgl2', 'webgpu'].includes(backend) || !['low', 'high'].includes(tier)) throw new Error('Expected backend and quality');
const reportSlug = process.env.QA_REPORT_SLUG ?? 'fix51-r10g';
const out = `test-results/${reportSlug}/G-11-${backend}-${tier}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier });
const rows: unknown[] = [], shots: { frame: number; jpeg: Buffer }[] = [];
try {
  await session.open();
  await session.load({ name: 'G-11-pickup-rings', ground: 'asphalt', time: 'L1', tier: 0,
    actors: [{ id: 'courier', kind: 'courier', at: [-8, -3], loadout: ['weapon.handgun', 'weapon.fists'], state: { run: [[-3, 0], [-8, -3], [-3, 0]] } },
      { id: 'follower', kind: 'pedestrian', at: [3, 3], look: { model: 'npc.civilian-man-b.aftermath' }, state: { survivor: { slot: 0 } } }],
    camera: { mode: 'pose', position: [8, 11, 9], target: [0, 0, 0] }, frames: 1 });
  const setup = await session.page.evaluate(() => {
    const world = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.world;
    const courierId = world.combat!.pickups.spawn('weapon.handgun', { x: -3, z: 0 }, false, { retain: true, interactTicks: 60 });
    const survivorId = world.combat!.pickups.spawn('weapon.handgun', { x: 3, z: 0 }, false, { survivorOnly: true });
    const ledger = { collections: [] as { id: number; tick: number; source: number }[], maxAwayAfterCollection: 0, returned: false };
    (window as unknown as { __pickupRingLedger: typeof ledger }).__pickupRingLedger = ledger;
    world.events.on('pickup.collected', e => { if (e.type === 'pickup.collected' && 'pickupId' in e && [courierId, survivorId].includes(e.pickupId)) ledger.collections.push({ id: e.pickupId, tick: e.tick, source: e.sourceId }); });
    world.events.on('sim.tick', () => {
      if (!ledger.collections.some(e => e.id === courierId)) return;
      const player = world.entities.get(1)!.transform, d = Math.hypot(player.x + 3, player.z);
      ledger.maxAwayAfterCollection = Math.max(ledger.maxAwayAfterCollection, d);
      if (ledger.maxAwayAfterCollection > 4 && d < .6) ledger.returned = true;
    });
    return { courierId, survivorId };
  });
  async function capture(stage: string) {
    await session.ready();
    const data = await session.page.evaluate(setup => {
      const game = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game;
      const actions = game.view as unknown as { actions: { pickups: Map<number, { children: { isMesh?: boolean; name: string; children: unknown[] }[] }> } };
      const pickups = [{ id: setup.courierId, at: { x: -3, z: 0 }, survivorOnly: false }, { id: setup.survivorId, at: { x: 3, z: 0 }, survivorOnly: true }].map(item => {
        const group = actions.actions.pickups.get(item.id), p = window.__SS__!.camera.project(item.at.x, .02, item.at.z);
        return { ...item, present: !!game.world.entities.get(item.id), markerMeshes: group?.children.filter(c => c.isMesh).length ?? 0, modelLoaded: !!group?.children.some(c => c.name === 'pickup-rest' && c.children.length), pixel: { x: (p[0] + 1) * 640, y: (1 - p[1]) * 360 } };
      });
      const render = window.__SS__!.getState().render;
      return { backend: render.backend, quality: render.quality, pickups, player: { ...game.world.entities.get(1)!.transform },
        ledger: structuredClone((window as unknown as { __pickupRingLedger: unknown }).__pickupRingLedger),
        replacementAtCourierSpot: [...game.world.entities.iterate()].filter(e => e.pickup && 'actionId' in e.pickup && Math.hypot(e.transform.x + 3, e.transform.z) < .5).map(e => e.id) };
    }, setup);
    const file = join(out, `${stage}.png`), buffer = await session.screenshot(file), png = PNG.sync.read(buffer);
    const pixels = data.pickups.map(p => {
      let yellow = 0;
      for (let y = Math.max(0, Math.floor(p.pixel.y - 40)); y < Math.min(png.height, Math.ceil(p.pixel.y + 40)); y++) for (let x = Math.max(0, Math.floor(p.pixel.x - 40)); x < Math.min(png.width, Math.ceil(p.pixel.x + 40)); x++) {
        const i = (y * png.width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
        if (r > 150 && g > 100 && r >= g * .9 && b < g * .75) yellow++;
      }
      return { id: p.id, yellowPixels: yellow };
    });
    rows.push({ stage, ...data, pixels, file, sha256: createHash('sha256').update(buffer).digest('hex') }); shots.push({ frame: shots.length, jpeg: buffer });
  }
  await capture('before');
  await session.step(480); await capture('after-revisit');
  await session.makeSheet(shots, `test-results/${reportSlug}/G-11-${backend}-${tier}.jpg`, 640, 380);
} finally {
  writeFileSync(`docs/reports/${reportSlug}/G-11-${backend}-${tier}.json`, JSON.stringify({ ...provenance(), scriptSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'), backend, tier,
    setup: 'paired authored/survivor-only pickup renderer fixture and Scene Lab native run-input out-and-back route; no timing claim', rows, errors: session.errors }, null, 2) + '\n');
  await session.close(); stopServer();
}
console.log(`${backend}/${tier}: pickup rings and revisit captured`);
