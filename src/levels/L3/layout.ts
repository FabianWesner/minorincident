import type { DistrictLayout, Placement } from '../districts/types';

/** L3-only dressing/parking edits feed both collision and rendering from the same layout. */
export function levelThreeLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return structuredClone(layouts).map(layout => {
    const moved = new Set<string>();
    for (const p of layout.placements) if (p.assetId === 'veh.wreck') {
      // Keep the abandoned cars, but leave the whole 5 m road open for a long chassis.
      p.position[0] = p.position[0] < 0 ? -8 : 8; moved.add(p.id);
    }
    const add = (assetId: string, x: number, z: number, yaw = 0): void => {
      const p: Placement = { id: `l3-${layout.placements.length}`, assetId, position: [x, 0, z], yaw, scale: [1, 1, 1], minTier: 2, maxTier: 2, allowRoad: true, lightGroup: '', visualAabb: { min: [x-.5, 0, z-.5], max: [x+.5, 1, z+.5] } };
      layout.placements.push(p);
    };
    if (layout.district === 'D-MAIN') for (let i = 0; i < 4; i++) {
      add('prop.traffic-cone', 5.5, 14-i*5); add('prop.barricade', -6, 11-i*5, Math.PI/2);
      add('prop.trash-bags', 7, 17-i*6); add('decal.blood-trail', -5, 15-i*4, Math.PI/2);
    }
    if (layout.district === 'D-SHOP') { add('prop.barricade', -5, -2, Math.PI/2); add('veh.police-sedan', -8, -2, Math.PI/2); }
    if (layout.district === 'D-CIVIC') {
      for (let i = 0; i < 4; i++) { add('prop.picket-fence', -7+i*4, 23); add('prop.traffic-cone', -2, -9+i*3); }
      add('prop.barricade', -2, -4, Math.PI/2);
      add('prop.medical-cooler', -11, 19); add('prop.bench', -10, 21);
      add('prop.trash-bags', -17, 20); add('decal.blood-trail', -12, 20);
      add('npc.police-officer', -11, 17);
      add('kit.evac-camp', 10, 16); add('npc.paramedic', -12, 18);
    }
    layout.colliders = layout.colliders.filter(c => !moved.has(c.id));
    return layout;
  });
}
