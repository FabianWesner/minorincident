/** Native actor sweeps through every tall per-placement building collider in the campaign layouts. */
import assert from 'node:assert/strict';
import { partColliders } from '../../src/data/destructionModel';
import { actorRadius } from '../../src/sim/world/SolidRegistry';
import { runnerLevels } from '../sim-runner/levels';
import { loadLevel } from '../sim-runner/levels';
import { buildingMeshWallSamples } from './building-mesh-wall-samples';
import knownMisses from './building-wall-sweep-baseline.json' with { type: 'json' };

export interface BuildingWallSweepReceipt {
  levels: { level: string; buildings: number; samples: number; misses: string[] }[];
  totals: { buildings: number; samples: number; misses: string[] };
}
const wallLike = (halfX: number, halfZ: number) => Math.min(halfX, halfZ) <= .75 && Math.max(halfX, halfZ) >= 1.2;
const sweepAxes = (halfX: number, halfZ: number) => wallLike(halfX, halfZ)
  ? [halfX <= halfZ ? 'x' as const : 'z' as const] : ['x' as const, 'z' as const];

/** Uses the live SolidRegistry capsule sweep, after each level has assembled its production colliders. */
export async function runBuildingWallSweepAudit(): Promise<BuildingWallSweepReceipt> {
  const levels: BuildingWallSweepReceipt['levels'] = [];
  const meshSamples = await buildingMeshWallSamples();
  const seen = new Set<string>();
  for (const level of runnerLevels) {
    const world = await loadLevel(level, 1);
    try {
      const district = world.districts!.districts;
      let buildings = 0, samples = 0;
      const misses: string[] = [];
      for (const d of district) for (const p of d.decay.placements) {
        if (!p.assetId.startsWith('bld.') || seen.has(`${level}/${d.id}/${p.id}`)) continue;
        seen.add(`${level}/${d.id}/${p.id}`); buildings++;
        assert.ok(meshSamples.get(p.assetId)?.length, `${level}/${d.id}/${p.id}: no mesh wall samples for ${p.assetId}`);
        const walls = d.decay.colliders.filter(c => (c.id === p.id || c.id.startsWith(`${p.id}/`))
          && c.aabb.max[1] - c.aabb.min[1] >= 1.1 && c.aabb.max[1] > .7 && c.aabb.min[1] < 1.1);
        const destruction = world.destruction?.objects.find(o => o.id === `${d.id}/${p.id}`);
        if (destruction) for (const [i, part] of partColliders(p.assetId, destruction.parts).entries()) {
          const box = part.box, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
          const cx = (box.min[0] + box.max[0]) / 2 * p.scale[0], cz = (box.min[2] + box.max[2]) / 2 * p.scale[2];
          const hx = (box.max[0] - box.min[0]) * Math.abs(p.scale[0]) / 2, hz = (box.max[2] - box.min[2]) * Math.abs(p.scale[2]) / 2;
          // Keep these synthetic colliders district-local, like decay.colliders;
          // the common sweep path adds the district origin below.
          const x = p.position[0] + cx * c + cz * s, z = p.position[2] - cx * s + cz * c;
          const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
          const minY = p.position[1] + box.min[1] * p.scale[1], maxY = p.position[1] + box.max[1] * p.scale[1];
          if (maxY - minY >= 1.1 && maxY > .7 && minY < 1.1) walls.push({ id: `${p.id}/destruction-${i}`, minTier: p.minTier, maxTier: p.maxTier, aabb: {
            min: [x - ex, minY, z - ez], max: [x + ex, maxY, z + ez], navFootprint: { x, z, halfX: hx, halfZ: hz, yaw: p.yaw },
          } });
        }
        if (!walls.length) { misses.push(`${level}/${d.id}/${p.id}:no-body-height-collider`); continue; }
        const courier = world.entities.get(1)!;
        const radius = Math.min(actorRadius(courier), .34);
        for (const sample of meshSamples.get(p.assetId) ?? []) {
          const c = Math.cos(p.yaw), s = Math.sin(p.yaw), x = p.position[0] + d.origin[0] + sample.x * p.scale[0] * c + sample.z * p.scale[2] * s;
          const z = p.position[2] + d.origin[1] - sample.x * p.scale[0] * s + sample.z * p.scale[2] * c;
          // A normal uses inverse scale before yaw; applying yaw alone points
          // across the wrong face when a placement is stretched on one axis.
          const localX = sample.nx / p.scale[0], localZ = sample.nz / p.scale[2], length = Math.hypot(localX, localZ);
          assert.ok(Number.isFinite(length) && length > 0, `Invalid building scale: ${d.id}/${p.id}`);
          const nx = (localX * c + localZ * s) / length, nz = (-localX * s + localZ * c) / length;
          courier.transform.x = x + nx; courier.transform.z = z + nz; courier.transform.y = .9;
          world.chunks?.update([courier.transform.x, courier.transform.z]);
          const moved = world.solids.sweep(courier, { x: -nx, z: -nz }, 2, actorRadius(courier), false, false);
          samples++;
          if (moved >= 1.9) misses.push(`${level}/${d.id}/${p.id}:mesh-wall:${sample.x.toFixed(2)},${sample.z.toFixed(2)}`);
        }
        if (level === 'L10' && p.id === 'l10-find-farm-shed') {
          // The reported scaled barn: probe a side wall, a gable pier, and the
          // centre of its visible doorway after streaming has activated it.
          const x = p.position[0] + d.origin[0], z = p.position[2] + d.origin[1];
          for (const [name, dx, dz, nx, nz, blocked] of [
            ['side', -4, 0, 1, 0, true], ['pier', 1.6, -4, 0, 1, true], ['door', 0, -4, 0, 1, false],
          ] as const) {
            courier.transform.x = x + dx; courier.transform.z = z + dz; courier.transform.y = .9;
            world.chunks?.update([courier.transform.x, courier.transform.z]);
            const moved = world.solids.sweep(courier, { x: nx, z: nz }, 3, actorRadius(courier), false, false);
            assert.equal(moved < 2.9, blocked, `Scaled farm shed ${name}: sweep moved ${moved.toFixed(3)} m`);
          }
        }
        for (const c of walls) {
          const a = c.aabb, f = a.navFootprint;
          const cx = f?.x ?? (a.min[0] + a.max[0]) / 2, cz = f?.z ?? (a.min[2] + a.max[2]) / 2;
          const hx = f?.halfX ?? (a.max[0] - a.min[0]) / 2, hz = f?.halfZ ?? (a.max[2] - a.min[2]) / 2;
          const yaw = f?.yaw ?? 0, origin = d.origin;
          for (const axis of sweepAxes(hx, hz)) {
            const normal = axis === 'x' ? { x: Math.cos(yaw), z: -Math.sin(yaw) } : { x: Math.sin(yaw), z: Math.cos(yaw) };
            const half = axis === 'x' ? hx : hz, start = half + radius + .45, distance = start * 2;
            courier.transform.x = cx + origin[0] - normal.x * start;
            courier.transform.z = cz + origin[1] - normal.z * start;
            courier.transform.y = Math.max(.9, (a.min[1] + a.max[1]) / 2);
            world.chunks?.update([courier.transform.x, courier.transform.z]);
            const moved = world.solids.sweep(courier, normal, distance, radius, false, false);
            samples++;
            if (moved >= distance - .1) misses.push(`${level}/${d.id}/${p.id}/${c.id}/${axis}:sweep=${moved.toFixed(3)}/${distance.toFixed(3)}`);
          }
        }
      }
      if (level === 'L10') {
        // A streamed destructible wall must stop the courier while intact and
        // cease blocking immediately when its part is destroyed.
        const courier = world.entities.get(1)!, object = world.destruction!.objects.find(o => o.id === 'D-CURE/l10-find-farm-shed')!;
        const part = object.parts.findIndex(p => p.id === 'farm-side--1');
        assert.ok(part >= 0, 'Farm shed side wall part is missing');
        courier.transform.x = 1166; courier.transform.y = .9; courier.transform.z = -26;
        world.chunks!.update([1166, -26]);
        const actors = [courier.id, world.npcs!.companion.spawn(), world.npcs!.escorts.spawn({ x: 1164, z: -26 }), world.infected!.spawn('infected.runner', { x: 1163, z: -26 }, { state: 'idle' })];
        for (const id of actors) {
          const actor = world.entities.get(id);
          assert.ok(actor, `Missing actor for farm wall sweep: ${id}`);
          actor.transform.x = 1166; actor.transform.z = -26; actor.transform.y = actor.companion ? .3 : .9; actor.transform.yaw = 0;
          const moved = world.solids.sweep(actor, { x: 1, z: 0 }, 3, actorRadius(actor), false, false);
          assert.ok(moved < 2.9, `${actor.kind} passed through streamed farm wall`);
        }
        const sweep = () => world.solids.sweep(courier, { x: 1, z: 0 }, 3, actorRadius(courier), false, false);
        assert.ok(sweep() < 2.9, 'Intact streamed farm wall must block');
        world.destruction!.damage({ object, part, local: [-3.5, 1, 0], normal: [-1, 0, 0], distance: 0 }, 'weapon.fire-axe', 100000);
        assert.ok(sweep() > 2.9, 'Destroyed farm wall must stop blocking');
      }
      levels.push({ level, buildings, samples, misses });
    } finally { world.dispose(); }
  }
  const receipt = { levels, totals: { buildings: levels.reduce((n, r) => n + r.buildings, 0), samples: levels.reduce((n, r) => n + r.samples, 0), misses: levels.flatMap(r => r.misses) } };
  const l10Misses = levels.find(row => row.level === 'L10')?.misses ?? [];
  assert.deepEqual(l10Misses, [], 'An L10 building has a missing or passable body-height collider');
  const baseline = new Set(knownMisses);
  assert.deepEqual(receipt.totals.misses.filter(miss => !baseline.has(miss)), [], 'New building wall sweep misses');
  return receipt;
}
