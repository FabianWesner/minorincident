import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import type { Aabb, DistrictLayout, Placement } from '../../../src/levels/districts/types';

/**
 * PO "clipping errors": no two hard static props (fences, planters, benches, lamps, walls, buildings) may interpenetrate.
 * Bounds are the baked collision boxes of each placement; assets without collision boxes (planters, sprinklers...) use their
 * visual AABB. Foliage (trees, bushes, hedges, flowers) is soft and ignored; flat ground decals are ignored.
 * Covers every district of L1 and L2.
 */
const TOLERANCE = 0.08; // m of penetration on the smaller horizontal axis
const FOLIAGE = /^prop\.(street-tree|tree|garden-bush|hedge|flower$|flower-patch|carpet)/;
const FENCE = /^prop\.(privacy|picket)-fence$/;
/** Intended overlaps: a sprinkler sits in its kiddie pool. Fence runs join at corners/T-junctions (<= one fence thickness). */
const ALLOWED_PAIRS = [['prop.kiddie-pool', 'prop.sprinkler']];
const FENCE_JOIN = 0.3;

const levels = ['L1', 'L2'] as const;
const districts = [...new Set(levels.flatMap((l) => compositions[l].districts.map((d) => d.id)))];

function bounds(layout: DistrictLayout, placements: Placement[]): Map<string, Aabb[]> {
  const solid = placementColliders(placements, layout.colliders).filter((c) => !c.walkable);
  const byPlacement = new Map<string, Aabb[]>();
  for (const p of placements) {
    const own = solid.filter((c) => c.id === p.id || c.id.startsWith(`${p.id}/`)).map((c) => c.aabb);
    byPlacement.set(p.id, own.length ? own : [p.visualAabb]);
  }
  return byPlacement;
}

export function findClipping(layout: DistrictLayout): string[] {
  const placements = layout.placements.filter((p) => !p.assetId.startsWith('veh.') && !FOLIAGE.test(p.assetId) && p.visualAabb.max[1] > 0.1);
  const box = bounds(layout, placements);
  const hits: string[] = [];
  for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++) {
    const a = placements[i], b = placements[j];
    if (ALLOWED_PAIRS.some(([x, y]) => (a.assetId === x && b.assetId === y) || (a.assetId === y && b.assetId === x))) continue;
    let worst: [number, number] | null = null;
    for (const A of box.get(a.id)!) for (const B of box.get(b.id)!) {
      const dx = Math.min(A.max[0], B.max[0]) - Math.max(A.min[0], B.min[0]);
      const dz = Math.min(A.max[2], B.max[2]) - Math.max(A.min[2], B.min[2]);
      const dy = Math.min(A.max[1], B.max[1]) - Math.max(A.min[1], B.min[1]);
      if (dy > 0.05 && Math.min(dx, dz) > TOLERANCE && (!worst || Math.min(dx, dz) > Math.min(...worst))) worst = [dx, dz];
    }
    if (!worst) continue;
    if (FENCE.test(a.assetId) && FENCE.test(b.assetId) && Math.min(...worst) <= FENCE_JOIN) continue;
    hits.push(`${a.id} / ${b.id} (${worst[0].toFixed(2)} x ${worst[1].toFixed(2)}) near ${a.position[0].toFixed(1)},${a.position[2].toFixed(1)}`);
  }
  return hits;
}

describe('layout clipping guard (L1 + L2)', () => {
  for (const id of districts) {
    test(`@clipping ${id}: no hard static props interpenetrate`, () => {
      const layout = JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;
      expect(findClipping(layout)).toEqual([]);
    });
  }
});

/**
 * Scene Lab QA sweep (specs/scenes/qa-grove-clipping-all.json): small contacts the 8 cm guard above lets through. The visual
 * boxes of these pairs must not overlap at all: flowerbeds against the picket fence and mailboxes, the edge roadwork kit
 * against the perimeter fence, clutter and lamps against privacy fences.
 */
describe('layout small contacts (Scene Lab qa-grove-clipping-all)', () => {
  const pairs: [RegExp, RegExp][] = [
    [/^prop\.flower-bed\.large$/, /^prop\.(picket-fence|mailbox-blue)$/], [/^kit\.edge-roadwork$/, /^prop\.privacy-fence$/],
    [/^prop\.(carpet|crates|hose-reel|street-lamp)$/, /^prop\.privacy-fence$/],
  ];
  test('@clipping D-GROVE visual boxes of the listed pairs do not overlap', () => {
    const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
    const hits: string[] = [];
    for (const a of layout.placements) for (const b of layout.placements) {
      if (a === b || !pairs.some(([x, y]) => x.test(a.assetId) && y.test(b.assetId))) continue;
      const dx = Math.min(a.visualAabb.max[0], b.visualAabb.max[0]) - Math.max(a.visualAabb.min[0], b.visualAabb.min[0]);
      const dz = Math.min(a.visualAabb.max[2], b.visualAabb.max[2]) - Math.max(a.visualAabb.min[2], b.visualAabb.min[2]);
      if (dx > 0.002 && dz > 0.002) hits.push(`${a.id} / ${b.id} (${dx.toFixed(2)} x ${dz.toFixed(2)})`);
    }
    expect(hits).toEqual([]);
  });
});
