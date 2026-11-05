import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadLevel, runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { transactArsenal } from '../../../src/sim/progression/arsenal';
import type { MissionCheckpoint } from '../../../src/sim/missions/types';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

const expected = [
  { weapon: 'weapon.pistol', checkpoint: 'cure-residential' },
  { weapon: 'weapon.shotgun', checkpoint: 'cure-industrial' },
  { weapon: 'weapon.army-mg', checkpoint: 'cure-military' },
  { weapon: 'weapon.rocket-launcher', checkpoint: 'cure-corridor' },
];
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash); assert.equal(control.observerHash, identity.observerHash);
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  const acquisitions: { weapon: string; tick: number; x: number; z: number; interact: boolean; checkpoint: string | null; snapshotTick: number | null; snapshotWeapons: string[]; expectedDistance: number | null; expectedRadius: number | null }[] = [];
  let finalHash = '';
  const beforePickups = new Map<string, { current: MissionCheckpoint; checkpoint: MissionCheckpoint }>();
  const run = await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      world.events.on('pickup.collected', event => {
        if (event.type !== 'pickup.collected') return;
        const weapon = 'actionId' in event ? event.actionId : event.item;
        if (!weapon?.startsWith('weapon.')) return;
        const player = world.entities.get(1)!, target = expected.find(row => row.weapon === weapon), anchor = target && world.missions!.def.anchors[target.checkpoint];
        acquisitions.push({ weapon, tick: event.tick, x: player.transform.x, z: player.transform.z, interact: world.inputFrame.interact, checkpoint: null, snapshotTick: null, snapshotWeapons: [],
          expectedDistance: anchor ? Math.hypot(player.transform.x - anchor.x, player.transform.z - anchor.z) : null, expectedRadius: anchor?.radius ?? null });
      });
      const update = world.update.bind(world);
      world.update = () => {
        const player = world.entities.get(1)!, owned = [...player.weapons!.LEFT.rack, ...player.weapons!.RIGHT.rack].map(slot => slot.id);
        for (const target of expected) {
          const anchor = world.missions!.def.anchors[target.checkpoint];
          if (!beforePickups.has(target.weapon) && !owned.includes(target.weapon) &&
            Math.hypot(player.transform.x - anchor.x, player.transform.z - anchor.z) <= anchor.radius + 1) beforePickups.set(target.weapon, world.missions!.saveResume());
        }
        update();
        for (const row of acquisitions.filter(row => row.snapshotTick === null && row.tick === world.tick)) {
          const saved = world.missions!.saveResume().checkpoint, player = saved.entities.find(actor => actor.id === 1)!;
          row.checkpoint = saved.state.checkpoint; row.snapshotTick = saved.tick;
          row.snapshotWeapons = [...new Set([...(player.weapons?.LEFT.rack ?? []), ...(player.weapons?.RIGHT.rack ?? [])].map(slot => slot.id))];
        }
      };
    },
    beforeDispose: world => { finalHash = stateHash(world.getState()); },
  });
  assert(run.completed); assert.equal(finalHash, control.nativeStateHash, 'pickup observation must leave canonical control identical');
  const inventoryCases = [];
  for (const target of expected) {
    const resume = beforePickups.get(target.weapon);
    assert(resume, `Missing naturally reached before-pickup snapshot for ${target.weapon}`);
    const cases = [];
    for (const add of [[], [target.weapon], expected.map(row => row.weapon)]) {
      const seed = preset('L10-default'); seed.settings.quality = tier;
      const world = await loadLevel('L10', 1, seed, 0, { quality: tier });
      world.missions!.loadResume(structuredClone(resume));
      const before = world.infected!.active.length, births: { tick: number; id: number; archetype: string }[] = [];
      const spawn = world.infected!.spawn.bind(world.infected!);
      world.infected!.spawn = (...args: Parameters<typeof spawn>) => {
        const id = spawn(...args); births.push({ tick: world.tick, id, archetype: args[0] }); return id;
      };
      // Deliberate controlled inventory-only intervention at each actual
      // pre-pickup location. Production Resume restores the same actors, depth,
      // objective, time and RNG state for the unchanged baseline and each case.
      if (add.length) transactArsenal(world, add, []);
      const census = [];
      for (let tick = 0; tick < 240; tick++) {
        world.update();
        census.push(world.infected!.active.map(actor => ({ id: actor.id, archetype: actor.archetype, x: actor.transform.x, z: actor.transform.z, hp: actor.health.current })));
      }
      cases.push({ add, before, births, censusSha256: createHash('sha256').update(JSON.stringify(census)).digest('hex'), checkpoint: world.missions!.state.checkpoint });
      world.dispose();
    }
    const baseline = cases[0];
    const identical = cases.every(row => row.before === baseline.before && JSON.stringify(row.births) === JSON.stringify(baseline.births) && row.censusSha256 === baseline.censusSha256 && row.checkpoint === baseline.checkpoint);
    inventoryCases.push({ weapon: target.weapon, snapshotTick: resume.current.tick, snapshotSha256: createHash('sha256').update(JSON.stringify(resume)).digest('hex'), cases, identical });
  }
  const inventoryOnlyIdentical = inventoryCases.every(row => row.identical);
  rows.push({ tier, acquisitions, expected, nativeStateHash: finalHash, controlIdentical: true, inventorySeconds: 4, inventoryCases, inventoryOnlyIdentical });
  console.log(tier, { acquisitions, inventoryOnlyIdentical, baselineBirths: inventoryCases.map(row => row.cases[0].births.length) });
}
atomicJson('docs/reports/fix51-r10c/L10-pickups-proof.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Observe every ordinary native weapon collection: exact named anchor, approach interaction and same-tick checkpoint entity arsenal. Final state equals canonical control. Separately compare four-second controlled inventory-only interventions at each naturally reached pre-pickup production Resume snapshot (the named weapon and all four) with an unchanged baseline; compare every infected census and spawn call. This inventory-only fixture does not complete objectives or move actors.', rows });
