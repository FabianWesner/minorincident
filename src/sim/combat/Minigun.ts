import { minigun } from '../../data/minigun';
const DT = 1 / 60;
export interface MinigunSnapshot { heat: number; locked: boolean }
/**
 * Spin and heat state machine of the mounted rotary minigun (pure, fixed 60 Hz). One `step(trigger)` per sim tick, mounted or not:
 * heat keeps cooling on the same rule while the player is off the gun, so a dismount neither resets nor freezes it (no reset exploit).
 *  - the trigger spins the barrels up; firing starts at `fireSpin` and lasts while the trigger is down and the gun is not locked;
 *  - firing heats the barrels; at 100% the gun locks (no fire, the barrels wind down) until it cools below `unlockBelow`;
 *  - cooling starts `coolDelayS` after the last fired round, so tapping the trigger cannot shed heat.
 */
export class Minigun {
  heat = 0;
  spin = 0;
  /** Barrel rotation in radians (presentation; advances with the spin, 40 rad/s at full speed). */
  angle = 0;
  locked = false;
  /** Ticks since the last round was fired. */
  idle = Infinity;
  private owed = 0;
  /** Rounds fired in this tick: 0 or 1 at 20/s on a 60 Hz tick. */
  step(trigger: boolean): number {
    const wants = trigger && !this.locked;
    this.spin = Math.min(1, Math.max(0, this.spin + (wants ? DT / minigun.spinUpS : -DT / minigun.spinDownS)));
    this.angle = (this.angle + this.spin * 40 * DT) % (Math.PI * 2);
    const firing = wants && this.spin >= minigun.fireSpin - 1e-9;
    let rounds = 0;
    if (firing) {
      this.idle = 0;
      this.heat = Math.min(1, this.heat + minigun.heatPerS * DT);
      this.owed += minigun.rate * DT;
      rounds = Math.floor(this.owed + 1e-9); this.owed -= rounds;
      if (this.heat >= 1 - 1e-9) { this.heat = 1; this.locked = true; this.owed = 0; }
    } else {
      this.owed = 0; this.idle++;
      if (this.idle > minigun.coolDelayS * 60) this.heat = Math.max(0, this.heat - minigun.coolPerS * DT);
      if (this.locked && this.heat < minigun.unlockBelow - 1e-9) this.locked = false;
    }
    return rounds;
  }
  /** Checkpoint payload: heat survives a reload, the barrels start still. */
  snapshot(): MinigunSnapshot { return { heat: this.heat, locked: this.locked }; }
  restore(s: MinigunSnapshot): void { this.heat = s.heat; this.locked = s.locked; this.spin = 0; this.idle = Infinity; this.owed = 0; }
}
