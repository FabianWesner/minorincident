import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { SimWorld } from '../../../src/sim/world/SimWorld';

/**
 * PO 2026-10-13 "Corgi sunken" (L1 fire station apron, low tier, zoom 0.5): the apron is tiled 0.75 x 1.5 m walkable slabs with
 * 3-4 cm seams. The courier's capsule spans a seam, but every point-sampled actor (corgi, pedestrians, pickups, contact shadows)
 * dropped 10 cm into the drawn slab there. Guard over every district (the L1-L9 compositions are built from these): no raised
 * walkable top may have a narrow trench beside it into which `groundHeight` falls while the far side is back at the top height.
 */
const districts = readdirSync('public/assets/layouts').filter(f => f.endsWith('.layout.json')).map(f => f.replace('.layout.json', ''));
for (const id of districts) test(`@E21 ${id}: raised walkable supports have no seam an actor sinks into`, async () => {
  const composition = compositions[id];
  if (!composition) return;
  const layout = JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;
  const w = new SimWorld(); await w.init(); w.loadComposition(composition, [layout], 1);
  const d = w.districts!, seams: string[] = [];
  for (const district of d.districts) for (const c of district.decay.colliders) {
    // Rims and sills narrower than a paw/foot stance (30 cm) are not floors an actor stands on.
    if (!c.walkable || c.aabb.max[1] < .05 || Math.min(c.aabb.max[0] - c.aabb.min[0], c.aabb.max[2] - c.aabb.min[2]) < .3) continue;
    const top = c.aabb.max[1], [x0, , z0] = c.aabb.min.map((v, i) => v + (i === 0 ? district.origin[0] : i === 2 ? district.origin[1] : 0)), [x1, , z1] = c.aabb.max.map((v, i) => v + (i === 0 ? district.origin[0] : i === 2 ? district.origin[1] : 0));
    // Edge samples (10 cm apart, inset 5 cm from the corners); `n` is the outward normal.
    const edges: [number, number, number, number, number, number][] = [[x0, z0 + .05, x0, z1 - .05, -1, 0], [x1, z0 + .05, x1, z1 - .05, 1, 0], [x0 + .05, z0, x1 - .05, z0, 0, -1], [x0 + .05, z1, x1 - .05, z1, 0, 1]];
    for (const [ax, az, bx, bz, nx, nz] of edges) {
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / .1));
      for (let i = 0; i <= n; i++) {
        const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
        const inSeam = d.groundHeight(x + nx * .045, z + nz * .045), beyond = d.groundHeight(x + nx * .12, z + nz * .12);
        if (inSeam < top - .05 && Math.abs(beyond - top) <= .01) seams.push(`${c.id} (${(x + nx * .045).toFixed(2)}, ${(z + nz * .045).toFixed(2)}) top ${top.toFixed(2)} seam ${inSeam.toFixed(2)}`);
      }
    }
  }
  expect(seams.slice(0, 12), `${seams.length} seam samples`).toEqual([]);
}, 120_000);
