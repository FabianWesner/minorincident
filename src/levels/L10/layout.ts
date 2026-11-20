import { finale } from '../../data/l10Finale';
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
    for (const [p, at, halfX, halfZ] of [[terminal, h.terminal, .8075, 1.65], [canister, h.canister, .7, .7]] as const) if (p) {
      // Anchors are the courier's standing positions on +X, outside the solid desk/plinth.
      p.position[0] = at.x - 2; p.position[2] = at.z; p.yaw = 0;
      p.visualAabb.min[0] = p.position[0] - halfX; p.visualAabb.max[0] = p.position[0] + halfX;
      p.visualAabb.min[2] = at.z - halfZ; p.visualAabb.max[2] = at.z + halfZ;
    }
    const place = (id: string, assetId: string, x: number, z: number, half: [number, number, number], yaw = 0, scale: [number, number, number] = [1, 1, 1], decor = false): Placement => {
      const p: Placement = { id, assetId, position: [x, 0, z], yaw, scale, decor, minTier: 0, maxTier: 6, allowRoad: false, lightGroup: 'research', visualAabb: { min: [x - half[0], 0, z - half[2]], max: [x + half[0], half[1] * 2, z + half[2]] } };
      layout.placements.push(p); return p;
    };
    const service = finale.serviceEntry.at, console = cure.anchors['cure-console'];
    layout.lightGroups.push({ id: 'l10-service', offAt: 6 });
    const serviceDoor = place('kit.zoo-tunnel-mouth:l10-service', 'kit.zoo-tunnel-mouth', console[0] + service[0], console[1] + service[1], [4.5, 3, 3], Math.PI);
    serviceDoor.lightGroup = 'l10-service';
    serviceDoor.decorLights = true;
    // Existing open vehicle-bay shell provides a roof and steel posts. Reviewed wall boxes leave the interior enterable.
    const shell = place('l10-hangar-shell', 'bld.cure-motor-shelter', h.centre.x, h.centre.z, [17.85, 3.65, 13.1], Math.PI / 2, [3, 1.6, 3], true);
    shell.position[1] = -.256; // The scaled shelter pad ends at the existing ground floor, under the cast's feet.
    const wall = (id: string, x0: number, z0: number, x1: number, z1: number) => {
      const sealed = id.startsWith('l10-hangar'), height = sealed ? 6.9 : 2.48;
      layout.colliders.push({ id, minTier: 0, maxTier: 6, aabb: { min: [x0, 0, z0], max: [x1, height, z1] } });
      const alongZ = z1 - z0 > x1 - x0, length = alongZ ? z1 - z0 : x1 - x0;
      const n = Math.ceil(length / 3.2);
      for (let i = 0; i < n; i++) {
        const x = alongZ ? (x0 + x1) / 2 : x0 + (i + .5) * length / n;
        const z = alongZ ? z0 + (i + .5) * length / n : (z0 + z1) / 2;
        // Both authored panels run along local X. Quarantine sheeting seals the research hall up to its roof.
        place(`${id}-${i}`, sealed ? 'prop.cure-quarantine-fence' : 'prop.cure-mil-fence', x, z,
          alongZ ? [.21, height / 2, length / n / 2] : [length / n / 2, height / 2, .21], alongZ ? Math.PI / 2 : 0,
          [length / n / (sealed ? 3.18 : 3.34), sealed ? height / 2.1 : 1, sealed ? .4 / .9 : 1], true);
      }
    };
    wall('l10-hangar-west', h.min.x - .2, h.min.z, h.min.x + .2, h.max.z);
    wall('l10-hangar-east', h.max.x - .2, h.min.z, h.max.x + .2, h.max.z);
    wall('l10-hangar-back', h.min.x, h.max.z - .2, h.max.x, h.max.z + .2);
    // A narrow opening admits the courier but can pinch the corgi's long
    // capsule when it turns through the threshold. Keep a 4 m clear bay.
    wall('l10-hangar-door-west', h.min.x, h.min.z - .2, h.entrance.x - 2, h.min.z + .2);
    wall('l10-hangar-door-east', h.entrance.x + 2, h.min.z - .2, h.max.x, h.min.z + .2);
    place('l10-hangar-generator', 'prop.cure-generator', 2719, 73, [1.2, 1.2, 1]);
    place('l10-hangar-tent', 'prop.cure-iso-tent', 2694, 73, [2.5, 1.7, 2]);
    place('l10-hangar-light', 'prop.emergency-light', 2707, 76, [.4, 1.5, .4]);
    // Finds belong to visible, open buildings beside the walking line. The farm
    // shells receive their post/sill collision in applyFarmLandscape.
    place('l10-find-farm-house', 'bld.farm-house-ruin', 705, 38, [4, 1.4, 3.5], 0, [1, 1, 1], true);
    place('l10-find-farm-barn', 'bld.farm-barn-ruin', 944, -26, [5, 2.1, 4], 0, [1, 1, 1], true);
    place('l10-find-farm-shed', 'bld.farm-barn-ruin', 1170, -26, [5, 2.1, 4], 0, [.7, .7, .7], true);
    place('l10-find-farm-workshop', 'bld.farm-house-ruin', 1407, 32, [4, 1.4, 3.5], 0, [1, 1, 1], true);
    // The camera approaches from +X/+Z. Graves sit beyond the east eave and
    // beside the silo, visible even while the roof remains intact.
    for (let i = 0; i < 3; i++) place(`l10-barn-grave-${i}`, 'prop.l10-grave-cross', 951, -29 + i * 3, [.4, .6, .5], 0, [1, 1, 1], true);
    const tower = place('l10-find-guard-tower', 'kit.guard-tower', 1965, 16, [1.54, 2.45, 1.4], 0, [1, 1, 1], true);
    tower.decorSolid = true;
    place('l10-find-checkpoint-locker', 'prop.crates', 2080, 3, [1, 1, .6], 0, [1, 1, 1], true);
    for (const [i, [x, z]] of [[3395, 64], [3550, 15]].entries()) {
      for (const [j, asset] of ['prop.crates', 'prop.l10-corpse-side', 'prop.l10-shovel'].entries()) {
        const p = place(`l10-pace-vignette-corridor-${i}-${j}`, asset, x + j * 1.4, z - j, [1, .5, .5], 0, [1, 1, 1], true);
        p.fixed = true;
      }
    }
    // The six dispersal beats sit beside the playable corridor. These use the
    // ordinary district placement/LOD pipeline so both tiers load them before
    // they enter view; encounter cohorts are authored separately in encounters.ts.
    const beat = (id: string, asset: string, x: number, z: number, half: [number, number, number], yaw = 0, scale: [number, number, number] = [1, 1, 1]) => {
      // Move each landmark with its encounter onto the measured objective
      // crossing. The old R6 road is 60–80 m away from the skilled route.
      const offset = id.startsWith('gate-') ? [20, -79] : id.startsWith('billboard-') ? [16, -62] : id.startsWith('hospital-') ? [-18, -58] : [0, 0];
      x += offset[0]; z += offset[1];
      const p = place(`l10-setpiece-${id}`, asset, x, z, half, yaw, scale, true);
      p.fixed = true;
      return p;
    };
    // Gate warning: wire, sandbag approach, empty tower and an abandoned bus.
    beat('gate-gantry', 'prop.l10-quarantine-gantry', 2990, 95, [.4, 2.45, 4.48], 0, [1, .7, .7]);
    for (const z of [93.25, 96.75]) beat(`gate-effigy-${z}`, 'prop.l10-warning-effigy', 2990, z, [.46, 1.86, .39], 0, [.7, .7, .7]);
    for (const z of [86, 104]) beat(`gate-wire-${z}`, 'prop.cure-mil-fence', 2994, z, [3.3, 1.4, .22], Math.PI / 2);
    beat('gate-sandbags', 'prop.sandbag-pallet', 2982, 99, [1.4, .7, .8]);
    beat('gate-tower', 'kit.guard-tower', 2995, 107, [1.6, 2.5, 1.5]);
    beat('gate-bus', 'veh.evac-bus', 2950, 126, [5, 1.6, 1.5], Math.PI / 2);
    // An abandoned public information board beside the objective crossing.
    beat('billboard-frame', 'prop.l10-cure-billboard', 3066, 92, [.4, 2.9, 3.8]);
    beat('billboard-wreck', 'prop.l10-abandoned-sedan-blue', 3072, 124, [2.5, .8, 1.1], Math.PI / 2);
    // The hazmat effigies use the retained TRELLIS source; the nearby cohort is separately admitted.
    for (let i = 0; i < 7; i++) beat(`scarecrow-${i}`, 'prop.l10-hazmat-scarecrow', 3170 + i * 7, 56 + (i % 2) * 2, [.7, 1.3, .6], i % 2 ? .16 : -.12);
    // Wrecked military vehicles and sandbag islands create a broad fight lane.
    for (const [id, x, z, yaw] of [['a', 3240, 60, -.35], ['b', 3280, 125, Math.PI + .28]] as const) {
      const truck = beat(`convoy-truck-${id}`, 'veh.military-truck', x, z, [3.8, 1.5, 1.5], yaw);
      truck.decay = 'wrecked';
      truck.fieldLight = 'wreckfire';
    }
    beat('convoy-cover-a', 'prop.sandbag-pallet', 3238, 103, [1.4, .7, .8]);
    beat('convoy-cover-b', 'prop.sandbag-pallet', 3285, 69, [1.4, .7, .8], Math.PI / 2);
    // Open-ended overpass spans the measured crossing, with lights at its sides.
    beat('underpass-mouth', 'prop.l10-underpass', 3383, 74, [6, 3.2, 7]);
    // Four independent pier footprints leave the full centre passage open to
    // navigation and physics; the overhead deck is not a ground-level wall.
    for (const x of [3378.2, 3387.8]) for (const z of [67.3, 80.7]) {
      layout.colliders.push({ id: `l10-underpass-pier-${x}-${z}`, minTier: 0, maxTier: 6,
        aabb: { min: [x - .5, 0, z - .4], max: [x + .5, 4.9, z + .4] } });
    }
    layout.lightGroups.push({ id: 'l10-underpass', offAt: 6 });
    for (const z of [67, 81]) {
      const lamp = beat(`underpass-lamp-${z}`, 'prop.emergency-light', 3383, z, [.4, 1.5, .4]);
      lamp.lightGroup = 'l10-underpass';
      lamp.decorLights = true;
    }
    // Field triage on the final approach: quarantine tents and a marked transport.
    for (const [i, x] of [3508, 3526, 3546].entries()) beat(`hospital-tent-${i}`, 'prop.l10-field-tent', x, i === 1 ? 89 : 83, [2.2, 1.6, 3.4], i % 2 ? Math.PI : 0);
    beat('hospital-truck', 'veh.ambulance', 3538, 98, [1.5, 1.7, 3.4], Math.PI / 2);
    beat('hospital-supplies', 'prop.medical-cooler', 3531, 91, [.5, .5, .5]);
    beat('hospital-stretcher-a', 'prop.l10-field-stretcher', 3504, 90, [1.1, .85, .65], .2);
    beat('hospital-stretcher-b', 'prop.l10-field-stretcher', 3521, 91, [1.1, .85, .65], -.15);
    place('l10-dispersal-electric-gate', 'prop.cure-mil-fence', 4002, 1, [6.4, 1.24, .21], 0, [12.8 / 3.34, 1, 1], true);
    for (const [i, gap] of cureEscapeGaps.entries()) {
      const low = gap.z - 35, high = gap.z + 35;
      wall(`l10-gap-${i}-north`, gap.x - .2, low, gap.x + .2, gap.z - 1);
      wall(`l10-gap-${i}-south`, gap.x - .2, gap.z + 1, gap.x + .2, high);
    }
    return layout;
  });
}
