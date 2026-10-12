import type { SimWorld } from '../world/SimWorld';

/**
 * Engine and road sound for scripted (kinematic) heavy vehicles: the L4 convoy now, the L3 -> L4 handover buses and the L7 bus
 * departure later. Emits the same `vehicle.sound` events a driven car would, so the audio service owns everything else (positional
 * loops, doppler, tyre noise, mixer, voice limiter). Idle at a standstill rising to a diesel cruise at `topSpeed`.
 */
export const engineRpm = (speed: number, topSpeed = 14): number => 1000 + Math.min(1, Math.max(0, speed) / topSpeed) * 3600;
/** Call at most every 6 ticks per vehicle: the audio loops are updated in place. `inCar` is the vehicle the player sits in (muffled). */
export function emitEngine(world: SimWorld, id: number, speed: number, inCar = false): void {
  const e = world.entities.get(id); if (!e) return;
  const { x, y, z, yaw } = e.transform;
  world.events.emit({ type: 'vehicle.sound', tick: world.tick, sourceId: id, phase: 'engine', position: { x, y, z }, velocity: { x: Math.cos(yaw) * speed, z: -Math.sin(yaw) * speed }, rpm: engineRpm(speed), speed, health: 1, inCar });
}
export function stopEngine(world: SimWorld, id: number): void {
  const e = world.entities.get(id); if (!e) return;
  world.events.emit({ type: 'vehicle.sound', tick: world.tick, sourceId: id, phase: 'stop', position: { x: e.transform.x, z: e.transform.z }, velocity: { x: 0, z: 0 }, rpm: 0, speed: 0, health: 1 });
}
