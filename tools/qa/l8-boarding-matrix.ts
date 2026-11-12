/** Native L8 final boarding across five seeds and four persistent elephant corpse positions. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';

const spots = [
  { id: 'yard-centre', at: { x: 101, z: 57 } },
  { id: 'entry-gateway', at: { x: 96, z: 39.5 } },
  { id: 'yard-gate', at: { x: 96, z: 46 } },
  { id: 'north-exit', at: { x: 96, z: 67 } },
] as const;
const rows = [];
for (const seed of [1, 2, 3, 4, 5]) for (const spot of spots) {
  const world = await loadLevel('L8', seed, undefined, 0, { quality: 'high' });
  const mission = world.missions!, zoo = mission.l8!, state = zoo.state;
  const elephant = state.arenas.find(arena => arena.id === 'elephant')!;
  mission.state.states.breached = true;
  mission.state.states['hale-keys'] = true;
  mission.state.states['hale-fallen'] = true;
  state.breachedAt = -1800; state.nextWave = Number.MAX_SAFE_INTEGER;
  mission.state.steps.sanctuary.status = 'completed'; mission.state.steps.escape.status = 'active';
  for (const arena of state.arenas) arena.phase = 3;
  elephant.armed = false;
  zoo.bosses.updateGates();
  world.combat!.damage.god = true;
  assert(world.solids.relocate(world.entities.get(1)!, { x: 93.5, z: 73.5, y: .7 }, 'qa.l8-boarding-courier', 2));
  world.update();
  const group = zoo.passengers();
  assert.equal(group.length, 14, `seed ${seed}: expected the complete 14-person passenger group`);
  for (const [index, id] of group.entries()) {
    const actor = world.entities.get(id)!;
    const x = spot.id === 'yard-gate' ? 96 + (index % 4) * .8 : 101 + (index % 4) * 1.1;
    const z = (spot.id === 'yard-gate' ? 44.5 : 51) + Math.floor(index / 4) * .65;
    assert(world.solids.relocate(actor, { x, z, y: actor.companion ? .3 : .82 }, 'qa.l8-yard-group', 4), `seed ${seed}: passenger ${id} setup`);
  }
  const body = world.entities.get(elephant.ids[0])!;
  assert(world.solids.relocate(body, { ...spot.at, y: .7 }, `qa.l8-elephant-${spot.id}`, 5), `seed ${seed}: persistent elephant corpse at ${spot.id}`);
  body.health.current = 0; body.corpse = true;
  elephant.armed = true;
  zoo.bosses.updateGates();
  const start = world.tick;
  let seated = 0;
  for (let tick = 0; tick < 60 * 60; tick++) {
    world.applyInput(emptyInput(), 'keyboard'); world.update();
    const seats = world.entities.get(state.carId)!.vehicle!.passengers ?? [];
    seated = group.filter(id => seats.some(passenger => passenger.id === id && passenger.phase === 'seated')).length;
    if (seated === group.length) break;
  }
  const gateClosed = !world.solids.clear({ x: 96, y: 1.5, z: 39 }, .2, 0, false, 0);
  const seconds = (world.tick - start) / 60;
  const row = { seed, corpseSpot: spot.id, corpsePersists: body.corpse === true, entryGateArmed: elephant.armed,
    entryGateClosed: gateClosed, seated, total: group.length, seconds, collisionFailures: world.solids.failures,
    pass: seated === group.length && seconds <= 60 && body.corpse === true && gateClosed && world.solids.failures === 0 };
  rows.push(row); console.log(JSON.stringify(row));
  world.dispose();
  assert(row.pass, `L8 boarding failed: ${JSON.stringify(row)}`);
}
const out = process.argv[2] ?? 'test-results/s79-l8boarding/native-matrix.json';
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
writeFileSync(out, JSON.stringify({ method: 'HIGH-quality native simulation after elephant cleared. All 14 live passengers start clustered inside the yard near the closed entry; the courier waits at the APC; the persistent elephant corpse is placed at one of four yard/gateway positions. Ordinary survivor pathing and vehicle boarding run for at most 60 simulation seconds. No corpse is removed.', cases: rows }, null, 2));
console.log(JSON.stringify({ pass: rows.length === 20 && rows.every(row => row.pass), cases: rows.length, maxSeconds: Math.max(...rows.map(row => row.seconds)), out }));
