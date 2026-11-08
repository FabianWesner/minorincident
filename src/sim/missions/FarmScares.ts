import type { Placement } from '../../levels/districts/types';
import { farmLaneDistance } from '../../levels/L10/farmLayout';
import type { SimWorld } from '../world/SimWorld';

export interface FarmScareState { [site: string]: { due: number; actor?: number } }
const sites = new WeakMap<readonly Placement[], { id: string; x: number; z: number }[]>();
export function farmScareSites(placements: readonly Placement[]) {
  let list = sites.get(placements);
  if (list) return list;
  list = [];
  for (const [i, targetX] of [615, 710, 865, 1115].entries()) {
    const tiles = placements.filter(p => p.assetId === 'veg.corn-block' && farmLaneDistance(p.position[0], p.position[2]) <= 14);
    tiles.sort((a, b) => Math.abs(a.position[0] - targetX) - Math.abs(b.position[0] - targetX));
    const tile = tiles.find(p => !list!.some(s => Math.hypot(s.x - p.position[0], s.z - p.position[2]) < 45));
    if (!tile) continue;
    let x = tile.position[0], z = tile.position[2], d = Infinity;
    // Use the edge nearest a mown lane. It remains inside the same standing block, 4–6 m past the lane verge.
    for (const [dx, dz] of [[-4.55, 0], [4.55, 0], [0, -4.55], [0, 4.55]]) {
      const distance = farmLaneDistance(tile.position[0] + dx, tile.position[2] + dz);
      if (distance < d) { x = tile.position[0] + dx; z = tile.position[2] + dz; d = distance; }
    }
    list.push({ id: `corn-scare-${i}`, x, z });
  }
  sites.set(placements, list); return list;
}
/** The scare ledger is checkpointed with LevelTenEncounters; nothing is spawned waiting in view. */
export function updateFarmScares(world: SimWorld, ledger: FarmScareState): void {
  const ai = world.infected, hero = world.entities.get(1), layout = world.districts?.districts.find(d => d.id === 'D-CURE')?.layout;
  if (!ai || !hero || !layout || hero.health.current <= 0) return;
  for (const site of farmScareSites(layout.placements)) {
    let entry = ledger[site.id];
    if (entry?.actor) continue;
    if (!entry) {
      if (Math.hypot(hero.transform.x - site.x, hero.transform.z - site.z) > 13 || !ai.nav.clear(site.x, site.z, .65)) continue;
      entry = ledger[site.id] = { due: world.tick + 90 };
      world.events.emit({ type: 'music.stinger', tick: world.tick, kind: 'scare', level: 'L10' });
    }
    if (world.tick < entry.due || !world.chunks?.resident(site.x, site.z) || !ai.pool.length || ai.director.count >= ai.director.cap - ai.director.reserved - ai.director.pendingTurns) continue;
    const id = ai.spawn('infected.sprinter', site, { perched: false, birds: 1, cureRegion: site.x < 747 ? 'crash-outskirts' : 'residential-fringe' });
    entry.actor = id;
    if (!ai.rush(id, hero.transform, world.tick + 480)) {
      ai.press(id, 1, world.tick + 480);
      // Start the archetype chase before its first presented frame.
      world.entities.get(id)!.infected!.state = 'chase';
    }
  }
}
