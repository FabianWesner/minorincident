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
  const bodies: { entity: EntitySnapshot; radius: number }[] = [];
  const ground = new WeakMap<EntitySnapshot, { district: NonNullable<SimWorld['districts']>; x: number; z: number; y: number }>();
  world.events.on('sim.tick', () => {
    const nav = world.infected?.nav; if (!nav) return;
    radii.clear(); let bodyCount = 0, maximumRadius = 0;
    for (const e of world.entities.iterate()) {
      const r = radius(e); if (!r) continue;
      radii.set(e.id, r); maximumRadius = Math.max(maximumRadius, r);
      if ((e.infected?.specialAttack && e.infected.specialAttack.stage !== 'recovery' && e.infected.specialAttack.move !== 'lion.flank') || e.survivor || e.civilian?.state === 'grabbed' || (e.civilian?.ally?.hold && storyProtected(world, e))) continue;
      const body = bodies[bodyCount++];
      if (body) { body.entity = e; body.radius = r; }
      else bodies.push({ entity: e, radius: r });
    }
    bodies.length = bodyCount;
    for (let pass = 0; pass < 3; pass++) for (const { entity: e, radius: r } of bodies) {
      query.x = e.transform.x; query.z = e.transform.z; query.r = r + maximumRadius + Math.max(.45, .22 + maximumRadius - .35); // covers the largest gap below
      world.spatial.query(query, neighbors, false);
      for (const id of neighbors) {
        const otherRadius = radii.get(id); if (!otherRadius) continue;
        const other = world.entities.get(id); if (!other || other === e) continue;
        // The swept charge owns contact; passive spacing must not push a human out before it hits.
        if (other.infected?.specialAttack && (other.infected.specialAttack.move === 'alpha.charge' || other.infected.specialAttack.move === 'elephant.charge' || other.infected.specialAttack.move === 'zebra.stampede') && other.infected.specialAttack.stage === 'active') continue;
        if (e.companion && !e.companion.following && e.companion.state === 'follow' && !other.survivor) continue;
        // Combat crowds reserve the attack pose's upper-body extent, including catalog/elite brains.
        // Scripted migration streams retain their authored density and spline timing.
        // Larger attackers keep the same surface clearance around the courier as ordinary humans.
        const infected = (e.infected ? 1 : 0) + (other.infected ? 1 : 0);
        const courier = !!(e.survivor || other.survivor);
        const contact = infected === 1 ? infectedContactDistance(e.infected ? r : otherRadius) : 0;
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
      if (e.transform.x !== query.x || e.transform.z !== query.z) world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
    // Separation changes only X/Z. Ground once at the final position, rather
    // than sampling every pass and leaving the last push's support stale.
    if (world.districts) for (const e of world.entities.iterate()) if (e.infected && radii.get(e.id) && !(e.infected.specialAttack && e.infected.specialAttack.stage !== 'recovery' && e.infected.specialAttack.move !== 'lion.flank') && !e.infected.perched && e.infected.special !== 'cling' && e.archetype !== 'infected.crow') {
      // Static district support cannot change beneath a stationary body. Reuse
      // its exact height until movement or a tier/checkpoint replaces the district.
      let support = ground.get(e);
      const { x, z } = e.transform;
      if (!support || support.district !== world.districts || support.x !== x || support.z !== z) {
        const y = .7 + world.districts.pavingHeight(x, z);
        if (support) { support.district = world.districts; support.x = x; support.z = z; support.y = y; }
        else { support = { district: world.districts, x, z, y }; ground.set(e, support); }
      }
      e.transform.y = support.y;
    }
  }, SimPhase.cleanup);
}
