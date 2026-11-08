import { cureEscapeGaps, cureHangar } from '../../data/l10Story';
import { cure } from './district';
import type { DistrictLayout, Placement } from '../districts/types';

/** Gameplay structures and anchors, composed before collision/nav and the separate scenery passes. */
export function levelTenLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return layouts.map(source => {
    if (source.district !== 'D-CURE' || source.placements.some(p => p.id === 'l10-hangar-shell')) return source;
    const layout = structuredClone(source), h = cureHangar;
    for (const [name, [x, z]] of Object.entries(cure.anchors)) layout.anchors[name] = { position: [x, 0, z], yaw: 0 };
    const set = (name: string, p: { x: number; z: number }) => { layout.anchors[name] = { position: [p.x, 0, p.z], yaw: 0 }; };
    set('cure-terminal', h.terminal); set('cure-canister', h.canister);
    set('cure-research-entry', { x: h.centre.x, z: 59 });
    set('river-exit', { x: 647, z: -12.5 });
    const terminal = layout.placements.find(p => p.assetId === 'kit.dispersal-console' && Math.abs(p.position[0] - 2707) < 5);
    const canister = layout.placements.find(p => p.assetId === 'prop.cure-canister-pedestal');
    const keep = new Set([terminal?.id, canister?.id]);
    const removed = new Set(layout.placements.filter(p => !keep.has(p.id) && p.visualAabb.min[0] < h.max.x + 2 && p.visualAabb.max[0] > h.min.x - 2 && p.visualAabb.min[2] < h.max.z + 2 && p.visualAabb.max[2] > h.min.z - 2).map(p => p.id));
    layout.placements = layout.placements.filter(p => !removed.has(p.id));
    layout.buildings = layout.buildings.filter(p => !removed.has(p.id));
    layout.colliders = layout.colliders.filter(p => !removed.has(p.id) && !keep.has(p.id));
    for (const [p, at] of [[terminal, h.terminal], [canister, h.canister]] as const) if (p) {
      const dx = at.x - p.position[0], dz = at.z - p.position[2];
      p.position[0] += dx; p.position[2] += dz;
      for (const end of [p.visualAabb.min, p.visualAabb.max]) { end[0] += dx; end[2] += dz; }
    }
    const place = (id: string, assetId: string, x: number, z: number, half: [number, number, number], yaw = 0, scale: [number, number, number] = [1, 1, 1], decor = false): Placement => {
      const p: Placement = { id, assetId, position: [x, 0, z], yaw, scale, decor, minTier: 0, maxTier: 6, allowRoad: false, lightGroup: 'research', visualAabb: { min: [x - half[0], 0, z - half[2]], max: [x + half[0], half[1] * 2, z + half[2]] } };
      layout.placements.push(p); return p;
    };
    // Existing open vehicle-bay shell provides a roof and steel posts. Reviewed wall boxes leave the interior enterable.
    place('l10-hangar-shell', 'bld.cure-motor-shelter', h.centre.x, h.centre.z, [17.85, 3.65, 13.1], Math.PI / 2, [3, 1.6, 3], true);
    const wall = (id: string, x0: number, z0: number, x1: number, z1: number) => {
      layout.colliders.push({ id, minTier: 0, maxTier: 6, aabb: { min: [x0, 0, z0], max: [x1, 3.2, z1] } });
      const alongZ = z1 - z0 > x1 - x0, length = alongZ ? z1 - z0 : x1 - x0;
      const n = Math.ceil(length / 3.2);
      for (let i = 0; i < n; i++) {
        const x = alongZ ? (x0 + x1) / 2 : x0 + (i + .5) * length / n;
        const z = alongZ ? z0 + (i + .5) * length / n : (z0 + z1) / 2;
        place(`${id}-${i}`, 'prop.cure-mil-fence', x, z, alongZ ? [.15, 1.6, length / n / 2] : [length / n / 2, 1.6, .15], alongZ ? 0 : Math.PI / 2, [1, 1, length / n / 3.2], true);
      }
    };
    wall('l10-hangar-west', h.min.x - .2, h.min.z, h.min.x + .2, h.max.z);
    wall('l10-hangar-east', h.max.x - .2, h.min.z, h.max.x + .2, h.max.z);
    wall('l10-hangar-back', h.min.x, h.max.z - .2, h.max.x, h.max.z + .2);
    wall('l10-hangar-door-west', h.min.x, h.min.z - .2, h.entrance.x - 1, h.min.z + .2);
    wall('l10-hangar-door-east', h.entrance.x + 1, h.min.z - .2, h.max.x, h.min.z + .2);
    place('l10-hangar-generator', 'prop.cure-generator', 2719, 73, [1.2, 1.2, 1]);
    place('l10-hangar-tent', 'prop.cure-iso-tent', 2694, 73, [2.5, 1.7, 2]);
    place('l10-hangar-light', 'prop.emergency-light', 2707, 76, [.4, 1.5, .4]);
    place('l10-dispersal-electric-gate', 'prop.cure-mil-fence', 4002, 1, [6.4, 1.6, .15], Math.PI / 2, [1, 1, 4], true);
    for (const [i, gap] of cureEscapeGaps.entries()) {
      const low = gap.z - 35, high = gap.z + 35;
      wall(`l10-gap-${i}-north`, gap.x - .2, low, gap.x + .2, gap.z - 1);
      wall(`l10-gap-${i}-south`, gap.x - .2, gap.z + 1, gap.x + .2, high);
    }
    return layout;
  });
}
