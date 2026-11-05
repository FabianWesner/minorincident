import { action } from '../../data/actions/catalog';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';

/** Resolve the active carried action and keyboard aim assist. Locomotion always comes from movement vectors. */
export class ControlIntent {
  /** Military perimeter feedback remains available to direct movement. */
  blockedMove: { point: Vec2; until: number } | null = null;
  private keyboardFacing: Vec2 | null = null;
  constructor(private readonly world: SimWorld) {}
  boundaryFeedback(point: Vec2): void { this.blockedMove = { point: { ...point }, until: this.world.tick + 180 }; }
  snapshot(): null { return null; }
  reset(clearFeedback = true): void { if (clearFeedback) this.blockedMove = null; this.keyboardFacing = null; }
  resolve(raw: InputFrame): InputFrame {
    if (raw.moveTarget || raw.attackTarget || raw.pointerGround || raw.pointerTarget || raw.attackInPlace) {
      raw = { ...raw };
      delete raw.moveTarget; delete raw.attackTarget; delete raw.pointerGround; delete raw.pointerTarget; delete raw.attackInPlace;
    }
    if (raw.cancelMove || raw.interact || raw.left.down || raw.right.down) this.keyboardFacing = null;
    const player = this.world.entities.get(1)!;
    if ((raw.mouseAttack || raw.activeAttack) && player.weapons) {
      const side = player.weapons.selectedSide;
      raw = { ...raw, left: side === 'LEFT' ? { ...raw.left } : { down: false, held: false, up: false }, right: side === 'RIGHT' ? { ...raw.left } : { down: false, held: false, up: false } };
    }
    if (this.world.vehicles?.active != null || player.health.current <= 0) { this.reset(false); return raw; }
    if (raw.aimSource !== 'assist') { this.keyboardFacing = null; return raw; }
    const frame: InputFrame = { ...raw, move: { ...raw.move }, left: { ...raw.left }, right: { ...raw.right } };
    const combat = player.weapons ? this.world.combat : null;
    if (raw.aimSource === 'assist' && combat) {
      const p = player.transform, length = Math.hypot(frame.move.x, frame.move.z);
      const firing = frame.left.down || frame.left.held || frame.right.down || frame.right.held;
      // Idle keyboard fire keeps the facing it started with: the courier turning toward a snapped target must not
      // re-centre the cone on that target (a burst then walked sideways from zombie to zombie, Q-196).
      if (length > 0) this.keyboardFacing = { x: frame.move.x / length, z: frame.move.z / length };
      else if (!firing || !this.keyboardFacing) this.keyboardFacing = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
      const facing = { ...this.keyboardFacing };
      frame.aim = facing; frame.aimPoint = null;
      const side = frame.right.down || frame.right.held ? 'RIGHT' : frame.left.down || frame.left.held ? 'LEFT' : combat.runner.loadout.state.selectedSide;
      const def = action(combat.runner.loadout.current(side).id);
      combat.assist.facing(p, facing, def.range, def.projectile?.speed);
    } else this.keyboardFacing = null;
    return frame;
  }
}
