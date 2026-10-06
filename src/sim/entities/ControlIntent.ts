import { action } from '../../data/actions/catalog';
import { survivor } from '../../data/survivor';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';

/** Persistent click commands resolve in the sim, against live target positions and weapon range. */
export class ControlIntent {
  moveTarget: Vec2 | null = null;
  private attack: { id: number; side: 'LEFT' | 'RIGHT'; started: boolean } | null = null;
  constructor(private readonly world: SimWorld) {}
  snapshot() { return this.moveTarget || this.attack ? structuredClone({ moveTarget: this.moveTarget, attack: this.attack }) : null; }
  attacked(side: 'LEFT' | 'RIGHT'): void { if (this.attack?.side === side) this.attack.started = true; }
  reset(): void { this.moveTarget = null; this.attack = null; }
  resolve(raw: InputFrame): InputFrame {
    const player = this.world.entities.get(1)!;
    if (raw.cancelMove || Math.hypot(raw.move.x, raw.move.z) > 0 || raw.interact || (!raw.attackTarget && !raw.pointerGround && (raw.left.down || raw.right.down))) this.reset();
    if (this.world.vehicles?.active != null || player.health.current <= 0) { this.reset(); return raw; }
    if (raw.moveTarget) { this.moveTarget = { ...raw.moveTarget }; this.attack = null; }
    if (raw.attackTarget) { this.attack = { ...raw.attackTarget, started: false }; this.moveTarget = null; }
    if (!this.moveTarget && !this.attack && !raw.pointerGround && raw.aimSource !== 'assist') return raw;
    const frame: InputFrame = { ...raw, move: { ...raw.move }, left: { ...raw.left }, right: { ...raw.right } };
    if (raw.pointerGround) frame.left = { down: false, held: false, up: raw.left.up };
    const combat = this.world.combat, attack = this.attack;
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
        if (distance > range + .08) this.walk(frame, t, distance - range);
        else {
          // Stop at range rather than drifting through the target during wind-up.
          this.world.player?.locomotion.reset(); frame.move = { x: 0, z: 0 };
          if (!combat.runner.running[attack.side] && combat.runner.loadout.usable(attack.side, this.world.tick)) {
            button.down = true;
          }
        }
      }
    }
    if (this.moveTarget) {
      const distance = Math.hypot(this.moveTarget.x - player.transform.x, this.moveTarget.z - player.transform.z);
      if (distance <= .08) { this.moveTarget = null; this.world.player?.locomotion.reset(); }
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
    const p = this.world.entities.get(1)!.transform, dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz);
    // Slow near arrival; the controller remains responsible for acceleration and collision.
    const speed = Math.min(1, remaining / .5, remaining / (survivor.speed / 60));
    frame.move.x = dx / distance * speed; frame.move.z = dz / distance * speed;
  }
}
