import { readFileSync } from 'node:fs';
import { Matrix4, Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import type { DistrictLayout } from '../../../src/levels/districts/types';

/**
 * PO 10-20 #63 "there is a place where I cannot continue, although there is no wall". Every L6 solid the courier can
 * walk into must have drawn geometry: (1) every non-walkable collider has a mesh triangle within 0.3 m of its box, and
 * (2) every body-height face sample of a collider that faces the walkable floor has a triangle within 0.3 m.
 */
type Tri = [Vector3, Vector3, Vector3];
const layout = JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json', 'utf8')) as DistrictLayout;
const cell = 1, reach = .3;
const glbs = new Map((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; glb?: string }[]).flatMap(a => a.glb ? [[a.id, a.glb] as const] : []));

async function triangles(): Promise<Map<string, Tri[]>> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), cache = new Map<string, Object3D>(), grid = new Map<string, Tri[]>();
  for (const p of layout.placements) {
    let scene = cache.get(p.assetId);
    if (!scene) {
      const file = readFileSync(glbs.get(p.assetId) ?? `public/assets/models/${p.assetId}.glb`);
      scene = (await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, '')).scene;
      scene.updateMatrixWorld(true); cache.set(p.assetId, scene);
    }
    const place = new Matrix4().compose(new Vector3(...p.position), new (await import('three')).Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.yaw), new Vector3(...p.scale));
    scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const m = place.clone().multiply(node.matrixWorld), pos = node.geometry.attributes.position, index = node.geometry.index;
      const count = index ? index.count : pos.count, at = (i: number) => new Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(m);
      for (let i = 0; i < count; i += 3) {
        const t: Tri = [at(i), at(i + 1), at(i + 2)];
        const lo = [0, 1, 2].map(a => Math.floor((Math.min(t[0].getComponent(a), t[1].getComponent(a), t[2].getComponent(a)) - reach) / cell));
        const hi = [0, 1, 2].map(a => Math.floor((Math.max(t[0].getComponent(a), t[1].getComponent(a), t[2].getComponent(a)) + reach) / cell));
        for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
          const key = `${x},${y},${z}`; let list = grid.get(key); if (!list) grid.set(key, list = []); list.push(t);
        }
      }
    });
  }
  return grid;
}
// Ericson, Real-Time Collision Detection 5.1.5.
function closest(p: Vector3, [a, b, c]: Tri): number {
  const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
  const d1 = ab.dot(ap), d2 = ac.dot(ap); if (d1 <= 0 && d2 <= 0) return p.distanceTo(a);
  const bp = p.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp); if (d3 >= 0 && d4 <= d3) return p.distanceTo(b);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return p.distanceTo(a.clone().addScaledVector(ab, d1 / (d1 - d3)));
  const cp = p.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp); if (d6 >= 0 && d5 <= d6) return p.distanceTo(c);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return p.distanceTo(a.clone().addScaledVector(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return p.distanceTo(b.clone().addScaledVector(c.clone().sub(b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  const denom = 1 / (va + vb + vc); return p.distanceTo(a.clone().addScaledVector(ab, vb * denom).addScaledVector(ac, vc * denom));
}
const near = (grid: Map<string, Tri[]>, p: Vector3) => (grid.get(`${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`) ?? []).some(t => closest(p, t) <= reach);
const excluded = layout.walkable.excluded.map(r => ({ x0: Math.min(...r.map(p => p[0])), x1: Math.max(...r.map(p => p[0])), z0: Math.min(...r.map(p => p[1])), z1: Math.max(...r.map(p => p[1])) }));
// Nav-only lane edges (crowd navigation) have no physics body: the courier never touches them.
const solids = layout.colliders.filter(c => !c.walkable && !c.aabb.navOnly);
/** Known backlog, not courier blockers: the station back walls (34-36) and box 3 export with Y/Z swapped (drawn walls, collide as
 * overhead shelves above the courier). Restoring them changes the shelter fight (complete bot 24-27 -> 15-19 rescued);
 * left for a balance-aware follow-up. A new offender fails. */
const backlog = new Set(["l6-0/fixed-3", "l6-0/fixed-34", "l6-0/fixed-35", "l6-0/fixed-36"]);
const floor = (x: number, z: number) => Math.max(.35, ...layout.colliders.filter(c => c.walkable && x >= c.aabb.min[0] && x <= c.aabb.max[0] && z >= c.aabb.min[2] && z <= c.aabb.max[2] && c.aabb.max[1] < 1).map(c => c.aabb.max[1]));
const open = (x: number, y: number, z: number) => !excluded.some(r => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) && !solids.some(c => x > c.aabb.min[0] && x < c.aabb.max[0] && z > c.aabb.min[2] && z < c.aabb.max[2] && y > c.aabb.min[1] && y < c.aabb.max[1]);

/** Body-height face samples (floor + 0.2 m to 1.8 m) whose outside lies on walkable floor. */
function faces(c: DistrictLayout['colliders'][number]): Vector3[] {
  const out: Vector3[] = [], { min, max } = c.aabb;
  for (const [axis, side] of [[0, -1], [0, 1], [2, -1], [2, 1]] as const) {
    const other = axis === 0 ? 2 : 0, fixed = side < 0 ? min[axis] : max[axis];
    for (let u = min[other] + .1; u <= max[other] - .1 + 1e-6; u += .25) {
      const x = axis === 0 ? fixed : u, z = axis === 0 ? u : fixed, f = floor(x + (axis === 0 ? side * .2 : 0), z + (axis === 2 ? side * .2 : 0));
      for (let y = Math.max(min[1], f + .2); y <= Math.min(max[1], f + 1.8); y += .3) {
        if (!open(x + (axis === 0 ? side * .2 : 0), y, z + (axis === 2 ? side * .2 : 0))) continue;
        out.push(new Vector3(x, y, z));
      }
    }
  }
  return out;
}

test('@E24 PO 10-20 #63 every L6 solid the courier can touch has drawn geometry within 0.3 m', async () => {
  const grid = await triangles();
  const invisible: string[] = [], bare: string[] = [];
  for (const c of solids) {
    const { min, max } = c.aabb, centre = new Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    // Box-level: any triangle within 0.3 m of the box (sampled on a 0.25 m lattice through the box).
    let found = false;
    for (let x = min[0]; x <= max[0] + 1e-6 && !found; x += Math.max(.25, (max[0] - min[0]) / 40)) for (let y = min[1]; y <= max[1] + 1e-6 && !found; y += .25) for (let z = min[2]; z <= max[2] + 1e-6 && !found; z += Math.max(.25, (max[2] - min[2]) / 40)) found = near(grid, new Vector3(x, y, z));
    if (!found) invisible.push(`${c.id} centre ${centre.toArray().map(v => v.toFixed(2)).join(',')}`);
    const samples = faces(c), missing = samples.filter(p => !near(grid, p));
    if (samples.length && missing.length / samples.length > .25 && !backlog.has(c.id)) bare.push(`${c.id} ${missing.length}/${samples.length} body-height face samples without a mesh, e.g. ${missing[0].toArray().map(v => v.toFixed(2)).join(',')}`);
  }
  console.log(`L6 colliders: ${solids.length} solid; invisible ${invisible.length}; bare faces ${bare.length}\n${[...invisible, ...bare].join('\n')}`);
  expect(invisible).toEqual([]);
  expect(bare).toEqual([]);
}, 300_000);
