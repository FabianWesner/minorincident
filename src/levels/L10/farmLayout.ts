import type { DistrictLayout, Placement, Point } from '../districts/types';
import { worldAssets } from '../../assets/worldDefinitions';
import { Rng } from '../../core/Rng';
import { cure } from './district';
import { cureCrossingLines } from './crossingStories';

/** Farm chapter paths: road and direct objective bearing both retain full-speed mown lanes. */
export const farmLanes: Point[][] = [
  ...cure.regions.slice(0, 2).map(r => r.route),
  [[547, 0], [747, 25]], [[774, 26], [918, 21], [936, -12], [1151, -10], [1228, -10], [1256, 23]],
];
export function farmLaneDistance(x: number, z: number): number {
  let nearest = Infinity;
  for (const line of farmLanes) for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return nearest;
}
function piece(id: string, assetId: string, x: number, z: number, yaw = 0): Placement {
  const d = worldAssets[assetId].dimensions, c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const hx = (d.x * c + d.z * s) / 2, hz = (d.x * s + d.z * c) / 2;
  return { id, assetId, position: [x, 0, z], yaw, scale: [1, 1, 1], minTier: 0, maxTier: 6, decor: true, allowRoad: false, lightGroup: 'decor',
    visualAabb: { min: [x - hx, 0, z - hz], max: [x + hx, d.y, z + hz] } };
}
const overlaps = (a: Placement, b: Placement, pad: number) => a.visualAabb.min[0] < b.visualAabb.max[0] + pad && a.visualAabb.max[0] > b.visualAabb.min[0] - pad && a.visualAabb.min[2] < b.visualAabb.max[2] + pad && a.visualAabb.max[2] > b.visualAabb.min[2] - pad;

/** Deterministic crop blocks and varied farm remnants. Every story composition survives low quality. */
export function cureFarmDecor(placements: readonly Placement[]): Placement[] {
  const out: Placement[] = [], rng = new Rng(1029, 'L10-dead-farm');
  // A ten metre tile has no collider. Whole tiles clear all mown lanes, story anchors, and existing building plots.
  for (let x = 555; x < 1230; x += 10) for (let z = -68; z < 125; z += 10) {
    const distance = farmLaneDistance(x, z);
    if (distance < 8 || distance > 42 || rng.next() < .08) continue;
    const p = piece(`decor-cure-corn-${x}-${z}`, 'veg.corn-block', x, z, rng.next() < .5 ? 0 : Math.PI);
    if (placements.some(q => q.visualAabb.max[1] > .8 && overlaps(p, q, .5))) continue;
    if (Object.values(cure.anchors).some(a => Math.hypot(x - a[0], z - a[1]) < 12)) continue;
    out.push(p);
  }
  // No identical procession: one ruined farm, a broken paddock, a workshop, and scattered carcasses.
  const scenes: [number, number, string[]][] = [
    [578, -24, ['bld.farm-barn-ruin', 'prop.farm-scarecrow', 'prop.farm-carcass']],
    [681, 48, ['bld.farm-house-ruin', 'prop.farm-carcass', 'prop.picket-fence']],
    [789, -37, ['bld.farm-barn-ruin', 'prop.crates', 'prop.farm-scarecrow']],
    [924, 47, ['prop.farm-carcass', 'prop.picket-fence', 'prop.farm-scarecrow']],
    [1092, -39, ['bld.farm-house-ruin', 'prop.farm-carcass', 'prop.crates']],
    [1195, 55, ['bld.farm-barn-ruin', 'prop.picket-fence', 'prop.farm-carcass']],
  ];
  for (const [i, [x, z, assets]] of scenes.entries()) for (const [j, asset] of assets.entries()) {
    let p = piece(`decor-cure-farm-${i}-${j}`, asset, x + (j ? rng.next() * 6 + 6 : 0), z + (j ? rng.next() * 5 - 2 : 0), rng.next() * 2 - 1);
    const fits = (candidate: Placement) => farmLaneDistance(candidate.position[0], candidate.position[2]) >= 12 && !placements.some(q => overlaps(candidate, q, .5)) && !out.some(q => q.assetId !== 'veg.corn-block' && overlaps(candidate, q, .3));
    if (!fits(p) && asset.startsWith('bld.')) {
      for (const [dx, dz] of [[-12, 14], [10, -16], [-22, -14], [18, 12], [0, -30], [0, 30]]) {
        const candidate = piece(p.id, asset, x + dx, z + dz, p.yaw);
        if (fits(candidate)) { p = candidate; break; }
      }
    }
    if (!fits(p)) continue;
    if (asset.startsWith('bld.farm-') && i > 0 && i % 2 === 0) p.decay = 'burned';
    // Roofed ruins retain a clear central doorway through both gable ends.
    for (let k = out.length - 1; k >= 0; k--) if (out[k].assetId === 'veg.corn-block' && overlaps(p, out[k], .4)) out.splice(k, 1);
    out.push(p);
  }
  // A scarecrow punctuates every few blocks, never evenly spaced in a row.
  let serial = 0;
  for (const tile of [...out].filter(p => p.assetId === 'veg.corn-block')) if (rng.next() < .09) {
    out.push(piece(`decor-cure-farm-field-${serial++}`, rng.next() < .65 ? 'prop.farm-scarecrow' : 'prop.farm-carcass', tile.position[0] + rng.next() * 4 - 2, tile.position[2] + rng.next() * 4 - 2, rng.next() * Math.PI * 2));
  }
  for (const [i, asset] of ['prop.farm-tractor', 'prop.farm-combine', 'prop.farm-irrigator'].entries()) {
    const tiles = out.filter(p => p.assetId === 'veg.corn-block').sort((a, b) => Math.abs(a.position[0] - [650, 1020, 1160][i]) - Math.abs(b.position[0] - [650, 1020, 1160][i]));
    for (const tile of tiles) {
      const p = piece(`decor-cure-farm-machine-${i}`, asset, tile.position[0], tile.position[2], rng.next() * .5 - .25);
      if (asset === 'prop.farm-combine') p.decay = 'burned';
      if (farmLaneDistance(p.position[0], p.position[2]) < 17 || placements.some(q => overlaps(p, q, .5)) || out.some(q => q.assetId !== 'veg.corn-block' && overlaps(p, q, .5))) continue;
      for (let k = out.length - 1; k >= 0; k--) if (out[k].assetId === 'veg.corn-block' && overlaps(p, out[k], .3)) out.splice(k, 1);
      out.push(p); break;
    }
  }
  return out;
}

/** Render-only southern field detail for the off-road farm approach shown in the PO's QA capture. */
export function cureSouthernFieldDecor(occupied: readonly Placement[]): Placement[] {
  const out: Placement[] = [];
  for (const [i, [asset, x, z]] of ([
    ['prop.farm-tractor', 870, -100], ['prop.farm-scarecrow', 849, -97], ['prop.picket-fence', 860, -107],
  ] as const).entries()) {
    const remnant = piece(`decor-cure-south-approach-${i}`, asset, x, z, i === 0 ? -.35 : 0);
    if (!occupied.some(p => overlaps(remnant, p, .5))) out.push(remnant);
  }
  // The QA approach bends through the south field at (858,-94); the wider
  // field rows leave a bare wedge there, so continue the crop edge behind it.
  for (let x = 820; x <= 940; x += 14) for (const z of [-88, -112]) {
    const crop = piece(`decor-cure-south-approach-corn-${x}-${z}`, 'veg.corn-block', x, z, x % 2 ? 0 : Math.PI);
    if (occupied.some(p => overlaps(crop, p, .5)) || out.some(p => overlaps(crop, p, .5))) continue;
    out.push(crop);
  }
  for (let x = 820; x <= 1210; x += 30) for (const z of [-145, -125, -105]) {
    const crop = piece(`decor-cure-south-corn-${x}-${z}`, 'veg.corn-block', x, z, (x / 30) % 2 ? 0 : Math.PI);
    if (occupied.some(p => overlaps(crop, p, .5)) || out.some(p => overlaps(crop, p, .5))) continue;
    out.push(crop);
  }
  for (const [i, [asset, x, z]] of ([
    ['prop.farm-carcass', 850, -122], ['prop.farm-scarecrow', 1025, -122], ['prop.crates', 1160, -122],
  ] as const).entries()) {
    const remnant = piece(`decor-cure-south-remnant-${i}`, asset, x, z);
    if (!occupied.some(p => overlaps(remnant, p, .5)) && !out.some(p => overlaps(remnant, p, .5))) out.push(remnant);
  }
  return out;
}

/** Thin, broken crop strips on the two later stretches called out by the route review. */
export function cureRoadsideFarmDecor(occupied: readonly Placement[]): Placement[] {
  const out: Placement[] = [];
  let station = 0;
  const lines = [...cure.regions.map(r => r.route), ...cureCrossingLines.map(r => r.line),
    [cure.anchors['cure-corridor'], cure.anchors['corridor-breach'], cure.anchors['cure-complex']]];
  for (const line of lines) for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    for (let along = 10; along < length; along += 14) {
      const x = a[0] + dx * along / length, z = a[1] + dz * along / length;
      if (!((x >= 1250 && x <= 1750) || (x >= 3050 && x <= 3650))) continue;
      const side = Math.floor((station + along) / 56) % 2 ? -1 : 1;
      for (const [lateral, direction] of [10, 14, 18, 22].flatMap(offset => [[offset, side], [offset, -side]])) {
        const crop = piece(`decor-cure-route-corn-${Math.round(station + along)}`, 'veg.corn-block', x - dz / length * direction * lateral, z + dx / length * direction * lateral, dx > 0 ? 0 : Math.PI);
        if (occupied.some(p => p.visualAabb.max[1] > .8 && overlaps(crop, p, .5)) || out.some(p => overlaps(crop, p, .5))) continue;
        out.push(crop);
        if (out.filter(p => p.assetId === 'veg.corn-block').length % 6 === 0) out.push(piece(`${crop.id}-scarecrow`, 'prop.farm-scarecrow', crop.position[0], crop.position[2]));
        break;
      }
    }
    station += length;
  }
  return out;
}

/** Clear the later vignette pavement, retaining landmarks and moving displaced field details into surviving crops. */
export function clearFarmFromSurfaces(placements: readonly Placement[], surfaces: DistrictLayout['surfaces']): Placement[] {
  const bounds = surfaces.map(s => ({ minX: Math.min(...s.polygon.map(p => p[0])), maxX: Math.max(...s.polygon.map(p => p[0])), minZ: Math.min(...s.polygon.map(p => p[1])), maxZ: Math.max(...s.polygon.map(p => p[1])) }));
  const onPavement = (p: Placement) => bounds.some(b => p.visualAabb.min[0] < b.maxX && p.visualAabb.max[0] > b.minX && p.visualAabb.min[2] < b.maxZ && p.visualAabb.max[2] > b.minZ);
  const out = placements.filter(p => p.assetId !== 'veg.corn-block' || !onPavement(p));
  const crops = out.filter(p => p.assetId === 'veg.corn-block');
  for (const [i, p] of out.entries()) if (p.id.startsWith('decor-cure-farm-field-') && onPavement(p)) {
    let moved = false;
    for (const tile of [...crops].sort((a, b) => Math.hypot(a.position[0] - p.position[0], a.position[2] - p.position[2]) - Math.hypot(b.position[0] - p.position[0], b.position[2] - p.position[2]))) {
      const dx = tile.position[0] - p.position[0], dz = tile.position[2] - p.position[2];
      const candidate: Placement = { ...p, position: [tile.position[0], p.position[1], tile.position[2]], visualAabb: { min: [p.visualAabb.min[0] + dx, p.visualAabb.min[1], p.visualAabb.min[2] + dz], max: [p.visualAabb.max[0] + dx, p.visualAabb.max[1], p.visualAabb.max[2] + dz] } };
      if (onPavement(candidate) || out.some(q => q.id !== p.id && q.assetId !== 'veg.corn-block' && overlaps(candidate, q, .3))) continue;
      out[i] = candidate; moved = true; break;
    }
    if (!moved) throw new Error(`Cannot clear farm detail ${p.id} from the evacuation road`);
  }
  return out;
}

/** L10-only copy: leave the source layouts and the L1–L5 asset palette intact. */
export function applyFarmLandscape(layout: DistrictLayout): void {
  // Re-preparing an assembled layout replaces our generated solids instead of doubling them.
  layout.colliders = layout.colliders.filter(c => !c.id.includes('/farm-wood-') && !c.id.endsWith('/farm-chassis'));
  for (const p of layout.placements) if ((p.id.startsWith('decor-cure-farm-') || p.id.startsWith('l10-find-farm-')) && p.assetId.startsWith('bld.farm-')) {
    const house = p.assetId === 'bld.farm-house-ruin', w = house ? 8 : 7, d = house ? 7 : 8, h = house ? 2.55 : 3.35;
    const opening = house ? 1.8 : 2.8, pier = (w - opening) / 2;
    // Match the rebuilt walls while preserving a traversable north/south escape aisle.
    const boxes = [-1, 1].map(x => ({ x: x * w / 2, z: 0, hx: .12, hz: d / 2, h }));
    boxes.push(...[-1, 1].flatMap(z => [-1, 1].map(x => ({ x: x * (opening + pier) / 2, z: z * d / 2, hx: pier / 2, hz: .12, h }))));
    if (!house) boxes.push(
      { x: 4.3, z: -2.55, hx: .8, hz: .8, h: 4.4 },
      ...[-2.2, -.75].map(z => ({ x: 4.32, z: -z, hx: .55, hz: .55, h: 1.13 })),
      { x: -4.7, z: -2.3, hx: .1, hz: 1.3, h: 1.3 },
    );
    for (const [i, b] of boxes.entries()) {
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw), x = p.position[0] + b.x * c + b.z * s, z = p.position[2] - b.x * s + b.z * c;
      const hx = (Math.abs(c) * b.hx + Math.abs(s) * b.hz) * p.scale[0], hz = (Math.abs(s) * b.hx + Math.abs(c) * b.hz) * p.scale[2];
      const sx = p.position[0] + (x - p.position[0]) * p.scale[0], sz = p.position[2] + (z - p.position[2]) * p.scale[2];
      layout.colliders.push({ id: `${p.id}/farm-wood-${i}`, minTier: 0, maxTier: 6, aabb: { min: [sx - hx, 0, sz - hz], max: [sx + hx, b.h * p.scale[1], sz + hz], navFootprint: { x: sx, z: sz, halfX: b.hx * p.scale[0], halfZ: b.hz * p.scale[2], yaw: p.yaw } } });
    }
  }
  for (const p of layout.placements) if (['prop.farm-tractor', 'prop.farm-combine'].includes(p.assetId)) {
    const hx = p.assetId === 'prop.farm-tractor' ? 1.9 : 2.7, hz = .95, c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw));
    layout.colliders.push({ id: `${p.id}/farm-chassis`, minTier: 0, maxTier: 6, aabb: { min: [p.position[0] - hx * c - hz * s, 0, p.position[2] - hx * s - hz * c], max: [p.position[0] + hx * c + hz * s, 2, p.position[2] + hx * s + hz * c], navFootprint: { x: p.position[0], z: p.position[2], halfX: hx, halfZ: hz, yaw: p.yaw } } });
  }
  layout.placements = layout.placements.map((p, i) => {
    if (!['prop.tree', 'prop.street-tree', 'prop.street-tree-blossom'].includes(p.assetId)) return p;
    const d = worldAssets['prop.tree.dead'].dimensions;
    return { ...p, assetId: 'prop.tree.dead', decay: i % 3 ? undefined : 'burned', scale: [1, 1, 1],
      visualAabb: { min: [p.position[0] - d.x / 2, p.position[1], p.position[2] - d.z / 2], max: [p.position[0] + d.x / 2, p.position[1] + d.y, p.position[2] + d.z / 2] } };
  });
}
