import type { EntitySnapshot } from '../world/types';
/** One entity owns up to 20 one-HP birds. Separation/cohesion is bounded by that fixed flock size. */
export function updateFlock(entity: EntitySnapshot, tick: number, target: { x: number; z: number }): void {
  const b = entity.infected!, positions = b.birdPositions;
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
    positions[i * 3] += (targetX - positions[i * 3]) * 0.12 + separationX;
    positions[i * 3 + 1] += (y - positions[i * 3 + 1]) * 0.3;
    positions[i * 3 + 2] += (targetZ - positions[i * 3 + 2]) * 0.12 + separationZ;
  }
}
