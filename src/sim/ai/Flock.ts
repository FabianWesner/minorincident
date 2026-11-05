import { motionResponse, respond } from '../locomotion/MotionResponse';
import type { EntitySnapshot } from '../world/types';
/** One entity owns up to 20 one-HP birds. Separation/cohesion is bounded by that fixed flock size. */
export function updateFlock(entity: EntitySnapshot, tick: number, target: { x: number; z: number }): void {
  const b = entity.infected!, positions = b.birdPositions;
  const horizontal = b.birdMotion ??= Array.from({ length: 20 }, motionResponse);
  const vertical = b.birdVertical ??= Array.from({ length: 20 }, motionResponse);
  const scattered = tick < b.scatterUntil, diving = b.state === 'attack' && tick >= b.until;
  for (let i = 0; i < 20; i++) {
    if (!b.birdAlive[i]) continue;
    const angle = tick / 90 + i * 2.399963, radius = scattered ? 8 : 1.5 + (i % 3) * 0.5;
    const wave = Math.floor((tick - b.until) / 30) % 4, inWave = diving && i % 4 === wave;
    const targetX = inWave ? target.x : entity.transform.x + Math.cos(angle) * radius, targetZ = inWave ? target.z : entity.transform.z + Math.sin(angle) * radius;
    const y = inWave ? 0.7 : scattered ? 6 : 3 + Math.sin(angle) * 0.5;
    let separationX = 0, separationZ = 0;
    for (let j = 0; j < 20; j++) if (j !== i && b.birdAlive[j]) {
      const dx = positions[i * 3] - positions[j * 3], dz = positions[i * 3 + 2] - positions[j * 3 + 2], d2 = dx * dx + dz * dz;
      if (d2 > 0 && d2 < 0.36) { separationX += dx * (0.36 - d2); separationZ += dz * (0.36 - d2); }
    }
    const dx = (targetX - positions[i * 3]) * 4 + separationX * 60, dz = (targetZ - positions[i * 3 + 2]) * 4 + separationZ * 60;
    const scale = Math.min(1, 7.2 / (Math.hypot(dx, dz) || 1));
    respond(horizontal[i], dx * scale, dz * scale);
    respond(vertical[i], Math.max(-6, Math.min(6, (y - positions[i * 3 + 1]) * 4)), 0);
    positions[i * 3] += horizontal[i].vx / 60;
    positions[i * 3 + 1] += vertical[i].vx / 60;
    positions[i * 3 + 2] += horizontal[i].vz / 60;
  }
}

/** Flamingo dive shares the flock's bounded cohesion response; walls clip every step. */
export function steerFlockDive(entity: EntitySnapshot, area: { x: number; z: number }, age: number, tick: number, impactAge: number | undefined, index: number, query: import('../combat/HitQuery').HitQuery): void {
  const p = entity.transform, response = entity.locomotion ??= motionResponse();
  const angle = index * 2.399963, spread = impactAge === undefined ? .7 : 2;
  const dx = area.x + Math.cos(angle) * spread - p.x, dz = area.z + Math.sin(angle) * spread - p.z;
  const scale = Math.min(1, 7.2 / (Math.hypot(dx, dz) * 4 || 1));
  respond(response, dx * 4 * scale, dz * 4 * scale); response.updatedAt = tick;
  const speed = Math.hypot(response.vx, response.vz), direction = { x: response.vx / (speed || 1), z: response.vz / (speed || 1) };
  const distance = query.clearDistance(p, direction, speed / 60, undefined, entity.combat!.radius);
  p.x += direction.x * distance; p.z += direction.z * distance;
  p.y = .7 + 2.3 * Math.sin(Math.PI * Math.min(1, age / 24));
  if (speed > .025) p.yaw = -Math.atan2(direction.z, direction.x);
}
