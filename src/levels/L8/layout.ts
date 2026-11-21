import { worldAssets } from '../../assets/worldDefinitions';
import { l8BossArenas } from '../../data/l8Bosses';
import type { DistrictLayout, Placement } from '../districts/types';
/** Encounter cover is installed before physics/destruction assembly, with the same stable IDs on both tiers. */
export function levelEightLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return structuredClone(layouts).map(layout => {
    if (layout.district !== 'D-ZOO') return layout;
    const cages = [
      { id: 'lion', x0: -82, z0: -54, x1: -38, z1: -10 },
      { id: 'flamingo', x0: -16, z0: -54, x1: 16, z1: -10 },
      { id: 'zebra', x0: 38, z0: 10, x1: 82, z1: 54 },
      { id: 'gorilla', x0: 38, z0: -54, x1: 82, z1: -10 },
      { id: 'monkey', x0: -22, z0: 4, x1: 10, z1: 36 },
      { id: 'elephant', x0: -82, z0: 10, x1: -38, z1: 54 },
    ];
    const insideCage = (p: Placement) => cages.some(c => p.position[0] >= c.x0 && p.position[0] <= c.x1 && p.position[2] >= c.z0 && p.position[2] <= c.z1);
    // Generic plaza dressing in a cage makes the habitats read as public parks.
    // Remove those fittings before adding the authored enclosure dressing below.
    layout.placements = layout.placements.filter(p => !(insideCage(p) && (
      ['prop.bench', 'prop.folding-chair', 'prop.lawn-chair-a', 'prop.lawn-chair-b', 'prop.street-lamp'].includes(p.assetId)
      || p.id.startsWith('l8-gorilla-throw-') || p.id.startsWith('l8-gorilla-light-')
    )));
    // Keep planted bushes beside the yard, rather than creating elephant-sized charge stops in its wall-bait lanes.
    for (const [id, x, z] of [['prop.garden-bush:220', -85, 20], ['prop.garden-bush:222', -35, 44], ['prop.wheelbarrow:426', 112, 38], ['prop.crates:427', 112, 42], ['prop.hose-reel:425', 112, 34]] as const) {
      const bush = layout.placements.find(p => p.id === id); if (!bush) continue;
      const dx = x - bush.position[0], dz = z - bush.position[2]; bush.position[0] = x; bush.position[2] = z;
      bush.visualAabb.min[0] += dx; bush.visualAabb.max[0] += dx; bush.visualAabb.min[2] += dz; bush.visualAabb.max[2] += dz;
    }
    for (const a of l8BossArenas) layout.anchors[`arena-${a.id}`] = { position: [a.entry.x, 0, a.entry.z], yaw: 0 };
    layout.anchors['animal-monkey'] = { position: [-15.2, 0, 26], yaw: 0 };
    const house = layout.buildings.find(b => b.assetId === 'bld.reptile-house'); if (house) house.label = 'Primate House';
    const add = (id: string, assetId: string, x: number, z: number, scale: [number, number, number] = [1, 1, 1], yaw = 0, destruction?: Placement['destruction'], y = 0) => {
      const dim = worldAssets[assetId].dimensions;
      const hx = (Math.abs(Math.cos(yaw)) * dim.x * scale[0] + Math.abs(Math.sin(yaw)) * dim.z * scale[2]) / 2;
      const hz = (Math.abs(Math.sin(yaw)) * dim.x * scale[0] + Math.abs(Math.cos(yaw)) * dim.z * scale[2]) / 2;
      layout.placements.push({ id, assetId, position: [x, y, z], yaw, scale, minTier: 0, maxTier: 6, lightGroup: layout.lightGroups[0]?.id ?? 'zoo', allowRoad: true,
        visualAabb: { min: [x - hx, y, z - hz], max: [x + hx, y + dim.y * scale[1], z + hz] }, ...(destruction ? { destruction } : {}) });
    };
    if (layout.placements.some(p => p.id === 'l8-gorilla-pillar-0')) return layout;
    // Habitat fittings are existing solid props, kept around the outside of
    // each encounter's movement lanes and away from both gate thresholds.
    add('l8-lion-dead-tree', 'prop.tree.dead', -69, -25, [.8, .85, .8], -.35);
    for (const [i, [x, z]] of [[-71, -40], [-50, -24], [-51, -42]].entries()) add(`l8-lion-scrub-${i}`, 'prop.garden-bush-small', x, z, [1.4, .8, 1.2]);
    for (const [i, [x, z]] of [[-10, -43], [10, -43], [-10, -21], [10, -21]].entries()) add(`l8-flamingo-reed-bank-${i}`, 'prop.garden-bush-small', x, z, [1.3, .6, .8]);
    for (const [i, [x, z]] of [[49, 25], [71, 25], [49, 39], [71, 39]].entries()) add(`l8-zebra-feeding-rack-${i}`, 'prop.crates', x, z, [.9, .75, .7], i % 2 ? Math.PI / 2 : 0);
    add('l8-zebra-trough', 'prop.kiddie-pool', 68, 43, [1.5, .35, .65]);
    // Keep the four stable tactical-cover IDs used by the gorilla behavior,
    // while changing their silhouette from red plaza pillars to dead trunks.
    for (const [i, [x, z]] of [[55, -28], [65, -28], [55, -38], [65, -38]].entries()) add(`l8-gorilla-pillar-${i}`, 'prop.tree.dead', x, z, [.8, 1.1, .8], 0, { class: 'pillar' });
    for (const [i, [x, z]] of [[59, -29], [64, -35], [55, -34], [61, -40]].entries()) add(`l8-gorilla-throw-${i}`, 'prop.crates', x, z, [.85, .8, .85]);
    for (let i = 0; i < 3; i++) add(`l8-gorilla-log-${i}`, 'prop.tree.dead', 53 + i * 7, -24 - (i % 2) * 3, [.55, .6, .55], .4);
    for (const [i, [x, z]] of [[-4, 9], [2, 9], [-4, 31], [2, 31]].entries()) add(`l8-primate-roof-platform-${i}`, 'prop.crates', x, z, [.8, .65, .8], Math.PI / 2);
    for (let i = 0; i < 5; i++) add(`l8-monkey-debris-${i}`, 'prop.crates', -3 + i * 1.5, 20, [.35, .35, .35]);
    for (const [i, [x, z]] of [[84, 48], [108, 64], [84, 67]].entries()) add(`l8-elephant-earth-mound-${i}`, 'prop.garden-bush', x, z, [1.5, .65, 1.5]);
    // The primate yard sits behind the house, away from the public tour path.
    // Its east service entrance stays available for the post-breach encounter.
    (layout.zones ??= {})['enclosure-monkey'] = [[-20, 20], [-10.48, 20], [-10.48, 31.9], [-20, 31.9]];
    const fencePanels: [number, number, number][] = [];
    for (let x = -18.81; x <= -11.67; x += 2.38) fencePanels.push([x, 20, 0], [x, 31.9, 0]);
    for (let i = 0; i < 5; i++) {
      const z = 21.19 + i * 2.38;
      fencePanels.push([-20, z, Math.PI / 2]);
      if (i !== 2) fencePanels.push([-10.48, z, Math.PI / 2]);
    }
    for (const [i, [x, z, yaw]] of fencePanels.entries()) {
      add(`l8-primate-fence-${i}`, 'prop.crowd-fence', x, z, [1, 2.4, 1], yaw);
      layout.placements.at(-1)!.fixed = true;
    }
    add('l8-primate-climbing-tree', 'prop.tree.dead', -16, 27, [.65, .7, .65]);
    const wall = worldAssets['prop.cure-garden-wall'].dimensions;
    add('l8-yard-north-wall', 'prop.cure-garden-wall', 88, 46, [8 / wall.x, 3 / wall.y, .5 / wall.z], 0, { class: 'concrete', indestructible: true, bossBreakable: true });
    layout.placements.at(-1)!.fixed = true;
    add('l8-elephant-truck', 'veh.box-truck', 100, 54, [1, 1, 1], Math.PI / 2);
    for (const [i, [x, z]] of [[-64, -30], [-55, -36], [-66, -40]].entries()) add(`l8-lion-cover-${i}`, 'prop.tree.dead', x, z, [.8, .9, .8], i * Math.PI / 3);
    for (let i = 0; i < 2; i++) {
      add(`l8-monkey-roof-debris-${i}`, 'prop.crates', -12, 12.5 + i * 3, [.25, .25, .25], 0, undefined, 4.1);
      add(`l8-monkey-ropes-${i}`, 'prop.laundry-line', -4 + i * 4, 22, [1, 1.2, 1.5]);
    }
    // Door-side furniture makes a real, body-width choke without closing either public escape path.
    add('l8-monkey-choke-0', 'prop.cure-garden-wall', -6, 12, [.6, 1, 1], Math.PI / 2);
    add('l8-monkey-choke-1', 'prop.cure-garden-wall', -6, 16, [.6, 1, 1], Math.PI / 2);
    // Offset cover leaves the centre and both gates open. Pond pieces sit
    // inside the landing ring; paddock pieces leave distinct charge sidesteps.
    for (const [i, [x, z]] of [[-6, -28], [6, -28], [0, -38]].entries())
      add(`l8-flamingo-cover-${i}`, 'prop.jersey-barrier', x, z, [.9, 1.4, 1], i === 2 ? 0 : Math.PI / 2);
    for (const [i, [x, z]] of [[52, 28], [68, 28], [60, 39]].entries())
      add(`l8-zebra-cover-${i}`, 'prop.jersey-barrier', x, z, [.9, 1.4, 1], i === 2 ? 0 : Math.PI / 2);
    return layout;
  });
}
