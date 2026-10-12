import { vehicleBoardingTicks } from '../../data/vehicles';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { SurvivorState } from '../../data/survivor';
import { lerp } from '../../core/maths';

export const carTransitionTicks = vehicleBoardingTicks;
const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
/** The door opens before the courier crosses the sill, then shuts after boarding/landing. */
export function carDoorWeight(elapsed: number): number {
  return ease(elapsed / 12) * (1 - ease((elapsed - 42) / 18));
}
/** Presentation only: the real player collider/control changes at the original interaction tick. */
export function carTransitionPose(world: SimWorld, alpha: number) {
  const transition = world.vehicles?.transition;
  if (!transition) return null;
  const elapsed = Math.max(0, world.tick + alpha - 1 - transition.tick);
  const car = world.vehicles!.cars.get(transition.carId), player = world.entities.get(1);
  if (!car || !player?.survivor || player.health.current <= 0 || elapsed >= carTransitionTicks) return null;
  const def = car.physics.def, entering = transition.kind === 'enter';
  const p = car.entity.transform, side = transition.side;
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  // Keep the standing body outside the chassis; only cross its wall after ducking onto the step.
  const out = def.width / 2 + .4;
  const door = { x: p.x + c * def.doorX + s * side * out, z: p.z - s * def.doorX + c * side * out };
  const progress = ease((elapsed - 12) / 30);
  if (entering) { const cross = ease((elapsed - 30) / 12) * .55; door.x -= s * side * cross; door.z -= c * side * cross; }
  const current = player.transform, previous = world.previousPlayer ?? current;
  const target = { x: lerp(previous.x, current.x, alpha), y: lerp(previous.y, current.y, alpha) - .7, z: lerp(previous.z, current.z, alpha) };
  const from = transition.from;
  const step = def.stepHeight * Math.sin(Math.PI * progress / 2);
  const landing = entering ? 0 : Math.sin(Math.PI * ease((elapsed - 36) / 24)) * .13 * Math.min(1, car.entity.vehicle!.speed / 5 + .25);
  return {
    visible: entering ? elapsed < 42 : elapsed >= 12,
    x: entering ? lerp(from.x + side * s * .65 * ease(elapsed / 12), door.x, progress) : lerp(door.x, target.x, progress),
    y: entering ? step : lerp(def.stepHeight, target.y, progress) - landing,
    z: entering ? lerp(from.z + side * c * .65 * ease(elapsed / 12), door.z, progress) : lerp(door.z, target.z, progress),
    yaw: p.yaw + side * (entering ? Math.PI / 2 : -Math.PI / 2),
    pose: { ...player.survivor, attack: undefined, animation: entering ? 'enter-car' : 'dismount', animationTick: transition.tick, velocity: { x: 0, z: 0 } } as SurvivorState,
    crouch: entering ? progress * .4 : (1 - progress) * .4 + landing,
  };
}
