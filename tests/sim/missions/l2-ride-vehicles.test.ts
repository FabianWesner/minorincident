import { afterEach, expect, test } from 'vitest';
import { loadL2, runL2 } from '../../../tools/sim-runner/l2Bots';
import { truckBodyOverlap } from '../../../src/sim/vehicles/L2TruckDrive';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

test('@E20 truck brakes smoothly and holds for a stationary sedan in its lane', async () => {
  const l = await loadL2(1); world = l.world; const w = world;
  let sedan = 0, held = false, previousV = 0, overlap = false, brakeMax = 0;
  runL2(w, l.mission, 'complete', { maxSeconds: 90, stopWhen: m => {
    const s = m.state.l2!; if (s.phase !== 'ride') return false;
    if (!sedan) sedan = w.vehicles!.spawn('vehicle.sedan', { x: -55, z: 31.25 }, 0);
    const t = w.entities.get(s.truckId)!.transform;
    overlap ||= truckBodyOverlap(t, 7.4, 2.1, w.entities.get(sedan)!, w);
    brakeMax = Math.max(brakeMax, (previousV - s.rideV) * 60); previousV = s.rideV;
    held = s.rideS > 10 && s.rideV < .01; return held;
  } });
  expect(held).toBe(true); expect(overlap).toBe(false); expect(brakeMax).toBeLessThanOrEqual(4 + 1e-6);
  expect(l.mission.state.l2!.arrivedAt).toBe(0);
  const before = { ...w.entities.get(l.mission.state.l2!.truckId)!.transform };
  // A blocked ride outlasts the station routine's 60 s clock: passengers remain seated until the actual crew exit.
  for (let i = 0; i < 65 * 60; i++) {
    w.update();
    expect(l.mission.state.l2!.crewIds.every(id => w.entities.get(id)!.hidden)).toBe(true);
  }
  const after = w.entities.get(l.mission.state.l2!.truckId)!.transform;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(.01);
  expect(truckBodyOverlap(after, 7.4, 2.1, w.entities.get(sedan)!, w)).toBe(false);
}, 120_000);

test('@E20 crossing traffic yields outside the truck sweep and lets the ride finish', async () => {
  const l = await loadL2(1); world = l.world; const w = world;
  let traffic = 0, yielded = false, overlap = false;
  runL2(w, l.mission, 'complete', { maxSeconds: 100, stopWhen: m => {
    const s = m.state.l2!; if (s.arrivedAt) return true; if (s.phase !== 'ride') return false;
    if (!traffic && s.rideS > 20) traffic = w.npcs!.traffic.spawn([{ x: -40, z: 36.8 }, { x: -40, z: -10 }]);
    if (traffic) {
      const e = w.entities.get(traffic)!;
      yielded ||= (e.traffic!.yieldUntil ?? 0) > w.tick && e.traffic!.stopped;
      overlap ||= truckBodyOverlap(w.entities.get(s.truckId)!.transform, 7.4, 2.1, e, w);
    }
    return false;
  } });
  expect(yielded).toBe(true); expect(overlap).toBe(false); expect(l.mission.state.l2!.arrivedAt).toBeGreaterThan(0);
}, 120_000);
