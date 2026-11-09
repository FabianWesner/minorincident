import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { compositions } from '../../src/levels/compositions';
import { destructionRollout } from '../../src/levels/destructionRollout';
import { levelTwoLayouts } from '../../src/levels/L2/layout';
import { levelOneLayouts } from '../../src/levels/L1/layout';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import { levelFourLayouts } from '../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import { levelTenLayouts } from '../../src/levels/L10/layout';
import { Destruction } from '../../src/sim/destruction/Destruction';

const sourceLayouts = (level: string): DistrictLayout[] => compositions[level].districts.map(({ id }) =>
  JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout);

function layoutsFor(level: string): DistrictLayout[] {
  const layouts = sourceLayouts(level);
  const prepared = level === 'L1' ? levelOneLayouts(layouts)
    : level === 'L2' ? levelTwoLayouts(layouts)
    : level === 'L3' ? levelThreeLayouts(layouts)
      : level === 'L4' ? levelFourLayouts(layouts)
        : level === 'L5' ? levelFiveLayouts(layouts)
          : level === 'L10' ? levelTenLayouts(layouts) : layouts;
  return destructionRollout(prepared, level);
}

const classes = (layouts: DistrictLayout[]) => layouts.flatMap(layout => layout.placements)
  .filter(p => p.destruction && !p.destruction.indestructible)
  .reduce<Record<string, number>>((counts, p) => {
    const key = p.destruction!.class;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

/** Native authored-level counts, hit-shape construction and collision/route invariants for the rollout. */
export function verifyDestructionRollout(): void {
  const counts = Object.fromEntries(['L1', 'L2', 'L3', 'L4', 'L5', 'L9', 'L10'].map(level => [level, classes(layoutsFor(level))]));
  expect(counts.L1.vehicle).toBeGreaterThan(0);
  expect(counts.L2.vehicle).toBeGreaterThan(0);
  expect(counts.L3).toEqual({ timber: 2, vehicle: 2 });
  expect(counts.L4.vehicle).toBeGreaterThan(0);
  expect(counts.L4.timber).toBeGreaterThan(0);
  expect(counts.L5.vehicle).toBeGreaterThan(0);
  expect(counts.L5.timber).toBeGreaterThan(0);
  expect(counts.L9.vehicle).toBeGreaterThan(0);
  expect(counts.L9.timber).toBeGreaterThan(0);
  expect(counts.L9['metal-prop']).toBeGreaterThan(0);
  expect(counts.L10.vehicle).toBeGreaterThan(0);
  expect(counts.L10.timber).toBeGreaterThan(0);
  expect(counts.L10.masonry).toBeGreaterThan(0);
  expect(counts.L10.machinery).toBeGreaterThan(0);
  expect(counts.L10['fuel-tank']).toBeGreaterThan(0);

  for (const level of ['L1', 'L2', 'L4', 'L5']) {
    for (const p of layoutsFor(level).flatMap(layout => layout.placements).filter(p => p.destruction)) {
      expect(p.assetId === 'bld.shed' || /^(veh\.(?:sedan|suv|pickup|wreck)(?:-|$))/.test(p.assetId), `${level} opt-in ${p.id}`).toBe(true);
    }
    if (level === 'L4' || level === 'L5') {
      expect(layoutsFor(level).flatMap(layout => layout.placements).filter(p => p.id.startsWith(`${level.toLowerCase()}-`) && p.destruction), `${level} combat dressing stays intact`).toEqual([]);
    }
  }
  const crossing = layoutsFor('L9').find(layout => layout.district === 'D-CROSSING')!;
  const original = sourceLayouts('L9').find(layout => layout.district === 'D-CROSSING')!;
  expect(crossing.roads).toEqual(original.roads);
  expect(crossing.anchors).toEqual(original.anchors);
  const cure = layoutsFor('L10').find(layout => layout.district === 'D-CURE')!;
  expect(cure.placements.filter(p => p.destruction?.class === 'fuel-tank').every(p => p.position[0] >= 3750)).toBe(true);
  expect(cure.placements.filter(p => p.destruction?.class === 'machinery').every(p => p.position[0] >= 3750)).toBe(true);
  expect(cure.placements.some(p => p.assetId === 'kit.dispersal-console' && p.destruction)).toBe(false);

  for (const level of ['L9', 'L10']) {
    const layouts = layoutsFor(level);
    const fakeWorld = {
      districts: { districts: layouts.map(layout => ({ id: layout.district, origin: [0, 0], decay: { placements: layout.placements } })), nav: { block() {}, unblock() {} } },
      physics: { addStatic: () => 1, removeBlocker() {} }, interactables: { walls: [] }, events: { emit() {} }, tick: 0,
    };
    const live = new Destruction(fakeWorld as never);
    const byClass = live.objects.filter(o => !o.protected).reduce<Record<string, number>>((result, object) => {
      const key = object.placement.destruction!.class;
      result[key] = (result[key] ?? 0) + 1;
      return result;
    }, {});
    expect(byClass.vehicle, `${level} live vehicles`).toBeGreaterThan(0);
    if (level === 'L9') {
      expect(byClass.timber).toBeGreaterThan(0);
      expect(byClass['metal-prop']).toBeGreaterThan(0);
    } else {
      expect(byClass.timber).toBeGreaterThan(0);
      expect(byClass.masonry).toBeGreaterThan(0);
      expect(byClass.machinery).toBeGreaterThan(0);
      expect(byClass['fuel-tank']).toBeGreaterThan(0);
    }
    expect(live.objects.filter(o => !o.protected && o.placement.destruction!.class !== 'vehicle' && !o.query.length).map(o => o.id), `${level} targets need live hit geometry`).toEqual([]);
  }
}
