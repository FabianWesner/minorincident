import { l5 } from '../../data/l5';
import { corpseDetour, formationBack, formationSlot } from '../missions/missionHelpers';
import { idleEligible, looseSlotOffset } from './groupNature';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';

const ticks = (s: number) => Math.round(s * 60);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** The shared L5 follower combat state: a visible threat near the follower or courier. */
export function followerInCombat(world: SimWorld, follower: EntitySnapshot): boolean {
  const player = world.entities.get(1);
  if (!player) return false;
  const f = l5.follow;
  return world.infected!.active.some(o => o.health.current > 0 && !o.hidden && !o.infected?.hidden && !o.infectionRise &&
    (dist(o.transform, follower.transform) <= f.coverM && world.infected!.nav.visible(follower.transform, o.transform, 0) ||
     dist(o.transform, player.transform) <= f.waitCallM && world.infected!.nav.visible(player.transform, o.transform, 0)));
}
/** Per-second correction toward the moving formation slot (1/s). */
const slotGain = 1.5;
/** Per-tick easing of the perceived courier pace (time constant 0.6 s). */
const paceEase = 1 / 36;
/** Rise with the courier at once; ease off when she slows or stops. */
export function courierPace(s: { pace?: { x: number; z: number; tick: number } }, v: Point, tick: number): { x: number; z: number } {
  const last = s.pace;
  if (!last || tick - last.tick > 1 || Math.hypot(v.x, v.z) >= Math.hypot(last.x, last.z) * (1 - paceEase)) s.pace = { x: v.x, z: v.z, tick };
  else s.pace = { x: last.x + (v.x - last.x) * paceEase, z: last.z + (v.z - last.z) * paceEase, tick };
  return s.pace;
}

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
    if (c.story?.clip === 'npc-cower' || c.story?.clip === 'shoot' || c.story?.clip === 'swing') c.story = null;
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
  // Heal during the group's rests; a personal pickup detour must not strand
  // one follower behind a moving escort.
  const velocity = player.survivor?.velocity ?? { x: 0, z: 0 };
  if (!threat && world.scenario === 'L5' && Math.hypot(velocity.x, velocity.z) <= .2 && world.pickups?.seekSurvivorMedkit(e)) return true;
  const d = dist(me, p);
  if (d > f.waitCallM && tick >= s.waitAt) { s.waitAt = tick + ticks(f.waitEveryS); world.events.emit({ type: 'l5.wait', tick, id: e.id }); }
  // Slot: three columns behind a moving courier, within 2-5 m of a resting courier.
  const v = player.survivor?.velocity ?? { x: 0, z: 0 }, speed = Math.hypot(v.x, v.z), slot = Math.max(0, s.slot);
  const behind = speed > .2 ? -((me.x - p.x) * v.x + (me.z - p.z) * v.z) / speed : 0;
  const inCombat = followerInCombat(world, e);
  if (inCombat) delete s.corpseRoute;
  const catchingUp = !inCombat && speed > .2 && behind > f.maxM;
  const stop = formationBack(slot);
  const pace = courierPace(s, v, tick), paceSpeed = Math.hypot(pace.x, pace.z);
  if (!inCombat && paceSpeed > .8) {
    // Calm escort travel tracks the moving formation slot: walk with the
    // courier's velocity plus a correction toward the slot. A follower ahead
    // of its slot eases off instead of standing until it is passed, and one
    // behind it closes at no more than 1.05x the courier's speed (L5-08), so
    // the group does not lag a full braking distance after every start. In
    // combat the authored 3.8 m/s run and defensive slot below apply. The
    // perceived pace rides through a courier's momentary stops, and beside a
    // wall the side slot falls back to single file on the courier's line.
    const heading = { x: pace.x / paceSpeed, z: pace.z / paceSpeed }, nav = world.infected!.nav;
    // Keep both moving rows inside the 2-5 m band with room on each side for
    // the resolved body's turning and braking error (2.7 m and 3.4 m back; the
    // shared slots sit 2.3 m back, 0.3 m from the band's near edge). The rear
    // row staggers into the front row's gaps so the rows can sit close.
    // r12-group: a little personal sideways offset so the five do not walk an exact pattern.
    const row = Math.floor(slot / 3), back = 2.7 + row * .7, side = (row ? [-.6, .6, 0][slot % 3] : (slot % 3 - 1) * 1.2) + looseSlotOffset(slot).side * .4;
    const target = [{ x: p.x - heading.x * back - heading.z * side, z: p.z - heading.z * back + heading.x * side }, { x: p.x - heading.x * back, z: p.z - heading.z * back }]
      .find(t => nav.clear(t.x, t.z, .35) && nav.visible(t, p, .35));
    if (target) {
      // Closing the gap along the route has priority over sliding sideways
      // into the column, so a capped catch-up never loses ground to steering.
      const ex = target.x - me.x, ez = target.z - me.z, cap = paceSpeed * 1.05;
      // A follower ahead of its slot (left beside her at a stop) drops back twice as briskly.
      const ahead = ex * heading.x + ez * heading.z;
      const along = Math.max(0, Math.min(cap, paceSpeed + ahead * (ahead < 0 ? 2 * slotGain : slotGain)));
      const sideRoom = Math.sqrt(Math.max(0, cap * cap - along * along));
      const across = Math.max(-sideRoom, Math.min(sideRoom, (ez * heading.x - ex * heading.z) * slotGain));
      const vx = heading.x * along - heading.z * across, vz = heading.z * along + heading.x * across;
      const step = Math.hypot(vx, vz), aim = { x: me.x + vx * .5, z: me.z + vz * .5 };
      // With a wall between the follower and its heading, route to where the
      // slot will be in half a second, so the route does not brake on arrival.
      const lead = { x: target.x + pace.x * .5, z: target.z + pace.z * .5 };
      // A short clear stride can still lead into a frontage pocket while the
      // courier is around its corner. Keep the global slot route until it is visible.
      let goal = nav.visible(me, target, .35) && nav.visible(me, aim, .35) ? aim : nav.clear(lead.x, lead.z, .35) && nav.visible(target, lead, .35) ? lead : target;
      // Large corpses are physical bodies but are absent from the route grid.
      // Reuse L7's swept local detour before the calm stride enters one.
      goal = aroundCorpse(world, e, goal);
      // Track her already smooth pace without the crowd response lag: a
      // critically damped 6/s response trails a starting courier by 1-1.5 m,
      // which a 1.05x catch-up then needs seconds to win back.
      s.briskAt = tick;
      if (step > .3 && world.npcs!.move(e, goal, step, c, 0)) {
        world.spatial.set(e.id, me.x, me.z);
        return true;
      }
    }
  }
  let goal: Point = p, reach = stop;
  if (speed > .8 || threat) {
    const toward = threat ? { x: threat.transform.x - p.x, z: threat.transform.z - p.z } : v;
    const length = Math.hypot(toward.x, toward.z) || 1;
    // Three columns reuse the later campaign formation. The old last slot
    // sat 1.9 m off the route and repeatedly braked/slid against street cover.
    const target = formationSlot(p, { x: toward.x / length, z: toward.z / length }, slot);
    const nav = world.infected!.nav;
    // Match allied followers: a clear slot beyond a wreck is not a reachable
    // formation slot. Follow the courier's line until both segments are clear.
    // A turning leader can swing one slot behind its follower. Keep travelling
    // toward the leader until the formation slot is ahead again.
    const ahead = speed <= .8 || (target.x - me.x) * v.x + (target.z - me.z) * v.z >= 0;
    if (ahead && nav.clear(target.x, target.z, .35) && nav.visible(me, target, .35) && nav.visible(target, p, .35)) { goal = target; reach = .5; }
  }
  if (goal === p ? d > stop + .8 : dist(me, goal) > reach + .4) {
    const toGoal = dist(me, goal), normalSpeed = speed > .8 || d > f.maxM || toGoal > 3 ? f.runMs : f.walkMs;
    const speedMs = catchingUp ? Math.max(normalSpeed, speed * 1.05)
      : !inCombat && speed > .2 ? Math.max(normalSpeed, speed) : normalSpeed;
    // The shared resolved-motion limiter applies the outside-combat catch-up
    // cap. Keep navigation's requested speed at the authored run pace so the
    // extra catch-up speed does not distort path steering or threat reachability.
    const routed = inCombat ? goal : aroundCorpse(world, e, goal);
    world.npcs!.move(e, routed, speedMs, c, routed === p ? reach : 0);
  } else if (s.restAt === undefined || tick - s.restAt < 20 || !idleEligible(e)) {
    // Settled followers look around on their own (groupNature.idleLookYaw); until then face the courier.
    const yaw = -Math.atan2(p.z - me.z, p.x - me.x), delta = Math.atan2(Math.sin(yaw - me.yaw), Math.cos(yaw - me.yaw));
    me.yaw += Math.max(-.1, Math.min(.1, delta));
  }
  world.spatial.set(e.id, me.x, me.z);
  return true;
}

/** Keep the L7 swept legs until reached; recomputing an arc every tick can orbit the body. */
function aroundCorpse(world: SimWorld, e: EntitySnapshot, goal: Point): Point {
  if (world.scenario !== 'L5') return goal;
  const s = e.civilian!.survivor!;
  while (s.corpseRoute?.length && dist(e.transform, s.corpseRoute[0]) < .15) s.corpseRoute.shift();
  if (!s.corpseRoute?.length) s.corpseRoute = corpseDetour(world, e, goal);
  return s.corpseRoute?.[0] ?? goal;
}
