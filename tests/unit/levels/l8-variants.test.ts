import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { doorwayOf } from '../../../src/data/buildingDoors';
import { zooStaff, zooStaffLook, isZooStaffTint, zooStaffModelsAreCivilianBases } from '../../../src/data/zooStaff';
import { l1Pedestrians } from '../../../src/data/npcs';
import { gameplay, tunnelOutlets } from '../../../src/levels/districts/D-ZOO';
import type { DistrictLayout, Point } from '../../../src/levels/districts/types';
import { resolvePosition, validateLayout } from '../../../src/levels/districts/validate';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import { crossValidate } from '../../../src/levels/districts/crossValidate';
import { bakeNav } from '../../../src/sim/world/NavGrid';
import { layoutHouseDoors } from '../../../src/sim/outbreak/HouseEmergence';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-ZOO.layout.json', 'utf8')) as DistrictLayout;
const point = (name: string): Point => resolvePosition({ anchor: name }, layout);
const nav = () => bakeNav([{ layout, origin: [0, 0], colliders: placementColliders(layout.placements.filter(p => p.minTier === 0), layout.colliders.filter(c => c.minTier === 0)).filter(c => !c.walkable).map(c => c.aabb) }], 30, .5);
type Def = { id: string; category: string; budget: { triangles: number; materials: number }; decayVariants: string[]; authoredLodTriangles?: { lod1: number; lod2: number } };
const def = (id: string) => (manifest as Def[]).find(d => d.id === id)!;

test('T-E30-07-outlets @E30-AC07 at least three occluded tunnel outlets, >= 20 m apart, inside the perimeter, on the path network', () => {
  expect(validateLayout(layout, worldAssets)).toEqual([]);
  expect(tunnelOutlets.length).toBeGreaterThanOrEqual(3);
  const outlets = layout.placements.filter(p => p.assetId === 'kit.zoo-tunnel-mouth');
  expect(outlets).toHaveLength(tunnelOutlets.length);
  for (const a of outlets) for (const b of outlets) if (a !== b) expect(Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2])).toBeGreaterThanOrEqual(20);
  const grid = nav(), reached = grid.flood(point('exit'));
  for (const outlet of tunnelOutlets) {
    const [x, z] = point(outlet.anchor);
    expect(Math.abs(x), outlet.id).toBeLessThan(115); expect(Math.abs(z), outlet.id).toBeLessThan(85);
    expect(grid.walkable([x, z]), `${outlet.id} apron walkable`).toBe(true);
    expect(reached[grid.index(x, z)], `${outlet.id} connected to the exit/vehicle path`).toBe(1);
  }
  expect(crossValidate(gameplay, layout, nav()).errors).toEqual([]);
});

test('T-E30-07-doors @E30-AC07 each outlet is a HouseEmergence door: closed masonry shell, spawn point behind the door inside the collider, door faces the apron', () => {
  const doors = layoutHouseDoors(layout, [0, 0], undefined, id => id === 'kit.zoo-tunnel-mouth');
  expect(doors).toHaveLength(tunnelOutlets.length);
  const grid = nav(), reached = grid.flood(point('exit'));
  for (const door of doors) {
    const placement = layout.placements.find(p => p.id === door.house)!, way = doorwayOf(placement)!;
    // The doorway is the asset's door plane: 3.05 m from the footprint centre along the facing normal, 1.8 m wide.
    expect(Math.hypot(way.door.x - placement.position[0], way.door.z - placement.position[2])).toBeCloseTo(3.05, 3);
    expect(way.width).toBeCloseTo(1.8, 5);
    // Occluded: with the doors shut the waiting point (1.15 m behind the door) is inside the solid footprint collider.
    const solid = layout.colliders.find(c => c.id === placement.id)!.aabb;
    expect(way.inside.x).toBeGreaterThan(solid.min[0]); expect(way.inside.x).toBeLessThan(solid.max[0]);
    expect(way.inside.z).toBeGreaterThan(solid.min[2]); expect(way.inside.z).toBeLessThan(solid.max[2]);
    expect(Math.hypot(way.inside.x - way.door.x, way.inside.z - way.door.z)).toBeCloseTo(1.15, 3);
    // The doorstep (apron end, 2.95 m out) is walkable and joins the path network, so infected can walk out.
    const out: Point = [way.door.x + way.out.x * door.depth, way.door.z + way.out.z * door.depth];
    expect(grid.walkable(out), `${door.house} doorstep`).toBe(true);
    expect(reached[grid.index(...out)], `${door.house} doorstep connected`).toBe(1);
  }
});

test('T-E30-07-asset @E30-AC07 tunnel mouth budgets, derived looks and unarmed APC variant are registered', () => {
  const mouth = def('kit.zoo-tunnel-mouth');
  expect(mouth.budget.triangles).toBe(3000); expect(mouth.authoredLodTriangles).toEqual({ lod1: 1200, lod2: 400 }); expect(mouth.budget.materials).toBeLessThanOrEqual(4);
  const budgets: Record<string, [number, number, number]> = { 'amb.lion': [12000, 4000, 1500], 'amb.gorilla': [12000, 4000, 1500], 'amb.flamingo': [2000, 800, 300] };
  for (const [id, [lod0, lod1, lod2]] of Object.entries(budgets)) {
    const d = def(id);
    expect(d.budget.triangles, id).toBe(lod0); expect(d.authoredLodTriangles, id).toEqual({ lod1, lod2 }); expect(d.budget.materials, id).toBeLessThanOrEqual(4);
    // Normal animals stay out of the infected crowd's auto-registered variants.
    expect(d.category, id).not.toBe('infected');
  }
  const apc = def('veh.military-apc') as Def & { decayNodes?: Record<string, { requiredNodes?: string[]; sockets?: string[] }> };
  expect(apc.decayVariants).toContain('unarmed');
  const nodes = apc.decayNodes!.unarmed;
  expect([...(nodes.requiredNodes ?? []), ...(nodes.sockets ?? [])].some(n => /turret|gun|muzzle/.test(n))).toBe(false);
  expect(nodes.sockets).toEqual(expect.arrayContaining(['driverSeat', 'exitL', 'exitR', 'rearExit', 'passenger0']));
});

test('T-E30-05-staff @E30-AC05 zoo staff are civilian bases with a uniform tint no visitor uses, plus cap and a work prop', () => {
  expect(zooStaffModelsAreCivilianBases()).toBe(true);
  for (const tint of zooStaff.uniforms) expect((l1Pedestrians.shirts as readonly string[]).includes(tint)).toBe(false);
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const look = zooStaffLook(i);
    expect(isZooStaffTint(look.tint)).toBe(true); expect(look.accessories).toContain('cap');
    expect((l1Pedestrians.handProps as readonly string[]).includes(look.handProp)).toBe(true);
    for (const a of look.accessories) expect((l1Pedestrians.accessories as readonly string[]).includes(a)).toBe(true);
    seen.add(look.role);
  }
  expect(seen.size).toBe(zooStaff.roles.length);
});
