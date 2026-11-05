import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadLevel, runLevel } from '../../sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';
import type { MissionCheckpoint } from '../../../src/sim/missions/types';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash); assert.equal(control.observerHash, identity.observerHash);
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  const movement = { before: { best60TickMetres: 0, median60TickMetres: 0, windows: 0 }, carried: { best60TickMetres: 0, median60TickMetres: 0, windows: 0 } };
  const distances = { before: [] as number[], carried: [] as number[] };
  let grant: { tick: number; before: { LEFT: string[]; RIGHT: string[] }; after: { LEFT: string[]; RIGHT: string[] }; carried: boolean; installed: boolean; item: boolean } | null = null;
  const snapshots: { current: MissionCheckpoint; checkpoint: MissionCheckpoint }[] = [];
  let finalHash = '', previous: { x: number; z: number } | null = null, windowKey = '', window: number[] = [];
  const run = await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      const racks = () => {
        const weapons = world.entities.get(1)!.weapons!;
        return { LEFT: weapons.LEFT.rack.map(slot => slot.id), RIGHT: weapons.RIGHT.rack.map(slot => slot.id) };
      };
      const update = world.update.bind(world);
      world.update = () => {
        const beforeRacks = racks(), beforeItem = world.missions!.state.items.includes('cure-canister');
        update();
        const state = world.missions!.state, player = world.entities.get(1)!;
        if (!beforeItem && state.items.includes('cure-canister')) {
          grant = { tick: world.tick, before: beforeRacks, after: racks(), carried: !!state.states['cure-carried'], installed: !!state.states['cure-installed'], item: true };
          snapshots.push(world.missions!.saveResume());
        }
        const carried = !!state.states['cure-carried'], key = carried ? 'carried' : 'before';
        const eligible = !state.states['cure-installed'] && player.health.current > 0 && Math.hypot(world.inputFrame.move.x, world.inputFrame.move.z) >= .99;
        const distance = previous ? Math.hypot(player.transform.x - previous.x, player.transform.z - previous.z) : 0;
        if (!eligible || windowKey !== key) window = [];
        if (eligible) {
          windowKey = key; window.push(distance); if (window.length > 60) window.shift();
          if (window.length === 60) { const metres = window.reduce((sum, metres) => sum + metres, 0); movement[key].windows++; movement[key].best60TickMetres = Math.max(movement[key].best60TickMetres, metres); distances[key].push(metres); }
        }
        previous = { x: player.transform.x, z: player.transform.z };
      };
    },
    beforeDispose: world => { finalHash = stateHash(world.getState()); },
  });
  assert(run.completed); assert.equal(finalHash, control.nativeStateHash, 'cure observation must preserve canonical control');
  for (const key of ['before', 'carried'] as const) { const sorted = distances[key].sort((a, b) => a - b); movement[key].median60TickMetres = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; }
  assert.equal(snapshots.length, 1, 'Exactly one ordinary canister acquisition');
  const snapshot = snapshots[0], controlledMovement = [];
  for (const move of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
    const cases = [];
    for (const carried of [false, true]) {
      const seed = preset('L10-default'); seed.settings.quality = tier;
      const world = await loadLevel('L10', 1, seed, 0, { quality: tier });
      world.missions!.loadResume(structuredClone(snapshot));
      // Controlled canister-only intervention. Both cases retain the exact
      // same production Resume actors, positions, objectives, time and RNG.
      // Use the normal input API; never move or disable actors/colliders.
      world.missions!.state.states['cure-carried'] = carried;
      if (!carried) world.missions!.state.items = world.missions!.state.items.filter(item => item !== 'cure-canister');
      const player = world.entities.get(1)!, start = { x: player.transform.x, z: player.transform.z }, trajectory = [];
      for (let tick = 0; tick < 120; tick++) {
        world.applyInput({ ...emptyInput(), move }, 'keyboard'); world.update();
        trajectory.push({ x: player.transform.x, y: player.transform.y, z: player.transform.z });
      }
      const displacement = Math.hypot(player.transform.x - start.x, player.transform.z - start.z);
      cases.push({ carried, displacement, trajectorySha256: createHash('sha256').update(JSON.stringify(trajectory)).digest('hex'), finalCarried: !!world.missions!.state.states['cure-carried'], finalItem: world.missions!.state.items.includes('cure-canister') });
      world.dispose();
    }
    controlledMovement.push({ move, ticks: 120, cases, identical: cases[0].trajectorySha256 === cases[1].trajectorySha256 });
  }
  rows.push({ tier, grant, movement, controlledMovement, snapshotSha256: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), nativeStateHash: finalHash, controlIdentical: true });
  console.log(tier, { grant, movement, controlledMovement });
}
atomicJson('docs/reports/fix51-r10c/L10-cure-proof.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Read-only actual native cure grant and route movement observations; canonical final state identical. Separately replay the naturally reached post-grant production Resume snapshot with and without only the canister flag/item. All actors, positions, objectives, time and RNG identical. Four cardinal keyboard inputs for120ticks each; compare every-tick XYZ trajectory hashes exactly, retaining displacements to rule out an entirely blocked setup. Checkpoint death and physical subtitle/backpack appearance are separate evidence.', rows });
