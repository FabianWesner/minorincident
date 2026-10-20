import { l5 } from '../../data/l5';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';

const ticks = (s: number) => Math.round(s * 60);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * One tick of a found E23 survivor (called by the outbreak layer for live civilians with `survivor` in follow mode). They are biteable humans like anyone else; the escort rules of section 5.4: follow the courier at 2-5 m (each in its own slot behind and to
 * the side of her; through a narrow passage the grid route makes them single file), run at 3.8 m/s (slower than the courier and
 * every infected), call "Wait!" when more than 10 m behind, and briefly crouch before regrouping when an infected is within 8 m. No fail state: a
 * survivor that is lost is simply gone. Returns true (the follower owns the tick).
 */
export function updateSurvivor(world: SimWorld, e: EntitySnapshot): boolean {
  if (e.passengerOf !== undefined) return true;
  const c = e.civilian!, s = c.survivor!, tick = world.tick, f = l5.follow;
  if (world.missions?.l8?.follower(e)) return true;
  if (world.l7Encounters?.follower(e) || world.missions?.l6?.follower(e)) return true;
  if (s.mode !== 'follow') return false;
  // Ordinary formation resumes only after the shared defence/release reaction has finished.
  if (c.state !== 'calm') { c.state = 'calm'; c.entered = tick; c.until = tick; world.events.emit({ type: 'civilian.state', tick, id: e.id, state: 'calm', until: tick }); }
  const player = world.entities.get(1)!, me = e.transform, p = player.transform;
  const ingress = world.missions?.l5?.ingress(e);
  c.supportFeet = !!ingress;
  if (ingress) {
    s.cover = false;
    if (c.story?.clip === 'npc-cower') c.story = null;
    if (dist(me, ingress) > .15) world.npcs!.move(e, ingress, f.runMs, c, .1);
    world.spatial.set(e.id, me.x, me.z);
    return true;
  }
  // A threat causes one brief cower, then the survivor regroups behind the protector.
  // Keep the reaction latched until the threat leaves so proximity cannot restart it every tick.
  let threat: EntitySnapshot | undefined;
  for (const o of world.infected!.active) if (o.health.current > 0 && !o.hidden && !o.infected?.hidden && !o.infectionRise && dist(o.transform, me) <= f.coverM && world.infected!.nav.visible(me, o.transform, 0)) {
    if (!threat || dist(o.transform, me) < dist(threat.transform, me)) threat = o;
  }
  if (!threat) delete s.fearUntil;
  else s.fearUntil ??= tick + ticks(f.reactS);
  s.cover = !!threat && tick < s.fearUntil!;
  if (s.cover) {
    if (c.story?.clip !== 'npc-cower') c.story = { clip: 'npc-cower', start: tick - (e.id * 11) % 30 };
    world.spatial.set(e.id, me.x, me.z);
    return true;
  }
  if (c.story?.clip === 'npc-cower') c.story = null;
  if (!threat && world.scenario === 'L5' && world.pickups?.seekSurvivorMedkit(e)) return true;
  const d = dist(me, p);
  if (d > f.waitCallM && tick >= s.waitAt) { s.waitAt = tick + ticks(f.waitEveryS); world.events.emit({ type: 'l5.wait', tick, id: e.id }); }
  // Slot: behind the courier when she moves (alternating sides, a little further back for each follower), anywhere 2-5 m around her when she stands.
  const v = player.survivor?.velocity ?? { x: 0, z: 0 }, speed = Math.hypot(v.x, v.z), slot = Math.max(0, s.slot);
  const stop = f.minM + .3 + .5 * slot;
  let goal: Point = p, reach = stop;
  if (speed > .8 || threat) {
    const toward = threat ? { x: threat.transform.x - p.x, z: threat.transform.z - p.z } : v;
    const length = Math.hypot(toward.x, toward.z) || 1;
    const hx = toward.x / length, hz = toward.z / length, back = f.minM + .3 + .55 * slot, side = (slot % 2 ? 1 : -1) * (.9 + .5 * Math.floor(slot / 2));
    const target = { x: p.x - hx * back - hz * side, z: p.z - hz * back + hx * side };
    if (world.infected!.nav.clear(target.x, target.z, .35)) { goal = target; reach = .5; }
  }
  if (goal === p ? d > stop + .8 : dist(me, goal) > reach + .4) {
    const toGoal = dist(me, goal), speedMs = d > f.maxM || toGoal > 3 ? f.runMs : f.walkMs;
    world.npcs!.move(e, goal, speedMs, c, reach);
  } else {
    const yaw = -Math.atan2(p.z - me.z, p.x - me.x), delta = Math.atan2(Math.sin(yaw - me.yaw), Math.cos(yaw - me.yaw));
    me.yaw += Math.max(-.1, Math.min(.1, delta));
  }
  world.spatial.set(e.id, me.x, me.z);
  return true;
}
