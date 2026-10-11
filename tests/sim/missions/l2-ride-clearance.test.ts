import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l2TruckRoute, l2TruckPath } from '../../../src/data/l2';
import { loadL2, runL2 } from '../../../tools/sim-runner/l2Bots';
import { truckBodyOverlap, truckPoseAt, truckWallOverlap, L2TruckDrive } from '../../../src/sim/vehicles/L2TruckDrive';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

/** L2 beat 3: the kinematic fire truck never overlaps a pedestrian, infected, corgi, car, prop or static collider (PO: "Firefighting car went over a ped"). */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const seeds = Array.from({ length: 1 }, (_, i) => i + 1);
const L = 7.4, W = 2.1;

/** Stress: four people planted on the lane, and the first one is put back on the lane again every 5 s (the PO's repeat case). */
const planted = new WeakMap<SimWorld, number[]>();
function plant(w: SimWorld, t: number): void {
  const ids = planted.get(w) ?? [];
  if (!planted.has(w)) {
    planted.set(w, ids);
    const o = w.npcs!.civilians.outbreak!;
    for (const [x, z] of [[ -58, 31.25], [-42, 31.25], [-28.75, 10], [-28.75, -15]] as const) ids.push(o.spawnPedestrian({ x, z }, { waypoints: [{ x, z }, { x, z: z + .5 }] }));
  }
  const first = w.entities.get(ids[0]), distance = w.missions!.state.l2!.rideS + 12;
  if (first && t % 300 === 299 && distance < l2TruckPath.at(-1)!.s) {
    // Plant on the driven lane, including its bends; a tangent extrapolation can land inside a fenced garden.
    const { x, z } = truckPoseAt(distance);
    first.transform.x = x; first.transform.z = z; w.spatial.set(first.id, x, z);
  }
}

describe('L2 truck ride clearance', () => {
  test('@E20 route polyline stays on clear (drivable) cells for the whole truck width', async () => {
    const l = await loadL2(1); world = l.world; const nav = l.world.infected!.nav;
    // The parked truck's own blocker is lifted at departure; ignore it by sampling after the ride starts.
    let bad = 0;
    for (let i = 1; i < l2TruckRoute.length; i++) {
      const [ax, az] = l2TruckRoute[i - 1], [bx, bz] = l2TruckRoute[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / .5);
      for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
        for (const side of [-W / 2, 0, W / 2]) {
          const px = Math.abs(bx - ax) > Math.abs(bz - az) ? x : x + side, pz = Math.abs(bx - ax) > Math.abs(bz - az) ? z + side : z;
          if (nav.walls.some(w => Math.abs(px - w.x) < w.halfX && Math.abs(pz - w.z) < w.halfZ)) bad++;
        }
      }
    }
    expect(bad).toBe(0);
    for (const p of l2TruckPath) {
      expect(nav.walls.some(w => truckWallOverlap(p, L, W, w))).toBe(false);
      if (Math.abs(p.curvature) > .05) expect(Math.hypot(1 / Math.abs(p.curvature) + W / 2, L / 2)).toBeGreaterThanOrEqual(8);
    }
  });

  for (const mode of ['natural', 'planted'] as const) test(`@E20 single seed (${mode}): no body or static collider overlaps the truck footprint during the ride; ride stays in the time band`, async () => {
    const report: unknown[] = [];
    for (const seed of seeds) {
      const l = await loadL2(seed); world = l.world; const { mission } = l; const w = l.world;
      const hits = new Map<string, number>(); let staticHits = 0, heldTicks = 0, rideStart = 0, rideEnd = 0;
      let previousYaw: number | null = null, previousSpeed = 0, yawRateMax = 0, yawJumpMax = 0, accelMax = 0, brakeMax = 0, laneM = 0, roadM = 0, previousS = 0;
      runL2(w, mission, 'complete', { seed, maxSeconds: 240, stopWhen: m => {
        const s = m.state.l2!; if (s.phase !== 'ride') return s.phase === 'arrived' || !!s.arrivedAt;
        const car = w.vehicles!.cars.get(s.truckId)!, t = car.entity.transform;
        rideStart ||= w.tick; rideEnd = w.tick; if (s.rideV < .05) heldTicks++;
        if (mode === 'planted') plant(w, rideEnd - rideStart);
        if (previousYaw !== null) {
          const jump = Math.abs(Math.atan2(Math.sin(t.yaw - previousYaw), Math.cos(t.yaw - previousYaw))) * 180 / Math.PI;
          yawJumpMax = Math.max(yawJumpMax, jump); yawRateMax = Math.max(yawRateMax, jump * 60);
          accelMax = Math.max(accelMax, (s.rideV - previousSpeed) * 60); brakeMax = Math.max(brakeMax, (previousSpeed - s.rideV) * 60);
        }
        previousYaw = t.yaw; previousSpeed = s.rideV;
        const pose = truckPoseAt(s.rideS), travelled = s.rideS - previousS; previousS = s.rideS;
        if (pose.section === 'junction') expect(s.rideV, `seed ${seed}: turn speed`).toBeLessThanOrEqual(4 + 1e-6);
        // Street lane centres come from the district's 5 m two-way roads (not the driven pose).
        {
          const error = pose.section === 'apron' ? Math.abs(Math.hypot(t.x + 62.6, t.z - 36.7) - 6.2) : pose.section === 'elm' ? Math.abs(t.z - 31.25) : pose.section === 'juniper' ? Math.abs(t.x + 28.75) : pose.section === 'row' ? Math.abs(t.z + 32.25) : Math.abs(Math.hypot(t.x + 37.75, t.z - (t.z > 0 ? 22.25 : -23.0)) - 9);
          roadM += travelled; if (error <= .6) laneM += travelled;
          // The centre must be on actual road geometry, including the junction's curved connector.
          expect(pose.section === 'apron' ? t.x >= -68.8 && t.x <= -62.6 && t.z >= 30.5 && t.z <= 36.7 : Math.abs(t.z - 30) <= 2.5 || Math.abs(t.x + 30) <= 2.5 || Math.abs(t.z + 31) <= 2.5, `seed ${seed}: road/apron at ${t.x},${t.z}`).toBe(true);
        }
        for (const e of w.entities.iterate()) {
          if (e.id === s.truckId || e.hidden || e.id === 1 || !(e.civilian || e.infected || e.companion || e.vehicle || e.traffic || e.kind === 'physics-prop')) continue;
          if (truckBodyOverlap(t, L, W, e, w)) hits.set(`${e.kind}:${e.archetype ?? ''}#${e.id}`, (hits.get(`${e.kind}:${e.archetype ?? ''}#${e.id}`) ?? 0) + 1);
        }
        for (const q of w.infected!.nav.walls) if (truckWallOverlap(t, L, W, q)) staticHits++;
        return false;
      } });
      expect(mission.state.l2!.arrivedAt, `seed ${seed}: ride arrived`).toBeGreaterThan(0);
      const seconds = (mission.state.l2!.arrivedAt - mission.state.l2!.departAt) / 60;
      report.push({ seed, seconds, heldS: heldTicks / 60, overlaps: [...hits], staticHits, yawRateMax, yawJumpMax, accelMax, brakeMax, laneShare: laneM / roadM });
      mkdirSync('test-results/epics/E20', { recursive: true }); writeFileSync(`test-results/epics/E20/ride-clearance-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
      expect(yawRateMax, `seed ${seed}: yaw rate`).toBeLessThanOrEqual(25);
      expect(yawJumpMax, `seed ${seed}: heading continuity`).toBeLessThanOrEqual(2);
      expect(accelMax).toBeLessThanOrEqual(2.6 + 1e-6); expect(brakeMax).toBeLessThanOrEqual(4 + 1e-6);
      expect(laneM / roadM, `seed ${seed}: right lane`).toBeGreaterThanOrEqual(.95);
      if (mode === 'natural') expect(seconds).toBeLessThanOrEqual(25);
      expect([...hits], `seed ${seed}`).toEqual([]);
      expect(staticHits, `seed ${seed} static`).toBe(0);
      expect(seconds, `seed ${seed} ride time`).toBeGreaterThan(15);
      expect(seconds, `seed ${seed} ride time`).toBeLessThan(mode === 'planted' ? 60 : 30);
      w.dispose(); world = undefined;
    }
    mkdirSync('test-results/epics/E20', { recursive: true }); writeFileSync(`test-results/epics/E20/ride-clearance-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
  }, 3_600_000);
});


test('@E20 truck sweeps living and downed infected aside without braking for them', async () => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld');
  world = new SimWorld(); await world.init(); world.loadScenario('horde-arena');
  const start = truckPoseAt(18), id = world.vehicles!.spawn('vehicle.fire-engine', start, start.yaw);
  const state = { truckId: id, rideS: 18, rideV: 5.6 }, drive = new L2TruckDrive(world, state);
  drive.prepare();
  const ahead = truckPoseAt(22);
  const infected = world.infected!.spawn('infected.runner', ahead);
  const target = world.entities.get(infected)!;
  drive.step();
  expect(state.rideV).toBeGreaterThanOrEqual(5.6);
  expect(target.health.current).toBe(0);
  expect(target.combat!.reaction!.heavy).toBe(true);
  expect(truckBodyOverlap(truckPoseAt(state.rideS), L, W, target, world)).toBe(false);
  // A fallen body put back in the sweep is pushed again, without holding the ride.
  Object.assign(target.transform, truckPoseAt(state.rideS + 4));
  const speed = state.rideV; drive.step();
  expect(state.rideV).toBeGreaterThanOrEqual(speed);
  expect(truckBodyOverlap(truckPoseAt(state.rideS), L, W, target, world)).toBe(false);
});


test('@E20 slow scripted truck knocks down infected instead of attaching them to its chassis', async () => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld');
  world = new SimWorld(); await world.init(); world.loadScenario('horde-arena');
  const start = truckPoseAt(18), id = world.vehicles!.spawn('vehicle.fire-engine', start, start.yaw);
  const state = { truckId: id, rideS: 18, rideV: .5 }, drive = new L2TruckDrive(world, state);
  drive.prepare();
  const infected = world.infected!.spawn('infected.brute', start);
  world.update(); drive.step();
  const target = world.entities.get(infected)!;
  expect(target.attachedTo).toBeUndefined();
  expect(target.health.current).toBeLessThan(target.health.max);
  expect(target.combat!.reaction!.heavy).toBe(true);
  expect(truckBodyOverlap(truckPoseAt(state.rideS), L, W, target, world)).toBe(false);
});
