import { actorRadius, solidLargeCorpse } from '../world/SolidRegistry';
import { l2 } from '../../data/l2';
import { l5 } from '../../data/l5';
import { l7Departure } from '../../data/l7';
import { FIXED_DT } from '../../core/Clock';
import { SimPhase } from '../../core/EventBus';
import type { NavGrid } from '../ai/NavGrid';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { faceMotion, motionResponse, resetResponse, respond } from './MotionResponse';
import { Status } from '../combat/Status';
import { followerInCombat } from '../outbreak/Survivors';

/** Navigation/behaviour supplies intent; static sweeps remain authoritative. */
/** Calm followers track the courier's own (already limited) pace closely. */
export const followerTracking = { acceleration: 12, jerk: 300, omega: 20 } as const;
// Keep the calm party responsive without overshooting its moving slots.
export const l5FollowerTracking = { ...followerTracking, omega: 22 } as const;
export function moveAgent(e: EntitySnapshot, vx: number, vz: number, nav: NavGrid, tick: number, radius = actorRadius(e), impulse = false, tracking?: Parameters<typeof respond>[3]): void {
  const state = e.locomotion ??= motionResponse();
  if (state.updatedAt === tick) return;
  if (impulse) { state.vx = vx; state.vz = vz; state.ax = state.az = 0; }
  else {
    const speed = Status.speed(e), ally = e.civilian?.ally;
    const following = e.civilian?.survivor?.briskAt === tick || ally?.follow && !ally.targetId && !ally.strikeAt;
    respond(state, vx * speed, vz * speed, tracking ?? (following ? followerTracking : undefined));
  }
  state.updatedAt = tick;
  const x = e.transform.x, z = e.transform.z;
  if (state.vx !== 0 || state.vz !== 0) nav.move(e.transform, state.vx * FIXED_DT, state.vz * FIXED_DT, radius);
  const territory = e.infected?.territory;
  if (territory && Math.hypot(e.transform.x - territory.x, e.transform.z - territory.z) > territory.radius &&
      Math.hypot(e.transform.x - territory.x, e.transform.z - territory.z) > Math.hypot(x - territory.x, z - territory.z)) {
    e.transform.x = x; e.transform.z = z;
  }
  const actualX = (e.transform.x - x) / FIXED_DT, actualZ = (e.transform.z - z) / FIXED_DT;
  // Do not accumulate velocity into a wall. Collision/forced displacement takes
  // priority over the response bound; animation consumes the resolved movement.
  if (Math.hypot(actualX - state.vx, actualZ - state.vz) > .05) {
    state.vx = actualX; state.vz = actualZ; state.ax = state.az = 0;
  }
  e.transform.yaw = faceMotion(state, e.transform.yaw, actualX, actualZ);
  if (e.companion) Object.assign(e.companion.velocity ??= { x: 0, z: 0 }, { x: actualX, z: actualZ });
}
/** Scripted story walks (L1 hand-overs) cross shop steps without the crowd foot solver's ground probe: support the body
 * on the highest ground under either foot (0.22 m fore and aft), so the trailing foot never sinks into the step edge. */
function stepSupport(world: SimWorld, e: EntitySnapshot): number {
  const d = world.districts!, x = e.transform.x, z = e.transform.z, stride = e.companion ? .55 : e.civilian?.supportFeet ? .4 : .22, fx = Math.cos(e.transform.yaw) * stride, fz = -Math.sin(e.transform.yaw) * stride;
  const support = (px: number, pz: number) => e.companion ? d.groundBelow(px, pz, e.transform.y - .3) : d.groundHeight(px, pz);
  const height = Math.max(support(x, z), support(x + fx, z + fz), support(x - fx, z - fz));
  if (!e.companion) return height;
  const sx = Math.sin(e.transform.yaw) * .18, sz = Math.cos(e.transform.yaw) * .18;
  return Math.max(height, support(x + fx + sx, z + fz + sz), support(x + fx - sx, z + fz - sz), support(x - fx + sx, z - fz + sz), support(x - fx - sx, z - fz - sz));
}
/** Feet support is resolved before the final collision commit, and again after a contact correction. */
export function groundAgent(world: SimWorld, e: EntitySnapshot): void {
  if (world.scenario === 'L9' && world.missions?.l9?.driving.ownsPose(e)) return;
  if (world.districts && !e.infected && !e.survivor) e.transform.y = (e.companion ? .3 : .7) + (e.civilian?.floorY ?? ((e.companion || e.civilian?.story || e.civilian?.supportFeet) ? stepSupport(world, e) : world.districts.groundHeight(e.transform.x, e.transform.z)));
}
function actor(e: EntitySnapshot): boolean { return !e.corpse && !!(e.infected || e.civilian || e.companion || e.escort); }
// Corgi hiding still follows at the survivor's heels; it must retain its response.
function forced(e: EntitySnapshot, tick: number, world: SimWorld): boolean {
  return !!(world.npcs?.civilians.holds(e.id) || e.hidden || e.health.current <= 0 || e.attachedTo !== undefined || e.passengerOf !== undefined || (e.infectionRise && tick < e.infectionRise.until) || e.infected?.hidden || e.infected?.perched || (e.infected && e.infected.grabUntil > tick) || (e.combat && e.combat.staggerUntil > tick) || ['grabbed','down','rising','finished','infected'].includes(e.civilian?.state ?? '') || (e.civilian && e.civilian.knockedUntil > tick) || ['downed','dead'].includes(e.escort?.state ?? ''));
}
/** Runs once per world. Brakes actors whose behaviour supplies no movement this
 * tick, then publishes post-separation/grounding displacement for every figure. */
export function installAgentMotion(world: SimWorld): void {
  const previous = new Map<number, { x: number; z: number; following: boolean }>();
  const rejectedCompanions = new Map<EntitySnapshot, EntitySnapshot>();
  world.events.on('sim.tick', () => {
    for (const [id] of previous) if (!world.entities.get(id) || world.entities.get(id)!.corpse) previous.delete(id);
    for (const e of world.entities.iterate()) if (actor(e)) {
      const p = previous.get(e.id) ?? { x: e.transform.x, z: e.transform.z, following: false }; p.x = e.transform.x; p.z = e.transform.z; p.following = e.civilian?.survivor?.mode === 'follow'; previous.set(e.id, p);
      if (forced(e, world.tick, world) && e.locomotion) resetResponse(e.locomotion);
    }
  }, SimPhase.intent);
  world.events.on('sim.tick', () => {
    const nav = world.infected!.nav;
    for (const e of world.entities.iterate()) if (actor(e) && !forced(e, world.tick, world) && e.locomotion && e.locomotion.updatedAt !== world.tick) {
      const yaw = e.transform.yaw;
      moveAgent(e, 0, 0, e.infected ? world.infected!.infectedNav : nav, world.tick, actorRadius(e), false,
        world.scenario === 'L5' && (e.companion || e.civilian?.survivor?.briskAt === world.tick) ? l5FollowerTracking : undefined); world.spatial.set(e.id, e.transform.x, e.transform.z);
      // Braking retains the authored approach distance. The windup owns facing,
      // so residual steering must not turn the strike away from its victim.
      if (e.infected?.state === 'attack') e.transform.yaw = yaw;
    }
  }, SimPhase.missions + .5);
  world.events.on('sim.tick', () => {
    for (const e of world.entities.iterate()) if (actor(e)) {
      const p = previous.get(e.id); if (!p) continue;
      // Follow speed includes crowd separation: a chain of people pushing one
      // another must not run faster than the courier-facing movement contract.
      const l5Follower = !!world.missions?.state.l5;
      const l7Follower = world.scenario === 'L7' && world.missions?.state.steps.departure?.status === 'active';
      const followMs = l5Follower ? l5.follow.runMs : l7Follower ? l7Departure.followMs : 0;
      if (followMs && p.following && e.civilian?.survivor?.mode === 'follow' && !forced(e, world.tick, world)) {
        const dx = e.transform.x - p.x, dz = e.transform.z - p.z, distance = Math.hypot(dx, dz);
        let maxSpeed: number = followMs;
        if (l5Follower || l7Follower) {
          // L5 and L7 calm followers can catch up at 1.05x the moving courier;
          // combat pace remains authored. This keeps routed followers together
          // without letting the formation run away from the player.
          const player = world.entities.get(1)!, velocity = player.survivor?.velocity ?? { x: 0, z: 0 }, velocitySpeed = Math.hypot(velocity.x, velocity.z);
          const playerSpeed = velocitySpeed > .2 ? velocitySpeed : player.motion?.speed ?? 0;
          const inCombat = l5Follower ? followerInCombat(world, e) : world.infected!.active.some(o => o.health.current > 0 && !o.hidden && !o.infected?.hidden && !o.infectionRise &&
            (Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z) <= 14 && world.infected!.nav.visible(e.transform, o.transform, 0) ||
             Math.hypot(o.transform.x - player.transform.x, o.transform.z - player.transform.z) <= 18 && world.infected!.nav.visible(player.transform, o.transform, 0)));
          const pace = e.civilian.survivor.pace, perceived = Math.max(playerSpeed, pace && world.tick - pace.tick <= 1 ? Math.hypot(pace.x, pace.z) : 0);
          if (!inCombat && perceived > .8) maxSpeed = l7Follower ? Math.max(followMs, perceived * 1.05) : perceived * 1.05;
        }
        const limit = maxSpeed * FIXED_DT;
        if (distance > limit) {
          const at = { x: p.x, z: p.z };
          world.infected!.nav.move(at, dx / distance * limit, dz / distance * limit, e.combat?.radius ?? .35);
          Object.assign(e.transform, at); world.spatial.set(e.id, at.x, at.z);
        }
      }
      groundAgent(world, e);
    }
  }, SimPhase.cleanup + .5);
  // Facing is part of the long physical footprint and must precede the final contact transaction.
  world.events.on('sim.tick', () => {
    for (const e of world.entities.iterate()) {
      if (!e.companion) {
        const c = e.civilian, ally = c?.ally, motion = e.locomotion;
        // Followers and gunners can overwrite walking yaw with an aim/formation pose. Leave other controllers and passive nudges alone.
        if (!c || c.pet || c.zooAnimal || e.infected || e.health.current <= 0) continue;
        if (!c.survivor && !ally?.follow && !ally?.gun && ally?.role !== 'officer' && ally?.role !== 'soldier') continue;
        if (motion?.updatedAt !== world.tick || Math.hypot(motion.vx, motion.vz) <= .12) { if (ally) delete ally.aimMoveAt; continue; }
      }
      // A waiting Metro pet sidesteps for the queue while retaining the shaft-facing pose.
      if (e.companion && world.missions?.state.l5?.metroAt && !e.companion.following) continue;
      const p = previous.get(e.id); if (!p) continue;
      const dx = e.transform.x - p.x, dz = e.transform.z - p.z;
      if (Math.hypot(dx, dz) / FIXED_DT <= (e.companion ? .5 : .12)) { if (e.civilian?.ally) delete e.civilian.ally.aimMoveAt; continue; }
      const a = e.civilian?.ally, target = a && world.entities.get(a.targetId);
      const aiming = !!a && !!target?.infected && target.health.current > 0 && !target.hidden && !target.infected.hidden && !target.infectionRise
        && e.civilian?.story?.clip === 'shoot' && world.tick >= (a.reloadUntil ?? 0)
        && Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z) <= (a.gun?.rangeM ?? l2.allies.officer.rangeM + 4);
      // L3's retreating squad aims continuously while its feet follow the courier.
      if (aiming && world.missions?.def.l3 && a!.follow) continue;
      if (aiming && world.tick >= (a!.aimMoveRestUntil ?? 0)) {
        a!.aimMoveAt ??= world.tick;
        if (world.tick - a!.aimMoveAt < 120) continue;
        a!.aimMoveRestUntil = world.tick + 30;
      }
      if (a && (!aiming || world.tick < (a.aimMoveRestUntil ?? 0))) delete a.aimMoveAt;
      const heading = -Math.atan2(dz, dx), error = Math.atan2(Math.sin(heading - e.transform.yaw), Math.cos(heading - e.transform.yaw));
      if (Math.abs(error) > .3) { e.transform.yaw = heading - Math.sign(error) * .3; if (e.locomotion) e.locomotion.omega = 0; }
    }
  }, SimPhase.cleanup + .6);
  world.events.on('sim.tick', () => {
    rejectedCompanions.clear();
    for (const e of world.entities.iterate()) if (actor(e)) {
      const p = previous.get(e.id); if (!p) continue;
      const dx = e.transform.x - p.x, dz = e.transform.z - p.z, distance = Math.hypot(dx, dz);
      const motion = e.motion ??= { velocity: { x: 0, z: 0 }, speed: 0, moving: false, distance: e.id * .137 };
      const response = e.locomotion, blocker = world.solids.blockingBody(e.id);
      // Either half of the pair can be rejected: a stationary corgi can also
      // seal a follower's route. Let just the companion yield to break symmetry.
      if (world.scenario === 'L5' && response?.updatedAt === world.tick && distance / FIXED_DT <= 1.2 && !forced(e, world.tick, world)) {
        const companion = e.companion && blocker?.civilian?.survivor?.mode === 'follow' ? e
          : e.civilian?.survivor?.mode === 'follow' && blocker?.companion ? blocker : undefined;
        if (companion) rejectedCompanions.set(companion, e.companion ? blocker! : e);
      }
      // The final collision pass can reject a step after navigation moved.
      // Clear rejected momentum at a solid corpse or following body so the
      // next step starts from resolved motion instead of pushing into it again.
      if (world.scenario === 'L7' && world.missions?.state.steps.departure?.status === 'active' && e.civilian?.survivor?.mode === 'follow' && response?.updatedAt === world.tick && blocker && (solidLargeCorpse(blocker) || blocker.civilian?.survivor?.mode === 'follow') && distance / FIXED_DT <= .12 && !forced(e, world.tick, world)) {
        response.vx = dx / FIXED_DT; response.vz = dz / FIXED_DT; response.ax = response.az = 0;
      }
      motion.velocity.x = dx / FIXED_DT; motion.velocity.z = dz / FIXED_DT; motion.speed = distance / FIXED_DT;
      motion.moving = motion.speed > (motion.moving ? .04 : .12); if (distance < 3) motion.distance += distance;
    }
    if (world.scenario === 'L5') for (const e of world.entities.iterate()) if (e.companion) {
      const c = e.companion;
      // Projection can alternate tiny accepted and rejected steps. Reset on
      // real progress or a contact gap, rather than losing the stall on jitter.
      if (c.contactFrom && (Math.hypot(e.transform.x - c.contactFrom.x, e.transform.z - c.contactFrom.z) > .2 || world.tick - c.contactFrom.at > 30)) { delete c.contactFrom; c.contactRejected = 0; }
      if (rejectedCompanions.has(e)) {
        c.contactFrom ??= { x: e.transform.x, z: e.transform.z, at: world.tick, blocker: rejectedCompanions.get(e)!.id };
        c.contactFrom.at = world.tick; c.contactFrom.blocker = rejectedCompanions.get(e)!.id; c.contactRejected = (c.contactRejected ?? 0) + 1;
      }
    }
  }, SimPhase.cleanup + 1);
}
