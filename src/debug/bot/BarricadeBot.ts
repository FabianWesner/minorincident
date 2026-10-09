import { emptyInput } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';

/** Complete policy for the isolated defense lab: push available furniture, then stand to brace. */
export class BarricadeBot {
  readonly profile = 'complete';
  readonly frame = emptyInput();
  finished = false;
  private readonly walker = new Walker();
  private pushing = false;
  private slotId = '';
  constructor(private readonly world: SimWorld) {}
  sample() {
    this.frame.move.x = this.frame.move.z = 0;
    const slots = this.world.entities.values().filter(e => e.barricade && !e.barricade.slot.boardUp);
    const slot = slots.find(e => !e.barricade!.intact);
    if (!slot) { this.finished = true; return this.frame; }
    if (this.slotId !== slot.barricade!.slot.id) { this.slotId = slot.barricade!.slot.id; this.pushing = false; this.walker.reset(); }
    const player = this.world.entities.get(1)!.transform;
    const props = this.world.props!.items.filter(p => !p.braced && !p.fixed && p.body.isEnabled());
    const prop = props.sort((a, b) => Math.hypot(a.pose.p[0] - slot.transform.x, a.pose.p[2] - slot.transform.z) - Math.hypot(b.pose.p[0] - slot.transform.x, b.pose.p[2] - slot.transform.z))[0];
    if (!prop) return this.frame;
    // Once eligible and inside the ring, stop immediately; routing to the rail centre
    // can keep the survivor sliding into the prop and interrupt stand-to-interact.
    if (slot.barricade!.coverage >= .8 && Math.hypot(player.x - slot.transform.x, player.z - slot.transform.z) <= 1.6) return this.frame;
    let goal = { x: slot.transform.x, z: slot.transform.z }, stop = 1.3;
    if (slot.barricade!.coverage < .8) {
      const dx = goal.x - prop.pose.p[0], dz = goal.z - prop.pose.p[2], distance = Math.hypot(dx, dz) || 1;
      const behind = { x: prop.pose.p[0] - dx / distance * (prop.radius + .45), z: prop.pose.p[2] - dz / distance * (prop.radius + .45) };
      if (!this.pushing && Math.hypot(player.x - behind.x, player.z - behind.z) < .25) this.pushing = true;
      if (this.pushing && (player.x - prop.pose.p[0]) * dx + (player.z - prop.pose.p[2]) * dz > 0) this.pushing = false;
      if (this.pushing) { this.frame.move.x = dx / distance; this.frame.move.z = dz / distance; return this.frame; }
      goal = behind; stop = .12;
    }
    const movement = this.walker.step(this.world, goal, stop, this.slotId);
    if (movement) Object.assign(this.frame.move, movement);
    return this.frame;
  }
}
