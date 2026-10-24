import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { floorAt, layoutHouseDoors, walkResidents, type HouseEmergence } from '../../../src/sim/outbreak/HouseEmergence';

/** PO P1 10-08 "a zombie spawning out of nowhere": the beat-9 residents come out of a real front door. */
describe('HouseEmergence door geometry', () => {
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
  const anchors = Object.fromEntries(Object.entries(layout.anchors).map(([k, a]) => [k, { x: (a as { position: number[] }).position[0], z: (a as { position: number[] }).position[2] }]));
  test('every house-a front door sits behind its gate path, faces the street and matches its refuge door', () => {
    const doors = layoutHouseDoors(layout, [0, 0], anchors, id => id === 'bld.house-a');
    expect(doors.length).toBe(layout.placements.filter(p => p.assetId === 'bld.house-a').length);
    for (const d of doors) {
      const p = layout.placements.find(q => q.id === d.house)!;
      // Front normal = the model's +X (layout yaw), the threshold inside the house footprint's front half, on the gate line.
      expect(d.nx).toBeCloseTo(Math.cos(p.yaw), 5); expect(d.nz).toBeCloseTo(-Math.sin(p.yaw), 5);
      expect(d.door).toBeGreaterThan(0);
      const gate = anchors[`refuge-door-${d.door}`], along = (gate.x - d.x) * d.nx + (gate.z - d.z) * d.nz, lateral = (gate.x - d.x) * d.nz - (gate.z - d.z) * d.nx;
      expect(Math.abs(lateral)).toBeLessThan(.05); expect(along).toBeGreaterThan(d.depth); expect(along).toBeLessThan(d.depth + 1.5);
    }
  });
  test('porch floor: deck, two treads, then the path', () => {
    const door = { floor: [[1.59, .54], [1.85, .36], [2.11, .2]] as [number, number][] };
    expect(floorAt(door, -.9)).toBe(.54); expect(floorAt(door, 1)).toBe(.54); expect(floorAt(door, 1.7)).toBe(.36);
    expect(floorAt(door, 2)).toBe(.2); expect(floorAt(door, 2.5)).toBe(0);
    // Eased over 10 cm at a tread edge, monotonic.
    expect(floorAt(door, 1.59)).toBeCloseTo(.45, 5);
    for (let s = -1; s < 3; s += .01) expect(floorAt(door, s + .01)).toBeLessThanOrEqual(floorAt(door, s) + 1e-9);
  });
});


test('L4 tent walk waits for body clearance and retains a downed resident until recovery', () => {
  const e = { id: 7, health: { current: 0, max: 60 }, transform: { x: 0, y: .7, z: 0, yaw: 0 }, emerging: true,
    infected: { recoverAt: 1 }, combat: { radius: .35 } } as EntitySnapshot;
  let clear = false;
  const w = { entities: { get: () => e }, solids: { clear: (_p: unknown, _r: number, _id: number, bodies = true) => { expect(bodies).toBe(true); return clear; }, admit: () => true },
    spatial: { set: () => undefined }, openDoors: new Map() } as unknown as SimWorld;
  const house: HouseEmergence = { strictRoute: true, door: 0, house: 'tent', x: -1, z: 0, nx: 1, nz: 0, floor: [], sx: 0, sz: 0, route: [[0, 1]], ox: 0, oz: 1,
    next: 0, ids: [7], walking: [{ id: 7, until: 0, leg: 0 }] };
  expect(walkResidents(w, house, 20)).toEqual([]);
  expect(e.emerging).toBe(true); expect(house.walking).toHaveLength(1);
  e.health.current = 60; e.infected!.recoverAt = -1;
  expect(walkResidents(w, house, 21)).toEqual([]);
  expect(e.transform.z).toBe(0); expect(house.walking![0].leg).toBe(0);
  clear = true;
  for (let tick = 22; tick < 100 && house.walking!.length; tick++) walkResidents(w, house, tick);
  expect(house.walking).toHaveLength(0); expect(e.emerging).toBeUndefined(); expect(e.transform.z).toBeCloseTo(1);
});
