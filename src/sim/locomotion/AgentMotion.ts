import { FIXED_DT } from '../../core/Clock';
import { SimPhase } from '../../core/EventBus';
import type { NavGrid } from '../ai/NavGrid';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { faceMotion, motionResponse, resetResponse, respond } from './MotionResponse';

/** Navigation/behaviour supplies intent; static sweeps remain authoritative. */
export function moveAgent(e: EntitySnapshot, vx: number, vz: number, nav: NavGrid, tick: number, radius = e.combat?.radius ?? .35, impulse = false): void {
  const state = e.locomotion ??= motionResponse();
  if (state.updatedAt === tick) return;
  if (impulse) { state.vx = vx; state.vz = vz; state.ax = state.az = 0; }
  else respond(state, vx, vz);
  state.updatedAt = tick;
  const x = e.transform.x, z = e.transform.z;
  if (state.vx !== 0 || state.vz !== 0) nav.move(e.transform, state.vx * FIXED_DT, state.vz * FIXED_DT, radius);
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
  const d = world.districts!, x = e.transform.x, z = e.transform.z, fx = Math.cos(e.transform.yaw) * .22, fz = -Math.sin(e.transform.yaw) * .22;
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
  const previous = new Map<number, { x: number; z: number }>();
  world.events.on('sim.tick', () => {
    for (const [id] of previous) if (!world.entities.get(id) || world.entities.get(id)!.corpse) previous.delete(id);
    for (const e of world.entities.iterate()) if (actor(e)) {
      const p = previous.get(e.id) ?? { x: e.transform.x, z: e.transform.z }; p.x = e.transform.x; p.z = e.transform.z; previous.set(e.id, p);
      if (forced(e, world.tick, world) && e.locomotion) resetResponse(e.locomotion);
    }
  }, SimPhase.intent);
  world.events.on('sim.tick', () => {
    const nav = world.infected!.nav;
    for (const e of world.entities.iterate()) if (actor(e) && !forced(e, world.tick, world) && e.locomotion && e.locomotion.updatedAt !== world.tick) {
      moveAgent(e, 0, 0, nav, world.tick); world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }, SimPhase.missions + .5);
  world.events.on('sim.tick', () => {
    for (const e of world.entities.iterate()) if (actor(e)) {
      const p = previous.get(e.id); if (!p) continue;
      if (world.districts && !e.infected) e.transform.y = (e.companion || e.civilian?.pet ? .3 : .7) + (e.civilian?.story ? stepSupport(world, e) : world.districts.groundHeight(e.transform.x, e.transform.z));
      const dx = e.transform.x - p.x, dz = e.transform.z - p.z, distance = Math.hypot(dx, dz);
      const motion = e.motion ??= { velocity: { x: 0, z: 0 }, speed: 0, moving: false, distance: e.id * .137 };
      motion.velocity.x = dx / FIXED_DT; motion.velocity.z = dz / FIXED_DT; motion.speed = distance / FIXED_DT;
      motion.moving = motion.speed > (motion.moving ? .04 : .12); if (distance < 3) motion.distance += distance;
    }
  }, SimPhase.cleanup + .5);
}
