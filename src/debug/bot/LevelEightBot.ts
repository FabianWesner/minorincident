import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
/** Shared seeded policy: explore, hold the group together, fight only threats on the route, board the APC. */
export class LevelEightBot {
  finished = false;
  private readonly walker = new Walker();
  constructor(private readonly w: SimWorld, readonly profile = 'complete') {}
  sample(): InputFrame {
    const w = this.w, m = w.missions!, zoo = m.l8!, f = emptyInput(), player = w.entities.get(1)!;
    this.finished = m.state.phase === 'result' || m.state.phase === 'progression';
    if (this.finished || this.profile === 'idle' || player.health.current <= 0) return f;
    const p = player.transform;
    if (w.vehicles!.active !== null) { f.brake = true; return f; }
    const calm = !zoo.state.breachedAt;
    const target = calm ? { x: 24, z: 64 } : zoo.door();
    if (!calm) {
      const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 16 && w.infected!.nav.visible(p, e.transform, 0)).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z));
      const enemy = enemies[0];
      if (enemy && this.profile !== 'evade-only') { f.attackTarget = { id: enemy.id, side: 'RIGHT' }; f.right.held = true; }
      const live = zoo.roster().map(id => w.entities.get(id)).filter(e => e && e.health.current > 0 && !e.infected && e.passengerOf === undefined);
      if (Math.hypot(p.x - target.x, p.z - target.z) > 10 && live.some(e => Math.hypot(e!.transform.x - p.x, e!.transform.z - p.z) > Math.max(12, Math.ceil(live.length / 3) * 1.2 + 5))) return f;
    }
    f.move = this.walker.step(w, target, calm ? 1 : .35, calm ? 'explore' : 'apc') ?? f.move;
    if (!calm && Math.hypot(p.x - target.x, p.z - target.z) < .6) { f.move = { x: 0, z: 0 }; f.interact = true; }
    return f;
  }
}
