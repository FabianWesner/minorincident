import * as RAPIER from '@dimforge/rapier3d-compat';
import { expect, test } from 'vitest';
import { bicycleGeometry as g } from '../../src/data/bicycleGeometry';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

// PO 10-22 (PROD 73bce8bc5, L1 tick 8773, step firestation, player (-70.50, 46.99)): "I took the bike to the firefight
// station and when I got up, the bike is now on the other side of the fence..." The privacy fence south of the fire
// station runs along z = 49.9 (prop.privacy-fence:914-920); the courier stands on the gravel strip north of it.
const FENCE_Z = 49.765;
function step(w: SimWorld, ticks: number) { for (let i = 0; i < ticks; i++) w.update(); }
function teleport(w: SimWorld, x: number, z: number) {
  const p = w.entities.get(1)!; Object.assign(p.transform, { x, z, y: w.districts!.pavingHeight(x, z) + .72 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z);
}
function courierSide(w: SimWorld): string | null {
  const bike = w.vehicles!.bicycle.entity!, t = bike.transform, p = w.entities.get(1)!.transform, heading = -t.yaw;
  const fx = Math.cos(heading), fz = Math.sin(heading);
  if (bike.bicycle!.mounted) return 'still mounted';
  for (const along of [g.minX, g.maxX]) for (const side of [-g.halfWidth, g.halfWidth]) if (t.z + fz * along + fx * side >= FENCE_Z) return `frame beyond fence ${JSON.stringify(t)} rider ${p.x.toFixed(2)},${p.z.toFixed(2)}`;
  const centre = (g.minX + g.maxX) / 2;
  const hit = w.physics.world!.intersectionWithShape({ x: t.x + fx * centre, y: t.y + .01 + g.height / 2, z: t.z + fz * centre }, { x: 0, y: Math.sin(t.yaw / 2), z: 0, w: Math.cos(t.yaw / 2) }, new RAPIER.Cuboid((g.maxX - g.minX) / 2, g.height / 2, g.halfWidth), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, w.physics.playerCollider!);
  if (hit) return `frame inside a solid ${JSON.stringify(t)} rider ${p.x.toFixed(2)},${p.z.toFixed(2)}`;
  const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
  if (d > .05) {
    const ray = new RAPIER.Ray({ x: p.x, y: t.y + .35, z: p.z }, { x: dx / d, y: 0, z: dz / d });
    if (w.physics.world!.castRay(ray, d, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, w.physics.playerCollider!)) return `solid between rider ${p.x.toFixed(2)},${p.z.toFixed(2)} and bike ${JSON.stringify(t)}`;
  }
  return null;
}
let park = { x: 0, y: 0, z: 0, yaw: 0 };
function ride(w: SimWorld, x: number, z: number, heading: number) {
  const b = w.vehicles!.bicycle, p = w.entities.get(1)!;
  // Each case starts from the parked depot bike, not the previous case's spot.
  Object.assign(b.entity!.transform, park); b.entity!.bicycle!.mounted = false; delete p.riding; step(w, 1);
  teleport(w, x, z); b.entity!.bicycle!.mounted = true; b.entity!.bicycle!.heading = heading; p.riding = b.entity!.id; step(w, 1);
}

test('dismounting beside the fire-station fence parks the bike on the courier side, clear of solids @E19', async () => {
  const { world: w, mission } = await loadL1(1);
  try {
    w.combat!.damage.god = true;
    for (const id of ['pickup', 'deliver', 'escape']) mission.completeObjective(id);
    const b = w.vehicles!.bicycle, p = w.entities.get(1)!, failures: string[] = []; park = { ...b.entity!.transform };
    let cases = 0;
    const headings = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i * Math.PI / 4);
    // ACTION dismount on the gravel strip between the station and the fence, in every riding direction.
    for (let x = -71; x <= -61; x += 1) for (const z of [46.7, 47, 47.6, 48.2, 48.8, 49.2]) for (const heading of headings) {
      // Only cases where the riding courier really is on the station side (a teleport into a prop can be pushed out).
      ride(w, x, z, heading); if (!b.riding || p.transform.z > FENCE_Z - .3) continue;
      cases++;
      w.setInput({ interact: true }); step(w, 1); w.setInput({ interact: false }); step(w, 1);
      const why = courierSide(w); if (why) failures.push(`action (${x}, ${z}) h${heading.toFixed(2)}: ${why}`);
    }
    // Riding west into the fire-station no-bike zone parks the bike where she left the road.
    for (const z of [46.7, 46.99, 47.6, 48.2, 48.8, 49.2]) {
      ride(w, -69, z, Math.PI); teleport(w, -71.6, Math.min(z, 48.5)); step(w, 2);
      const why = courierSide(w); if (why) failures.push(`zone ${z}: ${why}`);
    }
    expect(cases).toBeGreaterThan(400);
    expect(failures, `${failures.length} failures\n${failures.slice(0, 12).join('\n')}`).toEqual([]);
  } finally { w.dispose(); }
}, 300_000);
