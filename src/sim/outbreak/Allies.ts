import { l3 } from '../../data/l3';
import { Rng } from '../../core/Rng';
import { l2 } from '../../data/l2';
import { l4 } from '../../data/l4';
import { policeTactics as pt } from '../../data/l3';
import { policeTargetInView, policeShotRangeM } from '../../data/cameraFraming';
import { allyCadence, allyCallout, allyOffscreenDefenceM, allyTactics, allyViewM, type AllyTactic } from '../../data/allyCombat';
import type { SimWorld } from '../world/SimWorld';
import type { SpawnDirector } from '../ai/SpawnDirector';
import type { EntitySnapshot } from '../world/types';
import type { AllyGun, AllyState, Point } from '../npc/types';

const civ = l4.civilians;
const half = Math.cos(l2.allies.coneDeg / 2 * Math.PI / 180);
const ticks = (s: number) => Math.round(s * 60);
/** Fresh allied-fighter component (E20 §5.2): no immunity, no survival flag; it is an ordinary live human otherwise. */
export function allyState(role: AllyState['role'], post: { x: number; z: number } | null = null, hold = false): AllyState {
  return { role, engaged: false, run: null, runSpeed: l2.allies.firefighter.moveMs, post: post ? { ...post } : null, hold, targetId: 0, nextAttack: 0, hits: 0, forceUntil: 0 };
}
/** A level handover keeps the gun but starts a new clock and discards the previous fight's orders/targets. */
export function readyCarriedAlly(e: EntitySnapshot, tick: number): void {
  const c = e.civilian!, a = c.ally;
  delete c.dangerUntil;
  if (!a) return;
  a.nextAttack = tick; a.targetId = 0; a.strikeAt = 0; a.forceUntil = 0; a.post = null; a.run = null; a.hold = false;
  a.mag = 0; a.burstN = 0; a.lastHp = e.health.current;
  for (const key of ['follow', 'cover', 'strikeTarget', 'step', 'stepAfter', 'still', 'reloadUntil', 'flinchUntil', 'panicUntil', 'blockedAt', 'aimMoveAt', 'aimMoveRestUntil', 'calloutAt'] as const) delete a[key];
}
/** v2 hit chance: flat to `nearM`, then linear down to `hitFar` at the gun's range. */
export function gunHitChance(gun: AllyGun, distance: number): number {
  if (distance <= gun.nearM) return gun.hitNear;
  return gun.hitNear + (gun.hitFar - gun.hitNear) * Math.min(1, (distance - gun.nearM) / Math.max(1e-6, gun.rangeM - gun.nearM));
}
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
// A retreat order (`a.run`) can cross a whole district: the L3 straggler route from the station to the relocated army
// boom needs ~32k A* nodes, far beyond the 1600-node per-tick NPC budget. The route is cached once found.
const runBudget = 48_000;

/**
 * One tick of an allied fighter (firefighter, officer or soldier), called by the outbreak layer for live civilians with
 * `ally`. Sight model of civilians (140 degree cone, 16 m, line of sight; gunmen scan all around) to acquire infected; an
 * infected that is biting a human is preferred (the rescue window is the 1.0 s grab, as for the player). Firefighters close
 * to melee reach; officers and soldiers hold their post (or follow the player as a squad, E21 §5.4) and shoot. A v2 shot
 * hits one target with a distance-dependent chance (deterministic per shooter and shot). Returns false when the ordinary
 * calm routine should run instead.
 */
export function updateAlly(world: SimWorld, e: EntitySnapshot, sees: (a: { x: number; z: number }, b: { x: number; z: number }, id: number) => boolean): boolean {
  if (e.passengerOf !== undefined) return true;
  const c = e.civilian!, a = c.ally!, tick = world.tick, ai = world.infected!, npcs = world.npcs!;
  if (e.health.current <= 0 || tick < c.knockedUntil) { a.strikeAt = 0; return true; }
  const shooter = a.role !== 'firefighter' && !(a.role === 'civilian' && !a.gun);
  const travelFacing = shooter && c.state !== 'grabbed' && tick < (a.aimMoveRestUntil ?? 0) && Math.hypot(e.locomotion?.vx ?? 0, e.locomotion?.vz ?? 0) > .12;
  if (travelFacing) { a.strikeAt = 0; if (c.story?.clip === 'shoot') c.story = null; }
  // Hit flinch: any health lost since the last tick plays the hurt clip and holds fire for a quarter second.
  if (a.lastHp !== undefined && e.health.current < a.lastHp - .5 && c.state !== 'grabbed') {
    a.flinchUntil = tick + 16; a.nextAttack = Math.max(a.nextAttack, tick + 16); a.strikeAt = 0; a.step = undefined; c.story = { clip: 'hurt', start: tick };
  }
  a.lastHp = e.health.current;
  if (c.story?.clip === 'hurt' && tick >= (a.flinchUntil ?? 0)) c.story = null;
  if (tick < (a.flinchUntil ?? 0)) return true;
  const visible = (from: EntitySnapshot['transform'], to: EntitySnapshot['transform'], id: number) => shooter
    ? (from.y > 2.5 || sees(from, to, id)) && world.combat!.query.shotVisible(from, to, id) : sees(from, to, id);
  const player = world.entities.get(1);
  // The army covers the retreat. Continue the ordinary self-defence shot while moving through the open checkpoint.
  if (world.missions?.def.l3 && a.follow && a.run && player && player.transform.x > l3.finale.passX && e.transform.x < l3.map.zoneX && c.state !== 'grabbed') {
    npcs.move(e, a.run, a.follow.moveMs, c, .5);
  }
  const heard = (target: EntitySnapshot) => ai.hearing.hears(e, target.transform);
  const defence = (target: EntitySnapshot) => a.role === 'officer' && dist(target.transform, e.transform) <= pt.defendM;
  const policeRule = (target: EntitySnapshot) => a.role !== 'officer' || defence(target) || (!!player && policeTargetInView(target.transform.x - player.transform.x, target.transform.z - player.transform.z) && dist(target.transform, e.transform) <= policeShotRangeM);
  // PO 2026-10-13: a gun only fires at what the player can see (the sim camera frame, at most 22 m from the courier); an infected
  // at arm's length still takes the shove or rifle butt, wherever it is.
  // Police keep the strict rule everywhere (PO 10-12: "Ideally the Zombies will win against police") and only shove off screen.
  // Orchestrator 2026-10-13 (option 3): the rule binds allies the player can see (in the frame, at most 22 m from the courier); they
  // shoot only what is in view, plus self-defence within 6 m. Allies away from the player fight their own war as before.
  const onScreen = a.role === 'officer' || allyOnScreen(world, e.transform);
  const inView = (target: EntitySnapshot) => !onScreen || playerSees(world, target.transform)
    || allyOffscreenDefenceM > 0 && a.role !== 'officer' && dist(target.transform, e.transform) <= allyOffscreenDefenceM;
  const policeCanEngage = (target: EntitySnapshot) => policeRule(target) && (!shooter || dist(target.transform, e.transform) <= pt.batonReachM * 1.15 || inView(target));
  // Hearing only controls civilian panic and forced work. An ordinary soldier
  // already fighting has no use for this extra line-of-sight scan.
  const audibleThreat = (a.role === 'civilian' || a.forceUntil > tick)
    && ai.active.some(o => o.health.current > 0 && !o.hidden && !o.infected?.hidden && !o.infectionRise && heard(o));
  // E22 §5.4: an armed civilian fights, but flees (the ordinary pedestrian flight) when 3 infected are within 4 m.
  if (!c.survivor && tick >= (c.dangerUntil ?? 0) && a.role === 'civilian' && c.state === 'flee' && tick < (a.panicUntil ?? 0) && !audibleThreat) return false;
  if (!c.survivor && tick >= (c.dangerUntil ?? 0) && a.role === 'civilian' && a.engaged && !audibleThreat && (tick + e.id) % 6 === 0) {
    let close = 0;
    for (const o of ai.active) if (o.health.current > 0 && !o.hidden && !o.infectionRise && dist(o.transform, e.transform) <= civ.panicRadiusM && ++close >= civ.panicInfected) break;
    if (close >= civ.panicInfected) {
      a.panicUntil = tick + ticks(civ.panicS); a.targetId = 0; a.strikeAt = 0; c.story = null;
      c.state = 'flee'; c.entered = tick; c.until = tick; if (c.l1) c.l1.repickAt = tick;
      world.events.emit({ type: 'civilian.state', tick, id: e.id, state: 'flee', until: tick });
      return false;
    }
  }
  // A rescued or startled ally does not run for a refuge: it is a fighter (state stays a live human state).
  if (c.state !== 'calm' && c.state !== 'grabbed') { c.state = 'calm'; c.entered = tick; c.until = tick; world.events.emit({ type: 'civilian.state', tick, id: e.id, state: 'calm', until: tick }); }
  if (c.story && c.story.clip === 'swing' && tick - c.story.start > 30 && tick >= a.forceUntil) c.story = null;
  // Police aim: the two-handed stance is held while a target is in the sights, then the gun goes back down (idle, lowered ready).
  if (c.story && c.story.clip === 'shoot' && (tick - c.story.start > ticks(pt.aimHoldS) || (!a.targetId && tick - c.story.start > 20))) c.story = null;
  // Forcing the doors: a looping halligan heave (or the directing gesture), seeded per person so the crew never moves in sync.
  const forcing = a.forceClip ?? 'ff-pry';
  if (c.story && c.story.clip === forcing && tick >= a.forceUntil) c.story = null;
  if (a.forceUntil > tick && !audibleThreat) { if (c.story?.clip !== forcing) c.story = { clip: forcing, start: tick - (e.id * 17) % 40 }; return true; }
  const leader = a.follow ? world.entities.get(a.follow.targetId) : undefined, follower = !!a.follow && !!leader && leader.health.current > 0;
  // Close threats interrupt regrouping, including a straggler's own defence.
  let forced: EntitySnapshot | undefined;
  // Breakout (the first seconds after the fallback call): the squad gets out with the player instead of holding the yard.
  // Moving beyond the follow leash ends even an existing fight: the squad catches up through shared E08 navigation.
  const breakout = follower && (a.follow!.breakoutUntil ?? 0) > tick;
  // Engaged fighters already scan their targets below; only idle fighters and
  // followers considering regrouping consume the separate close-threat result.
  const closeThreat = (!a.engaged || follower)
    && ai.active.some(o => o.health.current > 0 && !o.hidden && !o.infected?.hidden && !o.infectionRise && (defence(o) || heard(o)) && visible(e.transform, o.transform, o.id));
  if (!a.engaged && !closeThreat) { a.targetId = 0; a.strikeAt = 0; a.baton = false; }
  if (follower && a.engaged && !closeThreat && !a.strikeAt && (breakout || dist(e.transform, leader!.transform) > a.follow!.leashM)) {
    forced = dist(e.transform, leader!.transform) <= a.follow!.leashM ? ai.active.find(o => o.health.current > 0 && !o.hidden && !o.infectionRise && policeCanEngage(o) && dist(o.transform, e.transform) < 3.5 && visible(e.transform, o.transform, o.id)) : undefined;
    if (!forced) { a.targetId = 0; return regroup(world, e, a, leader!.transform); }
    a.targetId = forced.id;
  }
  if (a.engaged || closeThreat) {
    const gun = a.gun, shooter = a.role !== 'firefighter' && !(a.role === 'civilian' && !gun), post = a.post ?? e.transform;
    // Improvised melee (bat, pipe, crowbar) is the firefighter swing with the weapon's own numbers.
    const ff = a.melee ? { ...l2.allies.firefighter, damage: a.melee.damage, reachM: a.melee.reachM, swingS: a.melee.swingS } : l2.allies.firefighter;
    const reachM = gun ? (a.follow ? Math.min(gun.rangeM, a.follow.engageM) : gun.rangeM) : shooter ? l2.allies.officer.rangeM + 4 : ff.engageM;
    let target = c.state === 'grabbed' ? world.entities.get(c.attacker) : a.targetId ? world.entities.get(a.targetId) : undefined;
    // Recheck the camera/self-defence rule on cached targets as well as new scans.
    if (target && !policeCanEngage(target)) { target = undefined; a.targetId = 0; }
    if (c.state !== 'grabbed' && !forced && (!target || target.health.current <= 0 || !target.infected || target.hidden || (tick + e.id) % (a.role === 'soldier' ? 15 : 6) === 0)) {
      // Soldiers concentrate on visible Alphas within their firing range; other allies keep the rescue priority.
      let best: EntitySnapshot | undefined, score = Infinity;
      const fx = Math.cos(e.transform.yaw), fz = -Math.sin(e.transform.yaw);
      const compound = world.missions?.def.l3 && a.role === 'soldier';
      for (const o of ai.active) {
        if (o.health.current <= 0 || o.hidden || o.infected?.hidden || o.infectionRise) continue;
        const dx = o.transform.x - e.transform.x, dz = o.transform.z - e.transform.z, d = Math.hypot(dx, dz);
        const defending = a.role === 'officer' && d <= pt.defendM;
        // Half a metre of hysteresis: a fighter stepping between firing positions keeps a target at the edge of its range.
        if (d > reachM + (o.id === a.targetId ? .5 : 0) && !defending) continue;
        if (!defending && a.cover && dist(o.transform, a.cover) > (a.range ?? reachM)) continue;
        else if (!defending && !a.cover && shooter && !gun && Math.hypot(o.transform.x - post.x, o.transform.z - post.z) > (a.range ?? l2.allies.officer.rangeM)) continue;
        else if (!defending && !a.cover && gun && a.hold && a.range !== undefined && Math.hypot(o.transform.x - post.x, o.transform.z - post.z) > a.range) continue;
        // Out-of-range candidates cannot be acquired, regardless of camera policy.
        if (!policeCanEngage(o)) continue;
        const current = o.id === a.targetId;
        if (!current && d > 1.2 && (dx * fx + dz * fz) / d < half && !shooter && !heard(o)) continue;
        // The L3 line protects the resting compound: a breach or a body getting up inside takes precedence over the
        // next outside pursuer. Visibility, cover, range and friendly-fire clearance still apply.
        const breach = compound && o.transform.x >= l3.map.zoneX;
        const s = d - (o.infected?.l1?.mode === 'bite' ? 8 : 0) - (current ? 1.5 : 0) - (breach ? l3.soldiers.coverM : 0);
        const alpha = a.role === 'soldier' && o.archetype === 'infected.alpha';
        const bestAlpha = a.role === 'soldier' && best?.archetype === 'infected.alpha';
        // A candidate that cannot outrank the current visible choice needs no
        // cover rays. Keep the exact Alpha/rescue/current-target score and ties.
        if (((alpha && !bestAlpha) || (alpha === bestAlpha && s < score)) && visible(e.transform, o.transform, o.id)) { score = s; best = o; }
      }
      if (best && best.id !== a.targetId && (defence(best) || heard(best))) a.nextAttack = Math.min(a.nextAttack, tick + 15);
      if (best && best.id !== a.targetId && a.role === 'soldier' && dist(best.transform, e.transform) < 5) callout(world, e, "They're inside!");
      target = best; a.targetId = best?.id ?? 0;
    }
    // A pending strike retains its own victim through a target rescan.
    // A swing in progress lands after its windup on whatever is still in reach (no tracking, it can whiff).
    if (a.strikeAt && tick >= a.strikeAt) {
      const victim = world.entities.get(a.strikeTarget ?? 0); a.strikeAt = 0;
      const allowed = !!victim && policeCanEngage(victim) && !victim.hidden && !victim.infected?.hidden && !victim.infectionRise && visible(e.transform, victim.transform, victim.id)
        && (!shooter || a.baton || world.combat!.query.alliedShotClear(e, victim, tick) && inView(victim));
      if (!allowed) a.baton = false;
      if (allowed && victim?.infected && victim.health.current > 0 && world.combat) {
        const dx = victim.transform.x - e.transform.x, dz = victim.transform.z - e.transform.z, d = Math.hypot(dx, dz);
        if (a.baton) {
          // Police shove/baton at arm's length: heavy stagger and knockback, little damage.
          a.baton = false;
          if (d <= pt.batonReachM * 1.15) world.combat.damage.apply({ attackId: 0, actionId: 'weapon.fists', sourceId: e.id, targetId: victim.id, origin: { x: e.transform.x, z: e.transform.z }, direction: { x: dx / (d || 1), z: dz / (d || 1) }, base: pt.batonDamage, multiplier: 1, type: 'melee', knockback: victim.archetype === 'infected.alpha' ? 0 : .6, stagger: victim.archetype === 'infected.alpha' ? 0 : .5 });
          world.events.emit({ type: 'ally.attack', tick, sourceId: e.id, targetId: victim.id, role: a.role });
        } else if (gun) {
          // v2 shot: one target, a seeded roll per shooter and shot, no pierce and no ammunition.
          const hit = d <= gun.rangeM + .5 && new Rng(world.seed, `ally-shot:${e.id}:${a.hits}`).next() < gunHitChance(gun, d);
          world.events.emit({ type: 'ally.attack', tick, sourceId: e.id, targetId: victim.id, role: a.role, ...(a.weapon ? { weapon: a.weapon } : {}), hit, from: { x: e.transform.x, z: e.transform.z }, to: { x: victim.transform.x, z: victim.transform.z } });
          // An Alpha (E07 heavy) shrugs off allied rifle stagger; damage is unchanged (l4-collapse: crowds of soldiers otherwise pin it forever).
          if (hit) world.combat.damage.apply({ attackId: 0, actionId: a.actionId ?? 'weapon.pistol', sourceId: e.id, targetId: victim.id, origin: { x: e.transform.x, z: e.transform.z }, direction: { x: dx / (d || 1), z: dz / (d || 1) }, base: gun.damage, multiplier: 1, type: 'bullet', knockback: 0, stagger: victim.archetype === 'infected.alpha' ? 0 : .25 });
        } else {
          const def = shooter ? l2.allies.officer : ff, reach = shooter ? (a.range ?? l2.allies.officer.rangeM) + 4 : ff.reachM * 1.1;
          if (d <= reach) world.combat.damage.apply({ attackId: 0, actionId: shooter ? 'weapon.pistol' : 'weapon.fire-axe', sourceId: e.id, targetId: victim.id, origin: { x: e.transform.x, z: e.transform.z }, direction: { x: dx / (d || 1), z: dz / (d || 1) }, base: def.damage, multiplier: 1, type: shooter ? 'bullet' : 'melee', knockback: shooter ? 0 : .3, stagger: shooter ? .25 : .1 });
          if (shooter && d <= reach) world.events.emit({ type: 'ally.attack', tick, sourceId: e.id, targetId: victim.id, role: a.role, hit: true, from: { x: e.transform.x, z: e.transform.z }, to: { x: victim.transform.x, z: victim.transform.z } });
        }
      }
    }
    if (a.strikeAt) return true;
    if (c.state === 'grabbed' && target) a.targetId = target.id;
    if (target) {
      if (!visible(e.transform, target.transform, target.id)) { a.targetId = 0; return true; }
      // Defend while obeying retreat orders and catching up; only a contact shove plants the officer.
      if (c.state !== 'grabbed' && dist(e.transform, target.transform) > pt.batonReachM) {
        if (a.run) npcs.move(e, a.run, a.runSpeed, c, .25, runBudget);
        else if (follower && (breakout || dist(e.transform, leader!.transform) > a.follow!.leashM)) regroup(world, e, a, leader!.transform);
      }
      const dx = target.transform.x - e.transform.x, dz = target.transform.z - e.transform.z, d = Math.hypot(dx, dz);
      const reach = defence(target) ? Math.max(reachM, pt.defendM) : gun ? reachM : shooter ? l2.allies.officer.rangeM + 4 : ff.reachM;
      if (d > reach * .9 && !a.hold && !a.follow && !a.run) { npcs.move(e, target.transform, a.runSpeed, c, reach * .8); return true; }
      // The travel-facing interval lowers the gun while the fighter keeps its retreat order.
      if (travelFacing) return true;
      e.transform.yaw = -Math.atan2(dz, dx);
      const reloading = tick < (a.reloadUntil ?? 0);
      if (shooter && c.state !== 'grabbed' && c.story?.clip !== 'shoot' && !reloading) c.story = { clip: 'shoot', start: tick };
      // Every shooter fights on the move (PO 2026-10-13); scripted runs and the raised army deck keep their own movement.
      // A subway guard catching the column keeps shooting, but a firing-position
      // backstep must not override its retreat movement. Contact shoves still run.
      const columnRun = a.run && c.survivor?.mode === 'follow' && !!world.missions?.state.l6;
      if (shooter && !a.strikeAt && (a.role === 'officer' || !a.run) && (!columnRun || d <= pt.batonReachM) && e.transform.y < 2.5 && tactics(world, e, a, target, d, dx, dz)) return true;
      if (d <= reach + (shooter ? .5 : 0) && tick >= a.nextAttack && world.combat) {
        // A person in the line of fire holds the shot (never a friendly-fire roll).
        // After a second of waiting the shooter sidesteps to clear it (nobody stands for long behind someone).
        if (shooter && !world.combat.query.alliedShotClear(e, target, tick)) {
          a.blockedAt ??= tick;
          if (tick - a.blockedAt >= 60 && e.transform.y < 2.5 && !a.run) clearLine(world, e, a, target, dx / (d || 1), dz / (d || 1));
          return true;
        }
        a.blockedAt = undefined;
        a.nextAttack = tick + (shooter ? cadence(world, e, a, gun ? gun.shotS : l2.allies.officer.shotS) : ticks(ff.swingS)); a.hits++;
        a.strikeAt = tick + Math.max(1, ticks(shooter ? 0 : ff.windupS)); a.strikeTarget = target.id;
        // Shooters raise the gun (recoil replays on every shot), melee fighters swing the halligan (strike frame = windup).
        c.story = shooter ? gun || a.role === 'officer' ? { clip: 'shoot', start: tick } : { clip: 'npc-gesture', start: tick } : { clip: 'swing', start: tick, prop: 'crowbar' };
        if (!gun && !shooter) world.events.emit({ type: 'ally.attack', tick, sourceId: e.id, targetId: target.id, role: a.role });
      }
      return true;
    }
  }
  // Losing a target must not cancel a move to cover halfway through the step.
  // A walking leader takes priority over the old firing position, including inside
  // the follow band. Finish a stationary formation's step without delaying regrouping.
  const leaderMoving = follower && Math.hypot(leader!.survivor?.velocity.x ?? 0, leader!.survivor?.velocity.z ?? 0) > .5;
  const inFormation = !follower || !breakout && !leaderMoving && dist(e.transform, leader!.transform) >= a.follow!.minM && dist(e.transform, leader!.transform) <= a.follow!.maxM;
  // Once the retreat reaches the streets, targetless officers regroup rather
  // than finishing the station's old firing position. Other levels keep their orders.
  const stationFight = !world.missions || !!world.missions.def.l3 && world.missions.state.l3?.phase !== 'corridor';
  if (shooter && (a.role !== 'officer' || stationFight) && a.step && !a.run && inFormation && c.state !== 'grabbed') {
    if (tick >= a.step.until || dist(e.transform, a.step) <= .15) a.step = undefined;
    else { npcs.move(e, a.step, tacticFor(a).stepMs, c, .1); return true; }
  }
  if (a.run) {
    if (Math.hypot(a.run.x - e.transform.x, a.run.z - e.transform.z) <= .35) { a.run = null; return true; }
    npcs.move(e, a.run, a.runSpeed, c, .25, runBudget); return true;
  }
  if (follower) return regroup(world, e, a, leader!.transform);
  // Disengaged fighters follow their routine; a held post (officers) is kept regardless.
  if (!a.engaged && !a.hold) return false;
  const post = a.post;
  if (post && Math.hypot(post.x - e.transform.x, post.z - e.transform.z) > (a.hold ? .4 : l2.allies.regroupM)) npcs.move(e, post, a.hold ? 2 : a.runSpeed * .8, c, a.hold ? .3 : l2.allies.regroupM * .5);
  return true;
}
/** Squad: stay 3-8 m from the player on an own slot around it; regroup when the player moves on (E21 §5.4). Never teleports. */
function regroup(world: SimWorld, e: EntitySnapshot, a: AllyState, p: Point): boolean {
  const f = a.follow!, d = dist(e.transform, p);
  const leader = world.entities.get(f.targetId)!;
  const moving = Math.hypot(leader.survivor?.velocity.x ?? 0, leader.survivor?.velocity.z ?? 0) > .5;
  // A stop or a tight turn can leave a follower inside the band. Step into nearby clear space, never onto the courier.
  if (d < f.minM) {
    const nav = world.infected!.nav, angle = Math.atan2(e.transform.z - p.z, e.transform.x - p.x);
    for (let i = 0; i < 16; i++) {
      const a = angle + i * Math.PI / 8, goal = { x: p.x + Math.cos(a) * (f.minM + 1), z: p.z + Math.sin(a) * (f.minM + 1) };
      if (!nav.clear(goal.x, goal.z, .4) || !nav.visible(e.transform, goal, .4)) continue;
      world.npcs!.move(e, goal, f.moveMs * .6, e.civilian!, .15); break;
    }
    return true;
  }
  // E08 corgi/escort band: keep walking while the leader walks, avoiding repeated stop/start response delays.
  if (d > f.maxM || (moving && d > f.minM)) {
    // E08 shared NPC movement uses the same obstacle routing/steering as corgi and survivor escorts.
    // Slots trail the courier's facing, leaving her walking line clear even when she changes avenue.
    const forward = world.entities.get(f.targetId)!.transform.yaw;
    const behind = 4 + Math.floor((f.slot % 6) / 2), side = (f.slot % 2 ? 1 : -1) * (1.8 + Math.floor(f.slot / 6) * 1.8);
    const slot = { x: p.x - Math.cos(forward) * behind + Math.sin(forward) * side,
      z: p.z + Math.sin(forward) * behind + Math.cos(forward) * side };
    const nav = world.infected!.nav;
    // Around a wreck, follow the courier's reachable line rather than routing to a slot on its far face.
    const goal = d <= 10 && nav.clear(slot.x, slot.z, .4) && nav.visible(e.transform, slot, .4) && nav.visible(slot, p, .4) ? slot : p;
    if (!world.npcs!.move(e, goal, d > f.maxM + 2 ? f.moveMs : f.moveMs * .9, e.civilian!, goal === p ? f.minM : .5))
      world.npcs!.move(e, p, f.moveMs, e.civilian!, f.minM);
  }
  return true;
}

/** Ticks until the next shot: bursts, then a reload pause after a magazine; the burst pause pays for the reload (average rate = `shotS`). */
function cadence(world: SimWorld, e: EntitySnapshot, a: AllyState, shotS: number): number {
  const c = allyCadence[(a.weapon === 'shotgun' ? 'hunting-rifle' : a.weapon) ?? (a.role === 'soldier' ? 'rifle' : 'pistol')], tick = world.tick;
  a.mag = (a.mag ?? 0) + 1; a.burstN = (a.burstN ?? 0) + 1;
  if (a.mag >= c.mag) {
    a.mag = 0; a.burstN = 0; a.reloadUntil = tick + ticks(c.reloadS); a.still = undefined;
    callout(world, e, 'Reloading!');
    return ticks(c.reloadS);
  }
  if (a.burstN < c.burst) return Math.max(1, ticks(c.gapS));
  a.burstN = 0;
  const pause = c.burst * shotS - (c.burst - 1) * c.gapS - c.reloadS * c.burst / c.mag;
  return Math.max(1, ticks(Math.max(pause, c.burst > 1 ? .25 : shotS * .5)));
}
/** The player's view rule (SpawnDirector.inPlayerView); bare test worlds without a spawn director see everything. */
function playerSees(world: SimWorld, p: { x: number; z: number; y?: number }, inset?: number): boolean {
  const director = world.infected?.director as SpawnDirector | undefined;
  return director ? director.inPlayerView(p, allyViewM, inset) : true;
}
/** An ally the view rule binds: inside the player's sim-camera frame and within `allyViewM` of the courier. (A plain 22 m circle bound
 * nearly the whole L4 camp around the quartermaster: 3 of 20 soldiers left 50 s after the turn; the frame keeps 17 at 84 s.) Without a
 * camera volume (bare sim worlds) nobody is bound. */
export function allyOnScreen(world: SimWorld, p: { x: number; z: number; y?: number }): boolean {
  const player = world.entities.get(1)?.transform;
  if (player && Math.hypot(p.x - player.x, p.z - player.z) > allyViewM) return false;
  return (world.infected?.director as SpawnDirector | undefined)?.inFrame(p) ?? false;
}
const lastCallout = new WeakMap<SimWorld, number>();
/** A short shout (speech bubble + bark) from a fighter the player can see; one at a time, each fighter rarely. */
function callout(world: SimWorld, e: EntitySnapshot, text: "Reloading!" | "They're inside!" | 'Behind us!'): void {
  const a = e.civilian!.ally!, tick = world.tick;
  if (tick - (a.calloutAt ?? -1e9) < ticks(allyCallout.perAllyS) || tick - (lastCallout.get(world) ?? -1e9) < ticks(allyCallout.globalS)) return;
  if (!playerSees(world, e.transform, .85)) return;
  a.calloutAt = tick; lastCallout.set(world, tick);
  world.events.emit({ type: 'ally.callout', tick, id: e.id, text, position: { x: e.transform.x, z: e.transform.z } });
}
function tacticFor(a: AllyState): AllyTactic { return a.role === 'officer' ? allyTactics.officer : a.role === 'soldier' ? allyTactics.soldier : allyTactics.civilian; }

/**
 * Fighting on the move for every shooting ally (police PO 2026-10-09: "they need to move like real policemen would do, not standing
 * still"; all allies PO 2026-10-13: "Everyone is just standing around and shooting"): a shove or rifle butt at arm's length, a backstep
 * (always facing the threat) when an infected closes in or a crowd presses, stepping away from a grabbed teammate, a sidestep to clear
 * the line of fire past a teammate or the courier, spreading out from a neighbour, a short reposition every few shots, and a new firing
 * position (low cover first, pairs flank to the same side) whenever the fighter has stood on one spot for `stillS`. Steps are short,
 * kept within `leashM` of the post, and the fighter keeps firing while stepping. Returns true while busy.
 */
function tactics(world: SimWorld, e: EntitySnapshot, a: AllyState, target: EntitySnapshot, d: number, dx: number, dz: number): boolean {
  const tick = world.tick, c = e.civilian!, nx = dx / (d || 1), nz = dz / (d || 1), npcs = world.npcs!, nav = world.infected!.nav, pt = tacticFor(a);
  const face = () => { e.transform.yaw = -Math.atan2(dz, dx); };
  const here = e.transform;
  if (!a.still || Math.hypot(a.still.x - here.x, a.still.z - here.z) > .3) a.still = { x: here.x, z: here.z, tick };
  if (a.step) {
    if (tick >= a.step.until || Math.hypot(a.step.x - e.transform.x, a.step.z - e.transform.z) <= .15) a.step = undefined;
    else { npcs.move(e, a.step, pt.stepMs, c, .1); face(); return false; }
  }
  // Shove: an infected at arm's length takes a baton strike (officers) or a rifle butt instead of a point-blank shot.
  if (d <= pt.batonReachM) {
    if (tick < a.nextAttack) { face(); return true; }
    a.nextAttack = tick + ticks(pt.batonS); a.baton = true; a.strikeAt = tick + ticks(pt.batonWindupS); a.strikeTarget = target.id; a.hits++;
    c.story = { clip: 'swing', start: tick }; return true;
  }
  if (tick < (a.stepAfter ?? 0)) return false;
  const post = a.post ?? e.transform;
  const go = (gx: number, gz: number, far = 1): boolean => {
    if (Math.hypot(gx - post.x, gz - post.z) > (a.follow ? 99 : pt.leashM) || !nav.clear(gx, gz, .4) || !nav.visible(here, { x: gx, z: gz }, .35)) return false;
    a.step = { x: gx, z: gz, until: tick + ticks(pt.stepS * far) }; a.stepAfter = tick + ticks(pt.stepEveryS); return true;
  };
  // Pairs (consecutive ids) shift to the same side, so two fighters flank together.
  const side = Math.floor(e.id / 2) % 2 ? 1 : -1;
  // Backstep (backpedal while aiming): keep distance from what closes in.
  if (c.state !== 'grabbed' && d < pt.backstepM && (go(here.x - nx * pt.stepM, here.z - nz * pt.stepM) || go(here.x - nz * side * pt.stepM, here.z + nx * side * pt.stepM))) return false;
  if ((tick + e.id) % 6 === 0) {
    // Line of fire: a teammate or the courier near the line to the target.
    for (const id of world.spatial.query({ x: here.x + nx * d / 2, z: here.z + nz * d / 2, r: d / 2 + .5 })) {
      if (id === e.id || id === target.id) continue;
      const o = world.entities.get(id); if (!o || o.health.current <= 0 || !(o.id === 1 || o.civilian?.ally)) continue;
      const ox = o.transform.x - here.x, oz = o.transform.z - here.z, along = ox * nx + oz * nz, across = -ox * nz + oz * nx;
      if (along > .4 && along < d - .4 && Math.abs(across) < pt.clearM) {
        const s = across >= 0 ? -1 : 1;
        if (go(here.x - nz * s * pt.stepM, here.z + nx * s * pt.stepM) || go(here.x + nz * s * pt.stepM, here.z - nx * s * pt.stepM)) return false;
      }
    }
    // Spread out from a neighbour; back off from a crowd (3+ infected within 3 m) or from a teammate's grabber.
    let press = 0, px = 0, pz = 0;
    for (const id of world.spatial.query({ x: here.x, z: here.z, r: 4 })) {
      if (id === e.id) continue;
      const o = world.entities.get(id); if (!o || o.health.current <= 0) continue;
      const ox = here.x - o.transform.x, oz = here.z - o.transform.z, od = Math.hypot(ox, oz) || 1;
      if (o.infected && !o.hidden && od < 3) { press++; px += ox / od; pz += oz / od; continue; }
      if (!o.civilian?.ally || o.civilian.state === 'grabbed' && a.role === 'officer') continue;
      if (o.civilian.state === 'grabbed') {
        const g = world.entities.get(o.civilian.attacker);
        if (g && go(here.x + (here.x - g.transform.x) / (dist(here, g.transform) || 1) * pt.stepM, here.z + (here.z - g.transform.z) / (dist(here, g.transform) || 1) * pt.stepM)) return false;
        continue;
      }
      if (od < pt.spreadM && go(here.x + ox / od * pt.stepM, here.z + oz / od * pt.stepM)) return false;
    }
    // Police keep the PO 10-12 balance (they hold and get overwhelmed); soldiers and civilians back off from a crowd.
    if (press >= 3 && a.role !== 'officer') { const pd = Math.hypot(px, pz) || 1; if (go(here.x + px / pd * pt.stepM * 1.8, here.z + pz / pd * pt.stepM * 1.8, 1.6)) return false; }
  }
  // Reposition after a few shots: a short lateral step, alternating sides.
  if (a.hits > 0 && a.hits % pt.repositionShots === 0 && a.repoHits !== a.hits) {
    a.repoHits = a.hits;
    if (go(here.x - nz * side * pt.stepM, here.z + nx * side * pt.stepM) || go(here.x + nz * side * pt.stepM, here.z - nx * side * pt.stepM)) return true;
  }
  // Nobody stands on one spot for long: the next firing position, behind low cover when one is near.
  if (tick - a.still.tick > ticks(pt.stillS)) {
    const spot = firingSpot(world, e, target, d, nx, nz, side, pt);
    if (spot && go(spot.x, spot.z)) return false;
    a.still.tick = tick - ticks(pt.stillS) + 20; // nowhere to go: try again in a third of a second
  }
  return false;
}
/** Sidestep when a human blocks the shot: to the side (1 or 2 steps) from which the line is clear, else the pair's side. */
function clearLine(world: SimWorld, e: EntitySnapshot, a: AllyState, target: EntitySnapshot, nx: number, nz: number): void {
  const tick = world.tick, pt = tacticFor(a), nav = world.infected!.nav, here = e.transform, post = a.post ?? here, hx = here.x, hz = here.z;
  if (a.step || tick < (a.stepAfter ?? 0) - ticks(pt.stepEveryS / 2)) return;
  const side = Math.floor(e.id / 2) % 2 ? 1 : -1;
  let pick: { x: number; z: number } | null = null;
  for (const k of [1, 2]) for (const s of [side, -side]) {
    const x = hx - nz * s * pt.stepM * k, z = hz + nx * s * pt.stepM * k;
    if (!(a.follow || Math.hypot(x - post.x, z - post.z) <= pt.leashM) || !nav.clear(x, z, .4) || !nav.visible(here, { x, z }, .35)) continue;
    here.x = x; here.z = z; const clear = world.combat!.query.alliedShotClear(e, target, tick); here.x = hx; here.z = hz;
    if (clear) { a.step = { x, z, until: tick + ticks(pt.stepS * k) }; a.stepAfter = tick + ticks(pt.stepEveryS); return; }
    pick ??= { x, z };
  }
  if (pick) { a.step = { ...pick, until: tick + ticks(pt.stepS) }; a.stepAfter = tick + ticks(pt.stepEveryS); }
}
/** Candidate firing positions one step away (forward-diagonal when far, back-diagonal when close, else lateral first); the target
 * must stay in the line of fire, and a spot with low cover (a sandbag, crate or car at knee height toward the target) wins. */
function firingSpot(world: SimWorld, e: EntitySnapshot, target: EntitySnapshot, d: number, nx: number, nz: number, side: number, pt: AllyTactic): { x: number; z: number } | null {
  const q = world.combat!.query, nav = world.infected!.nav, here = e.transform, base = Math.atan2(nz, nx), r = pt.stepM;
  const angles = d < 6 ? [140, -140, 100, -100] : d > 12 ? [45, -45, 90, -90] : [90, -90, 135, -135, 45, -45];
  let best: { x: number; z: number } | null = null;
  for (const deg of angles) {
    const t = base + side * deg * Math.PI / 180, x = here.x + Math.cos(t) * r, z = here.z + Math.sin(t) * r;
    if (Math.hypot(x - (e.civilian!.ally!.post ?? here).x, z - (e.civilian!.ally!.post ?? here).z) > pt.leashM && !e.civilian!.ally!.follow) continue;
    if (!nav.clear(x, z, .4)) continue;
    const at = { x, y: here.y, z };
    if (!q.shotVisible(at, target.transform, target.id)) continue;
    const tx = target.transform.x - x, tz = target.transform.z - z, td = Math.hypot(tx, tz) || 1;
    if (q.clearDistance({ x, y: here.y - .35, z }, { x: tx / td, y: 0, z: tz / td }, Math.min(2, td)) < Math.min(1.9, td - .5)) return { x, z };
    best ??= { x, z };
  }
  return best;
}
