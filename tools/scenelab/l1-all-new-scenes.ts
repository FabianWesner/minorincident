/** Scripted story scenes and the production crowd's live/turned/corpse appearances. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import { pedestrians, named } from './l1-all-new-crowd';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const out = resolve('test-results/l1-all-new/scenes');
const session = new SceneSession({ backend: 'webgpu', tier: 'low', viewport: { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
const receipts: unknown[] = [];
let passed = true;
try {
  await session.open();
  for (const file of process.env.ONLY_STATES === '1' ? [] : process.env.STORY_FILES?.split(',').filter(Boolean) ?? ['specs/scenes/qa-handover-depot.json', 'specs/scenes/qa-handover-annex.json', 'specs/scenes/catalog/fight-firefighter-vs2.json', 'tests/scenes/catalog/corgi-tongue-female.json', 'tests/scenes/catalog/corgi-tongue-male.json', 'tests/scenes/catalog/dog-limbs-attached.json', 'specs/scenes/catalog/corgi-sit.json', 'specs/scenes/catalog/corgi-behaviour.json', 'specs/scenes/catalog/dog-bike-follow.json']) {
    const spec = readSpec(resolve(file));
    // Full size shots retain the actual game view; the labelled sheet samples the complete choreography.
    const result = await runSpec(session, spec, { file, out: resolve(out, spec.name!), sheet: spec.name!.includes('handover') ? 60 : spec.sheet ?? 60 });
    let baselineComparison;
    if (spec.name === 'qa-handover-depot' && result.failed.every(check => check.name === 'actorHitsMax')) {
      const before = JSON.parse(readFileSync(resolve(out, 'depot-main/metrics.json'), 'utf8'));
      const after = JSON.parse(readFileSync(resolve(out, spec.name, 'metrics.json'), 'utf8'));
      const signature = (hit: { bone: string; asset: string; actor: string; frame: number }) => [hit.actor, hit.bone, hit.asset, hit.frame].join('/');
      const oldHits = new Map<string, { clearanceCm: number }>(before.clipping.actors.map((hit: { clearanceCm: number; bone: string; asset: string; actor: string; frame: number }) => [signature(hit), hit]));
      const noNewContact = after.clipping.actors.length === oldHits.size && after.clipping.actors.every((hit: { crossing: boolean; clearanceCm: number; bone: string; asset: string; actor: string; frame: number }) => !hit.crossing && oldHits.has(signature(hit)) && hit.clearanceCm >= oldHits.get(signature(hit))!.clearanceCm - .1);
      baselineComparison = { revision: '0009f107d', path: 'depot-main/metrics.json', noNewContact, old: before.clipping.actors, current: after.clipping.actors };
    }
    receipts.push({ file, ...result, baselineComparison });
    writeJson(resolve(out, 'receipts.json'), receipts);
    if (!result.pass && !baselineComparison?.noNewContact) { console.error(`${spec.name}: ${JSON.stringify(result.failed)}`); passed = false; }
  }
  if (process.env.ONLY_STATES !== '1') {
    await session.load({ name: 'corgi-apc-transport', ground: 'asphalt', time: 'L1', size: 60, actors: [{ id: 'courier', kind: 'courier', at: [4, 5] }, { id: 'corgi', kind: 'corgi', at: [.71, 2.025] }], vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, 0] }], camera: { mode: 'game', target: 'apc', zoom: 1.5 } });
    const transport = [];
    await session.page.evaluate(() => window.__SCENE__!.command('corgi', { boardCar: 'apc' }));
    await session.step(90); await session.ready();
    const seated = await session.page.evaluate(() => {
      const world = (window.__SCENE__ as unknown as { game: Game }).game.world;
      const corgi = [...world.entities.iterate()].find(e => e.companion)!;
      const vehicle = world.entities.get(corgi.passengerOf!)!;
      return { id: corgi.id, passengerOf: corgi.passengerOf, hidden: corgi.hidden, phase: vehicle.vehicle?.passengers?.find(p => p.id === corgi.id)?.phase };
    });
    assert.equal(seated.phase, 'seated'); assert.ok(seated.passengerOf); transport.push({ frame: 90, ...seated });
    await session.screenshot(resolve(out, 'corgi-apc-seated.png'));
    await session.page.evaluate(() => window.__SCENE__!.command('corgi', { exitCar: 'apc' }));
    await session.step(90); await session.ready();
    const exited = await session.page.evaluate(() => {
      const world = (window.__SCENE__ as unknown as { game: Game }).game.world, corgi = [...world.entities.iterate()].find(e => e.companion)!;
      return { id: corgi.id, passengerOf: corgi.passengerOf, hidden: corgi.hidden, health: corgi.health.current };
    });
    assert.equal(exited.passengerOf, undefined); assert.ok(!exited.hidden && exited.health > 0); transport.push({ frame: 180, ...exited });
    await session.screenshot(resolve(out, 'corgi-apc-exited.png'));
    for (const parked of [false, true]) {
      const spec = readSpec(resolve('tests/scenes/catalog/qa-vehicle-travel-convoy.json'));
      spec.name = parked ? 'corgi-bus-disembark' : 'corgi-bus-ride'; spec.l4Convoy = parked ? 'parked' : true;
      spec.actors!.push({ id: 'corgi', kind: 'corgi', at: [-71, 47] });
      await session.load(spec); await session.step(parked ? 2 : 600); await session.ready();
      const state = await session.page.evaluate(() => {
        const world = (window.__SCENE__ as unknown as { game: Game }).game.world, corgi = [...world.entities.iterate()].find(e => e.companion)!, player = world.entities.get(1)!;
        const l4 = world.missions!.state.l4!;
        const distanceToHull = Math.min(...l4.convoyIds.map(id => { const e = world.entities.get(id)!; return Math.hypot(corgi.transform.x - e.transform.x, corgi.transform.z - e.transform.z); }));
        return { seated: l4.seated, hidden: !!corgi.hidden, distanceToHull, distanceToCourier: Math.hypot(corgi.transform.x - player.transform.x, corgi.transform.z - player.transform.z), health: corgi.health.current };
      });
      assert.equal(state.seated, !parked); assert.equal(state.hidden, !parked); assert.ok(state.health > 0);
      if (parked) assert.ok(state.distanceToCourier < 4); else assert.ok(state.distanceToHull < .5);
      transport.push({ scene: spec.name, ...state });
      await session.screenshot(resolve(out, `${spec.name}.png`));
    }
    writeJson(resolve(out, 'corgi-transport.json'), transport);
    assert.equal(session.errors.length, 0);
  }
  for (const model of process.env.STATE_FIGURES?.split(',').filter(Boolean) ?? [...pedestrians, ...named]) for (const state of ['healthy', 'turned', 'corpse']) {
    const spec: SceneSpec = {
      name: `${model}-${state}`, ground: 'asphalt', time: 'L1', size: 100,
      actors: [
        { id: 'courier', kind: 'courier', at: [40, 40] },
        { id: 'figure', kind: 'pedestrian', at: [0, 0], yaw: -45, look: { model, handProp: model === 'npc.civilian-elderly' ? 'cane' : null }, state: 'idle' },
      ],
      script: [
        ...state !== 'healthy' ? [{ frame: 1, actor: 'figure', do: { infect: { instant: true } } }] : [],
        ...state === 'corpse' ? [{ frame: 2, actor: 'figure', do: { corpse: true as const } }] : [],
        { frame: 179, camera: { mode: 'close', target: 'figure', radius: 6, azimuth: 45 } },
      ],
      camera: { mode: 'close', target: [0, .75, 0], radius: 6, azimuth: 45 },
      frames: 180, shots: [0, 3, 180], expect: { consoleErrors: 0 },
    };
    const result = await runSpec(session, spec, { out: resolve(out, spec.name!) });
    receipts.push({ model, state, ...result }); writeJson(resolve(out, 'receipts.json'), receipts);
    assert.ok(result.pass, `${spec.name}: ${JSON.stringify(result.failed)}`);
  }
} finally { await session.close(); stopServer(); }
console.log(JSON.stringify(receipts));
assert.ok(passed, 'Inspect failed scene receipts, including baseline comparisons');
