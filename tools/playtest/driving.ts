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
