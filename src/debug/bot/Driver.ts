import { emptyInput } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
/** Pure-pursuit driver: reads course position and emits the same logical controls as a player. */
export class Driver {
  readonly frame = emptyInput();
  readonly drive = { throttle: 1, steer: 0 };
  finished = false;
  constructor(private readonly world: SimWorld) { this.frame.drive = this.drive; }
  sample() {
    const active = this.world.vehicles?.active;
    this.drive.throttle = this.drive.steer = 0;
    if (active == null) return this.frame; // Standing at the start door naturally enters.
    const car = this.world.vehicles!.cars.get(active)!, p = car.entity.transform;
    this.finished = p.x >= 600;
    const lookahead = 8, targetZ = Math.sin((p.x + lookahead) / 40) * 3;
    const heading = Math.atan2(-(targetZ - p.z), lookahead);
    const delta = Math.atan2(Math.sin(heading - p.yaw), Math.cos(heading - p.yaw));
    this.drive.steer = Math.max(-1, Math.min(1, Math.atan(2 * car.physics.def.wheelbase * Math.sin(delta) / lookahead) / car.physics.def.steering));
    this.drive.throttle = this.finished ? 0 : 1; this.frame.brake = this.finished;
    return this.frame;
  }
}
