import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { SimPhase } from '../../core/EventBus';

function radius(e: EntitySnapshot): number {
  if (e.infectionRise || e.hidden || e.health.current <= 0 || e.attachedTo !== undefined || (e.infected && (e.infected.hidden || e.transform.y > 2)) || e.companion?.state === 'hide' || e.civilian?.state === 'down' || e.civilian?.state === 'rising') return 0;
  if (e.companion) return .65;
  if (e.civilian?.pet) return .5;
  return e.survivor || e.companion || e.escort || (e.civilian && e.civilian.state !== 'infected' && e.civilian.state !== 'finished') || e.infected ? e.combat?.radius ?? .35 : 0;
}
/** Resolve body circles against the same static geometry as steering, after physics.
 * The survivor stays authoritative in Rapier; AI yields to it, including during
 * attack windups. Stable ID order resolves exact coincidence deterministically. */
export function installCharacterSeparation(world: SimWorld): void {
  const neighbors: number[] = [], query = { x: 0, z: 0, r: 2 }, radii = new Map<number, number>();
  world.events.on('sim.tick', () => {
    const nav = world.infected?.nav; if (!nav) return;
    radii.clear(); let maximumRadius = 0;
    for (const e of world.entities.iterate()) { const r = radius(e); radii.set(e.id, r); maximumRadius = Math.max(maximumRadius, r); }
    for (let pass = 0; pass < 3; pass++) for (const e of world.entities.iterate()) {
      const r = radii.get(e.id)!; if (!r || e.survivor || e.civilian?.state === 'grabbed') continue;
      if (world.districts && e.infected && !e.infected.perched && e.infected.special !== 'cling' && e.archetype !== 'infected.crow') e.transform.y = .7 + world.districts.groundHeight(e.transform.x, e.transform.z);
      query.x = e.transform.x; query.z = e.transform.z; query.r = r + maximumRadius + .3;
      world.spatial.query(query, neighbors, false);
      for (const id of neighbors) {
        const other = world.entities.get(id); if (!other || other === e) continue;
        if (e.companion && !e.companion.following && e.companion.state === 'follow' && !other.survivor) continue;
        const otherRadius = radii.get(other.id)!; if (!otherRadius) continue;
        // Combat spacing between an infected and a human fighter (larger fighters still need to enter their authored
        // melee/grab range). Infected among themselves keep body contact, so hordes and migration streams stay packed.
        const gap = (e.infected ? 1 : 0) + (other.infected ? 1 : 0) === 1 ? Math.max(.015, Math.min(.3, 1.05 - r - otherRadius)) : .015;
        const dx = e.transform.x - other.transform.x, dz = e.transform.z - other.transform.z, reach = r + otherRadius + gap;
        if (dx * dx + dz * dz >= reach * reach) continue;
        const distance = Math.hypot(dx, dz), overlap = reach - distance;
        if (overlap <= .001) continue;
        const angle = e.id * 2.399963, scale = other.survivor || other.civilian?.state === 'grabbed' || (other.companion && !other.companion.following && other.companion.state === 'follow') ? 1 : .5;
        nav.move(e.transform, (distance ? dx / distance : Math.cos(angle)) * overlap * scale, (distance ? dz / distance : Math.sin(angle)) * overlap * scale, r);
      }
      world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }, SimPhase.cleanup);
}
