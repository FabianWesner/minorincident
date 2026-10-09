import { Rng } from '../../core/Rng';
import { l2 } from '../../data/l2';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { AllyGun, AllyState, Point } from '../npc/types';

const half = Math.cos(l2.allies.coneDeg / 2 * Math.PI / 180);
const ticks = (s: number) => Math.round(s * 60);
/** Fresh allied-fighter component (E20 §5.2): no immunity, no survival flag; it is an ordinary live human otherwise. */
export function allyState(role: AllyState['role'], post: { x: number; z: number } | null = null, hold = false): AllyState {
  return { role, engaged: false, run: null, runSpeed: l2.allies.firefighter.moveMs, post: post ? { ...post } : null, hold, targetId: 0, nextAttack: 0, hits: 0, forceUntil: 0 };
}
/** v2 hit chance: flat to `nearM`, then linear down to `hitFar` at the gun's range. */
export function gunHitChance(gun: AllyGun, distance: number): number {
  if (distance <= gun.nearM) return gun.hitNear;
  return gun.hitNear + (gun.hitFar - gun.hitNear) * Math.min(1, (distance - gun.nearM) / Math.max(1e-6, gun.rangeM - gun.nearM));
}
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * One tick of an allied fighter (firefighter, officer or soldier), called by the outbreak layer for live civilians with
 * `ally`. Sight model of civilians (140 degree cone, 16 m, line of sight; gunmen scan all around) to acquire infected; an
 * infected that is biting a human is preferred (the rescue window is the 1.0 s grab, as for the player). Firefighters close
 * to melee reach; officers and soldiers hold their post (or follow the player as a squad, E21 §5.4) and shoot. A v2 shot
 * hits one target with a distance-dependent chance (deterministic per shooter and shot). Returns false when the ordinary
 * calm routine should run instead.
 */
export function updateAlly(world: SimWorld, e: EntitySnapshot, sees: (a: { x: number; z: number }, b: { x: number; z: number }, id: number) => boolean): boolean {
  const c = e.civilian!, a = c.ally!, tick = world.tick, ai = world.infected!, npcs = world.npcs!;
  // A rescued or startled ally does not run for a refuge: it is a fighter (state stays a live human state).
  if (c.state !== 'calm') { c.state = 'calm'; c.entered = tick; c.until = tick; world.events.emit({ type: 'civilian.state', tick, id: e.id, state: 'calm', until: tick }); }
  if (c.story && c.story.clip === 'swing' && tick - c.story.start > 30 && tick >= a.forceUntil) c.story = null;
  // Forcing the doors: a looping halligan heave (or the directing gesture), seeded per person so the crew never moves in sync.
  const forcing = a.forceClip ?? 'ff-pry';
  if (c.story && c.story.clip === forcing && tick >= a.forceUntil) c.story = null;
  if (a.forceUntil > tick) { if (c.story?.clip !== forcing) c.story = { clip: forcing, start: tick - (e.id * 17) % 40 }; return true; }
  const leader = a.follow ? world.entities.get(a.follow.targetId) : undefined, follower = !!a.follow && !!leader && leader.health.current > 0;
  // Squad: a member that has fallen behind runs to the player first; on the run it only fights what is at arm's length,
  // never a target down the street (a straggler grabbed behind the running group is on his own).
  let forced: EntitySnapshot | undefined;
  // Breakout (the first seconds after the fallback call): the squad gets out with the player instead of holding the yard.
  // Otherwise (E21 §5.4) an officer engages what it sees within 18 m while it is within 20 m of the player, and a fight in
  // progress goes on wherever the player goes (separation is real); one further back without a target regroups and picks
  // no new fight on the way.
  const breakout = follower && (a.follow!.breakoutUntil ?? 0) > tick;
  const current = a.targetId ? world.entities.get(a.targetId) : undefined;
  const fighting = !!current?.infected && current.health.current > 0 && !current.hidden && dist(current.transform, e.transform) <= (a.follow?.engageM ?? 0) * 1.2;
  if (follower && a.engaged && !a.strikeAt && (breakout || (!fighting && dist(e.transform, leader!.transform) > a.follow!.leashM))) {
    forced = ai.active.find(o => o.health.current > 0 && !o.hidden && !o.infectionRise && dist(o.transform, e.transform) < 3.5 && sees(e.transform, o.transform, o.id));
    if (!forced) { a.targetId = 0; return regroup(world, e, a, leader!.transform); }
    a.targetId = forced.id;
  }
  if (a.engaged) {
    const shooter = a.role !== 'firefighter', gun = a.gun, post = a.post ?? e.transform;
    const reachM = gun ? (a.follow ? Math.min(gun.rangeM, a.follow.engageM) : gun.rangeM) : shooter ? l2.allies.officer.rangeM + 4 : l2.allies.firefighter.engageM;
    let target = a.targetId ? world.entities.get(a.targetId) : undefined;
    if (!forced && (!target || target.health.current <= 0 || !target.infected || target.hidden || (tick + e.id) % 6 === 0)) {
      // Re-acquire: biting infected first (rescue), then the nearest visible one.
      let best: EntitySnapshot | undefined, score = Infinity;
      const fx = Math.cos(e.transform.yaw), fz = -Math.sin(e.transform.yaw);
      for (const o of ai.active) {
        if (o.health.current <= 0 || o.hidden || o.infected?.hidden || o.infectionRise) continue;
        const dx = o.transform.x - e.transform.x, dz = o.transform.z - e.transform.z, d = Math.hypot(dx, dz);
        if (d > reachM) continue;
        if (a.cover && dist(o.transform, a.cover) > (a.range ?? reachM)) continue;
        else if (!a.cover && shooter && !gun && Math.hypot(o.transform.x - post.x, o.transform.z - post.z) > (a.range ?? l2.allies.officer.rangeM)) continue;
        else if (!a.cover && gun && a.hold && a.range !== undefined && Math.hypot(o.transform.x - post.x, o.transform.z - post.z) > a.range) continue;
        const current = o.id === a.targetId;
        if (!current && d > 1.2 && (dx * fx + dz * fz) / d < half && !shooter) continue;
        if (!sees(e.transform, o.transform, o.id)) continue;
        const s = d - (o.infected?.l1?.mode === 'bite' ? 8 : 0) - (current ? 1.5 : 0);
        if (s < score) { score = s; best = o; }
      }
      target = best; a.targetId = best?.id ?? 0;
    }
    // A squad member too far from the player regroups instead of fighting (it never teleports: it runs).
    // A swing in progress lands after its windup on whatever is still in reach (no tracking, it can whiff).
    if (a.strikeAt && tick >= a.strikeAt) {
      const victim = world.entities.get(a.strikeTarget ?? 0); a.strikeAt = 0;
      if (victim?.infected && victim.health.current > 0 && world.combat) {
        const dx = victim.transform.x - e.transform.x, dz = victim.transform.z - e.transform.z, d = Math.hypot(dx, dz);
        if (gun) {
          // v2 shot: one target, a seeded roll per shooter and shot, no pierce and no ammunition.
          const hit = d <= gun.rangeM && new Rng(world.seed, `ally-shot:${e.id}:${a.hits}`).next() < gunHitChance(gun, d);
          world.events.emit({ type: 'ally.attack', tick, sourceId: e.id, targetId: victim.id, role: a.role, hit, from: { x: e.transform.x, z: e.transform.z }, to: { x: victim.transform.x, z: victim.transform.z } });
          if (hit) world.combat.damage.apply({ attackId: 0, actionId: 'weapon.pistol', sourceId: e.id, targetId: victim.id, origin: { x: e.transform.x, z: e.transform.z }, direction: { x: dx / (d || 1), z: dz / (d || 1) }, base: gun.damage, multiplier: 1, type: 'bullet', knockback: 0, stagger: .25 });
        } else {
          const def = shooter ? l2.allies.officer : l2.allies.firefighter, reach = shooter ? (a.range ?? l2.allies.officer.rangeM) + 4 : l2.allies.firefighter.reachM * 1.1;
          if (d <= reach) world.combat.damage.apply({ attackId: 0, actionId: shooter ? 'weapon.pistol' : 'weapon.fire-axe', sourceId: e.id, targetId: victim.id, origin: { x: e.transform.x, z: e.transform.z }, direction: { x: dx / (d || 1), z: dz / (d || 1) }, base: def.damage, multiplier: 1, type: shooter ? 'bullet' : 'melee', knockback: shooter ? 0 : .3, stagger: shooter ? .25 : .1 });
        }
      }
    }
    if (a.strikeAt) return true;
    if (target) {
      const dx = target.transform.x - e.transform.x, dz = target.transform.z - e.transform.z, d = Math.hypot(dx, dz);
      const reach = gun ? reachM : shooter ? l2.allies.officer.rangeM + 4 : l2.allies.firefighter.reachM;
      if (d > reach * .9 && !a.hold && !a.follow) { npcs.move(e, target.transform, a.runSpeed, c, reach * .8); return true; }
      e.transform.yaw = -Math.atan2(dz, dx);
      if (d <= reach && tick >= a.nextAttack && world.combat) {
        a.nextAttack = tick + ticks(gun ? gun.shotS : shooter ? l2.allies.officer.shotS : l2.allies.firefighter.swingS); a.hits++;
        a.strikeAt = tick + Math.max(1, ticks(shooter ? 0 : l2.allies.firefighter.windupS)); a.strikeTarget = target.id;
        c.story = shooter ? { clip: 'npc-gesture', start: tick } : { clip: 'swing', start: tick };
        if (!gun) world.events.emit({ type: 'ally.attack', tick, sourceId: e.id, targetId: target.id, role: a.role });
      }
      return true;
    }
  }
  if (a.run) {
    if (Math.hypot(a.run.x - e.transform.x, a.run.z - e.transform.z) <= .35) { a.run = null; return true; }
    npcs.move(e, a.run, a.runSpeed, c, .25); return true;
  }
  if (follower) return regroup(world, e, a, leader!.transform);
  // Disengaged fighters follow their routine; a held post (officers) is kept regardless.
  if (!a.engaged && !a.hold) return false;
  const post = a.post;
  if (post && Math.hypot(post.x - e.transform.x, post.z - e.transform.z) > (a.hold ? .4 : l2.allies.regroupM)) npcs.move(e, post, a.hold ? 2 : a.runSpeed * .8, c, a.hold ? .3 : l2.allies.regroupM * .5);
  return true;
}
/** Squad: stay 2-6 m from the player on an own slot around it; regroup when the player moves on (E21 §5.4). Never teleports. */
function regroup(world: SimWorld, e: EntitySnapshot, a: AllyState, p: Point): boolean {
  const f = a.follow!, d = dist(e.transform, p);
  if (d > f.maxM) {
    const angle = f.slot * 2.39996 + Math.PI, r = (f.minM + f.maxM) / 2, slot = { x: p.x + Math.cos(angle) * r, z: p.z + Math.sin(angle) * r };
    const goal = world.infected!.nav.clear(slot.x, slot.z, .4) ? slot : p;
    world.npcs!.move(e, goal, d > f.maxM + 2 ? f.moveMs : f.moveMs * .9, e.civilian!, f.minM * .5);
  }
  return true;
}
