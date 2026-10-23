import { expect, test, vi } from 'vitest';
import { loadLevel } from './world';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { l2, l2TruckPath } from '../../../src/data/l2';
import { l3 } from '../../../src/data/l3';
import { l6Entries, l6Doors } from '../../../src/data/l6';
import { l7Encounters } from '../../../src/data/l7';
import { cureEncounters, cureEncounterSlots } from '../../../src/levels/L10/encounters';
import { followFrustum } from '../../../tools/sim-runner/l3Bots';
import { l4, l4Route, l4RoutePose, l4ConvoyStations } from '../../../src/data/l4';

const failure = (authored: number, ids: number[]) => ids.length !== authored || ids.some(id => id <= 0);
function observed(world: SimWorld, ids: number[]) { return ids.filter(id => { const e = world.entities.get(id); return e && !e.hidden && !e.pendingAdmission && e.infected && !e.infected.hidden; }); }
function reach(w: SimWorld, ids: number[] | (() => number[]), goal: (id: number, x: number, z: number) => boolean, frames = 1800) {
  const admitted = new Set<number>(), reached = new Set<number>();
  const current = () => typeof ids === 'function' ? ids() : ids;
  for (let tick = 0; tick < frames && reached.size < current().length; tick++) {
    // Isolate navigation from damage: an ally killing an arrival before it reaches the test area is not a routing failure.
    for (const id of current()) { const e = w.entities.get(id); if (e) e.health.current = e.health.max = 1_000_000; }
    followFrustum(w); w.update();
    for (const id of observed(w, current())) {
      admitted.add(id); const e = w.entities.get(id)!;
      if (!e.emerging && goal(id, e.transform.x, e.transform.z)) reached.add(id);
    }
  }
  if (reached.size < current().length) console.log(`[qa:invariants] unreached identities: ${JSON.stringify(current().filter(id => !reached.has(id)).map(id => {
    const e = w.entities.get(id), brain = e?.infected?.l1, target = brain && w.entities.get(brain.targetId);
    return { id, at: e?.transform, mode: brain?.mode, goal: brain && [brain.goalX, brain.goalZ], target: target && { id: target.id, at: target.transform }, pending: e?.pendingAdmission, hidden: e?.hidden, emerging: e?.emerging };
  }))}`);
  return { admitted: admitted.size, reached: reached.size, admittedIds: [...admitted], reachedIds: [...reached] };
}
async function withWorld(id: Parameters<typeof loadLevel>[0], tier: 'high' | 'low', action: (world: SimWorld) => void) {
  const w = await loadLevel(id, 1, tier);
  try { w.combat!.damage.god = true; followFrustum(w); action(w); } finally { vi.restoreAllMocks(); w.dispose(); }
}

// Finite authored waves/alarms, including late mission controllers. Resident wandering populations are not waves.
// Counts are read from authoring data or the explicit controller batch contract, never inferred from the event count.
for (const tier of ['high', 'low'] as const) test(`5 authored wave census ${tier}: L1, L2, L3, L6, L7, L8 and L10`, async () => {
  const errors: string[] = [], receipt: Record<string, { authored: number; spawned: number; admitted: number; reached?: number }> = {};
  const record = (key: string, authored: number, ids: number[], w: SimWorld, movement?: { admitted: number; reached: number }) => {
    receipt[key] = { authored, spawned: ids.filter(id => id > 0).length, admitted: movement?.admitted ?? observed(w, ids).length, ...(movement ? { reached: movement.reached } : {}) };
    if (failure(authored, ids)) errors.push(`${key}: authored ${authored}, actual IDs ${ids.filter(id => id > 0).length}`);
    if (movement && movement.reached !== authored) errors.push(`${key}: authored ${authored}, admitted ${movement.admitted}, reached ${movement.reached}`);
  };
  await withWorld('L1', tier, w => {
    w.update();
    const c = w.missions! as unknown as { l1: { advance(): boolean } }; c.l1.advance();
    for (let i = 0; i < 600; i++) w.update();
    const ids = w.missions!.state.l1!.exitIds;
    record('L1/lab-exits', 5, ids, w, reach(w, ids, () => true));
  });
  await withWorld('L2', tier, w => {
    const c = w.missions!.l2! as unknown as { arrive(): void; crewExit(): void; openDoors(): void; emergeAmbush(tick: number): void };
    w.update();
    const s = w.missions!.state.l2!;
    // Open the market after the real arrival/disembark lifecycle, rather than with the whole crew still at the fire station.
    const truck = w.entities.get(s.truckId)!, stop = w.missions!.def.anchors['l2-truck-stop'];
    Object.assign(truck.transform, { x: stop.x, z: stop.z, yaw: l2TruckPath.at(-1)!.yaw });
    c.arrive(); c.crewExit();
    const player = w.entities.get(1)!, forecourt = w.missions!.def.anchors['l2-forecourt'];
    Object.assign(player.transform, forecourt); w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform); w.spatial.set(1, player.transform.x, player.transform.z);
    c.openDoors();
    // This is a routing census, already isolated from damage. An immortal fleeing human outside the market
    // can legitimately intercept an ambusher forever; keep perception targets in the measured goal area.
    // Movement, obstacles, the cap, stagger and the exact authored quota remain the production paths.
    const humans = w.infected!.l1!.humans, all = humans.all.bind(humans), get = humans.get.bind(humans), within = humans.within.bind(humans);
    const inMarket = (id: number) => { const p = w.entities.get(id)?.transform; return !!p && p.x >= -64 && p.x <= -36 && p.z >= -52 && p.z <= -24; };
    vi.spyOn(humans, 'all').mockImplementation(() => all().filter(h => inMarket(h.id)));
    vi.spyOn(humans, 'get').mockImplementation(id => inMarket(id) ? get(id) : undefined);
    vi.spyOn(humans, 'within').mockImplementation((p, r) => within(p, r).filter(h => inMarket(h.id)));
    // Observe/protect from the first staggered arrival: an early member may cross the forecourt and chase a fleeing
    // victim away before the last member spawns. Starting observation after the batch missed that real arrival.
    const movement = reach(w, () => s.ambush.map(a => a.id), (_id, x, z) => x >= -64 && x <= -36 && z >= -52 && z <= -24, 3000);
    const ids = s.ambush.map(a => a.id);
    record('L2/market-ambush', l2.rescue.ambushDoors.reduce((n, [, count]) => n + Math.ceil(count * (tier === 'low' ? l2.escape.lowScale : 1)), 0), ids, w, movement);
  });
  await withWorld('L3', tier, w => {
    const c = w.missions!.l3! as unknown as { startAttack(): void; emergeWaves(): void; checkFallback(): void };
    c.startAttack(); const s = w.missions!.state.l3!, all = s.waves.slice();
    s.pending.length = 0; s.populated.fill(true);
    vi.spyOn(c, 'checkFallback').mockImplementation(() => {});
    // Drain each authored stream in isolation from the next phase's cap. Admission and the production spawner stay live.
    for (let wave = 0; wave < l3.attack.waves.length; wave++) {
      const entries = all.filter(q => q.wave === wave), earliest = Math.min(...entries.map(q => q.at));
      for (const e of [...w.infected!.active]) w.infected!.release(e);
      for (const q of entries) q.at = w.tick + q.at - earliest;
      s.waves = entries;
      const yard = l3.map.yard, admitted = new Set<number>(), reached = new Set<number>();
      for (let i = 0; i < 3600 && (entries.some(q => !q.id) || reached.size < entries.length); i++) {
        followFrustum(w); c.emergeWaves();
        for (const e of w.entities.iterate()) if (e.civilian && !e.infected) { e.health.current = e.health.max = 1_000_000; delete e.infection; }
        for (const q of entries) { const e = w.entities.get(q.id); if (e) e.health.current = e.health.max = 1_000_000; }
        w.update();
        for (const id of observed(w, entries.map(q => q.id))) {
          const e = w.entities.get(id)!, p = e.transform; admitted.add(id);
          if (p.x > yard.x0 - 3 && p.x < yard.x1 + 3 && p.z > yard.z0 - 3 && p.z < yard.z1 + 3) { reached.add(id); w.infected!.release(e); }
        }
      }
      record(`L3/station-wave-${wave}`, Math.ceil(l3.attack.waves[wave].count * (tier === 'low' ? l3.attack.lowScale : 1)), entries.map(q => q.id), w, { admitted: admitted.size, reached: reached.size });
    }
  });
  await withWorld('L6', tier, w => {
    const c = w.missions!.l6! as unknown as { spawn(n: number, doors: number[], wave: number): number };
    const state = w.missions!.state.l6!;
    state.breach1At = state.breach2At = Infinity;
    // Two at the first breach; eight staggered at the second; every authored maintenance entry has its own quota.
    for (const [name, count, doors, wave] of [['breach-1', 2, [0], 1], ['breach-2', 8, [0, 1], 2], ['retreat-reinforcement', 1, [0, 1], 3], ...l6Entries.map((entry, i) => [`entry-${i}`, entry.count, [entry.door], 4])] as [string, number, number[], number][]) {
      for (const e of [...w.infected!.active]) w.infected!.release(e);
      if (wave === 4) {
        const door = l6Doors[doors[0]], p = w.entities.get(1)!;
        Object.assign(p.transform, { x: door.x - 24, z: 15 });
        w.spatial.set(1, p.transform.x, p.transform.z);
        w.physics.playerBody!.setTranslation(p.transform, true);
        w.physics.playerBody!.setNextKinematicTranslation(p.transform);
        followFrustum(w);
      }
      const before = w.missions!.state.l6!.spawnLog.length;
      c.spawn(count, doors, wave);
      const ids = w.missions!.state.l6!.spawnLog.slice(before).map(q => q.id);
      record(`L6/${name}`, count, ids, w, reach(w, ids, (_id, x, z) => wave <= 3 ? x >= -16 && x <= 260 && z >= -22 && z <= 20 : Math.abs(z - 15) <= 4));
    }
  });
  await withWorld('L7', tier, w => {
    const c = w.l7Encounters!, ai = w.infected!; c.start();
    // The real director queues more than one cap. Let it admit and retire each batch; the arrival ledger survives retirement.
    for (let batch = 0; batch < 20 && ai.director.queue.length; batch++) {
      if (batch === 1) {
        const player = w.entities.get(1)!, dx = 286 - player.transform.x;
        for (const id of [1, ...c.state.roster.map(r => r.id)]) {
          const e = w.entities.get(id); if (!e) continue; e.transform.x += dx; w.spatial.set(id, e.transform.x, e.transform.z);
        }
        w.physics.playerBody!.setTranslation(player.transform, true);
      }
      followFrustum(w);
      ai.director.update(); c.update();
      for (const e of [...ai.active]) ai.release(e);
      w.tick++;
    }
    for (let i = 0; i <= l7Encounters.streets.length; i++) {
      const group = i === 0 ? l7Encounters.finalGroup : l7Encounters.firstStreetGroup + i - 1;
      const expected = i === 0 ? (tier === 'low' ? 60 : 120) + 2 : (tier === 'low' ? 35 : 70) + (i <= 3 ? 1 : 0);
      const arrivals = c.state.arrivals.filter(a => a.group === group), ids = arrivals.map(a => a.id);
      const home = i === 0 ? l7Encounters.horde : l7Encounters.streets[i - 1];
      // These groups are authored idle at their destination: verify the admitted poses are in that area.
      const atGoal = arrivals.filter(a => Math.hypot(a.x - home.x, a.z - home.z) <= 20).length;
      // Ledger entries are the actual admitted director arrivals; not the requested count.
      receipt[`L7/group-${group}`] = { authored: expected, spawned: ids.length, admitted: ids.length, reached: atGoal };
      if (ids.length !== expected) errors.push(`L7/group-${group}: authored ${expected}, admitted ${ids.length}`);
      if (atGoal !== expected) errors.push(`L7/group-${group}: authored ${expected}, admitted inside goal area ${atGoal}`);
    }
  });
  await withWorld('L8', tier, w => {
    const c = w.missions!.l8!; w.tick = c.state.startedAt + 3600; c.update();
    const initial = c.state.arrivals.slice();
    const next = c.state.nextWave; c.state.nextWave = Infinity;
    const initialGoals = new Map(initial.map(a => [a.id, c.state.outlets[a.outlet]]));
    const firstMovement = reach(w, initial.map(a => a.id), (id, x, z) => { const door = initialGoals.get(id)!; return Math.hypot(x - door.ox, z - door.oz) < 12; });
    for (let outlet = 0; outlet < c.state.outlets.length; outlet++) {
      const ids = initial.filter(a => a.outlet === outlet).map(a => a.id);
      record(`L8/tunnel-breach-${outlet}`, tier === 'low' ? 3 : 6, ids, w, { admitted: ids.filter(id => firstMovement.admittedIds.includes(id)).length, reached: ids.filter(id => firstMovement.reachedIds.includes(id)).length });
    }
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    c.state.nextWave = Math.max(next, w.tick); c.update(); c.state.nextWave = Infinity;
    const reinforcements = c.state.arrivals.slice(initial.length), reinforcementGoals = new Map(reinforcements.map(a => [a.id, c.state.outlets[a.outlet]]));
    const reinforcementMovement = reach(w, reinforcements.map(a => a.id), (id, x, z) => { const door = reinforcementGoals.get(id)!; return Math.hypot(x - door.ox, z - door.oz) < 12; });
    for (let outlet = 0; outlet < c.state.outlets.length; outlet++) {
      const ids = reinforcements.filter(a => a.outlet === outlet).map(a => a.id);
      record(`L8/tunnel-reinforcement-${outlet}`, 4, ids, w, { admitted: ids.filter(id => reinforcementMovement.admittedIds.includes(id)).length, reached: ids.filter(id => reinforcementMovement.reachedIds.includes(id)).length });
    }
  });
  await withWorld('L10', tier, w => {
    const m = w.missions!; m.loadCheckpoint('cure-disperse-ready');
    const p = w.entities.get(1)!; Object.assign(p.transform, { x: 4002, z: -27 });
    w.physics.playerBody!.setTranslation(p.transform, true); w.chunks!.update(); m.setState('charge-active', true);
    w.tick += 10 - w.tick % 10; w.l10Encounters!.update();
    const def = cureEncounters.find(g => g.id === 'dispersal-assault')!;
    const ids = Object.entries(w.l10Encounters!.state.spawned).filter(([key]) => key.startsWith('dispersal-assault:')).map(([, id]) => id);
    record('L10/dispersal-assault', cureEncounterSlots(def, tier).length, ids, w, reach(w, ids, (_id, x, z) => Math.hypot(x - def.at[0], z - def.at[1]) < 18, 3600));
  });
  console.log(`[qa:invariants] wave census ${tier}: ${JSON.stringify(receipt)}`);
  expect(errors, `waves invariant ${tier}`).toEqual([]);
}, 240_000);

// A reachability receipt must follow actual moving infected, not just a spawn event or a valid nav path.
for (const tier of ['high', 'low'] as const) test(`5 L4 alarm ${tier}: every authored identity is admitted and reaches the hold area`, async () => {
  const w = await loadLevel('L4', 1, tier);
  try {
    const m = w.missions!, s = m.state.l4!;
    const c = m.l4! as unknown as { arrive(): void; turn(): void };
    const route = l4Route(), stations = l4ConvoyStations(route.length);
    for (const [i, id] of s.convoyIds.entries()) Object.assign(w.entities.get(id)!.transform, l4RoutePose(route, stations.end[i]));
    c.arrive();
    const p = w.entities.get(1)!; Object.assign(p.transform, { x: -27, z: 4 });
    w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform);
    w.combat!.damage.god = true; followFrustum(w);
    let ids: number[] = [];
    w.events.on('l4.firstTurn', e => { if (e.type === 'l4.firstTurn') ids = [...e.ids]; });
    c.turn();
    const reached = new Set<number>(), admitted = new Set<number>();
    for (let i = 0; i < 60 * 60; i++) {
      for (const id of ids) { const e = w.entities.get(id); if (e) e.health.current = e.health.max = 1_000_000; }
      followFrustum(w); w.update();
      for (const id of ids) {
        const e = w.entities.get(id);
        if (!e || e.hidden || e.pendingAdmission || e.infected?.hidden) continue;
        admitted.add(id);
        if (e.transform.x > -37 && e.transform.x < -8 && e.transform.z > -19 && e.transform.z < 24) reached.add(id);
      }
    }
    const expected = l4.calm.alarmInfected[tier];
    expect(ids.length, `L4/${tier}: authored alarm count`).toBe(expected);
    expect(admitted.size, `L4/${tier}: visible admitted alarm identities`).toBe(expected);
    expect(reached.size, `L4/${tier}: alarm identities reaching the military hold area; missing ${JSON.stringify(ids.filter(id => !reached.has(id)).map(id => { const e=w.entities.get(id); return {id,at:e?.transform,scripted:e?.infected?.scripted,vault:e?.infected?.vault,mode:e?.infected?.l1?.mode,goal:e?.infected?.l1&&[e.infected.l1.goalX,e.infected.l1.goalZ]}; }))}; phase ${s.phase}`).toBe(expected);
  } finally { w.dispose(); }
}, 240_000);
