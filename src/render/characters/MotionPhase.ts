/** Distance-driven gait phase, measured from actual sim displacement. Stationary
 * characters cannot walk in place, even when their AI intent says 'wander'. */
export class MotionPhase {
  private readonly samples = new Map<number, { tick: number; x: number; z: number; distance: number; speed: number }>();
  sample(id: number, tick: number, x: number, z: number) {
    let sample = this.samples.get(id);
    if (!sample) { sample = { tick, x, z, distance: id * .137, speed: 0 }; this.samples.set(id, sample); }
    if (tick !== sample.tick) {
      const dt = Math.max(1, tick - sample.tick) / 60, moved = Math.hypot(x - sample.x, z - sample.z);
      const distance = moved > 3 ? 0 : moved;
      sample.speed = distance / dt; sample.distance += distance; sample.x = x; sample.z = z; sample.tick = tick;
    }
    return sample;
  }
  delete(id: number): void { this.samples.delete(id); }
}
