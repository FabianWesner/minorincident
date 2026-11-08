import { worldAssets } from '../../assets/worldDefinitions';
import { l8BossArenas } from '../../data/l8Bosses';
import type { DistrictLayout, Placement } from '../districts/types';
/** Encounter cover is installed before physics/destruction assembly, with the same stable IDs on both tiers. */
export function levelEightLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return structuredClone(layouts).map(layout => {
    if (layout.district !== 'D-ZOO' || layout.placements.some(p => p.id === 'l8-gorilla-pillar-0')) return layout;
    for (const a of l8BossArenas) layout.anchors[`arena-${a.id}`] = { position: [a.entry.x, 0, a.entry.z], yaw: 0 };
    layout.anchors['animal-monkey'] = { position: [-5, 0, 15], yaw: 0 };
    const house = layout.buildings.find(b => b.assetId === 'bld.reptile-house'); if (house) house.label = 'Primate House';
    const add = (id: string, assetId: string, x: number, z: number, scale: [number, number, number] = [1, 1, 1], yaw = 0, destruction?: Placement['destruction'], y = 0) => {
      const dim = worldAssets[assetId].dimensions;
      const hx = (Math.abs(Math.cos(yaw)) * dim.x * scale[0] + Math.abs(Math.sin(yaw)) * dim.z * scale[2]) / 2;
      const hz = (Math.abs(Math.sin(yaw)) * dim.x * scale[0] + Math.abs(Math.cos(yaw)) * dim.z * scale[2]) / 2;
      layout.placements.push({ id, assetId, position: [x, y, z], yaw, scale, minTier: 0, maxTier: 6, lightGroup: layout.lightGroups[0]?.id ?? 'zoo', allowRoad: true,
        visualAabb: { min: [x - hx, y, z - hz], max: [x + hx, y + dim.y * scale[1], z + hz] }, ...(destruction ? { destruction } : {}) });
    };
    for (const [i, [x, z]] of [[55, -28], [65, -28], [55, -38], [65, -38]].entries()) add(`l8-gorilla-pillar-${i}`, 'prop.cure-garden-wall', x, z, [.25, 1.55, 1.6], 0, { class: 'pillar' });
    for (const [i, [x, z]] of [[59, -29], [64, -35], [55, -34], [61, -40]].entries()) add(`l8-gorilla-throw-${i}`, 'prop.bench', x, z);
    for (let i = 0; i < 3; i++) add(`l8-gorilla-light-${i}`, 'prop.folding-chair', 58 + i * 2, -31);
    add('l8-elephant-truck', 'veh.box-truck', -68, 32, [1, 1, 1], Math.PI / 2);
    for (const [i, [x, z]] of [[-64, -30], [-55, -36], [-66, -40]].entries()) add(`l8-lion-cover-${i}`, 'prop.jersey-barrier', x, z, [1.1, 1.4, 1.6], i * Math.PI / 3);
    for (let i = 0; i < 5; i++) add(`l8-monkey-debris-${i}`, 'prop.bench', -3 + i * 1.5, 20, [.35, .35, .35]);
    for (let i = 0; i < 2; i++) {
      add(`l8-monkey-roof-debris-${i}`, 'prop.bench', -12, 12.5 + i * 3, [.25, .25, .25], 0, undefined, 4.1);
      add(`l8-monkey-ropes-${i}`, 'prop.laundry-line', -4 + i * 4, 22, [1, 1.2, 1.5]);
    }
    // Door-side furniture makes a real, body-width choke without closing either public escape path.
    add('l8-monkey-choke-0', 'prop.cure-garden-wall', -6, 12, [.6, 1, 1], Math.PI / 2);
    add('l8-monkey-choke-1', 'prop.cure-garden-wall', -6, 16, [.6, 1, 1], Math.PI / 2);
    return layout;
  });
}
