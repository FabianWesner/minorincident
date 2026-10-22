import { expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { l4PerimeterWalls } from '../../src/data/l4Perimeter';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

// PO #116 (10-22): "The tank is driving through the wall". The scripted tank (veh.tank hull: x -3.55..3.45, z +-1.65, forward +X)
// must keep its whole route and stop pose clear of the military perimeter, static solids and pickup props.
const HULL = { back: 3.55, front: 3.45, half: 1.65 }, MARGIN = .3;

function footprint(x: number, z: number, yaw: number, step = .6): { x: number; z: number }[] {
  const c = Math.cos(yaw), s = -Math.sin(yaw), out: { x: number; z: number }[] = [];
  for (let u = -HULL.back - MARGIN; u <= HULL.front + MARGIN + 1e-6; u += step) for (let v = -HULL.half - MARGIN; v <= HULL.half + MARGIN + 1e-6; v += step) out.push({ x: x + c * u - s * v, z: z + s * u + c * v });
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

test('L4 tank route and stop pose stay clear of the perimeter, solids and medkits', async () => {
  const { world: w } = await loadL4(1);
  try {
    const bad: string[] = [];
    for (const pose of route()) for (const p of footprint(pose.x, pose.z, pose.yaw)) {
      for (const wall of l4PerimeterWalls) if (Math.abs(p.x - wall.x) <= wall.halfX && Math.abs(p.z - wall.z) <= wall.halfZ) { bad.push(`perimeter ${wall.id} at pose ${pose.x.toFixed(1)},${pose.z.toFixed(1)}`); break; }
      if (!w.solids.clear({ x: p.x, y: .7, z: p.z }, .05, undefined, false)) bad.push(`solid at ${p.x.toFixed(1)},${p.z.toFixed(1)} (pose ${pose.x.toFixed(1)},${pose.z.toFixed(1)})`);
    }
    const stop = route().at(-1)!;
    for (const [mx, mz] of l4.medkits.positions) if (footprint(stop.x, stop.z, stop.yaw, .3).some(p => Math.hypot(p.x - mx, p.z - mz) < .5)) bad.push(`medkit ${mx},${mz} inside the stop footprint`);
    expect([...new Set(bad)].slice(0, 20)).toEqual([]);
  } finally { w.dispose(); }
}, 180_000);
