import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { cure } from '../../levels/L10/district';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';

/** The existing L10 sim policy, available to browser diagnostics through bot.start. */
export class LevelTenBot {
  private readonly walker = new Walker();
  private readonly route = cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route);
  private waypoint = 0;
  private readonly startTick: number;
  finished = false;
  constructor(private readonly w: SimWorld, readonly profile = 'complete') { this.startTick = w.tick; }
  sample(): InputFrame {
    const w = this.w, mission = w.missions!, player = w.entities.get(1)!, f = emptyInput();
    this.finished = mission.state.phase === 'result' || mission.state.phase === 'progression';
    const active = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
    if (this.finished || this.profile === 'idle' || !active || player.health.current <= 0 || mission.state.phase === 'retry') return f;
    const tick = w.tick - this.startTick, p = player.transform;
    const finale = active.id === 'hold' || active.id === 'mega';
    const anchor = mission.def.anchors[active.id === 'mega' ? 'cure-console' : active.anchor];
    const distance = (a: { x: number; z: number }) => Math.hypot(a.x - p.x, a.z - p.z);
    const released = !!mission.state.states['cure-released'];
    while (this.waypoint < this.route.length && distance({ x: this.route[this.waypoint][0], z: this.route[this.waypoint][1] }) < 2) this.waypoint++;
    let goal = anchor;
    if (!released && !finale && this.waypoint < this.route.length && this.route[this.waypoint][0] < anchor.x - 2) goal = { x: this.route[this.waypoint][0], z: this.route[this.waypoint][1], radius: 2 };
    if (released) goal = { x: anchor.x + (tick % 600 < 300 ? 12 : -12), z: anchor.z, radius: 1 };
    f.move = this.walker.step(w, goal, .8, `${active.id}-${this.waypoint}`) ?? f.move;
    f.interact = !released && tick % 60 < 45 && distance(anchor) <= anchor.radius;
    const threats = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && distance(e.transform) < 30 && w.infected!.nav.visible(p, e.transform, 0)).sort((a, b) => distance(a.transform) - distance(b.transform));
    const rack = player.weapons!.RIGHT.rack, index = rack.length - 1, weapon = rack[index]?.id, target = threats[0];
    if (!released && target && this.profile !== 'evade-only' && weapon && (weapon !== 'weapon.fire-axe' || distance(target.transform) < 2.5)) {
      f.selectedSlot = { side: 'RIGHT', index }; f.aimSource = 'keyboard';
      const dx = target.transform.x - p.x, dz = target.transform.z - p.z, d = Math.hypot(dx, dz) || 1;
      f.aim = { x: dx / d, z: dz / d }; f.aimPoint = { x: target.transform.x, z: target.transform.z }; f.right.held = true;
      if (finale && d < 10) {
        const angle = Math.atan2(p.z - anchor.z, p.x - anchor.x) + Math.PI / 4;
        f.move = this.walker.step(w, { x: anchor.x + Math.cos(angle) * 18, z: anchor.z + Math.sin(angle) * 18 }, 1, 'dodge') ?? f.move;
      }
    }
    if (this.profile === 'newbie') { f.move.x *= .8; f.move.z *= .8; }
    return f;
  }
}
