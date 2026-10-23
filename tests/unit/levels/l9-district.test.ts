import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, Raycaster, Vector3 } from 'three';
import { crossing, crossingChunks, crossingRouteLength } from '../../../src/levels/L9/district';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { compositions } from '../../../src/levels/compositions';
import { validateLayout } from '../../../src/levels/districts/validate';
import type { DistrictLayout, Point } from '../../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')) as DistrictLayout;
const world = () => new DistrictWorld(compositions['D-CROSSING'], [layout], 31);
function samples(points: Point[], step = 2): Point[] {
  return points.slice(1).flatMap((b, i) => {
    const a = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return Array.from({ length: Math.ceil(length / step) + 1 }, (_, j) => {
      const t = Math.min(1, j * step / length);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as Point;
    });
  });
}
test('T-E31-04 @E31-AC04 greybox extent, connected materially different routes and skyline', () => {
  expect(validateLayout(layout, worldAssets)).toEqual([]);
  expect(layout.bounds).toEqual([[-600,-400],[600,-400],[600,400],[-600,400],[-600,-400]]);
  expect(layout.roads.edges).toHaveLength(3);
  for (const [i, route] of crossing.routes.entries()) {
    expect(layout.roads.edges[i].points).toEqual(route.points);
    expect(route.points[0]).toEqual(crossing.start); expect(route.points.at(-1)).toEqual(crossing.outskirts);
    expect(crossingRouteLength(route.points)).toBeGreaterThanOrEqual(900);
  }
  expect(new Set(layout.surfaces.map(s => s.surface))).toEqual(new Set(['asphalt','grass','gravel']));
  expect(layout.buildings.filter(b => b.label === 'Next city')).toHaveLength(4);
  expect(layout.buildings.filter(b => b.label === 'Countryside').length).toBeGreaterThanOrEqual(4);
  const district = world();
  for (const view of crossing.viewpoints) {
    expect(Math.hypot(view.to[0]-view.from[0],view.to[1]-view.from[1])).toBeGreaterThanOrEqual(150);
    for (const [x,z] of samples([view.from,view.to],.5)) {
      expect(district.nav.walkable([x,z]), `sightline ${view.id} at ${x},${z}`).toBe(true);
      expect(district.districts[0].decay.colliders.some(c => x>=c.aabb.min[0] && x<=c.aabb.max[0] && z>=c.aabb.min[2] && z<=c.aabb.max[2])).toBe(false);
    }
  }
});
test('T-E31-05-district @E31-AC05 open road departure/reentry, shortcut ratio and avoidable risk anchors', () => {
  const district = world(), reached = district.nav.flood(crossing.start);
  const lengths = crossing.routes.map(r => crossingRouteLength(r.points));
  expect(lengths[2]).toBeLessThanOrEqual(.8*Math.max(...lengths));
  expect(crossing.routes[2].risks.length).toBeGreaterThanOrEqual(2*crossing.routes[0].risks.length);
  for (const route of crossing.routes) {
    // Sample the APC hull footprint as well as the pedestrian grid, not just a centre trace.
    for (const [x,z] of samples(route.points).concat(samples(route.detour))) for (const dx of [-3,0,3]) for (const dz of [-3,0,3]) {
      expect(reached[district.nav.index(x+dx,z+dz)], `${route.id} hull ${x+dx},${z+dz}`).toBe(1);
      expect(district.groundHeight(x+dx,z+dz)).toBe(0);
    }
    // A small steering correction must remain on connected, supported ground along every drive route.
    for (let i = 1; i < route.points.length; i++) {
      const [ax, az] = route.points[i - 1], [bx, bz] = route.points[i], length = Math.hypot(bx - ax, bz - az) || 1;
      const side = [-2.5, 2.5];
      for (const [x, z] of samples([route.points[i - 1], route.points[i]])) {
        if (x > 508 && x < 524) continue; // The authored crash gully is intentionally unsupported.
        for (const offset of side) {
          const sx = x - (bz - az) / length * offset, sz = z + (bx - ax) / length * offset;
          expect(reached[district.nav.index(sx, sz)], `${route.id} steering offset ${offset} at ${sx},${sz}`).toBe(1);
          expect(district.groundHeight(sx, sz)).toBe(0);
        }
      }
    }
    for (const risk of route.risks) {
      expect(samples(route.detour,.5).every(p => Math.hypot(p[0]-risk[0],p[1]-risk[1])>12), `${route.id} risk detour`).toBe(true);
    }
  }
  // Connect different route traces directly across open terrain, independent of their road graph.
  for (const points of [[[0,-330],[0,240]], [[-300,240],[250,-30]], [[350,-330],[-250,-30]]] as Point[][])
    for (const [x,z] of samples(points)) expect(reached[district.nav.index(x,z)]).toBe(1);
  // Every intended driveable cell, including all 100 m seams, can reach outskirts on foot.
  expect(reached[district.nav.index(...crossing.outskirts)]).toBe(1);
  let disconnected = 0;
  for (let i=0;i<district.nav.cells.length;i++) if (district.nav.cells[i] && !reached[i]) disconnected++;
  expect(disconnected).toBe(0);
});
test('T-E31-04-ground @E31-AC04 locally authored chunks have continuous road/off-road support', async () => {
  const buffer = readFileSync('public/assets/layouts/D-CROSSING.base.glb');
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
  scene.updateMatrixWorld(true);
  const ground: Mesh[] = [], chunks: string[] = [];
  scene.traverse(n => { if (n instanceof Mesh) ground.push(n); if(n.userData.terrainChunk) chunks.push(n.userData.terrainChunk); });
  expect(chunks.sort()).toEqual(crossingChunks.map(c=>c.id).sort());
  const ray = new Raycaster(new Vector3(),new Vector3(0,-1,0),0,5);
  // L9-A2: every route ends at the mandatory collapsed section (a 16 m gully, x 508..524). Outside it the support rule is unchanged.
  const inGully = (x: number) => x > 508 && x < 524;
  for (const route of crossing.routes) for (const [x,z] of samples(route.points,5).concat(samples(route.detour,5))) {
    if (inGully(x)) continue;
    ray.ray.origin.set(x,2,z); const hit=ray.intersectObjects(ground,false)[0];
    expect(hit,`${route.id} support at ${x},${z}`).toBeDefined();
    expect(Math.abs(hit.point.y)).toBeLessThanOrEqual(.01);
  }
  // The collapsed section is real geometry: the floor is >= 5 m down at its centre, and the lips are intact ground at +-8.5 m.
  for (const [x, y] of [[516, -5.5], [507.9, 0], [524.1, 0]]) {
    ray.ray.origin.set(x, 2, 0); ray.far = 9; const hit = ray.intersectObjects(ground, false)[0];
    expect(hit, `crash gully at ${x}`).toBeDefined(); expect(Math.abs(hit.point.y - y)).toBeLessThanOrEqual(.05);
  }
  ray.far = 5;
  for(const c of crossingChunks) for(const [x,z] of [[c.origin[0]+.01,c.origin[1]+50],[c.max[0]-.01,c.origin[1]+50]]) {
    ray.ray.origin.set(x,2,z); const hit=ray.intersectObjects(ground,false)[0]; expect(hit).toBeDefined(); expect(Math.abs(hit.point.y)).toBeLessThanOrEqual(.01);
  }
});

test('T-E31-04-dress @E31-AC04 route landmarks reuse countryside stock and leave detours open', () => {
  expect(layout.title).toContain('dry moonlit countryside');
  for (const label of ['Farm outbuilding', 'Farm workshop', 'Abandoned highway stop', 'Roadside workshop'])
    expect(layout.buildings.some(b => b.label === label), label).toBe(true);
  expect(layout.placements.filter(p => p.assetId === 'prop.tree').length).toBeGreaterThanOrEqual(50);
  expect(layout.placements.filter(p => p.assetId === 'veh.wreck' && p.position[0] < 450 && p.position[2] > -80 && p.position[2] < -40).length).toBeGreaterThanOrEqual(4);
  // The existing AC05 footprint/flood test checks every road, detour and sightline against these colliders.
  expect(layout.placements.every(p => worldAssets[p.assetId])).toBe(true);
});

test('T-E31-Q131 @E31-AC21 APC start shoulder clears the shallow-steer tree and pole wedge', () => {
  const conflicts = layout.placements.filter(p =>
    /^(prop|veh)\./.test(p.assetId) && p.visualAabb.min[0] <= -441.5 && p.visualAabb.max[0] >= -558.5 && p.visualAabb.min[2] <= 8.5 && p.visualAabb.max[2] >= -8.5,
  ).map(p => p.id);
  expect(conflicts, 'the APC swept hull and 2.5 m steering allowance need open shoulder at the reported start position').toEqual([]);
});
