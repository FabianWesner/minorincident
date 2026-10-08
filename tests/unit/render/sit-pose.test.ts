import { readFileSync } from 'node:fs';
import { Box3, Mesh, Vector3, type Object3D } from 'three';
import { describe, expect, test } from 'vitest';
import physics from '../../../src/data/physicsAssets';
import { sampleClip } from '../../../src/render/characters/clips';
import { createCivilianPlaceholder } from '../../../src/render/npc/placeholders';
import { seatAnchor, seatSpecs } from '../../../src/sim/npc/seats';
import type { DistrictLayout } from '../../../src/levels/districts/types';

/**
 * PO "clipping errors": a seated civilian must sit ON the seat, back near the backrest, feet on the ground in front.
 * The renderer (CivilianCrowd) puts the model root at the seat anchor's x/z and lifts it by `anchor.lift`; this test poses the
 * real rig in `npc-sit` that way for every bench / lawn chair of the L1 and L2 districts, in the seat's own frame (+X = front).
 */
const districts = ['D-GROVE', 'D-RES', 'D-MAIN'];
const seats = districts.flatMap((id) => {
  const layout = JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;
  return layout.placements.filter((p) => p.assetId in seatSpecs).map((p) => ({ id: `${id}/${p.id}`, p }));
});
const limbNames = ['hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'];
/** Axis-aligned bounds of every rig part's meshes, root unrotated at (rootX, lift, 0). */
function limbBoxes(root: Object3D): Map<string, Box3> {
  root.updateMatrixWorld(true);
  const boxes = new Map<string, Box3>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    let part: Object3D | null = node.parent;
    while (part && !limbNames.includes(part.name)) part = part.parent;
    if (!part) return;
    const box = boxes.get(part.name) ?? new Box3(); box.union(new Box3().setFromObject(node)); boxes.set(part.name, box);
  });
  return boxes;
}
const depth = (a: Box3, b: Box3): number => Math.min(a.max.x - b.min.x, b.max.x - a.min.x, a.max.y - b.min.y, b.max.y - a.min.y, a.max.z - b.min.z, b.max.z - a.min.z);

describe('seated civilians (npc-sit)', () => {
  test('layouts contain benches and chairs to sit on', () => {
    expect(seats.filter((s) => s.p.assetId === 'prop.bench').length).toBeGreaterThan(10);
    expect(seats.some((s) => s.id.startsWith('D-GROVE/') && s.p.assetId.startsWith('prop.lawn-chair'))).toBe(true);
  });

  test('@clipping pelvis within 3 cm of the seat anchor, thighs on the seat, feet on the ground, nothing inside the bench', () => {
    const root = createCivilianPlaceholder();
    const failures: string[] = [];
    for (const { id, p } of seats) {
      const anchor = seatAnchor(p.assetId, p.position, p.yaw, p.scale)!, spec = seatSpecs[p.assetId];
      const forward = spec.hipX * p.scale[0], seatTop = p.position[1] + spec.top * p.scale[1];
      const parts = (physics as Record<string, { boxes?: { min: number[]; max: number[] }[] }>)[p.assetId]?.boxes ?? [];
      // seat-local boxes: the bench's authored collision (seat block, plank, backrest); chairs only have one coarse box
      const bench = p.assetId === 'prop.bench' ? parts.map((b) => new Box3(new Vector3(b.min[0] * p.scale[0], b.min[1] * p.scale[1], b.min[2] * p.scale[2]), new Vector3(b.max[0] * p.scale[0], b.max[1] * p.scale[1], b.max[2] * p.scale[2]))) : [];
      for (const t of [0, 1, 2, 3]) {
        sampleClip(root, 'npc-sit', t);
        root.position.set(forward, p.position[1] + anchor.lift, 0); root.updateMatrixWorld(true);
        const hip = root.getObjectByName('hip')!.getWorldPosition(new Vector3());
        const target = new Vector3(forward, anchor.y, 0);
        if (hip.distanceTo(target) > 0.03) failures.push(`${id} t=${t}: pelvis ${hip.distanceTo(target).toFixed(3)} m off the seat anchor`);
        const boxes = limbBoxes(root);
        for (const thigh of ['legL', 'legR']) if (boxes.get(thigh)!.min.y < seatTop - 0.025) failures.push(`${id} t=${t}: ${thigh} ${(seatTop - boxes.get(thigh)!.min.y).toFixed(3)} m below the seat surface`);
        for (const foot of ['footL', 'footR']) if (Math.abs(boxes.get(foot)!.min.y - p.position[1]) > 0.06) failures.push(`${id} t=${t}: ${foot} ${(boxes.get(foot)!.min.y - p.position[1]).toFixed(3)} m off the ground`);
        for (const [name, box] of boxes) for (const solid of bench) if (name !== 'hip' && depth(box, solid) > 0.025) failures.push(`${id} t=${t}: ${name} ${depth(box, solid).toFixed(3)} m inside the bench`);
        // pelvis rests over the seat, not hanging off the front or sunk into the back
        if (p.assetId === 'prop.bench') {
          const back = bench[0], pelvis = boxes.get('hip')!;
          if (depth(pelvis, back) > 0.025) failures.push(`${id} t=${t}: pelvis inside the backrest`);
          const gap = boxes.get('torso')!.min.x - back.max.x;
          if (gap < -0.025 || gap > 0.28) failures.push(`${id} t=${t}: torso ${gap.toFixed(3)} m from the backrest`);
        }
      }
    }
    expect(failures.slice(0, 12)).toEqual([]);
  });
});
