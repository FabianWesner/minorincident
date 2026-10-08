import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l2TruckRoute } from '../../../src/data/l2';
import { loadL2, runL2 } from '../../../tools/sim-runner/l2Bots';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

/** L2 beat 3: the kinematic fire truck never overlaps a pedestrian, infected, corgi, car, prop or static collider (PO: "Firefighting car went over a ped"). */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
const L = 7.4, W = 2.1;

/** Stress: four people planted on the lane, and the first one is put back on the lane again every 5 s (the PO's repeat case). */
const planted = new WeakMap<SimWorld, number[]>();
function plant(w: SimWorld, truckId: number, t: number): void {
  const ids = planted.get(w) ?? [];
  if (!planted.has(w)) {
    planted.set(w, ids);
    const o = w.npcs!.civilians.outbreak!;
    for (const [x, z] of [[-70.6, 24], [-52, 30.6], [-30.6, 10], [-30.6, -20]] as const) ids.push(o.spawnPedestrian({ x, z }, { waypoints: [{ x, z }, { x, z: z + .5 }] }));
  }
  const first = w.entities.get(ids[0]), truck = w.entities.get(truckId)!.transform;
  if (first && t % 300 === 299) {
    const x = truck.x + Math.cos(truck.yaw) * 12, z = truck.z - Math.sin(truck.yaw) * 12;
    first.transform.x = x; first.transform.z = z; w.spatial.set(first.id, x, z);
  }
}

describe('L2 truck ride clearance', () => {
  test('route polyline stays on clear (drivable) cells for the whole truck width', async () => {
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
  });

  for (const mode of ['natural', 'planted'] as const) test(`20 seeds (${mode}): no body or static collider overlaps the truck footprint during the ride; ride stays in the time band`, async () => {
    const report: unknown[] = [];
    for (const seed of seeds) {
      const l = await loadL2(seed); world = l.world; const { mission } = l; const w = l.world;
      const hits = new Map<string, number>(); let staticHits = 0, heldTicks = 0, rideStart = 0, rideEnd = 0;
      runL2(w, mission, 'complete', { seed, maxSeconds: 240, stopWhen: m => {
        const s = m.state.l2!; if (s.phase !== 'ride') return s.phase === 'arrived' || !!s.arrivedAt;
        const car = w.vehicles!.cars.get(s.truckId)!, t = car.entity.transform, c = Math.cos(t.yaw), sn = Math.sin(t.yaw);
        rideStart ||= w.tick; rideEnd = w.tick; if (s.rideV < .05) heldTicks++;
        if (mode === 'planted') plant(w, s.truckId, rideEnd - rideStart);
        for (const e of w.entities.iterate()) {
          if (e.id === s.truckId || e.hidden || e.id === 1 || !(e.civilian || e.infected || e.companion || e.vehicle || e.kind === 'physics-prop')) continue;
          const dx = e.transform.x - t.x, dz = e.transform.z - t.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c, r = e.combat?.radius ?? .3;
          const ox = Math.max(0, Math.abs(lx) - L / 2), oz = Math.max(0, Math.abs(lz) - W / 2);
          if (ox * ox + oz * oz < r * r) hits.set(`${e.kind}:${e.archetype ?? ''}#${e.id}`, (hits.get(`${e.kind}:${e.archetype ?? ''}#${e.id}`) ?? 0) + 1);
        }
        const nav = w.infected!.nav;
        for (let a = -L / 2; a <= L / 2; a += .5) for (const b of [-W / 2, 0, W / 2]) {
          const px = t.x + a * c + b * sn, pz = t.z - a * sn + b * c;
          if (nav.walls.some(q => Math.abs(px - q.x) < q.halfX && Math.abs(pz - q.z) < q.halfZ)) staticHits++;
        }
        return false;
      } });
      const seconds = (rideEnd - rideStart) / 60;
      report.push({ seed, seconds, heldS: heldTicks / 60, overlaps: [...hits], staticHits });
      expect([...hits], `seed ${seed}`).toEqual([]);
      expect(staticHits, `seed ${seed} static`).toBe(0);
      expect(seconds, `seed ${seed} ride time`).toBeGreaterThan(15);
      expect(seconds, `seed ${seed} ride time`).toBeLessThan(mode === 'planted' ? 60 : 30);
      w.dispose(); world = undefined;
    }
    mkdirSync('test-results/epics/E20', { recursive: true }); writeFileSync(`test-results/epics/E20/ride-clearance-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
  }, 3_600_000);
});
