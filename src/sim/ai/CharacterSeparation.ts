import { actorRadius } from '../world/SolidRegistry';
import { storyProtected } from '../npc/storyProtection';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { ContactCells } from '../spatial/SpatialHash';
import { SimPhase } from '../../core/EventBus';

/** Human-sized infected contact spacing; larger bodies reserve their extra radius as well. */
export const meleeRing = 1.08;
export const infectedContactDistance = (radius: number): number => meleeRing + Math.max(0, radius - .35);
function spacingRadius(e: EntitySnapshot, world: SimWorld): number {
  if (!e.survivor && !e.companion && !e.escort && !e.civilian && !e.infected) return 0;
  if (e.infectionRise || e.hidden || e.emerging || e.health.current <= 0 || e.attachedTo !== undefined || e.passengerOf !== undefined || (e.infected && (e.infected.hidden || e.transform.y > 2)) || e.companion?.state === 'hide' || e.civilian?.state === 'down' || e.civilian?.state === 'rising') return 0;
  if (e.companion) return world.missions?.state.l5?.metroAt ? .2 : .9;
  if (e.civilian?.pet) return .5;
  if (e.survivor) return actorRadius(e);
  return e.survivor || e.companion || e.escort || (e.civilian && e.civilian.state !== 'infected' && e.civilian.state !== 'finished') || e.infected ? e.combat?.radius ?? .35 : 0;
}
type Body = { entity: EntitySnapshot; radius: number; physical: number; extra: number; contact: number; category: number; infected: boolean; courier: boolean; crowd: boolean; hullContact: boolean; l1: boolean; fixed: boolean; charge: boolean; passiveCompanion: boolean };
/** Combat/presentation spacing is wider than the physical footprint for companions and pets.
 * Resolve body circles against the same static geometry as steering, after physics.
 * The survivor stays authoritative in Rapier; AI yields to it, including during
 * attack windups. Stable ID order resolves exact coincidence deterministically. */
export function installCharacterSeparation(world: SimWorld): void {
  const neighbors: number[] = [], query = { x: 0, z: 0, r: 2 }, radii: (Body | undefined)[] = [], radiusIds: number[] = [];
  const records = new WeakMap<EntitySnapshot, Body>();
  const bodies: Body[] = [], categories: Body[] = [], reaches: number[][] = [];
  let active: typeof bodies[number] | undefined;
  const contacts: ContactCells = { epoch: 0, radius: id => radii[id]?.radius ?? 0, intersects: (maximum, x, z) => {
    if (!active || !maximum) return false;
    const p = active.entity.transform, r = active.radius;
    const dx = Math.max(x - p.x, 0, p.x - x - 4), dz = Math.max(z - p.z, 0, p.z - z - 4);
    const reach = Math.max(r + maximum + (active.hullContact ? .45 : .3), meleeRing) + Math.max(0, r - .35, maximum - .35);
    return dx * dx + dz * dz < reach * reach;
  } };
  const settled = new WeakMap<EntitySnapshot, { district: NonNullable<SimWorld['districts']>; x: number; z: number; y: number }>();
  const ground = new WeakMap<EntitySnapshot, { district: NonNullable<SimWorld['districts']>; x: number; z: number; y: number }>();
  world.events.on('sim.tick', () => {
    const nav = world.infected?.nav; if (!nav) return;
    // Reuse the numeric-ID lookup without clearing sparse carried-survivor ID ranges.
    for (const id of radiusIds) radii[id] = undefined; radiusIds.length = 0;
    let bodyCount = 0, maximumRadius = 0;
    // The stationary courier may yield to her own followers at the Metro mouth.
    // Otherwise her solid body seals the only route around a stationary intruder.
    const yieldCourier = !!world.missions?.state.l5?.metroAt && !world.inputFrame.move.x && !world.inputFrame.move.z && !world.inputFrame.moveTarget && !world.inputFrame.attackTarget;
    const drivenHull = world.vehicles?.active == null ? undefined : world.vehicles.cars.get(world.vehicles.active)?.physics;
    for (const e of world.entities.iterate()) {
      const r = spacingRadius(e, world); if (!r) continue;
      let body = records.get(e);
      if (!body) { body = { entity: e, radius: r, physical: 0, extra: 0, contact: 0, category: 0, infected: false, courier: false, crowd: false, hullContact: false, l1: false, fixed: false, charge: false, passiveCompanion: false }; records.set(e, body); }
      else body.radius = r;
      body.physical = actorRadius(e);
      body.extra = Math.max(0, r - .35); body.contact = infectedContactDistance(r);
      // These contact flags cannot change during the separation phase; cache them once per body.
      body.infected = !!e.infected; body.courier = !!e.survivor; body.l1 = !!e.infected?.l1;
      body.crowd = !!e.infected && (!!e.combat?.attacking || e.infected.state === 'chase');
      body.hullContact = !!drivenHull && drivenHull.speed < .2 && body.infected && drivenHull.hullDistance(e.transform.x, e.transform.z) < 3;
      body.passiveCompanion = !!e.companion && !e.companion.following && e.companion.state === 'follow';
      body.fixed = !!(e.infected?.pursuit && e.infected.specialAttack) || body.courier && !yieldCourier || !!(e.civilian?.ally?.hold && storyProtected(world, e)) || e.civilian?.state === 'grabbed' || body.passiveCompanion;
      const attack = e.infected?.specialAttack;
      body.charge = !!attack && attack.stage === 'active' && (attack.move === 'alpha.charge' || attack.move === 'elephant.charge' || attack.move === 'zebra.stampede');
      radii[e.id] = body; radiusIds.push(e.id); maximumRadius = Math.max(maximumRadius, r);
      if ((e.infected?.specialAttack && (e.infected.pursuit || e.infected.specialAttack.stage !== 'recovery') && e.infected.specialAttack.move !== 'lion.flank') || e.survivor && !yieldCourier || e.civilian?.state === 'grabbed' || (e.civilian?.ally?.hold && storyProtected(world, e))) continue;
      bodies[bodyCount++] = body;
    }
    bodies.length = bodyCount; contacts.epoch++;
    // Contact geometry depends only on radius/brain flags, which are fixed for this spacing pass.
    // Compute each distinct ordered pair once, retaining the exact original arithmetic.
    categories.length = 0;
    for (const id of radiusIds) {
      const body = radii[id]!;
      let category = -1;
      for (let i = 0; i < categories.length; i++) {
        const c = categories[i];
        if (c.radius === body.radius && c.infected === body.infected && c.courier === body.courier && c.crowd === body.crowd && c.hullContact === body.hullContact && c.l1 === body.l1) { category = i; break; }
      }
      if (category < 0) { category = categories.length; categories.push(body); }
      body.category = category;
    }
    for (let i = 0; i < categories.length; i++) {
      const body = categories[i], r = body.radius, row = reaches[i] ?? (reaches[i] = []);
      for (let j = 0; j < categories.length; j++) {
        const neighbor = categories[j], otherRadius = neighbor.radius;
        const infected = (body.infected ? 1 : 0) + (neighbor.infected ? 1 : 0);
        const courier = body.courier || neighbor.courier;
        const contact = infected === 1 ? (body.infected ? body.contact : neighbor.contact) : 0;
        const combatCrowd = infected === 2 && ((body.l1 && neighbor.l1) || body.crowd || neighbor.crowd);
        const gap = infected === 1 ? Math.max(.015, courier ? contact - r - otherRadius : Math.min(.3, 1.05 - r - otherRadius)) : combatCrowd ? (body.hullContact || neighbor.hullContact ? .4 : .22) + Math.max(body.extra, neighbor.extra) : .015;
        row[j] = r + otherRadius + gap;
      }
    }
    const visit = (id: number): void => {
      const body = active!, { entity: e } = body;
      const neighbor = radii[id]; if (!neighbor || neighbor.entity === e) return;
      const other = neighbor.entity;
      if (body.courier && !other.civilian?.survivor) return;
      const dx = e.transform.x - other.transform.x, dz = e.transform.z - other.transform.z, squared = dx * dx + dz * dz;
      const reach = reaches[body.category][neighbor.category];
      if (squared >= reach * reach || neighbor.charge || (body.passiveCompanion && !neighbor.courier)) return;
      const distance = Math.sqrt(squared), overlap = reach - distance;
      if (overlap <= .001) return;
      // A protected story actor holding a post is authoritative like the courier;
      // crowd overlap cannot push the invitation away from its interaction. Damage may still shove it.
      const angle = e.id * 2.399963, scale = neighbor.fixed ? 1 : .5;
      (e.infected ? world.infected!.infectedNav : nav).move(e.transform, (distance ? dx / distance : Math.cos(angle)) * overlap * scale, (distance ? dz / distance : Math.sin(angle)) * overlap * scale, body.physical, true);
    };
    // Keep the authored three passes for ordinary groups, friendly queues and
    // L1 pursuit trains. Large classic crowds use one (two at a driven hull).
    for (let pass = 0; pass < 3; pass++) for (const body of bodies) {
      if (pass && bodies.length > 20 && body.infected && !body.l1 && (!body.hullContact || pass > 1)) continue;
      const { entity: e, radius: r } = body; active = body;
      query.x = e.transform.x; query.z = e.transform.z; query.r = r + maximumRadius + Math.max(.45, .22 + maximumRadius - .35); // covers the largest gap below
      // Consume the same unsorted bucket order directly; nav.move does not mutate the spatial index.
      world.spatial.query(query, neighbors, false, visit, contacts);
      if (e.transform.x !== query.x || e.transform.z !== query.z) { world.spatial.set(e.id, e.transform.x, e.transform.z); world.solids.wrote(e, 'cleanup.separation'); }
    }
    // Stationary hull strikes have 1.5 m of authored reach. Reserve their pose
    // without preemptively pushing victims away from an approaching vehicle's ram.
    if (drivenHull) for (const body of bodies) if (body.hullContact && !body.charge) {
      const e = body.entity, x = e.transform.x, z = e.transform.z;
      drivenHull.separateHull(e.transform, body.radius + .45);
      if (x !== e.transform.x || z !== e.transform.z) { world.spatial.set(e.id, e.transform.x, e.transform.z); world.solids.wrote(e, 'cleanup.hull-stance'); }
    }
    // Separation changes only X/Z. Ground once at the final position, rather
    // than sampling every pass and leaving the last push's support stale.
    if (world.districts) for (const e of world.entities.iterate()) if (e.infected && !radii[e.id] && (e.health.current <= 0 || e.transform.y > 2) && !e.hidden && !e.infected.hidden && !e.infected.perched && e.infected.special !== 'cling' && !e.infected.specialAttack && !e.corpseThrown && e.attachedTo === undefined && !e.infectionRise && e.archetype !== 'infected.crow') {
      // Dead bodies and anything above the 2 m separation cut-off (L3 highway ramp/deck) are not separated, but still stand on
      // the support under them: a body that ends past the deck edge drops to the street, one on the ramp follows its slope, and none
      // keeps a stale height (PO: "Dead Zombies fliying"). `supportBelow` ignores a deck above the body.
      const { x, z } = e.transform; let support = settled.get(e);
      if (!support || support.district !== world.districts || support.x !== x || support.z !== z) {
        const y = .7 + world.districts.supportBelow(x, z, e.transform.y - .7);
        if (support) { support.district = world.districts; support.x = x; support.z = z; support.y = y; }
        else { support = { district: world.districts, x, z, y }; settled.set(e, support); }
      }
      e.transform.y = support.y;
    }
    if (world.districts) for (const e of world.entities.iterate()) if (e.infected && radii[e.id] && !(e.infected.specialAttack && (e.infected.pursuit || e.infected.specialAttack.stage !== 'recovery') && e.infected.specialAttack.move !== 'lion.flank') && !e.infected.perched && e.infected.special !== 'cling' && e.archetype !== 'infected.crow') {
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
