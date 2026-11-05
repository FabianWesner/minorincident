import { expect, test } from 'vitest';
import { loadLevel } from './world';
import { obbHitsAabb } from './oracles';
import physicsAssets from '../../../src/data/physicsAssets';
import { vehicleDef } from '../../../src/data/vehicles';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

function structuralSolids(w: SimWorld) {
  return w.districts!.districts.flatMap(d => d.decay.colliders.filter(c => !c.walkable && /bld\.|wall|fence|barrier/.test(c.id) && !/hedge/.test(c.id)).map(c => ({
    id: `${d.id}/${c.id}`,
    aabb: { min: [c.aabb.min[0] + d.origin[0], c.aabb.min[1], c.aabb.min[2] + d.origin[1]], max: [c.aabb.max[0] + d.origin[0], c.aabb.max[1], c.aabb.max[2] + d.origin[1]] },
  })));
}

test('4 vehicles: all level start poses, L8 evacuation vehicles and L9 scripted crash clear structural solids', async () => {
  const conflicts = new Set<string>(), poses: Record<string, number> = {};
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'] as const) {
    const w = await loadLevel(level, 1);
    try {
      const solids = structuralSolids(w);
      const check = (e: EntitySnapshot, label: string) => {
        const asset = e.archetype.startsWith('vehicle.') ? vehicleDef(e.archetype).asset : e.archetype.startsWith('veh.') ? e.archetype : e.appearance?.asset;
        const authored = asset ? physicsAssets[asset as keyof typeof physicsAssets] : undefined;
        const def = e.archetype.startsWith('vehicle.') ? vehicleDef(e.archetype) : null;
        const boxes = authored?.boxes ?? (def ? [{ min: [-def.length / 2, -.3, -def.width / 2], max: [def.length / 2, .3, def.width / 2] }] : []);
        expect(boxes.length, `${level}/${label}: vehicle hull must be available`).toBeGreaterThan(0);
        poses[level] = (poses[level] ?? 0) + 1;
        for (const b of boxes) {
          const p = e.transform, c = Math.cos(p.yaw), s = Math.sin(p.yaw), x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2;
          for (const solid of solids) if (obbHitsAabb(p.x + c * x + s * z, p.z - s * x + c * z, p.yaw, (b.max[0] - b.min[0]) / 2, (b.max[2] - b.min[2]) / 2, p.y + b.min[1], p.y + b.max[1], solid.aabb)) conflicts.add(`${level}/${label} overlaps ${solid.id}`);
        }
      };
      for (const e of w.entities.iterate()) if (e.vehicle || e.archetype.startsWith('veh.') || e.appearance?.asset?.startsWith('veh.')) check(e, `start-${e.id}`);
      if (level === 'L8') {
        const s = w.missions!.l8!.state;
        check(w.entities.get(s.busId)!, 'parked-bus'); check(w.entities.get(s.carId)!, 'parked-apc');
      }
      if (level === 'L9') {
        const m = w.missions!, c = m.l9!, car = w.entities.get(c.state.carId)!, start = m.def.anchors['crash-approach'];
        Object.assign(car.transform, start); w.vehicles!.scriptPose(car.id, car.transform);
        // Run the actual authored pose controller through approach, fall and parked impact.
        // Ground impact belongs to the crash; clipping an unrelated wall/fence does not.
        for (let i = 0; i <= 320; i++) { w.tick++; c.update(); check(car, `${c.state.phase}-${i}`); }
        expect(c.state.phase).toBe('impact');
      }
    } finally { w.dispose(); }
  }
  console.log(`[qa:invariants] vehicle scene poses ${JSON.stringify(poses)}`);
  expect([...conflicts], 'vehicles invariant: scripted/start/parked structural overlaps').toEqual([]);
}, 180_000);
