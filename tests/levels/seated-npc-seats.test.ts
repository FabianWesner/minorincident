import { afterEach, expect, test } from 'vitest';
import { Object3D } from 'three/webgpu';
import { loadLevel } from '../../tools/sim-runner/levels';
import { missionIds } from '../../src/levels/missions';
import { worldAssets } from '../../src/assets/worldDefinitions';
import { staticCollision } from '../../src/assets/staticCollision';
import { DistrictView } from '../../src/render/DistrictView';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { Placement } from '../../src/levels/districts/types';

/** PO #112 (L2 "These people sit there without a bank"): every seated NPC sits on a seat prop that is drawn whenever
 * the sitter is. The apron benches of Fire Station 3 sat inside the station's LOD0 bounds, so the interior cull hid them
 * while the courier stood outside the station, leaving four civilians sitting in the air. Scans every level's start. */
const seatAssets = /^prop\.(bench|cafe-patio-set|garden-set|lawn-chair-[ab]|folding-chair|chair.*|stool.*)$/;
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
type Seated = { id: number; seat: { x: number; z: number } };
const local = (p: Placement, origin: [number, number], x: number, z: number) => {
  const dx = x - p.position[0] - origin[0], dz = z - p.position[2] - origin[1], c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return { x: (dx * c - dz * s) / p.scale[0], z: (dx * s + dz * c) / p.scale[2] };
};
const ref = (p: Placement) => { const o = new Object3D(); o.position.set(...p.position as [number, number, number]); o.rotation.y = p.yaw; o.scale.set(...p.scale as [number, number, number]); o.updateMatrix(); return o; };

for (const level of missionIds) test(`T-PO112-${level} @PO112 every seated NPC in ${level} has a drawn seat prop under it`, async () => {
  world = await loadLevel(level, 1);
  for (let i = 0; i < 30; i++) world.update();
  const seated: Seated[] = [];
  for (const e of world.entities.iterate()) for (const a of e.civilian?.schedule ?? []) if (a.activity === 'sit' && a.seat) seated.push({ id: e.id, seat: a.seat });
  const districts = world.districts!.districts;
  for (const { id, seat } of seated) {
    // (1) A seat placement under the seat point (within its footprint plus a hand).
    let found: { p: Placement; d: typeof districts[number] } | undefined;
    for (const d of districts) for (const p of d.decay.placements) if (seatAssets.test(p.assetId) && worldAssets[p.assetId]) {
      const size = worldAssets[p.assetId].dimensions, q = local(p, d.origin, seat.x, seat.z);
      if (Math.abs(q.x) <= size.x / 2 + .5 && Math.abs(q.z) <= size.z / 2 + .5) { found = { p, d }; break; }
    }
    expect(found, `${level} sitter ${id} at ${seat.x.toFixed(2)}, ${seat.z.toFixed(2)} has no seat prop`).toBeDefined();
    if (!found) continue;
    // (2) The seat is not culled as a building interior unless the sitter is inside that building's walls too.
    const { p, d } = found, buildings = d.decay.placements.filter(b => /^bld\./.test(b.assetId) && worldAssets[b.assetId]?.category === 'building'
      && Math.hypot(b.position[0] - p.position[0], b.position[2] - p.position[2]) < 40);
    const batches = buildings.map(b => ({ id: b.assetId, refs: [ref(b)], origin: d.origin, foot: { cx: 0, cz: 0, hx: worldAssets[b.assetId].dimensions.x / 2, hz: worldAssets[b.assetId].dimensions.z / 2 }, height: worldAssets[b.assetId].dimensions.y }));
    const seatRef = ref(p), size = worldAssets[p.assetId].dimensions;
    const district = Object.assign(Object.create(DistrictView.prototype), { interiorBuildings: [], lodBatches: [...batches, { id: p.assetId, refs: [seatRef], origin: d.origin, foot: { cx: 0, cz: 0, hx: size.x / 2, hz: size.z / 2 }, height: size.y }], dressingEntries: [] });
    (district as { tagInteriors(): void }).tagInteriors();
    const owner = seatRef.userData.interiorBuilding as Object3D | undefined;
    if (!owner) continue;
    const building = buildings[batches.findIndex(b => b.refs[0] === owner)];
    const walls = (staticCollision[building.assetId]?.boxes ?? []).filter(b => b.max[1] - b.min[1] >= 2);
    if (!walls.length) continue;
    const q = local(building, d.origin, seat.x, seat.z);
    const inside = q.x > Math.min(...walls.map(b => b.min[0])) && q.x < Math.max(...walls.map(b => b.max[0])) && q.z > Math.min(...walls.map(b => b.min[2])) && q.z < Math.max(...walls.map(b => b.max[2]));
    expect(inside, `${level} sitter ${id}: seat ${p.id} is culled as the interior of ${building.id} although the sitter is outside its walls`).toBe(true);
  }
  console.log(`${level}: ${seated.length} seated NPCs checked`);
}, 300_000);
