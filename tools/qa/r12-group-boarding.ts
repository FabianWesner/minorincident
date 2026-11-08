/** Native L7 queue integration fixture. Initial placement bypasses the upstream street route;
 * after setup the ordinary follower, collision, boarding and courier-last controllers own every tick.
 * This proves queue integration, not mortal campaign completion. No browser. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { l7Departure } from '../../src/data/l7';
import { l7CorridorAnchors } from '../../src/levels/L7/corridor';
import { preset } from '../../src/sim/progression/Campaign';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';

const identity = provenance(), rows = [];
for (const quality of ['low', 'high'] as const) {
  const world = await loadLevel('L7', 1, preset('L7-default'), 0, { quality });
  try {
    const departure = world.l7Departure!, roster = world.l7Encounters!.state.roster;
    const player = world.entities.get(1)!, start = l7CorridorAnchors['l7-bus-boarding'].position;
    for (const enemy of [...world.infected!.active]) world.infected!.release(enemy);
    world.infected!.director.queue.length = 0;
    assert(world.solids.relocate(player, { x: start[0], z: start[2], y: world.districts!.groundHeight(start[0], start[2]) + .92 }, 'qa.group-queue-player', 2));
    for (const [slot, row] of roster.entries()) {
      const e = world.entities.get(row.id)!;
      const x = l7Departure.queue.x + Math.floor(slot / 3) * 1.1;
      const z = l7Departure.queue.z - 5 + (slot % 3 - 1) * 1.1;
      assert(world.solids.relocate(e, { x, z, y: world.districts!.groundHeight(x, z) + .7 }, 'qa.group-queue-follower', 5));
      e.civilian!.path.length = 0; e.civilian!.goal = -1;
      delete e.locomotion; delete e.motion;
      world.solids.commit();
    }
    const expected = roster.map(row => row.id).sort((a, b) => a - b);
    let maxVisibleStep = 0, assisted = 0, recovered = 0, elapsed = 0;
    world.events.on('mission.signal', event => {
      if (event.type !== 'mission.signal') return;
      if (event.name === 'l7.survivor-assisted') assisted++;
      if (event.name === 'l7.survivor-recovered') recovered++;
    });
    for (; elapsed < 120 * 60 && departure.state.phase !== 'departing'; elapsed++) {
      const before = roster.map(row => { const e = world.entities.get(row.id)!; return { e, x: e.transform.x, z: e.transform.z, visible: !e.hidden && e.passengerOf === undefined }; });
      world.applyInput(emptyInput(), 'keyboard'); world.update();
      for (const at of before) if (at.visible && !at.e.hidden && at.e.passengerOf === undefined)
        maxVisibleStep = Math.max(maxVisibleStep, Math.hypot(at.e.transform.x - at.x, at.e.transform.z - at.z));
      if (player.hidden) assert.equal(departure.state.boarded.length, expected.length, 'courier boards last');
    }
    assert.equal(departure.state.phase, 'departing', 'every living follower reaches the bus');
    assert.deepEqual([...departure.state.boarded].sort((a, b) => a - b), expected);
    assert(maxVisibleStep < 1, 'visible followers walk without a teleport');
    assert.equal(world.solids.snapshot().failures, 0);
    rows.push({ quality, followers: expected.length, boarded: departure.state.boarded.length, seconds: elapsed / 60, maxVisibleStep, assisted, recovered });
    console.log(JSON.stringify(rows.at(-1)));
  } finally { world.dispose(); }
}
assert.equal(provenance().sourceHash, identity.sourceHash);
mkdirSync('test-results/r12-group', { recursive: true });
writeFileSync('test-results/r12-group/l7-boarding.json', JSON.stringify({ ...identity, fixture: 'quiet queue approach; initial relocation only', rows }, null, 2) + '\n');
