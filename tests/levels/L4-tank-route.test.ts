import { expect, test } from 'vitest';
import { l4, l4Cars } from '../../src/data/l4';
import { l4PerimeterWalls } from '../../src/data/l4Perimeter';
import { l4Dressing } from '../../src/levels/L4/layout';

// PO #116 (10-22): "The tank is driving through the wall". The scripted tank (veh.tank hull: x -3.55..3.45, z +-1.65, forward +X)
// must keep its whole route and stop pose clear of the military perimeter, static solids and pickup props.
const HULL = { back: 3.55, front: 3.45, half: 1.65 };

/** Sample points over the hull rectangle grown by `margin` (half-width overridable for the solid check). */
function footprint(x: number, z: number, yaw: number, margin: number, half = HULL.half, step = .5): { x: number; z: number }[] {
  const c = Math.cos(yaw), s = -Math.sin(yaw), out: { x: number; z: number }[] = [];
  for (let u = -HULL.back - margin; u <= HULL.front + margin + 1e-6; u += step) for (let v = -half - margin; v <= half + margin + 1e-6; v += step) out.push({ x: x + c * u - s * v, z: z + s * u + c * v });
  return out;
}
function route(): { x: number; z: number; yaw: number }[] {
  const pts = l4.tank.path, out: { x: number; z: number; yaw: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az), yaw = -Math.atan2(bz - az, bx - ax);
    for (let d = 0; d <= len; d += .5) out.push({ x: ax + (bx - ax) * d / len, z: az + (bz - az) * d / len, yaw });
  }
  return out;
}

test('L4 tank route and stop pose stay clear of the perimeter wall, authored dressing, parked cars, the fuel truck and medkits', async () => {
  const bad = new Set<string>(), poses = route();
  const props: { name: string; x: number; z: number }[] = [
    ...l4Dressing.filter(d => d.kind !== 'barrier').map(d => ({ name: `${d.assetId}@${d.x},${d.z}`, x: d.x, z: d.z })),
    ...l4Cars.map(c => ({ name: `${c.def}@${c.at}`, x: c.at[0], z: c.at[1] })),
    ...l4.medkits.positions.map(([x, z]) => ({ name: `medkit@${x},${z}`, x, z })),
    { name: 'fuel-truck', x: l4.fuelTruck.x, z: l4.fuelTruck.z },
  ];
  for (const pose of poses) {
    const c = Math.cos(pose.yaw), s = -Math.sin(pose.yaw), at = `pose ${pose.x.toFixed(1)},${pose.z.toFixed(1)}`;
    // The visible wall: the hull plus 30 cm must not touch it.
    for (const p of footprint(pose.x, pose.z, pose.yaw, .3)) for (const wall of l4PerimeterWalls) if (Math.abs(p.x - wall.x) <= wall.halfX && Math.abs(p.z - wall.z) <= wall.halfZ) bad.add(`perimeter ${wall.id} at ${at}`);
    // No prop point inside the hull rectangle (+ 40 cm).
    for (const q of props) {
      const dx = q.x - pose.x, dz = q.z - pose.z, u = dx * c + dz * s, v = -dx * s + dz * c;
      if (u > -HULL.back - .4 && u < HULL.front + .4 && Math.abs(v) < HULL.half + .4) bad.add(`${q.name} inside the hull at ${at}`);
    }
  }
  // At the stop the hull turns in place to aim: its swept circle (hull corner radius) must also clear the wall.
  const stop = poses.at(-1)!, r = Math.hypot(HULL.back, HULL.half);
  for (const wall of l4PerimeterWalls) if (Math.abs(stop.x - wall.x) < wall.halfX + r && Math.abs(stop.z - wall.z) < wall.halfZ + r) bad.add(`stop turn circle touches ${wall.id}`);
  expect([...bad].slice(0, 3000)).toEqual([]);
}, 60_000);
