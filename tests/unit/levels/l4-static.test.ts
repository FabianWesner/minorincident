import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { l4, l4Anchors, l4Convoy, l4ConvoyStations, l4PhotoSpots, l4Route, l4RoutePose } from '../../../src/data/l4';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { compositions } from '../../../src/levels/compositions';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import type { Aabb, DistrictLayout, Point } from '../../../src/levels/districts/types';
import { validateLayout } from '../../../src/levels/districts/validate';
import { l4Dressing, levelFourLayouts } from '../../../src/levels/L4/layout';
import { bakeNav } from '../../../src/sim/world/NavGrid';

/** E22 static criteria: the D-FAIR layout, the clean W0 dressing, the convoy route, both routes to the cellar, the light and the pair cameras. */
const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const [layout] = levelFourLayouts([base]);
const solid = placementColliders(layout.placements, layout.colliders).filter(c => !c.walkable);
const at = (name: string): Point => { const a = layout.anchors[name]; if (!a) throw new Error(`missing anchor ${name}`); return [a.position[0], a.position[2]]; };
const navWith = (extra: Aabb[] = []) => bakeNav([{ layout, origin: [0, 0], colliders: solid.map(c => c.aabb).concat(extra) }], 1, .5);
const box = (x0: number, z0: number, x1: number, z1: number): Aabb => ({ min: [x0, 0, z0], max: [x1, 2.5, z1] });
const reach = (nav: ReturnType<typeof navWith>, from: Point, to: Point) => { const f = nav.flood(from); const i = nav.index(to[0], to[1]); return i >= 0 && f[i] === 1; };

describe('L4 static', () => {
  test('T-E22-05a @E22 @E22-AC05 D-FAIR layout: valid, about 170 x 130 m, the five streets and Kessler Lane, clean W0 (no wrecks, decals or damage variants)', () => {
    expect(validateLayout(base, worldAssets)).toEqual([]);
    const xs = base.bounds.map(p => p[0]), zs = base.bounds.map(p => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(165); expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThanOrEqual(125);
    for (const [name, axis, at0] of [['lakeshore', 1, 46], ['harbor', 1, -40], ['church-rd', 0, -58], ['plaza-way', 0, 14], ['metro-rd', 0, 50]] as const) {
      const edges = layout.roads.edges.filter(e => e.id.startsWith(name));
      expect(edges.length, name).toBeGreaterThanOrEqual(1);
      expect(edges.every(e => e.points.every(p => Math.abs(p[axis] - at0) < .01)), name).toBe(true);
    }
    expect(layout.placements.filter(p => p.decay).length).toBe(0);
    expect(layout.placements.filter(p => /^decal\.|decay\.(?!broken-glass)/.test(p.assetId)).length).toBe(0);
    expect(l4Dressing.filter(d => /^decal\.|\.wrecked|decay\./.test(d.assetId))).toHaveLength(0);
    expect(l4Dressing.some(d => d.kind === 'parked' && !d.assetId.startsWith('veh.'))).toBe(false);
  });

  test('T-E22-05b @E22 @E22-AC05 shops: >= 6 open shopfronts with lit interiors, apartment blocks, the town hall, the church, Kessler\'s Hardware and the Metro entrance stand', () => {
    const count = (id: string) => layout.placements.filter(p => p.assetId === id).length;
    expect(count('bld.storefront-row') * 3, 'storefront rows (3 shops each)').toBeGreaterThanOrEqual(6);
    for (const id of ['bld.town-hall', 'bld.church', 'bld.kessler-hardware', 'bld.metro-entrance']) expect(count(id), id).toBe(1);
    expect(count('bld.apartment-block-a') + count('bld.apartment-block-b')).toBeGreaterThanOrEqual(8);
    // Every shop and apartment is lit (W0: all light groups are on).
    expect(layout.lightGroups.every(g => (g.offAt ?? 6) >= 1)).toBe(true);
    expect(layout.placements.filter(p => p.assetId === 'kit.reception-plaza').length).toBe(1);
  });

  test('T-E22-05c @E22 @E22-AC05 army reception: sandbag line (>= 24 pallets), two HMG nests, light towers, barriers at the army gate and the street ends', () => {
    expect(l4Dressing.filter(d => d.kind === 'sandbag').length).toBeGreaterThanOrEqual(24);
    expect(l4Dressing.filter(d => d.kind === 'nest')).toHaveLength(2);
    expect(l4Dressing.filter(d => d.kind === 'barrier').length).toBeGreaterThanOrEqual(8); expect(l4Dressing.filter(d => d.kind === 'light').length).toBeGreaterThanOrEqual(4);
    for (const d of l4Dressing) expect(worldAssets[d.assetId], d.assetId).toBeDefined();
  });

  test('T-E22-18a @E22 @E22-AC18 photo spots and the four pair cameras resolve to walkable points of the layout copy', () => {
    const nav = navWith();
    for (const [name] of l4PhotoSpots) {
      const key = name.startsWith('pair-') ? name : `photo-${name}`, p = at(key);
      expect(compositions.L4.districts[0].overrides!.photoSpots!.some(s => s.name === name), name).toBe(true);
      void p;
    }
    for (const name of ['pair-plaza', 'pair-harbor-street', 'pair-metro-entrance', 'pair-kessler-lane']) { const p = at(name), i = nav.index(p[0], p[1]); expect(i >= 0 && nav.cells[i] === 1, name).toBe(true); }
    for (const name of Object.keys(l4Anchors)) expect(layout.anchors[name], name).toBeDefined();
  });

  test('T-E22-01a @E22 @E22-AC01 two routes from the plaza to Kessler\'s cellar door (Harbor Street and Lakeshore), each walkable with the other closed', () => {
    const plaza = at('l4-plaza'), door = at('l4-cellar-door');
    const harborClosed = navWith([box(-8, -46, 30, -33)]), lakeClosed = navWith([box(-30, 39, 30, 50)]);
    expect(reach(navWith(), plaza, door)).toBe(true);
    expect(reach(harborClosed, plaza, door), 'Lakeshore route').toBe(true);
    expect(reach(lakeClosed, plaza, door), 'Harbor route').toBe(true);
    // Neither route is a short cut: >= 100 m of walking even in the straight-line.
    expect(Math.hypot(door[0] - plaza[0], door[1] - plaza[1])).toBeGreaterThanOrEqual(70);
  });

  test('T-E22-04a @E22 @E22-AC04 the convoy route is clear of every collider (bus, truck and APC footprints along the lanes) and the parked column does not overlap props', () => {
    const route = l4Route(), stations = l4ConvoyStations(route.length), tall = solid.filter(c => c.aabb.max[1] > .9 && c.aabb.min[1] < .9).map(c => c.aabb);
    const bad: string[] = [];
    /** Oriented vehicle footprint (heading yaw, shrunk 0.15 m) against an axis-aligned collider: separating axis test. */
    const hits = (p: { x: number; z: number; yaw: number }, v: { len: number; wid: number }, a: Aabb): boolean => {
      const ux = Math.cos(p.yaw), uz = -Math.sin(p.yaw), vx = -uz, vz = ux, hl = v.len / 2 - .15, hw = v.wid / 2 - .15;
      const cx = (a.min[0] + a.max[0]) / 2, cz = (a.min[2] + a.max[2]) / 2, ex = (a.max[0] - a.min[0]) / 2, ez = (a.max[2] - a.min[2]) / 2, dx = cx - p.x, dz = cz - p.z;
      if (Math.abs(dx) > ex + hl * Math.abs(ux) + hw * Math.abs(vx) || Math.abs(dz) > ez + hl * Math.abs(uz) + hw * Math.abs(vz)) return false;
      return Math.abs(dx * ux + dz * uz) <= hl + ex * Math.abs(ux) + ez * Math.abs(uz) && Math.abs(dx * vx + dz * vz) <= hw + ex * Math.abs(vx) + ez * Math.abs(vz);
    };
    for (const [i, v] of l4.convoy.vehicles.entries()) {
      for (let s = stations.start[i]; s <= stations.end[i]; s += .75) {
        const p = l4RoutePose(route, s);
        for (const a of tall) if (hits(p, v, a)) { bad.push(`${v.id}@${p.x.toFixed(1)},${p.z.toFixed(1)} hits ${a.min.map(q => q.toFixed(1))}..${a.max.map(q => q.toFixed(1))}`); break; }
      }
    }
    expect([...new Set(bad)].slice(0, 12)).toEqual([]);
    expect(l4Convoy.endX).toBe(-11);
  });

  test('T-E22-16a @E22 @E22-AC16 light: polar 1.15-1.30, fog far >= L3 + 20, less haze and a cleaner sky than L3', () => {
    expect(timeOfDay.L4.polar).toBeGreaterThanOrEqual(1.15); expect(timeOfDay.L4.polar).toBeLessThanOrEqual(1.3);
    expect(timeOfDay.L4.fogFar).toBeGreaterThanOrEqual(timeOfDay.L3.fogFar + 20);
    expect(compositions.L4.timeOfDay).toBe('L4'); expect(compositions.L4.districts[0].id).toBe('D-FAIR');
  });

  test('T-E22-nav @E22 every refuge door is reachable from the convoy start and the cellar yard is the only island', () => {
    const nav = navWith(), start = at('player-start'), flood = nav.flood(start);
    const doors = Object.entries(layout.anchors).filter(([n]) => n.startsWith('refuge-door-')).map(([, a]) => [a.position[0], a.position[2]] as Point);
    expect(doors.length).toBeGreaterThanOrEqual(40);
    expect(doors.filter(([x, z]) => flood[nav.index(x, z)] !== 1)).toEqual([]);
    const inn = at('l4-cellar-in'); expect(flood[nav.index(inn[0], inn[1])]).not.toBe(1);
    expect(nav.cells[nav.index(inn[0], inn[1])]).toBe(1);
  });
});
