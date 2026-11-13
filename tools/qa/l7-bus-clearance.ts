/** Native full-route L7 bus/body clearance audit: 3 seeds, skilled and passive-skilled. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { actorRadius } from '../../src/sim/world/SolidRegistry';
import { staticCollision } from '../../src/assets/staticCollision';
import { l7CorridorAnchors } from '../../src/levels/L7/corridor';
import type { SimWorld } from '../../src/sim/world/SimWorld';

type Result = { seed: number; profile: string; outcome: string; ticks: number; minClearance: number; minWitness?: unknown; flags: number; phaseTicks: Record<string, number>; offenders: unknown[] };
const output = 'test-results/s82-l7bussoldiers'; mkdirSync(output, { recursive: true });
const results: Result[] = [];
const seeds = (process.env.L7_CLEARANCE_SEEDS ?? '1,2,3').split(',').map(Number);
const profiles = (process.env.L7_CLEARANCE_PROFILES ?? 'complete,complete-passive').split(',');
const qualities = (process.env.L7_CLEARANCE_QUALITIES ?? 'high,low').split(',') as ('high' | 'low')[];
function observe(world: SimWorld, profile: string, seed: number) {
  let minClearance = Infinity, minWitness: unknown, flags = 0, ticks = 0;
  const offenders: unknown[] = [];
  const phaseTicks: Record<string, number> = {};
  const update = world.update.bind(world);
  world.update = (...args) => {
    const value = update(...args), departure = world.l7Departure!, bus = world.entities.get(departure.state.busId);
    if (bus && departure.state.phase === 'departing') {
      ticks++; phaseTicks[departure.state.phase] = (phaseTicks[departure.state.phase] ?? 0) + 1;
      const box = staticCollision['veh.evac-bus'].boxes[0];
      for (const e of world.entities.iterate()) {
        if (e.hidden || e.passengerOf === bus.id || !(e.companion || e.civilian?.ally || e.civilian?.survivor || e.infected || e.infection || e.corpse)) continue;
        const dx = Math.max(0, Math.abs(e.transform.x - bus.transform.x) - Math.max(Math.abs(box.min[0]), Math.abs(box.max[0])));
        const dz = Math.max(0, Math.abs(e.transform.z - bus.transform.z) - Math.max(Math.abs(box.min[2]), Math.abs(box.max[2])));
        const clearance = Math.hypot(dx, dz) - actorRadius(e);
        if (clearance < minClearance) { minClearance = clearance; minWitness = { tick: world.tick, phase: departure.state.phase, id: e.id, actor: [e.transform.x, e.transform.z], bus: [bus.transform.x, bus.transform.z], clearance, radius: actorRadius(e), infected: !!e.infected || !!e.infection, corpse: !!e.corpse || e.health.current <= 0, soldier: e.civilian?.ally?.role === 'soldier', survivor: !!e.civilian?.survivor }; }
        if (clearance < -1e-6) {
          flags++;
          if (offenders.length < 30) offenders.push({ tick: world.tick, phase: departure.state.phase, id: e.id, model: e.civilian?.model, soldier: e.civilian?.ally?.role === 'soldier', survivor: e.civilian?.survivor?.key, infected: !!e.infected || !!e.infection, corpse: !!e.corpse || e.health.current <= 0, actor: [e.transform.x, e.transform.z], bus: [bus.transform.x, bus.transform.z], hull: [[box.min[0], box.min[2]], [box.max[0], box.max[2]]], clearance });
        }
      }
    }
    return value;
  };
  return () => ({ seed, profile, outcome: '', ticks, minClearance, minWitness, flags, phaseTicks, offenders });
}
for (const quality of qualities) for (const profile of profiles) for (const seed of seeds) {
  let snapshot: ReturnType<ReturnType<typeof observe>> | undefined;
  const passive = profile.endsWith('passive');
  const run = await runLevel('L7', 'complete', seed, 1200, 'auto', undefined, undefined, 0, {
    quality, passive: false,
    beforeBegin: world => {
      const read = observe(world, profile, seed);
      if (passive) {
        // Keep the native skilled route, but make the courier invulnerable;
        // suppress attacks once the bus arrival ring is reached.
        const busAt = l7CorridorAnchors['l7-bus-boarding'].position;
        const atBus = () => Math.hypot(world.entities.get(1)!.transform.x - busAt[0], world.entities.get(1)!.transform.z - busAt[2]) <= 6;
        const apply = world.applyInput.bind(world);
        world.player!.damage = () => 0;
        world.applyInput = (frame, scheme) => {
          apply(atBus() ? { ...frame, mouseAttack: false, activeAttack: false, attackInPlace: false, attackTarget: undefined,
            left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false } } : frame, scheme);
        };
      }
      world.events.on('level.completed', () => { snapshot = read(); });
    },
  });
  const result = { ...(snapshot ?? { seed, profile, outcome: run.outcome, ticks: 0, minClearance: Infinity, flags: -1, phaseTicks: {}, offenders: [] }), quality, outcome: run.outcome };
  results.push(result);
  console.log(JSON.stringify(result));
  assert.equal(run.outcome, 'complete', `${profile} seed ${seed} must complete L7: ${JSON.stringify(run.blocker)}`);
  assert.equal(result.flags, 0, `${quality} ${profile} seed ${seed} hull clearance flags`);
  assert(result.ticks > 0, `${profile} seed ${seed} must observe every active bus tick`);
  assert(result.minClearance >= -1e-6, `${profile} seed ${seed} hull intersection`);
}
writeFileSync(`${output}/clearance.json`, JSON.stringify({ requirement: 'visible living soldiers/survivors/infected and persistent corpses do not intersect the baked evacuation-bus hull at any departure tick; seated passengers excluded', results }, null, 2) + '\n');
