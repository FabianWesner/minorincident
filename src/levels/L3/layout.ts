import { findClearSpot, firstOverlap, footprints, obstaclesOf, resolveOverlaps, type Footprint } from '../placementClearance';
import type { DistrictLayout, Placement } from '../districts/types';

/** L3-only dressing/parking edits feed both collision and rendering from the same layout. */
export function levelThreeLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return structuredClone(layouts).map(layout => {
    layout.anchors.arrival.position = [0, 0, -20];
    const moved = new Set<string>();
    for (const p of layout.placements) if (p.assetId === 'veh.wreck') {
      // Keep the abandoned cars, but leave the whole 5 m road open for a long chassis.
      p.position[0] = p.position[0] < 0 ? -8 : 8;
      if (Math.abs(p.position[2]) < 8) p.position[2] = p.position[2] < 0 ? -8 : 8;
      moved.add(p.id);
    }
    for (const p of layout.placements) if (['prop.fire-hydrant', 'prop.street-sign'].includes(p.assetId) && Math.abs(p.position[0]) < 4 && Math.abs(p.position[2]) < 4) {
      // Keep corner furniture outside the sedan's swept chassis while turning.
      p.position[0] = Math.sign(p.position[0])*8; p.position[2] = Math.sign(p.position[2])*8; moved.add(p.id);
    }
    for (const p of layout.placements) if (p.assetId === 'prop.street-lamp' && Math.abs(p.position[0]) <= 5 && Math.abs(p.position[2]) <= 4) {
      p.position[0] = Math.sign(p.position[0])*10; moved.add(p.id);
    }
    // Same placement rule as L2: an addition never cuts into a fence, building, lamp, pump or other prop; it moves to the
    // nearest clear spot (cars slide along their own axis first, so they stop against the obstacle instead of through it).
    // A fence run never ends inside a building: panels that cut into one are dropped (the fence simply stops at the wall).
    const walls = layout.placements.filter(p => p.assetId.startsWith('bld.') && p.minTier <= 2 && p.maxTier >= 2).flatMap(p => footprints(p));
    const through = new Set(layout.placements.filter(p => /fence/.test(p.assetId) && firstOverlap(p, walls, .35) !== undefined).map(p => p.id));
    layout.placements = layout.placements.filter(p => !through.has(p.id));
    layout.colliders = layout.colliders.filter(c => !through.has(c.id.split('/')[0]));
    // The rewrites above and the inherited layout can leave a car on a bench or a lamp in a tree: nudge loose pieces clear first.
    for (const id of resolveOverlaps(layout, 2, p => p.assetId.startsWith('veh.') || p.assetId.startsWith('prop.') && !/fence|hedge|flower|bush|tent|bus-stop|gate/.test(p.assetId))) moved.add(id);
    const obstacles: Footprint[] = obstaclesOf(layout, 2);
    const add = (assetId: string, x: number, z: number, yaw = 0): void => {
      const p: Placement = { id: `l3-${layout.placements.length}`, assetId, position: [x, 0, z], yaw, scale: [1, 1, 1], minTier: 2, maxTier: 2, allowRoad: true, lightGroup: 'l3-emergency', visualAabb: { min: [x-.5, 0, z-.5], max: [x+.5, 1, z+.5] } };
      if (assetId.startsWith('decal.')) { p.position[1] = .06; p.scale = [1.6, 1, 2.8]; }
      if (footprints(p, 0, true).length) {
        const spot = findClearSpot(layout, p, obstacles, { slide: assetId.startsWith('veh.'), maxRadius: 8 });
        if (!spot) throw new Error(`No clear spot for ${p.id} (${assetId}) near ${x}, ${z}`);
        p.position = [spot[0], 0, spot[1]]; p.visualAabb = { min: [spot[0]-.5, 0, spot[1]-.5], max: [spot[0]+.5, 1, spot[1]+.5] };
        obstacles.push(...footprints(p, 0, true));
      }
      layout.placements.push(p);
    };
    layout.lightGroups.push({ id: 'l3-emergency', offAt: 3 });
    if (layout.district === 'D-MAIN') for (let i = 0; i < 4; i++) {
      add('prop.traffic-cone', 5.5, 14-i*5); add('prop.barricade', -11, 17-i*3, Math.PI/2);
      add('prop.trash-bags', 7, 17-i*6); add('decal.blood-trail', -1.5, 15-i*4, Math.PI/2);
    }
    if (layout.district === 'D-SHOP') { add('prop.barricade', -5, -2, Math.PI/2); add('veh.police-sedan', -8, -2, Math.PI/2); }
    if (layout.district === 'D-CIVIC') {
      for (let i = 0; i < 4; i++) add('prop.picket-fence', 4+i*4, 24);
      for (const x of [2, 18]) for (const z of [14, 18, 22]) add('prop.picket-fence', x, z, Math.PI/2);
      for (const x of [2, 10, 14, 18]) add('prop.picket-fence', x, 10);
      for (let i = 0; i < 4; i++) add('prop.traffic-cone', -2, -9+i*3);
      add('prop.barricade', -2, -10, Math.PI/2); add('prop.barricade', -2, 2, Math.PI/2);
      add('prop.medical-cooler', 7, 14); add('prop.bench', 10, 19);
      add('prop.trash-bags', 5, 20); add('decal.blood-trail', 6, 15);
      add('npc.police-officer', 6, 10); add('npc.paramedic', 8, 13);
      add('prop.street-lamp', 3, 20); add('prop.street-lamp', 17, 20);
      add('kit.evac-camp', 10, 16);
    }
    layout.colliders = layout.colliders.filter(c => !moved.has(c.id));
    return layout;
  });
}
