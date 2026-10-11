import { storyProtected } from '../npc/storyProtection';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { SimPhase } from '../../core/EventBus';

/** Human-sized infected contact spacing; larger bodies reserve their extra radius as well. */
export const meleeRing = 1.08;
export const infectedContactDistance = (radius: number): number => meleeRing + Math.max(0, radius - .35);
function radius(e: EntitySnapshot): number {
  if (e.infectionRise || e.hidden || e.emerging || e.health.current <= 0 || e.attachedTo !== undefined || (e.infected && (e.infected.hidden || e.transform.y > 2)) || e.companion?.state === 'hide' || e.civilian?.state === 'down' || e.civilian?.state === 'rising') return 0;
  if (e.companion) return .9;
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
      const r = radii.get(e.id)!; if (!r || e.survivor || e.civilian?.state === 'grabbed' || (e.civilian?.ally?.hold && storyProtected(world, e))) continue;
      if (world.districts && e.infected && !e.infected.perched && e.infected.special !== 'cling' && e.archetype !== 'infected.crow') e.transform.y = .7 + world.districts.groundHeight(e.transform.x, e.transform.z);
      query.x = e.transform.x; query.z = e.transform.z; query.r = r + maximumRadius + Math.max(.45, .22 + maximumRadius - .35); // covers the largest gap below
      world.spatial.query(query, neighbors, false);
      for (const id of neighbors) {
        const other = world.entities.get(id); if (!other || other === e) continue;
        if (e.companion && !e.companion.following && e.companion.state === 'follow' && !other.survivor) continue;
        const otherRadius = radii.get(other.id)!; if (!otherRadius) continue;
        // Combat crowds reserve the attack pose's upper-body extent, including catalog/elite brains.
        // Scripted migration streams retain their authored density and spline timing.
        // Larger attackers keep the same surface clearance around the courier as ordinary humans.
        const infected = (e.infected ? 1 : 0) + (other.infected ? 1 : 0);
        const courier = !!(e.survivor || other.survivor);
        const contact = infectedContactDistance(e.infected ? r : otherRadius);
        const combatCrowd = infected === 2 && ((e.infected!.l1 && other.infected!.l1) || e.combat!.attacking || other.combat!.attacking || e.infected!.state === 'chase' || other.infected!.state === 'chase');
        const gap = infected === 1 ? Math.max(.015, courier ? contact - r - otherRadius : Math.min(.3, 1.05 - r - otherRadius)) : combatCrowd ? .22 + Math.max(0, r - .35, otherRadius - .35) : .015;
        const dx = e.transform.x - other.transform.x, dz = e.transform.z - other.transform.z, reach = r + otherRadius + gap;
        const squared = dx * dx + dz * dz;
        if (squared >= reach * reach) continue;
        const distance = Math.sqrt(squared), overlap = reach - distance;
        if (overlap <= .001) continue;
        // A protected story actor holding a post is authoritative like the courier;
        // crowd overlap cannot push the invitation away from its interaction. Damage may still shove it.
        const angle = e.id * 2.399963, scale = other.survivor || (other.civilian?.ally?.hold && storyProtected(world, other)) || other.civilian?.state === 'grabbed' || (other.companion && !other.companion.following && other.companion.state === 'follow') ? 1 : .5;
        nav.move(e.transform, (distance ? dx / distance : Math.cos(angle)) * overlap * scale, (distance ? dz / distance : Math.sin(angle)) * overlap * scale, r);
      }
      world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }, SimPhase.cleanup);
}
