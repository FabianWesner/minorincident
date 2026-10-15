import { l5 } from '../../data/l5';
import { FIXED_DT } from '../../core/Clock';
import { SimPhase } from '../../core/EventBus';
import type { NavGrid } from '../ai/NavGrid';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { faceMotion, motionResponse, resetResponse, respond } from './MotionResponse';
import { Status } from '../combat/Status';

/** Navigation/behaviour supplies intent; static sweeps remain authoritative. */
export function moveAgent(e: EntitySnapshot, vx: number, vz: number, nav: NavGrid, tick: number, radius = e.combat?.radius ?? .35, impulse = false): void {
  const state = e.locomotion ??= motionResponse();
  if (state.updatedAt === tick) return;
  if (impulse) { state.vx = vx; state.vz = vz; state.ax = state.az = 0; }
  else { const speed = Status.speed(e); respond(state, vx * speed, vz * speed); }
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
  const d = world.districts!, x = e.transform.x, z = e.transform.z, stride = e.civilian?.supportFeet ? .4 : .22, fx = Math.cos(e.transform.yaw) * stride, fz = -Math.sin(e.transform.yaw) * stride;
  return Math.max(d.groundHeight(x, z), d.groundHeight(x + fx, z + fz), d.groundHeight(x - fx, z - fz));
}
function actor(e: EntitySnapshot): boolean { return !e.corpse && !!(e.infected || e.civilian || e.companion || e.escort); }
// Corgi hiding still follows at the survivor's heels; it must retain its response.
function forced(e: EntitySnapshot, tick: number, world: SimWorld): boolean {
  return !!(world.npcs?.civilians.holds(e.id) || e.hidden || e.health.current <= 0 || e.attachedTo !== undefined || (e.infectionRise && tick < e.infectionRise.until) || e.infected?.hidden || e.infected?.perched || (e.infected && e.infected.grabUntil > tick) || (e.combat && e.combat.staggerUntil > tick) || ['grabbed','down','rising','finished','infected'].includes(e.civilian?.state ?? '') || (e.civilian && e.civilian.knockedUntil > tick) || ['downed','dead'].includes(e.escort?.state ?? ''));
}
/** Runs once per world. Brakes actors whose behaviour supplies no movement this
 * tick, then publishes post-separation/grounding displacement for every figure. */
export function installAgentMotion(world: SimWorld): void {
  const previous = new Map<number, { x: number; z: number; following: boolean }>();
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
      moveAgent(e, 0, 0, e.infected ? world.infected!.infectedNav : nav, world.tick); world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }, SimPhase.missions + .5);
  world.events.on('sim.tick', () => {
    for (const e of world.entities.iterate()) if (actor(e)) {
      const p = previous.get(e.id); if (!p) continue;
      // Follow speed includes crowd separation: a chain of people pushing one
      // another must not run faster than the courier-facing movement contract.
      if (world.missions?.state.l5 && p.following && e.civilian?.survivor?.mode === 'follow' && !forced(e, world.tick, world)) {
        const dx = e.transform.x - p.x, dz = e.transform.z - p.z, distance = Math.hypot(dx, dz), limit = l5.follow.runMs * FIXED_DT;
        if (distance > limit) {
          const at = { x: p.x, z: p.z };
          world.infected!.nav.move(at, dx / distance * limit, dz / distance * limit, e.combat?.radius ?? .35);
          Object.assign(e.transform, at); world.spatial.set(e.id, at.x, at.z);
        }
      }
      // Only the corgi companion stands at 0.3 m. Pet dogs keep the civilian 0.7 m of their spawn (NpcView and the infected dog they
      // turn into use it): at 0.3 a moving pet was drawn 40 cm into the ground (PO 10-14/10-15 "that dog looks strange" / "broken").
      if (world.districts && !e.infected) e.transform.y = (e.companion ? .3 : .7) + (e.civilian?.floorY ?? ((e.civilian?.story || e.civilian?.supportFeet) ? stepSupport(world, e) : world.districts.groundHeight(e.transform.x, e.transform.z)));
      const dx = e.transform.x - p.x, dz = e.transform.z - p.z, distance = Math.hypot(dx, dz);
      const motion = e.motion ??= { velocity: { x: 0, z: 0 }, speed: 0, moving: false, distance: e.id * .137 };
      motion.velocity.x = dx / FIXED_DT; motion.velocity.z = dz / FIXED_DT; motion.speed = distance / FIXED_DT;
      motion.moving = motion.speed > (motion.moving ? .04 : .12); if (distance < 3) motion.distance += distance;
      // Companion behaviour runs before automatic braking and crowd separation. Keep its existing
      // 0.3 rad facing limit against the resolved travel too, including a warning's braking slide.
      if (e.companion && motion.speed > .5) {
        const heading = -Math.atan2(dz, dx), error = Math.atan2(Math.sin(heading - e.transform.yaw), Math.cos(heading - e.transform.yaw));
        if (Math.abs(error) > .3) { e.transform.yaw = heading - Math.sign(error) * .3; if (e.locomotion) e.locomotion.omega = 0; }
      }
    }
  }, SimPhase.cleanup + .5);
}
