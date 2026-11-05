import { resolvePosition } from '../../levels/districts/validate';
import { emptyInput } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
/** E08 movement/combat slice of the complete policy: follow objective anchors on the loaded map.
 * Uses player input, collision and actual combat; it never teleports or completes objectives by cheat. */
export class NpcPatrol {
  readonly frame = emptyInput();
  private readonly path: number[] = [];
  private index = 0;
  private goal = -1;
  private waypoint = 0;
  private readonly targets: { x: number; z: number }[] = [];
  constructor(readonly world: SimWorld) {
    this.frame.left.held = true; this.frame.aim = { x: 1, z: 0 };
    for (const d of world.districts?.districts ?? []) for (const objective of d.gameplay.objectives) { const p = resolvePosition(objective.position, d.layout); this.targets.push({ x: p[0] + d.origin[0], z: p[1] + d.origin[1] }); }
  }
  sample() {
    const player = this.world.entities.get(1)!, nav = this.world.infected!.nav;
    let target: { x: number; z: number } | undefined;
    const mission = this.world.missions;
    if (mission) { const step = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active'); if (step) target = mission.def.anchors[step.anchor]; }
    if (!target) {
      if (this.targets.length) target = this.targets[this.waypoint % this.targets.length];
      else target = player.transform;
    }
    let dx = target.x - player.transform.x, dz = target.z - player.transform.z, d = Math.hypot(dx, dz);
    this.frame.move.x = this.frame.move.z = 0;
    if (d < 1) this.waypoint++;
    else {
      const goal = nav.cell(target.x, target.z);
      if (!nav.visible(player.transform, target, .35)) {
        if (goal !== this.goal || this.index >= this.path.length) { if (!nav.path(nav.cell(player.transform.x, player.transform.z), goal, this.path, 600)) return this.frame; this.goal = goal; this.index = 0; }
        const next = this.path[this.index]; dx = nav.x(next) - player.transform.x; dz = nav.z(next) - player.transform.z; d = Math.hypot(dx, dz); if (d < .2) { this.index++; return this.frame; }
      } else this.goal = -1;
      this.frame.move.x = dx / d; this.frame.move.z = dz / d;
    }
    this.frame.aim!.x = 1; this.frame.aim!.z = 0;
    for (const enemy of this.world.infected!.active) if (enemy.health.current > 0 && Math.hypot(enemy.transform.x - player.transform.x, enemy.transform.z - player.transform.z) < 10) {
      const dx = enemy.transform.x - player.transform.x, dz = enemy.transform.z - player.transform.z, d = Math.hypot(dx, dz) || 1; this.frame.aim!.x = dx / d; this.frame.aim!.z = dz / d; break;
    }
    return this.frame;
  }
}
