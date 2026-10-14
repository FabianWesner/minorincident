import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { l4, l4ConvoyGate, l4ConvoyStations, l4Posts, l4Route, l4RoutePose } from '../../../src/data/l4';
import { convoyOverlaps } from '../../../src/sim/missions/L4ConvoyClearance';
import { levelFourLayouts } from '../../../src/levels/L4/layout';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import type { Aabb, DistrictLayout } from '../../../src/levels/districts/types';

const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const [layout] = levelFourLayouts([base]);
type Hull = { id: string; x: number; z: number; yaw: number; len: number; wid: number; height: number };
function intersects(h: Hull, b: Aabb): boolean {
  if (b.max[1] <= .05 || b.min[1] >= h.height) return false;
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw), dx = (b.min[0] + b.max[0]) / 2 - h.x, dz = (b.min[2] + b.max[2]) / 2 - h.z;
  const hx = (b.max[0] - b.min[0]) / 2, hz = (b.max[2] - b.min[2]) / 2;
  // SAT: vehicle longitudinal/lateral axes and the solid's world axes.
  return Math.abs(dx * c - dz * s) < h.len / 2 + hx * Math.abs(c) + hz * Math.abs(s) - .001
    && Math.abs(dx * s + dz * c) < h.wid / 2 + hx * Math.abs(s) + hz * Math.abs(c) - .001
    && Math.abs(dx) < hx + h.len / 2 * Math.abs(c) + h.wid / 2 * Math.abs(s) - .001
    && Math.abs(dz) < hz + h.len / 2 * Math.abs(s) + h.wid / 2 * Math.abs(c) - .001;
}

test('T-E22-04j @E22 @E22-AC04 convoy stop poses and parked military vehicles clear static solids and the closing gate', () => {
  const route = l4Route(), stations = l4ConvoyStations(route.length);
  const hulls: Hull[] = l4.convoy.vehicles.map((v, i) => ({ id: `convoy/${v.id}`, ...l4RoutePose(route, stations.end[i]), len: v.len, wid: v.wid, height: worldAssets[v.asset].dimensions.y }));
  for (const p of layout.placements.filter(p => p.assetId.startsWith('veh.military'))) {
    const d = worldAssets[p.assetId].dimensions;
    hulls.push({ id: p.id, x: p.position[0], z: p.position[2], yaw: p.yaw, len: d.x * p.scale[0], wid: d.z * p.scale[2], height: d.y * p.scale[1] });
  }
  const fuel = worldAssets['veh.fuel-truck'].dimensions;
  hulls.push({ id: 'scripted/fuel-truck', ...l4.fuelTruck, len: fuel.x, wid: fuel.z, height: fuel.y });
  const solids = placementColliders(layout.placements, layout.colliders).filter(c => !c.walkable);
  const gate = l4ConvoyGate.z.map((z, i) => ({ id: `closing-gate/${i}`, aabb: { min: [l4.perimeter.x1 - .4, 0, z - 1.5], max: [l4.perimeter.x1 + .4, 1, z + 1.5] } as Aabb }));
  const bad = hulls.flatMap(h => [...solids, ...gate].filter(b => b.id !== h.id && !b.id.startsWith(`${h.id}/`) && intersects({ ...h, len: h.len + .6, wid: h.wid + .6 }, b.aabb)).map(b => `${h.id} intersects ${b.id}`));
  expect(hulls.filter(h => h.id.includes('truck')).length).toBeGreaterThanOrEqual(2);
  expect(bad).toEqual([]);
  for (const post of l4Posts) for (const [i, h] of hulls.slice(0, l4.convoy.vehicles.length).entries()) {
    expect(convoyOverlaps(h, i, { x: post.at[0], z: post.at[1] }, .9), `${post.name} post in ${h.id}`).toBe(false);
  }
  const holdPoints = [...l4.director.fallback1, ...l4.director.fallback2, ...l4.director.retreat, ...l4.director.checkpoints.flat(),
    ...l4.calm.offDuty.chat.flatMap(([, , [x, z]]) => [[x - .6, z], [x + .6, z]])];
  for (const [x, z] of holdPoints) for (const [i, h] of hulls.slice(0, l4.convoy.vehicles.length).entries()) {
    expect(convoyOverlaps(h, i, { x, z }, .9), `soldier hold ${x},${z} in ${h.id}`).toBe(false);
  }
  // Opening the gate must expose a passage and a respawn point outside the
  // parked trucks, rather than relying on the old missing body collision.
  const [a, b] = l4.director.escape.route, checkpoint = l4.director.escape.checkpoint;
  for (let k = 0; k <= 40; k++) {
    const p = { x: a[0] + (b[0] - a[0]) * k / 40, z: a[1] + (b[1] - a[1]) * k / 40 };
    for (const [i, h] of hulls.slice(0, l4.convoy.vehicles.length).entries()) expect(convoyOverlaps(h, i, p, .95)).toBe(false);
  }
  for (const [i, h] of hulls.slice(0, l4.convoy.vehicles.length).entries()) expect(convoyOverlaps(h, i, { x: checkpoint[0], z: checkpoint[1] }, .95)).toBe(false);
});
