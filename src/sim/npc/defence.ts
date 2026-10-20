import { l2 } from '../../data/l2';
import { leaveSeat } from './MorningRoutines';
import { updateAlly } from '../outbreak/Allies';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';

const mobile = new Set(['calm', 'alarmed', 'flee', 'hide', 'annoyed']);
const distance = (a: EntitySnapshot, b: EntitySnapshot) => Math.hypot(a.transform.x - b.transform.x, a.transform.z - b.transform.z);

/** Direct attacks and rescues interrupt routines and follower cover. The bite clock remains owned by the outbreak. */
export function alarmVictim(world: SimWorld, e: EntitySnapshot, source: EntitySnapshot): void {
  const c = e.civilian;
  if (!c?.adult || c.pet || c.zooAnimal || e.infection || e.health.current <= 0 || !mobile.has(c.state)) return;
  Object.assign(c.threat, source.transform); c.dangerUntil = world.tick + 120;
  leaveSeat(e); c.story = null; c.path.length = 0; c.goal = -1;
  if (c.ally) {
    const fresh = !c.ally.engaged || c.ally.targetId !== source.id;
    c.ally.engaged = true; c.ally.targetId = source.id;
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
  const subway = world.missions?.state.l6;
  const row = subway?.survivors.find(r => r.id === e.id);
  const injured = row?.injured ?? world.l7Encounters?.state.roster.find(r => r.id === e.id)?.injured ?? (world.scenario === 'L8' && (c.l1?.walkSpeed ?? 2.2) <= 1.4);
  const group = subway && row && !row.collected ? { x: subway.leaderX, z: subway.leaderX < 25 ? subway.leaderZ : 15 } : world.entities.get(1)!.transform;
  if (a && threat) {
    a.engaged = true;
    if (survivor) {
      // A carried guard's old station post must not leash it underground forever.
      a.post = null; a.hold = true; delete a.follow;
      a.run = Math.hypot(e.transform.x - group.x, e.transform.z - group.z) > 5 ? { x: group.x, z: group.z } : null;
      a.runSpeed = injured ? 1.4 : subway ? 2.2 : 3.8;
    }
    return updateAlly(world, e, (from, to) => world.infected!.nav.visible(from, to, 0));
  }
  if (survivor && a) {
    a.targetId = 0; a.strikeAt = 0; a.step = undefined; a.run = null;
    if (c.story?.clip === 'shoot' || c.story?.clip === 'swing') c.story = null;
  }
  if (threat) { Object.assign(c.threat, threat.transform); c.dangerUntil = world.tick + 120; }
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
  const goal = { x: p.x + x / n * 4, z: p.z + z / n * 4 };
  const speed = injured ? 1.4 : c.l1?.fleeSpeed ?? 3.8;
  if (!world.npcs!.move(e, goal, speed, c, .1)) world.npcs!.moveStep(e, awayX * speed / 60, awayZ * speed / 60);
  world.spatial.set(e.id, p.x, p.z);
  return true;
}
