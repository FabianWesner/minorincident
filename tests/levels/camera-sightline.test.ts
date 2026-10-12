import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { cameraFraming } from '../../src/data/cameraFraming';
import { compositions } from '../../src/levels/compositions';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { levelTwoLayouts } from '../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import { levelFourLayouts } from '../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import { levelSevenLayouts } from '../../src/levels/L7/layout';
import { resolveCampaignMission, type MissionId } from '../../src/levels/missions';
import { DistrictWorld } from '../../src/sim/world/DistrictWorld';
import type { ObjectiveDef, ScriptAction } from '../../src/sim/missions/types';

/** PO 10-12 (L5 hide-out behind a 5-storey block): "This isn't a visibility problem. It's a positioning problem." The game camera
 * sits at a fixed offset from the player (View.ts: radius, polar, azimuth pi/4), so any objective spot with a tall building on the
 * camera side is hidden from the player however the building is drawn. For every objective anchor of L1-L6 the segment from
 * that camera position to the anchor must not pass through a static solid taller than TALL_M. */
const TALL_M = 4;
const { radiusM, polar } = cameraFraming;
/** An anchor within this distance of a building's footprint belongs to that building (its door or its interior). */
const INSIDE_M = .2;
const AZIMUTH = Math.PI / 4;
const camOffset = [radiusM * Math.sin(polar) * Math.sin(AZIMUTH), radiusM * Math.cos(polar), radiusM * Math.sin(polar) * Math.cos(AZIMUTH)] as const;
const layoutOf = (id: string): DistrictLayout => JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8'));

/** Slab test of the segment from `a` to `b` against a box. */
function segmentHitsBox(a: readonly number[], b: readonly number[], min: readonly number[], max: readonly number[]): boolean {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-9) { if (a[i] < min[i] || a[i] > max[i]) return false; continue; }
    let u = (min[i] - a[i]) / d, v = (max[i] - a[i]) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}

function worldOf(id: MissionId | 'L7') {
  const composition = compositions[id];
  const layouts = composition.districts.map(d => layoutOf(d.id));
  const tf = id === 'L7' ? levelSevenLayouts(layouts) : id === 'L5' ? levelFiveLayouts(layouts) : id === 'L4' ? levelFourLayouts(layouts) : id === 'L3' ? levelThreeLayouts(layouts) : id === 'L2' ? levelTwoLayouts(layouts, null) : layouts;
  return new DistrictWorld(composition, tf, 1);
}
/** Objective anchors (steps and markers) as [label, x, y, z] in world coordinates. */
function objectiveSpots(id: MissionId, w: DistrictWorld): [string, number, number, number][] {
  const def = resolveCampaignMission(id, w);
  const names = new Set<string>();
  const actions = (list?: ScriptAction[]) => list?.forEach(a => { if (a.kind === 'marker') names.add(a.anchor); });
  for (const s of def.steps as ObjectiveDef[]) { if (s.waypoint !== false) names.add(s.anchor); actions(s.onStart); actions(s.onComplete); }
  return [...names].filter(n => def.anchors[n]).map(n => [`${id}/${n}`, def.anchors[n].x, def.anchors[n].y ?? 0, def.anchors[n].z]);
}
/** Tall buildings at the level's tier (the baked collision of a building is only its ground floor, so the placement's visual box
 * gives the height) plus any static solid taller than TALL_M, whose box the segment crosses. */
function blockers(w: DistrictWorld, x: number, y: number, z: number): string[] {
  // A spot inside (or at the door of) a building is that building's own interior: its roof fade handles it, not the layout.
  const inside = (b: { min: readonly number[]; max: readonly number[] }, o: readonly number[]) => x > b.min[0] + o[0] - INSIDE_M && x < b.max[0] + o[0] + INSIDE_M && z > b.min[2] + o[1] - INSIDE_M && z < b.max[2] + o[1] + INSIDE_M;
  const from = [x, y + .5, z], cam = [x + camOffset[0], y + .5 + camOffset[1], z + camOffset[2]], out: string[] = [];
  for (const d of w.districts) {
    const boxes = d.decay.placements.filter(p => p.assetId.startsWith('bld.') && p.visualAabb.max[1] > TALL_M).map(p => ({ id: p.id, aabb: p.visualAabb }))
      .concat(d.decay.colliders.filter(c => !c.walkable && c.aabb.max[1] > TALL_M));
    for (const c of boxes) {
      const min = [c.aabb.min[0] + d.origin[0], c.aabb.min[1], c.aabb.min[2] + d.origin[1]], max = [c.aabb.max[0] + d.origin[0], c.aabb.max[1], c.aabb.max[2] + d.origin[1]];
      if (inside(c.aabb, d.origin)) continue;
      if (segmentHitsBox(from, cam, min, max)) out.push(c.id.replace(/\/geometry-\d+$/, ''));
    }
  }
  return [...new Set(out)];
}

/** Known offenders, none of them the PO's: the exact blockers must stay as listed (a fix has to remove its entry). */
const known: Record<string, string[]> = {
  // The garage door of L1 stands behind the north-west corner of the 7.5 m house to its east (grazed at 7.4 m of 7.5); moving it rebakes D-GROVE.
  'L1/garage-door': ['bld.house-d:818'],
};

describe('objective anchors are not hidden behind tall buildings (fixed game camera)', () => {
  for (const id of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const) {
    test(id, () => {
      const w = worldOf(id);
      const spots = objectiveSpots(id, w);
      expect(spots.length).toBeGreaterThan(0);
      const bad = spots.map(([n, x, y, z]) => ({ n, hit: blockers(w, x, y, z) })).filter(s => s.hit.length);
      expect(Object.fromEntries(bad.map(b => [b.n, b.hit]))).toEqual(Object.fromEntries(Object.entries(known).filter(([n]) => n.startsWith(`${id}/`))));
    });
  }
});
