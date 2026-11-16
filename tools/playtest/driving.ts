/** Recover a visibly stationary vehicle through reverse and steering input. */
export class VehicleRecovery {
  private position: { x: number; z: number; since: number } | null = null;
  private reverseUntil = 0;
  private attempts = 0;
  keys(car: { x: number; z: number }, nowMs: number): string[] | null {
    if (nowMs < this.reverseUntil) return ['KeyS', this.attempts % 2 ? 'KeyA' : 'KeyD'];
    if (!this.position || Math.hypot(car.x - this.position.x, car.z - this.position.z) > .8) this.position = { ...car, since: nowMs };
    if (nowMs - this.position.since < 3000) return null;
    this.attempts++;
    this.reverseUntil = nowMs + 1400;
    this.position = { ...car, since: this.reverseUntil };
    return ['KeyS', this.attempts % 2 ? 'KeyA' : 'KeyD'];
  }
}

/** Detect a vehicle revisiting the same approach without closing on its live goal. */
export class VehicleRouteRecovery {
  private best = Infinity;
  private progressAt = 0;
  private lastGoal: { x: number; z: number } | null = null;
  private reverseUntil = 0;
  private attempts = 0;
  private samples: { x: number; z: number; at: number }[] = [];
  keys(car: { x: number; z: number }, goal: { x: number; z: number }, nowMs: number): string[] | null {
    if (this.lastGoal && Math.hypot(goal.x - this.lastGoal.x, goal.z - this.lastGoal.z) > 8) {
      this.best = Infinity; this.progressAt = nowMs; this.samples = [];
    }
    this.lastGoal = { ...goal };
    const distance = Math.hypot(goal.x - car.x, goal.z - car.z);
    if (distance < this.best - 3) { this.best = distance; this.progressAt = nowMs; }
    this.samples.push({ ...car, at: nowMs });
    this.samples = this.samples.filter(s => nowMs - s.at <= 12_000);
    if (nowMs < this.reverseUntil) return ['KeyS', this.attempts % 2 ? 'KeyA' : 'KeyD'];
    const looped = this.samples.some(s => nowMs - s.at >= 8_000 && Math.hypot(s.x - car.x, s.z - car.z) < 5);
    if (!looped && nowMs - this.progressAt < 8_000) return null;
    this.attempts++;
    this.reverseUntil = nowMs + 1_600;
    this.progressAt = this.reverseUntil;
    this.best = Infinity;
    this.samples = [];
    return ['KeyS', this.attempts % 2 ? 'KeyA' : 'KeyD'];
  }
}
