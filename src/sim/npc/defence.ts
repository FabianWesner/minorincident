import { l2 } from '../../data/l2';
import { leaveSeat } from './MorningRoutines';
import { updateAlly } from '../outbreak/Allies';
import { storyProtected } from './storyProtection';
import { followerInCombat } from '../outbreak/Survivors';
import { formationBack } from '../missions/missionHelpers';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';

const mobile = new Set(['calm', 'alarmed', 'flee', 'hide', 'annoyed']);
const distance = (a: EntitySnapshot, b: EntitySnapshot) => Math.hypot(a.transform.x - b.transform.x, a.transform.z - b.transform.z);

/** Direct attacks and rescues interrupt routines and follower cover. The bite clock remains owned by the outbreak. */
export function alarmVictim(world: SimWorld, e: EntitySnapshot, source: EntitySnapshot): void {
  const c = e.civilian;
  if (!c?.adult || c.pet || c.zooAnimal || e.infection || e.health.current <= 0 || !mobile.has(c.state)) return;
  Object.assign(c.threat, source.transform); c.dangerUntil = world.tick + 120;
  leaveSeat(e);
  if (!c.ally || !c.ally.engaged) { c.story = null; c.path.length = 0; c.goal = -1; }
  if (c.ally) {
    const fresh = !c.ally.engaged;
    c.ally.engaged = true;
    if (fresh || !c.ally.targetId) c.ally.targetId = source.id;
    if (fresh) c.ally.nextAttack = Math.min(c.ally.nextAttack, world.tick + 15);
  }
  else world.npcs!.civilians.state(e, 'flee');
}

/** Self defence runs before level-specific formation/routine handlers, on every campaign level. */
export function defendHuman(world: SimWorld, e: EntitySnapshot): boolean {
  const c = e.civilian!;
  if (!c.adult || c.pet || c.zooAnimal || e.hidden || e.passengerOf !== undefined || e.infection || e.health.current <= 0 || !mobile.has(c.state) || world.tick < c.knockedUntil) return false;
  const survivor = c.survivor?.mode === 'follow', a = c.ally;
  if (!survivor && !(world.tick < (c.dangerUntil ?? 0))) return false;
  const range = a?.gun?.rangeM ?? a?.melee?.reachM ?? (a ? a.role === 'firefighter' || a.role === 'civilian' ? l2.allies.firefighter.reachM : l2.allies.officer.rangeM + 4 : 3);
  let threat: EntitySnapshot | undefined, best = range;
  for (const o of world.infected!.active) {
    const d = distance(e, o);
    if (!a && (o.combat?.staggerUntil ?? 0) > world.tick) continue;
    if (o.health.current <= 0 || o.hidden || o.infected?.hidden || o.infectionRise || d > best || !world.infected!.nav.visible(e.transform, o.transform, 0)) continue;
    threat = o; best = d;
  }
  // L5 escort (L5-08): an armed follower fights inside the shared escort
  // combat state. A distant target alone must not take over its movement:
  // holding fire position there left it standing until 5 m behind, then
  // chasing at the 3.8 m/s combat pace while the formation counted it calm.
  const l5Escort = !!world.missions?.state.l5;
  if (threat && survivor && a && l5Escort && !followerInCombat(world, e)) threat = undefined;
  const subway = world.missions?.state.l6;
  const row = subway?.survivors.find(r => r.id === e.id);
  const injured = row?.injured ?? world.l7Encounters?.state.roster.find(r => r.id === e.id)?.injured ?? c.survivor?.injured ?? false;
  const group = subway && row && !row.collected ? { x: subway.leaderX, z: subway.leaderX < 25 ? subway.leaderZ : 15 } : world.entities.get(1)!.transform;
  // L7's escape route owns unarmed travel, boarding and rear-guard regrouping.
  // Repeated self-defence flight used to
  // steer a trailing evacuee away from the courier and into frontage pockets;
  // each nearby biter restarted that flight before the connected follow route
  // could recover it. Rejoin at the ordinary L7 pace once outside its slot.
  if (survivor && world.l7Encounters && (!a || world.missions!.state.steps.departure.status === 'active' || Math.hypot(e.transform.x - group.x, e.transform.z - group.z) > formationBack(c.survivor!.slot) + 3)) {
    c.dangerUntil = 0;
    if (a) { a.targetId = 0; a.strikeAt = 0; a.step = undefined; a.run = null; a.engaged = false; }
    return world.l7Encounters.follower(e);
  }
  if (a && threat) {
    a.engaged = true;
    if (survivor) {
      // A carried guard's old station post must not leash it underground forever.
      a.post = null; a.hold = true; delete a.follow;
      a.run = Math.hypot(e.transform.x - group.x, e.transform.z - group.z) > 5 ? { x: group.x, z: group.z } : null;
      if (subway && a.run) a.step = undefined;
      a.runSpeed = subway ? 2.2 : injured ? 1.4 : 3.8;
    }
    return updateAlly(world, e, (from, to) => world.infected!.nav.visible(from, to, 0));
  }
  if (survivor && a) {
    a.targetId = 0; a.strikeAt = 0; a.step = undefined; a.run = null;
    if (c.story?.clip === 'shoot' || c.story?.clip === 'swing') c.story = null;
  }
  if (threat) { Object.assign(c.threat, threat.transform); c.dangerUntil = world.tick + 120; }
  // An L5 escort follower stops fleeing once the shared escort combat state
  // ends (attacker dead or gone): the formation then regroups behind her.
  else if (survivor && l5Escort && !followerInCombat(world, e)) c.dangerUntil = 0;
  if (!(world.tick < (c.dangerUntil ?? 0))) return false;
  c.story = null;
  if (c.survivor) c.survivor.cover = false;
  if (c.state !== 'flee') world.npcs!.civilians.state(e, 'flee');
  const p = e.transform, player = group;
  let dx = p.x - c.threat.x, dz = p.z - c.threat.z;
  const d = Math.hypot(dx, dz);
  if (d < .01) { dx = player.x - p.x || 1; dz = player.z - p.z; }
  const length = Math.hypot(dx, dz) || 1, awayX = dx / length, awayZ = dz / length;
  const toPlayerX = player.x - p.x, toPlayerZ = player.z - p.z, toPlayer = Math.hypot(toPlayerX, toPlayerZ) || 1;
  // Add a safe component toward the protector without ever running toward the attacker.
  const toward = (toPlayerX * awayX + toPlayerZ * awayZ) / toPlayer;
  const back = Math.min(0, toward);
  const x = awayX + toPlayerX / toPlayer - back * awayX, z = awayZ + toPlayerZ / toPlayer - back * awayZ, n = Math.hypot(x, z);
  // QA 10-21 #83: an L6 injured straggler cannot be bitten (storyProtected), so fleeing from its biters only pinned it against the
  // tunnel wall for good while the group held at the gate. It limps to its protector instead (the group, or the courier once collected).
  const shielded = !!row?.straggler && storyProtected(world, e) && toPlayer > 1;
  const goal = shielded ? { x: p.x + toPlayerX / toPlayer * 4, z: p.z + toPlayerZ / toPlayer * 4 } : { x: p.x + x / n * 4, z: p.z + z / n * 4 };
  const speed = injured && !subway ? 1.4 : c.l1?.fleeSpeed ?? 3.8;
  const stepX = shielded ? toPlayerX / toPlayer : awayX, stepZ = shielded ? toPlayerZ / toPlayer : awayZ;
  if (!world.npcs!.move(e, goal, speed, c, .1)) world.npcs!.moveStep(e, stepX * speed / 60, stepZ * speed / 60);
  world.spatial.set(e.id, p.x, p.z);
  return true;
}
