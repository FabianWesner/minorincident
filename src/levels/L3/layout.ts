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
    const add = (assetId: string, x: number, z: number, yaw = 0): void => {
      const p: Placement = { id: `l3-${layout.placements.length}`, assetId, position: [x, 0, z], yaw, scale: [1, 1, 1], minTier: 2, maxTier: 2, allowRoad: true, lightGroup: 'l3-emergency', visualAabb: { min: [x-.5, 0, z-.5], max: [x+.5, 1, z+.5] } };
      if (assetId.startsWith('decal.')) { p.position[1] = .06; p.scale = [1.6, 1, 2.8]; }
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
