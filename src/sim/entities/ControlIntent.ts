import { action } from '../../data/actions/catalog';
import { survivor } from '../../data/survivor';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';

/** Persistent click commands resolve in the sim, against live target positions and weapon range. */
export class ControlIntent {
  moveTarget: Vec2 | null = null;
  private readonly route = { path: [] as number[], goal: -1, pathIndex: 0 };
  private readonly waypoint = { x: 0, z: 0 };
  private attack: { id: number; side: 'LEFT' | 'RIGHT'; started: boolean } | null = null;
  constructor(private readonly world: SimWorld) {}
  snapshot() { return this.moveTarget || this.attack ? structuredClone({ moveTarget: this.moveTarget, attack: this.attack }) : null; }
  attacked(side: 'LEFT' | 'RIGHT'): void { if (this.attack?.side === side) this.attack.started = true; }
  reset(): void { this.route.path.length = 0; this.route.goal = -1; this.moveTarget = null; this.attack = null; }
  resolve(raw: InputFrame): InputFrame {
    const player = this.world.entities.get(1)!;
    if (raw.mouseAttack && player.weapons && !raw.pointerGround) {
      const side = player.weapons.selectedSide;
      raw = { ...raw, left: side === 'LEFT' ? { ...raw.left } : { down: false, held: false, up: false }, right: side === 'RIGHT' ? { ...raw.left } : { down: false, held: false, up: false },
        ...(raw.attackTarget ? { attackTarget: { ...raw.attackTarget, side } } : {}) };
    }
    if (raw.attackInPlace || Object.values(this.world.combat?.runner.running ?? {}).some(attack => attack.inPlace && this.world.tick < attack.endsAt)) {
      this.reset(); this.world.player?.locomotion.reset();
      return { ...raw, attackInPlace: true, move: { x: 0, z: 0 } };
    }
    if (raw.cancelMove || Math.hypot(raw.move.x, raw.move.z) > 0 || raw.interact || (!raw.attackTarget && !raw.pointerGround && (raw.left.down || raw.right.down))) this.reset();
    if (this.world.vehicles?.active != null || player.health.current <= 0) { this.reset(); return raw; }
    if (raw.moveTarget) {
      const nav = this.world.infected?.nav;
      const cell = nav?.nearestCell(raw.moveTarget.x, raw.moveTarget.z);
      const point = nav ? nav.clear(raw.moveTarget.x, raw.moveTarget.z, survivor.radius) ? [raw.moveTarget.x, raw.moveTarget.z] : cell !== undefined && cell >= 0 ? [nav.x(cell), nav.z(cell)] : this.world.districts?.nav.clamp([raw.moveTarget.x, raw.moveTarget.z]) : this.world.districts?.nav.clamp([raw.moveTarget.x, raw.moveTarget.z]);
      this.moveTarget = point ? { x: point[0], z: point[1] } : { ...raw.moveTarget }; this.attack = null;
    }
    if (raw.attackTarget) { this.attack = { ...raw.attackTarget, started: false }; this.moveTarget = null; }
    if (!this.moveTarget && !this.attack && !raw.pointerGround && !raw.pointerTarget && raw.aimSource !== 'assist') return raw;
    const frame: InputFrame = { ...raw, move: { ...raw.move }, left: { ...raw.left }, right: { ...raw.right } };
    if (raw.pointerGround) frame.left = { down: false, held: false, up: raw.left.up };
    const combat = player.weapons ? this.world.combat : null, attack = this.attack;
    if (!combat) this.attack = null;
    if (attack && combat) {
      const target = this.world.entities.get(attack.id), button = attack.side === 'LEFT' ? frame.left : frame.right;
      // One click approaches and attacks once; holding repeats until released or retargeted.
      if (!target || target.health.current <= 0 || target.hidden || target.infected?.hidden || (attack.started && !button.held)) this.attack = null;
      else {
        const p = player.transform, t = target.transform, dx = t.x - p.x, dz = t.z - p.z, distance = Math.hypot(dx, dz);
        const def = action(combat.runner.loadout.current(attack.side).id), range = def.range * .85;
        frame.aim = { x: distance ? dx / distance : 1, z: distance ? dz / distance : 0 }; frame.aimPoint = { x: t.x, z: t.z };
        frame.selectorSide = attack.side;
        button.down = button.held = false;
        // Approach toward 85 % of the reach but strike as soon as the target is inside 95 % of it: the
        // arrival slowdown plus the bounded locomotion response otherwise creeps for seconds before a swing.
        if (distance > Math.max(range + .08, def.range * .95)) this.walk(frame, t, distance - range);
        else {
          // Stop at range rather than drifting through the target during wind-up.
          frame.navigation = true; frame.move = { x: 0, z: 0 };
          if (!combat.runner.running[attack.side] && combat.runner.loadout.usable(attack.side, this.world.tick)) {
            button.down = true;
          }
        }
      }
    }
    if (raw.pointerTarget && !this.attack) { frame.left.down = frame.left.held = false; frame.right.down = frame.right.held = false; }
    if (this.moveTarget) {
      const distance = Math.hypot(this.moveTarget.x - player.transform.x, this.moveTarget.z - player.transform.z);
      if (distance <= .08) { this.moveTarget = null; frame.navigation = true; frame.move = { x: 0, z: 0 }; }
      else this.walk(frame, this.moveTarget, distance);
    }
    if (raw.aimSource === 'assist' && combat && !this.attack) {
      const p = player.transform, facing = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
      frame.aim = facing; frame.aimPoint = null;
      const side = frame.right.down || frame.right.held ? 'RIGHT' : frame.left.down || frame.left.held ? 'LEFT' : combat.runner.loadout.state.selectedSide;
      combat.assist.facing(p, facing, action(combat.runner.loadout.current(side).id).range);
    }
    return frame;
  }
  private walk(frame: InputFrame, target: Vec2, remaining: number): void {
    const p = this.world.entities.get(1)!.transform, nav = this.world.infected?.nav;
    if (this.world.player) this.world.player.locomotion.navigationGrid = nav ?? null;
    // Leave room for the capsule's acceleration while turning a pulled corner.
    // The player's own route floods the district in 3000-cell slices (< 1 ms/tick even at 4x CPU throttle) and
    // falls back to the closest reachable cell when a click lands in a fenced yard (QA1-02).
    if (nav && !nav.steer(p, target, this.route, survivor.radius + .1, this.waypoint, 3000, true)) {
      // While the route flood is still running (a few ticks at most), head straight for the click; the corner
      // clearance below keeps that from walking into walls. Without a walkable start, reconnect from its centre.
      const cell = nav.nearestCell(p.x, p.z);
      if (cell < 0) { frame.move.x = frame.move.z = 0; return; }
      if (nav.blocked[nav.cell(p.x, p.z)]) { this.waypoint.x = nav.x(cell); this.waypoint.z = nav.z(cell); } else { this.waypoint.x = target.x; this.waypoint.z = target.z; }
    }
    // Arrived as close as the fences allow (fallback route end): stop instead of re-searching every tick.
    const last = this.route.path[this.route.path.length - 1];
    if (nav && last !== undefined && this.route.pathIndex >= this.route.path.length - 1 && nav.nearestCell(target.x, target.z) !== last && Math.hypot(p.x - nav.x(last), p.z - nav.z(last)) < .3) {
      frame.move.x = frame.move.z = 0; if (this.moveTarget === target) this.moveTarget = null; return;
    }
    const destination = nav ? this.waypoint : target, dx = destination.x - p.x, dz = destination.z - p.z, distance = Math.hypot(dx, dz);
    if (distance < .02) { frame.move.x = frame.move.z = 0; return; }
    // Slow near arrival; the controller remains responsible for acceleration and collision.
    frame.navigation = true;
    // Braking profile v = sqrt(2·a·d): full run until the last metre, then a crisp stop. The former
    // proportional gain (v ∝ d) crept toward targets for seconds (QA: click-to-move / held-target lag).
    const left = Math.max(0, (destination.x === target.x && destination.z === target.z ? Math.min(remaining, distance) : Math.max(remaining, distance)) - .03);
    // Brake below the response limit (9 m/s²) and lead by the response lag (~0.17 s at ω = 8) so it stops on the mark.
    const current = this.world.player?.locomotion.velocity, lag = current ? Math.hypot(current.x, current.z) * .17 : 0;
    const speed = Math.min(1, Math.sqrt(2 * 4.5 * Math.max(0, left - lag)) / survivor.speed);
    frame.move.x = dx / distance * speed; frame.move.z = dz / distance * speed;
    // Match the grid's corner clearance before Rapier performs the actual sweep.
    if (nav) {
      const next = { x: p.x, z: p.z }, step = survivor.speed / 60;
      nav.move(next, frame.move.x * step, frame.move.z * step, survivor.radius + .02);
      frame.move.x = (next.x - p.x) / step; frame.move.z = (next.z - p.z) / step;
    }
    // Keep acceleration along the routed step instead of coasting sideways into a corner.
    const velocity = this.world.player?.locomotion.velocity;
    if (velocity) {
      const length = Math.hypot(frame.move.x, frame.move.z);
      const forward = length ? Math.max(0, (velocity.x * frame.move.x + velocity.z * frame.move.z) / length) : 0;
      velocity.x = length ? frame.move.x / length * forward : 0; velocity.z = length ? frame.move.z / length * forward : 0;
    }
  }
}
