import type { Placement } from '../../levels/districts/types';
import type { SimWorld } from '../world/SimWorld';
import { cure } from '../../levels/L10/district';

export interface FarmScareState { [site: string]: { due: number; actor?: number } }
const sites = new WeakMap<readonly Placement[], { id: string; x: number; z: number }[]>();
export function farmScareSites(placements: readonly Placement[]) {
  let list = sites.get(placements);
  if (list) return list;
  list = [];
  const walking = [...cure.regions[0].route.slice(0, 4), cure.anchors['farmhouse-rifle'], [774, 26], [918, 21], [936, -12], cure.anchors['shed-molotov']];
  for (const [i, targetX] of [615, 710, 865, 1115].entries()) {
    const segment = walking.slice(1).findIndex((p, n) => walking[n][0] <= targetX && p[0] >= targetX && p[0] > walking[n][0]);
    const a = walking[Math.max(0, segment)], b = walking[Math.max(0, segment) + 1];
    const targetZ = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, (targetX - a[0]) / (b[0] - a[0] || 1)));
    const tiles = placements.filter(p => p.assetId === 'veg.corn-block');
    // Choose the crop beside the actual marker-bearing crossing. Sorting only
    // by X selected the parallel northern road, up to 80 m out of the walk.
    tiles.sort((a, b) => Math.hypot(a.position[0] - targetX, a.position[2] - targetZ) - Math.hypot(b.position[0] - targetX, b.position[2] - targetZ));
    const tile = tiles.find(p => !list!.some(s => Math.hypot(s.x - p.position[0], s.z - p.position[2]) < 45));
    if (!tile) continue;
    let x = tile.position[0], z = tile.position[2], d = Infinity;
    // Use the edge nearest a mown lane. It remains inside the same standing block, 4–6 m past the lane verge.
    for (const [dx, dz] of [[-4.55, 0], [4.55, 0], [0, -4.55], [0, 4.55]]) {
      const distance = Math.hypot(tile.position[0] + dx - targetX, tile.position[2] + dz - targetZ);
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
    const available = ai.pool.length > 0 && ai.director.count < ai.director.cap - ai.director.reserved - ai.director.pendingTurns;
    if (!entry) {
      if (!available || Math.hypot(hero.transform.x - site.x, hero.transform.z - site.z) > 26 || !ai.nav.clear(site.x, site.z, .65)) continue;
      entry = ledger[site.id] = { due: world.tick + 90 };
      world.events.emit({ type: 'music.stinger', tick: world.tick, kind: 'scare', level: 'L10' });
    }
    if (world.tick < entry.due) continue;
    // A delayed admission needs a fresh warning, rather than a burst long after its sting.
    if (!available || !world.chunks?.resident(site.x, site.z) || !ai.nav.clear(site.x, site.z, .65)) { delete ledger[site.id]; continue; }
    const id = ai.spawn('infected.sprinter', site, { perched: false, birds: 1, cureRegion: site.x < 747 ? 'crash-outskirts' : 'residential-fringe' });
    entry.actor = id;
    if (!ai.rush(id, hero.transform, world.tick + 480)) {
      ai.press(id, 1, world.tick + 480);
      // Start the archetype chase before its first presented frame.
      world.entities.get(id)!.infected!.state = 'chase';
    }
  }
}
